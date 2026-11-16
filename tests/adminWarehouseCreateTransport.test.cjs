/* global __dirname */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const test = require('node:test');
const ts = require('typescript');
function load(file, mocks = {}) {
  const filename = path.resolve(__dirname, '../src', file + '.ts'), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths; mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : id === 'expo/fetch' ? require('./support/expoFetch.cjs') : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename); return mod.exports;
}
const dart = load('admin/dartJsonString'), error = load('shared/mobileApiException');
const checked = load('admin/adminProductionRequest', { '../authorizedFetch': {}, '../shared/mobileApiException': error, '../workerControlsApi': {} });
const model = load('admin/adminUsersModel', { '../shared/localization': {}, '../shared/appRoutes': {}, '../workerControlsApi': {}, './dartJsonString': dart });
const adminError = load('admin/adminApiError', { '../shared/mobileApiException': error });
const input = () => ({ warehouse: ' \u0085 Storage \u0085 ', principal_role: 'aparatchi', principal_ref: ' \u0085 ref \u0085 ', display_name: ' Name ' });
function fixture(customParser) {
  let valid = true, refreshes = 0;
  const session = { baseUrl: 'https://server.example', token: 'original' }, guard = () => { if (!valid) throw new Error('expired'); };
  const transport = load('authorizedFetch', { './auth': { activeSessionToken: () => session.token, refreshSession: async () => { refreshes++; session.token = 'fresh'; return true; } } });
  const create = load('admin/warehouseApi', { '../authorizedFetch': transport, '../gscale/gscaleAdminApi': { adminWarehouseFromJson: customParser ?? (value => value) },
    '../shared/mobileApiException': error, './adminApiError': adminError, './dartJsonString': dart, './adminProductionRequest': checked });
  const assign = load('admin/adminWarehouseAssignmentApi', { '../authorizedFetch': transport, './adminApiError': adminError,
    './adminProductionRequest': checked, './adminUsersModel': model, './dartJsonString': dart });
  return { session, guard, create, assign, retire: () => { valid = false; }, refreshes: () => refreshes,
    run: (kind, scoped = true) => kind === 'create' ? create.adminCreateWarehouse(session, input().warehouse, scoped ? guard : undefined)
      : assign.adminAssignWarehouse(session, input(), scoped ? guard : undefined) };
}
test('legacy create and assignment preserve exact two endpoint payloads and Dart trimming', async t => {
  const original = global.fetch; t.after(() => { global.fetch = original; }); const calls = [], f = fixture();
  global.fetch = async (url, init) => { calls.push({ url, payload: JSON.parse(init.body), method: init.method }); return new Response(JSON.stringify({ warehouse: 'Storage', principal_role: 'aparatchi', principal_ref: 'ref', display_name: 'Name' })); };
  await f.run('create', false); await f.run('assign', false);
  assert.deepEqual(calls, [{ url: 'https://server.example/v1/mobile/admin/warehouses', method: 'POST', payload: { warehouse: 'Storage' } },
    { url: 'https://server.example/v1/mobile/admin/warehouses/assignments', method: 'POST', payload: { warehouse: 'Storage', principal_role: 'aparatchi', principal_ref: 'ref', display_name: 'Name' } }]);
  assert.deepEqual(f.assign.adminWarehouseAssignmentFromJson({ warehouse: { name: 'w' }, principal_role: ' OMBORCHI ', principal_ref: [1, null], display_name: 7 }),
    { warehouse: '{name: w}', principal_role: 'werka', principal_ref: '[1, null]', display_name: '7' });
  assert.throws(() => f.assign.adminWarehouseAssignmentFromJson({}), /Unsupported user role/);
});
test('invalid create/assignment inputs and invalid synchronous guards send no request', async t => {
  const original = global.fetch; t.after(() => { global.fetch = original; }); let sends = 0; global.fetch = async () => { sends++; return new Response('{}'); };
  const f = fixture(); await assert.rejects(f.create.adminCreateWarehouse(f.session, ' \u0085 '), /name required/);
  await assert.rejects(f.assign.adminAssignWarehouse(f.session, { ...input(), principal_ref: '\u0085 ' }), /input required/);
  await assert.rejects(f.create.adminCreateWarehouse(f.session, 'name', async () => {}), /Invalid admin guard/);
  await assert.rejects(f.assign.adminAssignWarehouse(f.session, input(), () => true), /Invalid admin guard/);
  f.retire(); await assert.rejects(f.run('create'), /expired/); await assert.rejects(f.run('assign'), /expired/); assert.equal(sends, 0);
});
for (const kind of ['create', 'assign']) {
  for (const status of [302, 401]) test(`${kind} command original guard blocks ${status} continuation`, async t => {
    const original = global.fetch; t.after(() => { global.fetch = original; }); const f = fixture(); let sends = 0;
    global.fetch = async () => { sends++; f.retire(); return new Response('', { status, headers: status === 302 ? { location: '/v1/mobile/next' } : {} }); };
    await assert.rejects(f.run(kind), /expired/); assert.equal(sends, 1);
    // Positional guards preserve the legacy refresh entry; they block its second command dispatch.
    assert.equal(f.refreshes(), status === 401 ? 1 : 0);
  });
  test(`${kind} never follows write redirects; valid 401 token refresh retries original command once`, async t => {
    const original = global.fetch; t.after(() => { global.fetch = original; }); const f = fixture(); let sends = 0;
    global.fetch = async () => { sends++; return new Response('', { status: 302, headers: { location: '/v1/mobile/next' } }); };
    await assert.rejects(f.run(kind)); assert.equal(sends, 1);
    const tokens = [];
    global.fetch = async (_url, init) => { tokens.push(new Headers(init.headers).get('authorization')); return tokens.length === 1 ? new Response('', { status: 401 })
      : new Response(JSON.stringify({ warehouse: 'Storage', principal_role: 'aparatchi', principal_ref: 'ref', display_name: 'Name' })); };
    await f.run(kind); assert.deepEqual(tokens, ['Bearer original', 'Bearer fresh']); assert.equal(f.refreshes(), 1);
  });
  for (const status of [200, 400]) test(`${kind} rechecks original guard after ${status} response body and rejection`, async t => {
    const original = global.fetch; t.after(() => { global.fetch = original; }); const f = fixture();
    global.fetch = async () => { const response = new Response('{}', { status }); response.json = async () => { f.retire(); return {}; }; return response; };
    if (kind === 'create' && status !== 200) await assert.rejects(f.run(kind), /create failed/);
    else await assert.rejects(f.run(kind), /expired/);
    const g = fixture(); global.fetch = async () => { const response = new Response('{}'); response.json = async () => { g.retire(); throw new Error('body'); }; return response; };
    await assert.rejects(g.run(kind), /expired/);
  });
}
test('assignment source backend errors preserve mapped code/message; stale fallback body cannot escape original guard', async t => {
  const original = global.fetch; t.after(() => { global.fetch = original; }); const f = fixture();
  global.fetch = async () => new Response(JSON.stringify({ error: 'warehouse_assignee_not_allowed' }), { status: 403 });
  await assert.rejects(f.run('assign'), problem => problem.code === 'warehouse_assignee_not_allowed' && problem.message === 'Bu rolga ombor biriktirishga server ruxsat bermadi');
  global.fetch = async () => new Response('broken', { status: 400 });
  await assert.rejects(f.run('assign'), problem => problem.code === 'warehouse_assignment_failed' && problem.message === 'Ombor biriktirilmadi (HTTP 400)');
  const g = fixture(); global.fetch = async () => { const response = new Response('broken', { status: 400 }); response.json = async () => { g.retire(); throw new Error('body'); }; return response; };
  await assert.rejects(g.run('assign'), /expired/);
});
test('create checks after model decoding; parser side effects cannot install retired result', async t => {
  const original = global.fetch; t.after(() => { global.fetch = original; }); let f;
  f = fixture(value => { f.retire(); return value; }); global.fetch = async () => new Response('{}'); await assert.rejects(f.run('create'), /expired/);
});
