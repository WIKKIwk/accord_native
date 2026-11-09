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
const dart = load('admin/dartJsonString');
function fixture() {
  const requests = []; let status = 200, payload = [];
  const api = load('admin/warehouseStockApi', { '../authorizedFetch': { authorizedFetch: async (session, url) => {
    requests.push({ session, url }); return new Response(JSON.stringify(payload), { status });
  } }, './dartJsonString': dart });
  return { ...api, requests, setResponse(value, code = 200) { payload = value; status = code; } };
}
test('warehouse stock item and roll parsers retain fields, defaults and strict types', () => {
  const api = fixture();
  assert.deepEqual(api.adminWarehouseStockItemFromJson({ code: 'A', on_hand_qty: 4.2, package_count: 3.9 }),
    { code: 'A', name: '', uom: '', warehouse: '', order_id: '', item_group: '', on_hand_qty: 4.2, package_count: 3 });
  assert.deepEqual(api.adminWarehouseStockRollFromJson({ stock_id: 'S', qty: 12.5, accepted_at_unix: 123.9 }),
    { stock_id: 'S', warehouse: '', item_code: '', order_id: '', paddon_code: '', progress_batch_id: '', barcode: '', qty: 12.5,
      uom: '', accepted_by_display_name: '', accepted_at_unix: 123 });
  assert.throws(() => api.adminWarehouseStockItemFromJson({ code: 1 }), TypeError);
  assert.throws(() => api.adminWarehouseStockRollFromJson({ qty: '12' }), TypeError);
});
test('item page trims scope, sends optional pagination and returns early for empty warehouse', async () => {
  const api = fixture();
  assert.deepEqual(await api.adminWarehouseItemsPage({}, '\u0085 \u0085'), []);
  assert.equal(api.requests.length, 0);
  api.setResponse([{ code: 'A', package_count: 2 }]);
  assert.equal((await api.adminWarehouseItemsPage({}, ' X Y ', { query: ' A ', limit: 20, offset: 3 }))[0].code, 'A');
  assert.equal(api.requests[0].url, '/v1/mobile/admin/warehouses/items?warehouse=X+Y&q=A&limit=20&offset=3');
  api.setResponse({}, 500); await assert.rejects(api.adminWarehouseItemsPage({}, 'A'), /Admin warehouse items failed/);
});
test('rolls require warehouse and item, preserving trimmed filters and optional pagination', async () => {
  const api = fixture();
  assert.deepEqual(await api.adminWarehouseItemRolls({}, ' A ', ''), []);
  assert.equal(api.requests.length, 0);
  api.setResponse([{ barcode: 'B', qty: 5 }]);
  assert.equal((await api.adminWarehouseItemRolls({}, ' A ', ' X ', { orderId: ' Z ', limit: 5, offset: 2 }))[0].barcode, 'B');
  assert.equal(api.requests[0].url, '/v1/mobile/admin/warehouses/items/rolls?warehouse=A&item_code=X&order_id=Z&limit=5&offset=2');
  api.setResponse({}, 500); await assert.rejects(api.adminWarehouseItemRolls({}, 'A', 'X'), /Admin warehouse rolls failed/);
});
// @v2-test test/admin_warehouses_screen_test.dart, independently passed in the f119 oracle.
test('warehouse item page replays the f119 widget test request', async () => {
  const { contractFetch, recordedSession } = require('./support/contractFetch.cjs');
  const stem = 'f11910bb/admin_warehouses_screen_test', name = 'admin warehouse detailed stock and QR reprint: available';
  const replay = contractFetch(stem, name, { onlyPaths: ['/v1/mobile/admin/warehouses/items'] });
  const session = recordedSession(stem, name);
  const api = load('admin/warehouseStockApi', { '../authorizedFetch': { authorizedFetch: (s, p, init = {}) =>
    replay(new URL(p, s.baseUrl), { ...init, headers: { ...init.headers, Authorization: `Bearer ${s.token}` } }) }, './dartJsonString': dart });
  assert.deepEqual(await api.adminWarehouseItemsPage(session, 'Ulug‘bek ombori'), []);
  replay.assertDone();
});
