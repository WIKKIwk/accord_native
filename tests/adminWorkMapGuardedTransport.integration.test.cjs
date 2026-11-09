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
const tick = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => { let resolve; const promise = new Promise(yes => { resolve = yes; }); return { promise, resolve }; };
function fixture() {
  let joins = 0, refreshes = 0, valid = true, join = async () => false;
  const session = { baseUrl: 'https://server.example', token: 'token', profile: { role: 'admin', ref: 'me' }, capabilities: ['admin.access'] };
  const auth = { activeSessionToken: value => value.token, refreshSession: async () => { refreshes++; return false; },
    joinRefreshForGuardedRead: async (...args) => { joins++; return join(...args); } };
  const transport = load('authorizedFetch', { './auth': auth });
  class ControlError extends Error { constructor(code, message) { super(message); this.code = code; } }
  const controls = { WorkerControlException: ControlError, isCanonicalApparatusId: () => true, productionMapResponseError: () => new Error('HTTP') };
  const calculate = { calculateOrderTemplateFromJson: value => value }, snapshot = { decodeCanonicalProductionMapSnapshot: value => value };
  const pending = load('pendingOrderApi', { './authorizedFetch': transport, './workerControlsApi': controls, './workerOpenedOrderEditApi': calculate });
  const page = load('productionOrderPageApi', { './authorizedFetch': transport, './workerControlsApi': controls, './productionMapSnapshot': snapshot,
    './workerQueueModels': {}, './workerClosedOrders': {}, './productionMapAuditApi': {}, './workerOpenedOrderEditApi': calculate,
    './pendingOrderApi': pending, './productionReadSettings': { adminProductionReadIdentityCompression: false } });
  const detail = load('productionOrderDetailApi', { './authorizedFetch': transport, './workerControlsApi': controls,
    './productionMapSnapshot': snapshot, './productionReadSettings': { adminProductionReadIdentityCompression: false } });
  const apparatus = load('apparatusApi', { './authorizedFetch': transport, './workerControlsApi': controls });
  const mobile = load('shared/mobileApiException'), checked = load('admin/adminProductionRequest', { '../authorizedFetch': transport,
    '../shared/mobileApiException': mobile, '../workerControlsApi': controls });
  const dart = load('admin/dartJsonString'), summary = load('admin/adminOrderSummaryApi', { '../workerOpenedOrderEditApi': calculate,
    './adminProductionRequest': checked, './dartJsonString': dart });
  const closed = load('admin/adminClosedOrderDetailApi', { '../workerClosedOrders': {}, './adminProductionRequest': checked });
  const api = load('admin/adminWorkMapReader', { '../auth': auth, '../apparatusApi': apparatus, '../productionOrderPageApi': page,
    '../productionOrderDetailApi': detail, '../pendingOrderApi': pending, '../sessionReadScope': { sessionReadScope: value => JSON.stringify(value.profile) },
    '../shared/appRoutes': { appRoutes: { adminProductionMapOrders: '/map' }, canOpenRoute: () => true }, '../shared/profileSessionGuard': load('shared/profileSessionGuard'),
    '../shared/mobileApiException': mobile, './adminProductionRequest': checked, './adminWorkMapMetadataModel': {}, './adminWorkMapOrderWeight': {},
    './adminOrderSummaryApi': summary, './adminClosedOrderDetailApi': closed, './dartJsonString': dart });
  const witness = () => valid;
  const readers = {
    page: () => api.adminWorkMapReader(session, witness)({ view: 'orders' }),
    catalog: () => api.adminWorkMapCatalogReader(session, witness)(),
    detail: () => api.adminWorkMapDetailReader(session, witness)({ kind: 'order', id: 'o', epoch: 'e', revision: 1 }),
    pending: () => api.adminWorkMapDetailReader(session, witness)({ kind: 'pending', id: 'p', epoch: 'e', revision: 1 }),
    summary: () => api.adminWorkMapSummaryReader(session, witness)('o'),
    closed_unconnected: () => api.adminWorkMapClosedDetailReader(session, witness)('o'),
  };
  return { readers, session, api, witness, onJoin(value) { join = value; }, retire() { valid = false; }, counts: () => ({ joins, refreshes }) };
}
for (const kind of ['page', 'catalog', 'detail', 'pending', 'summary', 'closed_unconnected']) {
  test(`${kind}: retired original witness prevents a same-origin redirect or 401 refresh`, async t => {
    const original = global.fetch; t.after(() => { global.fetch = original; });
    for (const status of [302, 401]) {
      const f = fixture(), response = deferred(); let sends = 0;
      global.fetch = async () => { sends++; return response.promise; };
      const request = f.readers[kind](); await tick(); assert.equal(sends, 1); f.retire();
      response.resolve(new Response('', { status, headers: status === 302 ? { location: '/v1/mobile/next' } : {} }));
      await assert.rejects(request); assert.equal(sends, 1); assert.deepEqual(f.counts(), { joins: 0, refreshes: 0 });
    }
  });
  test(`${kind}: unaided 401 fails closed instead of initiating refresh`, async t => {
    const original = global.fetch; t.after(() => { global.fetch = original; }); const f = fixture(); let sends = 0;
    global.fetch = async () => { sends++; return new Response('', { status: 401 }); };
    await assert.rejects(f.readers[kind](), error => error.code === 'guarded_read_refresh_unavailable');
    assert.equal(sends, 1); assert.deepEqual(f.counts(), { joins: 1, refreshes: 0 });
  });
}

