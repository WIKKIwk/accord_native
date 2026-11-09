const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
function compile(relative, mocks = {}) {
  const filename = path.resolve(__dirname, `../src/${relative}.ts`), loaded = new Module(filename, module);
  loaded.filename = filename; loaded.paths = module.paths;
  loaded.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return loaded.exports;
}
function deferred() { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; }
function setup({ change = '', responseId = 'order-a', gate = null } = {}) {
  const session = { token: 'old', baseUrl: 'https://example.test', profile: { role: 'material_taminotchi', ref: 'one' },
    capabilities: ['raw_material.assign'], assigned_apparatus: [], assigned_item_groups: [], assigned_warehouses: [] };
  const witness = { session }, calls = []; let witnessValid = true, live = true, refreshes = 0;
  const auth = { isSessionWitnessCurrent: value => value === witness && witnessValid,
    activeSessionToken: value => value === session ? session.token : null, refreshSession: async () => {
      refreshes++; session.token = change === 'test-token' ? 'test-mode-token' : 'fresh';
      if (change === 'witness') witnessValid = false;
      if (change === 'role') session.profile.role = 'admin';
      if (change === 'capability') session.capabilities = [];
      return true;
    } };
  const authorized = compile('authorizedFetch', { './auth': auth });
  const reader = compile('productionMapReadApi', { './authorizedFetch': authorized,
    './workerControlsApi': { productionMapResponseError: () => Error('load failed') },
    './workerProductionMapSaved': { productionMapSavedFromJson: value => value } });
  const api = compile('material/materialTaskDetailApi', { '../auth': auth, '../productionMapReadApi': reader,
    '../shared/appRoutes': compile('shared/appRoutes'), '../shared/camera/synchronousGuard': compile('shared/camera/synchronousGuard'),
    './materialTestSession': compile('material/materialTestSession') });
  const original = global.fetch;
  global.fetch = async (url, init) => {
    calls.push({ url: String(url), init }); if (gate) await gate.promise;
    if (change && calls.length === 1) return new Response('{}', { status: 401 });
    return new Response(JSON.stringify({ map: { id: responseId, title: 'Order' }, program: {} }), { status: 200 });
  };
  return { session, witness, api, calls, refreshes: () => refreshes, isCurrent: () => live,
    stop: () => { live = false; }, invalidate: () => { witnessValid = false; }, restore: () => { global.fetch = original; } };
}
test('full order uses the real read API and requires the selected order ID', async () => {
  const h = setup(); try {
    const result = await h.api.readMaterialTaskDetail(h.session, h.witness, { id: 'order-a' }, h.isCurrent);
    assert.equal(result.map.id, 'order-a'); assert.equal(h.calls.length, 1);
    const url = new URL(h.calls[0].url); assert.equal(url.pathname, '/v1/mobile/admin/production-maps'); assert.equal(url.searchParams.get('id'), 'order-a');
  } finally { h.restore(); }
});
test('a response for another order cannot be shown', async () => {
  const h = setup({ responseId: 'other' }); try {
    await assert.rejects(h.api.readMaterialTaskDetail(h.session, h.witness, { id: 'order-a' }, h.isCurrent), /Buyurtma mavjud emas/);
  } finally { h.restore(); }
});
for (const change of ['witness', 'role', 'capability', 'test-token']) {
  test(`detail 401 cannot retry after ${change} changes`, async () => {
    const h = setup({ change }); try {
      await assert.rejects(h.api.readMaterialTaskDetail(h.session, h.witness, { id: 'order-a' }, h.isCurrent), /Buyurtma mavjud emas/);
      assert.equal(h.calls.length, 1); assert.equal(h.refreshes(), 1);
    } finally { h.restore(); }
  });
}
test('same-session token refresh may retry and deliver the order', async () => {
  const h = setup({ change: 'refresh' }); try {
    const value = await h.api.readMaterialTaskDetail(h.session, h.witness, { id: 'order-a' }, h.isCurrent);
    assert.equal(value.map.id, 'order-a'); assert.equal(h.calls.length, 2); assert.equal(h.calls[1].init.headers.get('authorization'), 'Bearer fresh');
  } finally { h.restore(); }
});
test('late result after sheet dismissal or scope invalidation never delivers', async () => {
  for (const change of ['dismiss', 'witness']) {
    const gate = deferred(), h = setup({ gate }); try {
      const pending = h.api.readMaterialTaskDetail(h.session, h.witness, { id: 'order-a' }, h.isCurrent); await Promise.resolve();
      if (change === 'dismiss') h.stop(); else h.invalidate(); gate.resolve();
      await assert.rejects(pending, /Buyurtma mavjud emas/); assert.equal(h.calls.length, 1);
    } finally { h.restore(); }
  }
});
test('invalid, asynchronous or reentrant selection guards never send a request', async () => {
  const guards = [() => false, () => 1, () => Promise.resolve(true), () => Promise.reject(Error('async')), () => { throw Error('guard'); }];
  for (const guard of guards) { const h = setup(); try {
    await assert.rejects(h.api.readMaterialTaskDetail(h.session, h.witness, { id: 'order-a' }, guard), /Buyurtma mavjud emas/);
    assert.equal(h.calls.length, 0);
  } finally { h.restore(); } }
  const h = setup(); try {
    await assert.rejects(h.api.readMaterialTaskDetail(h.session, h.witness, { id: 'order-a' }, () => { h.invalidate(); return true; }), /Buyurtma mavjud emas/);
    assert.equal(h.calls.length, 0);
  } finally { h.restore(); }
  await new Promise(resolve => setImmediate(resolve));
});
