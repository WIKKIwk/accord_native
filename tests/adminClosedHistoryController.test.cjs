const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
function load(name, mocks = {}) {
  const filename = path.resolve(__dirname, '../src', name + '.ts'), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths;
  mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : id.startsWith('./') ? load(name.slice(0, name.lastIndexOf('/') + 1) + id.slice(2), mocks)
    : id.startsWith('../') ? load(path.posix.normalize(name.slice(0, name.lastIndexOf('/') + 1) + id), mocks) : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return mod.exports;
}
const profile = load('shared/profileSessionGuard'), { MobileApiException } = load('shared/mobileApiException');
const Controller = load('admin/adminClosedHistoryController', { '../shared/profileSessionGuard': profile, '../shared/mobileApiException': { MobileApiException } }).AdminClosedHistoryController;
const tick = () => new Promise(resolve => setImmediate(resolve));
function deferred() { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
function fixture() {
  let current = true, row = { id: 'o', historyVersion: 'v1' }; const reads = [], events = [];
  const controller = new Controller(row, { isCurrent: () => current, rowIsCurrent: ticket => ticket.id === row.id && ticket.historyVersion === row.historyVersion,
    read: (id, witness) => { const result = deferred(); reads.push({ id, witness, ...result }); return result.promise; } });
  controller.subscribe(() => events.push(controller.getSnapshot()));
  return { controller, reads, events, setCurrent: value => { current = value; }, setRow: value => { row = value; } };
}
const detail = id => ({ order_id: id, history_version: '', logs: [] });
test('Closed history reads only on expansion, then caches a matching response across collapse', async () => {
  const f = fixture(), c = f.controller; assert.equal(c.getSnapshot().expanded, false); assert.equal(f.reads.length, 0);
  c.toggle(); assert.equal(f.reads.length, 1); assert.equal(f.reads[0].id, 'o'); assert.equal(f.reads[0].witness(), true);
  c.toggle(); assert.equal(c.getSnapshot().expanded, false); f.reads[0].resolve(detail('o')); await tick();
  assert.equal(c.getSnapshot().detail.order_id, 'o'); c.toggle(); assert.equal(c.getSnapshot().expanded, true); assert.equal(f.reads.length, 1); c.dispose();
});
test('history version changes retire old results and coalesce a new read after the in-flight request', async () => {
  const f = fixture(), c = f.controller; c.toggle(); f.setRow({ id: 'o', historyVersion: 'v2' }); c.configure({ id: 'o', historyVersion: 'v2' });
  assert.equal(c.getSnapshot().loading, true); assert.equal(c.getSnapshot().detail, null); assert.equal(f.reads[0].witness(), false); assert.equal(f.reads.length, 1);
  f.reads[0].resolve(detail('o')); await tick(); assert.equal(f.reads.length, 2); assert.equal(f.reads[1].witness(), true);
  f.reads[1].resolve(detail('o')); await tick(); assert.equal(c.getSnapshot().ticket.historyVersion, 'v2'); assert.equal(c.getSnapshot().detail.order_id, 'o'); c.dispose();
});
test('only the current account and row version can expose data or trigger another read', async () => {
  for (const change of ['account', 'row']) {
    const f = fixture(), c = f.controller; c.toggle();
    if (change === 'account') f.setCurrent(false); else f.setRow({ id: 'o', historyVersion: 'v2' });
    assert.equal(f.reads[0].witness(), false); assert.equal(c.getSnapshot().detail, null); assert.equal(c.getSnapshot().expanded, false);
    f.reads[0].resolve(detail('o')); await tick(); c.toggle(); assert.equal(f.reads.length, 1); assert.equal(c.getSnapshot().detail, null); c.dispose();
  }
});
test('a completed history is hidden immediately when the account or row version stops matching', async () => {
  for (const change of ['account', 'row']) {
    const f = fixture(), c = f.controller; c.toggle(); f.reads[0].resolve(detail('o')); await tick(); assert.ok(c.getSnapshot().detail);
    if (change === 'account') f.setCurrent(false); else f.setRow({ id: 'o', historyVersion: 'v2' });
    assert.equal(c.getSnapshot().detail, null); assert.equal(c.getSnapshot().expanded, false); c.dispose();
  }
});
test('changing a collapsed row version discards its cache and waits for expansion before reading', async () => {
  const f = fixture(), c = f.controller; c.toggle(); f.reads[0].resolve(detail('o')); await tick(); c.toggle();
  f.setRow({ id: 'o', historyVersion: 'v2' }); c.configure({ id: 'o', historyVersion: 'v2' });
  assert.equal(c.getSnapshot().detail, null); assert.equal(f.reads.length, 1); c.toggle(); assert.equal(f.reads.length, 2); c.dispose();
  f.reads[1].resolve(detail('o')); await tick();
});
test('reopening after invalidation waits visibly for a retired request, then reads again', async () => {
  const f = fixture(), c = f.controller; c.toggle(); c.invalidate(); c.toggle();
  assert.equal(c.getSnapshot().loading, true); assert.equal(f.reads.length, 1); assert.equal(f.reads[0].witness(), false);
  f.reads[0].resolve(detail('o')); await tick(); assert.equal(f.reads.length, 2); assert.equal(c.getSnapshot().loading, true);
  f.reads[1].resolve(detail('o')); await tick(); assert.equal(c.getSnapshot().loading, false); assert.equal(c.getSnapshot().detail.order_id, 'o'); c.dispose();
});
test('failure uses source text, explicit retry works, and another order is never installed', async () => {
  const f = fixture(), c = f.controller; c.toggle(); f.reads[0].reject(new MobileApiException({ code: 'failed', message: 'Server error' })); await tick();
  assert.equal(c.getSnapshot().error, 'Server error'); c.configure({ id: 'o', historyVersion: 'v1' }); assert.equal(f.reads.length, 1);
  c.retry(); assert.equal(f.reads.length, 2);
  f.reads[1].resolve(detail('other')); await tick(); assert.equal(c.getSnapshot().detail, null); assert.equal(c.getSnapshot().error, 'Tarix yuklanmadi');
  c.retry(); f.reads[2].reject(Error('network')); await tick(); assert.equal(c.getSnapshot().error, 'Tarix yuklanmadi'); c.dispose();
});
test('dispose and malformed or asynchronous witnesses cannot publish or start history reads', async () => {
  const f = fixture(); f.controller.toggle(); f.controller.dispose(); assert.equal(f.reads[0].witness(), false); f.reads[0].resolve(detail('o')); await tick();
  assert.equal(f.controller.getSnapshot().detail, null);
  for (const deps of [{ isCurrent: async () => true, rowIsCurrent: () => true }, { isCurrent: () => true, rowIsCurrent: async () => { throw Error('bad'); } }]) {
    let calls = 0; const c = new Controller({ id: 'o', historyVersion: 'v1' }, { ...deps, read: async () => { calls++; return detail('o'); } });
    c.toggle(); assert.equal(calls, 0); assert.equal(c.getSnapshot().expanded, false); c.dispose();
  }
  await tick();
});
test('real Closed reader accepts the composed non-reentrant witness and rejects a late account change', async () => {
  for (const change of [false, true]) {
    const bodies = [], sent = [], transport = { authorizedFetch: async (_session, url, _init, guard) => {
      guard(); sent.push(url); const body = deferred(); bodies.push(body); return { status: 200, json: () => body.promise };
    } };
    const adminGuard = load('admin/adminProductionRequest', { '../authorizedFetch': transport, '../shared/mobileApiException': { MobileApiException },
      '../workerControlsApi': { productionMapResponseError: () => Error('unused') } });
    const closedApi = load('admin/adminClosedOrderDetailApi', { './adminProductionRequest': adminGuard, '../workerClosedOrders': { closedProductionOrderFromJson: value => value } });
    const readers = load('admin/adminWorkMapReader', { '../auth': { activeSessionToken: session => session.token }, '../apparatusApi': {}, '../productionOrderDetailApi': {},
      '../productionOrderPageApi': {}, '../pendingOrderApi': {}, '../sessionReadScope': { sessionReadScope: session => JSON.stringify(session.profile) },
      '../shared/appRoutes': load('shared/appRoutes'), '../shared/profileSessionGuard': profile, '../shared/mobileApiException': { MobileApiException },
      './adminProductionRequest': adminGuard, './adminWorkMapMetadataModel': {}, './adminWorkMapOrderWeight': {}, './dartJsonString': {},
      './adminOrderSummaryApi': {}, './adminClosedOrderDetailApi': closedApi });
    const session = { token: 'token', profile: { role: 'admin', ref: 'me' }, capabilities: ['admin.access'] }; let current = true;
    const c = new Controller({ id: 'o', historyVersion: 'v1' }, { isCurrent: () => current, rowIsCurrent: () => true,
      read: (id, witness) => readers.adminWorkMapClosedDetailReader(session, witness)(id) });
    c.toggle(); await tick(); assert.equal(sent.length, 1); if (change) current = false; bodies[0].resolve(detail('o')); await tick();
    if (change) assert.equal(c.getSnapshot().detail, null); else assert.equal(c.getSnapshot().detail.order_id, 'o'); c.dispose();
  }
});