test('actual window generation reaches the transport before a retired redirect hop', async t => {
  const original = global.fetch; t.after(() => { global.fetch = original; });
  const f = fixture(), first = deferred(), second = deferred(), sent = [];
  global.fetch = async url => { sent.push(url); return sent.length === 1 ? first.promise : second.promise; };
  const dart = load('admin/dartJsonString'), current = load('admin/adminWorkMapCurrent');
  const audit = load('admin/adminWorkMapAuditModel', { './dartJsonString': dart }), closed = load('admin/adminWorkMapClosedModel', { './dartJsonString': dart });
  const Controller = load('admin/adminWorkMapController', { './dartJsonString': dart, './adminWorkMapCurrent': current,
    './adminWorkMapAuditModel': audit, './adminWorkMapClosedModel': closed }).AdminWorkMapController;
  const controller = new Controller({ isCurrent: f.witness, request: { view: 'orders' }, read: (request, operation) =>
    f.api.adminWorkMapReader(f.session, () => f.witness() && operation())(request) });
  controller.start(); await tick(); assert.equal(sent.length, 1); controller.configure({ view: 'audit' }); await tick(); assert.equal(sent.length, 2);
  first.resolve(new Response('', { status: 302, headers: { location: '/v1/mobile/next' } })); await tick(); await tick();
  assert.equal(sent.length, 2); controller.dispose(); second.resolve(new Response('', { status: 401 })); await tick(); await tick();
  assert.equal(sent.length, 2); assert.deepEqual(f.counts(), { joins: 0, refreshes: 0 });
});
test('actual workspace catalog generation reaches the transport before a retired redirect hop', async t => {
  const original = global.fetch; t.after(() => { global.fetch = original; }); const f = fixture(), first = deferred(); let sends = 0;
  global.fetch = async () => { sends++; return first.promise; };
  const dart = load('admin/dartJsonString'), current = load('admin/adminWorkMapCurrent');
  const audit = load('admin/adminWorkMapAuditModel', { './dartJsonString': dart }), closed = load('admin/adminWorkMapClosedModel', { './dartJsonString': dart });
  const controller = load('admin/adminWorkMapController', { './dartJsonString': dart, './adminWorkMapCurrent': current,
    './adminWorkMapAuditModel': audit, './adminWorkMapClosedModel': closed });
  const model = load('admin/adminWorkMapMoveModel', { './dartJsonString': dart });
  const move = load('admin/adminWorkMapMoveController', { './adminWorkMapCurrent': current, './adminWorkMapController': controller, './adminWorkMapMoveModel': model });
  const Workspace = load('admin/adminWorkMapWorkspace', { './adminWorkMapCurrent': current, './adminWorkMapController': controller, './adminWorkMapMoveController': move }).AdminWorkMapWorkspace;
  const workspace = new Workspace({ isCurrent: f.witness, read: async () => null,
    readCatalog: operation => f.api.adminWorkMapCatalogReader(f.session, () => f.witness() && operation())(),
    selection: { loadSavedApparatusId: async () => {}, resolveApparatus: () => null } });
  workspace.start(); await tick(); assert.equal(sends, 1); workspace.dispose();
  first.resolve(new Response('', { status: 302, headers: { location: '/v1/mobile/next' } })); await tick(); await tick();
  assert.equal(sends, 1); assert.deepEqual(f.counts(), { joins: 0, refreshes: 0 });
});

for (const kind of ['page', 'catalog', 'detail', 'pending', 'summary', 'closed_unconnected']) {
  test(`${kind}: original witness still governs a joined independent refresh`, async t => {
    const original = global.fetch; t.after(() => { global.fetch = original; }); const f = fixture(), joined = deferred(); let sends = 0;
    f.onJoin(() => joined.promise); global.fetch = async () => { sends++; return new Response('', { status: 401 }); };
    const request = f.readers[kind](); await tick(); await tick(); assert.deepEqual(f.counts(), { joins: 1, refreshes: 0 });
    f.retire(); f.session.token = 'fresh'; joined.resolve(true); await assert.rejects(request); assert.equal(sends, 1);
  });
}
test('catalog can replay after an independently completed refresh while its original witness is live', async t => {
  const original = global.fetch; t.after(() => { global.fetch = original; }); const f = fixture(), headers = [];
  f.onJoin(async session => { session.token = 'fresh'; return true; });
  global.fetch = async (_url, init) => { headers.push(new Headers(init.headers).get('authorization'));
    return headers.length === 1 ? new Response('', { status: 401 }) : new Response('[]', { status: 200 }); };
  assert.deepEqual(await f.readers.catalog(), []); assert.deepEqual(headers, ['Bearer token', 'Bearer fresh']);
  assert.deepEqual(f.counts(), { joins: 1, refreshes: 0 });
});
for (const kind of ['page', 'catalog', 'detail', 'pending', 'summary', 'closed_unconnected']) {
  test(`${kind}: post-body guard rejects account retirement before decode or error publication`, async t => {
    const original = global.fetch; t.after(() => { global.fetch = original; });
    for (const status of [200, 500]) {
      const f = fixture(), body = deferred(); let entered = false, sends = 0;
      global.fetch = async () => {
        sends++; const response = new Response('{}', { status });
        response.json = () => { entered = true; return body.promise; };
        response.text = () => { entered = true; return body.promise.then(value => JSON.stringify(value)); };
        return response;
      };
      const request = f.readers[kind](); await tick(); await tick(); assert.equal(entered, true); f.retire(); body.resolve({});
      await assert.rejects(request); assert.equal(sends, 1); assert.deepEqual(f.counts(), { joins: 0, refreshes: 0 });
    }
  });
}
