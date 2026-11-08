const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
function load(file, mocks = {}) {
  const filename = path.resolve(__dirname, '../src', file + '.ts'), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths;
  mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return mod.exports;
}
const routes = load('shared/appRoutes'), profileGuard = load('shared/profileSessionGuard');
const adminGuard = load('admin/adminProductionRequest', { '../authorizedFetch': {}, '../shared/mobileApiException': {}, '../workerControlsApi': {} });
function fixture() {
  const session = { baseUrl: 'https://server.example', token: 'token', profile: { role: 'admin', ref: 'me' }, capabilities: ['admin.access'] };
  let current = true, duringRead = () => {}, snapshot = { epoch: 'e', revision: 5, scope: 's', maps: [{ map: { id: 'o' } }] };
  const calls = [];
  const apis = {
    '../auth': { activeSessionToken: value => value.token },
    '../productionOrderPageApi': { adminProductionOrderPage: async (s, q, guard) => { calls.push(['page', s, q]); guard(); duringRead(); guard(); return { epoch: 'e' }; } },
    '../productionOrderDetailApi': { adminProductionOrderDetail: async (s, q, guard) => { calls.push(['detail', s, q]); guard(); duringRead(); guard(); return snapshot; } },
    '../pendingOrderApi': { pendingOrderDetail: async (s, id, guard) => { calls.push(['pending', s, id]); guard(); duringRead(); guard(); return { id, template: { product: 'P' } }; } },
    '../sessionReadScope': { sessionReadScope: value => JSON.stringify([value.baseUrl, value.profile, value.capabilities]) },
    '../shared/appRoutes': routes, '../shared/profileSessionGuard': profileGuard, './adminProductionRequest': adminGuard,
  };
  const api = load('admin/adminWorkMapReader', apis);
  return { session, calls, api, witness: () => current, invalidate: () => { current = false; }, onRead: fn => { duringRead = fn; }, setSnapshot: value => { snapshot = value; } };
}
test('page reader uses captured witness, scope, route permission and guarded existing API', async () => {
  const f = fixture(), read = f.api.adminWorkMapReader(f.session, f.witness);
  assert.equal((await read({ view: 'orders', search: 'x' })).epoch, 'e');
  assert.deepEqual(f.calls[0][2], { view: 'orders', search: 'x' });
  f.session.capabilities = []; await assert.rejects(read({ view: 'orders' }), /session changed/); assert.equal(f.calls.length, 1);
});
test('witness transition during page read cannot publish a result', async () => {
  const f = fixture(), read = f.api.adminWorkMapReader(f.session, f.witness); f.onRead(f.invalidate);
  await assert.rejects(read({ view: 'orders' }), /session changed/);
});
test('order detail hydrates the exact ID and rejects stale epoch or revision', async () => {
  const f = fixture(), read = f.api.adminWorkMapDetailReader(f.session, f.witness);
  const ticket = { kind: 'order', id: 'o', epoch: 'e', revision: 4 };
  assert.equal((await read(ticket)).map.id, 'o'); assert.deepEqual(f.calls[0][2], { apparatus: '', order_id: 'o' });
  f.setSnapshot({ epoch: 'new', revision: 5, scope: 's', maps: [{ map: { id: 'o' } }] }); await assert.rejects(read(ticket), /yangilandi/);
  f.setSnapshot({ epoch: 'e', revision: 3, scope: 's', maps: [{ map: { id: 'o' } }] }); await assert.rejects(read(ticket), /yangilandi/);
});
test('pending detail uses the existing API and never returns after witness invalidation', async () => {
  const f = fixture(), read = f.api.adminWorkMapDetailReader(f.session, f.witness), ticket = { kind: 'pending', id: 'p', epoch: 'e', revision: 4 };
  assert.equal((await read(ticket)).template.product, 'P'); assert.equal(f.calls[0][2], 'p');
  f.onRead(f.invalidate); await assert.rejects(read(ticket), /session changed/);
});
test('async or malformed session witness fails closed before request', async () => {
  const f = fixture(), read = f.api.adminWorkMapReader(f.session, async () => false);
  await assert.rejects(read({ view: 'orders' }), /session changed/); assert.equal(f.calls.length, 0);
});
