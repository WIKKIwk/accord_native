const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
function load(file, overrides = {}) {
  const filename = path.resolve(__dirname, '../src', file + '.ts');
  const mod = new Module(filename, module); mod.filename = filename; mod.paths = module.paths;
  mod.require = name => Object.hasOwn(overrides, name) ? overrides[name] : require(name);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return mod.exports;
}
const exception = load('shared/mobileApiException');
const errorApi = load('admin/adminApiError', { '../shared/mobileApiException': exception });
const dart = load('admin/dartJsonString');
const warehouseParser = load('gscale/gscaleAdminApi', { '../authorizedFetch': {}, '../workerControlsApi': {}, '../workerProductionMapSaved': {} });
function fixture() {
  const requests = []; let status = 200, payload = {};
  const api = load('admin/warehouseApi', { '../authorizedFetch': { authorizedFetch: async (session, url, init = {}) => {
    requests.push({ session, url, init }); return new Response(JSON.stringify(payload), { status });
  } }, '../gscale/gscaleAdminApi': warehouseParser, '../shared/mobileApiException': exception, './adminApiError': errorApi, './dartJsonString': dart });
  return { ...api, requests, setResponse(value, code = 200) { payload = value; status = code; } };
}
const session = { token: 'test' };
test('warehouse summary preserves display strings and truncates numeric counts', () => {
  const api = fixture();
  assert.deepEqual(api.adminWarehouseSummaryFromJson({ warehouse: ' A ', product_count: 4.9, reserved_count: -2.9,
    assigned_display_names: [' Bob ', '', '  ', 17, null] }), {
    warehouse: ' A ', product_count: 4, reserved_count: -2, assignment_count: 0, assigned_display_names: [' Bob ', '17', 'null'],
  });
  assert.deepEqual(api.adminWarehouseSummaryFromJson({}), { warehouse: '', product_count: 0, reserved_count: 0,
    assignment_count: 0, assigned_display_names: [] });
  assert.throws(() => api.adminWarehouseSummaryFromJson({ product_count: '4' }), TypeError);
  assert.throws(() => api.adminWarehouseSummaryFromJson({ assigned_display_names: 'bad' }), TypeError);
});
test('warehouse summaries send only nonempty query and positive limit', async () => {
  const api = fixture(); api.setResponse([{ warehouse: 'A', product_count: 2 }]);
  assert.equal((await api.adminWarehouseSummaries(session, { query: ' A B ', limit: 25 }))[0].product_count, 2);
  assert.equal(api.requests[0].url, '/v1/mobile/admin/warehouses/summary?q=A+B&limit=25');
  await api.adminWarehouseSummaries(session, { query: '\u0085 ', limit: 0 });
  assert.equal(api.requests[1].url, '/v1/mobile/admin/warehouses/summary');
  api.setResponse({}, 403); await assert.rejects(api.adminWarehouseSummaries(session), /Admin warehouse summaries failed/);
  api.setResponse({}); await assert.rejects(api.adminWarehouseSummaries(session), TypeError);
});
test('delete sends warehouse and delete-products choice only after validation', async () => {
  const api = fixture();
  await assert.rejects(api.adminDeleteWarehouse(session, '\u0085 \u0085', true), e => e.code === 'warehouse_required' && e.message === 'Ombor tanlanmagan');
  assert.equal(api.requests.length, 0);
  await api.adminDeleteWarehouse(session, ' Warehouse ', false);
  assert.equal(api.requests[0].url, '/v1/mobile/admin/warehouses');
  assert.equal(api.requests[0].init.method, 'DELETE');
  assert.deepEqual(JSON.parse(api.requests[0].init.body), { warehouse: 'Warehouse', delete_products: false });
  api.setResponse({ error: 'warehouse_has_active_reservations' }, 409);
  await assert.rejects(api.adminDeleteWarehouse(session, 'Warehouse', true), e => e.code === 'warehouse_has_active_reservations' &&
    e.statusCode === 409 && e.message === 'warehouse_has_active_reservations');
  assert.deepEqual(JSON.parse(api.requests[1].init.body), { warehouse: 'Warehouse', delete_products: true });
  api.setResponse({ error: 'constructor' }, 409);
  await assert.rejects(api.adminDeleteWarehouse(session, 'Warehouse', false), e => e.code === 'constructor' && e.message === 'constructor');
});
// @v2-test test/admin_warehouses_screen_test.dart, run independently against f119 before recording.
test('warehouse summary replays the available-stock widget test request', async () => {
  const { contractFetch, recordedSession } = require('./support/contractFetch.cjs');
  const stem = 'f11910bb/admin_warehouses_screen_test', name = 'admin warehouse detailed stock and QR reprint: available';
  const replay = contractFetch(stem, name, { onlyPaths: ['/v1/mobile/admin/warehouses/summary'] });
  const session = recordedSession(stem, name);
  const api = load('admin/warehouseApi', { '../authorizedFetch': { authorizedFetch: (s, p, init = {}) =>
    replay(new URL(p, s.baseUrl), { ...init, headers: { ...init.headers, Authorization: `Bearer ${s.token}` } }) },
    '../gscale/gscaleAdminApi': warehouseParser, '../shared/mobileApiException': exception, './adminApiError': errorApi, './dartJsonString': dart });
  assert.deepEqual(await api.adminWarehouseSummaries(session, { limit: 500 }), [{ warehouse: 'Ulug‘bek ombori', product_count: 1,
    reserved_count: 0, assignment_count: 0, assigned_display_names: [] }]);
  replay.assertDone();
});

test('warehouse create reuses the GScale parser and validates the trimmed name', async () => {
  const api = fixture();
  await assert.rejects(api.adminCreateWarehouse(session, '\u0085 \u0085'), /Admin warehouse name required/);
  assert.equal(api.requests.length, 0);
  api.setResponse({ warehouse: 'Production', company: 'Test', is_group: false, parent: 'Root' });
  assert.deepEqual(await api.adminCreateWarehouse(session, ' Production '), { warehouse: 'Production', company: 'Test',
    is_group: false, parent_warehouse: 'Root' });
  assert.equal(api.requests[0].init.method, 'POST');
  assert.deepEqual(JSON.parse(api.requests[0].init.body), { warehouse: 'Production' });
  api.setResponse({}, 500); await assert.rejects(api.adminCreateWarehouse(session, 'Production'), /Admin warehouse create failed/);
});
// Source-derived probe authored locally and executed against f119, not an upstream test.
for (const name of ['warehouse create trims name and reads response', 'warehouse delete preserves product choice']) {
  test(`warehouse mutation replays f119: ${name}`, async () => {
    const { contractFetch, recordedSession } = require('./support/contractFetch.cjs');
    const stem = 'f11910bb/admin_warehouse_mutations_probe_test', replay = contractFetch(stem, name);
    const session = recordedSession(stem, name);
    const api = load('admin/warehouseApi', { '../authorizedFetch': { authorizedFetch: (s, p, init = {}) =>
      replay(new URL(p, s.baseUrl), { ...init, headers: { ...init.headers, Authorization: `Bearer ${s.token}` } }) },
      '../gscale/gscaleAdminApi': warehouseParser, '../shared/mobileApiException': exception, './adminApiError': errorApi, './dartJsonString': dart });
    if (name.startsWith('warehouse create')) {
      assert.deepEqual(await api.adminCreateWarehouse(session, '\u0085 Production \u0085'), { warehouse: 'Production', company: 'Test',
        is_group: false, parent_warehouse: 'Root' });
    } else await api.adminDeleteWarehouse(session, ' Production ', true);
    replay.assertDone();
  });
}
