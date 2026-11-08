const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
function compile(relative, mocks = {}) {
  const filename = path.resolve(__dirname, `../src/${relative}.ts`), loaded = new Module(filename, module);
  loaded.filename = filename; loaded.paths = module.paths;
  loaded.require = name => Object.hasOwn(mocks, name) ? mocks[name] : require(name);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return loaded.exports;
}
function setup(change) {
  const session = { token: 'old', baseUrl: 'https://example.test', profile: { role: 'material_taminotchi', ref: 'one' },
    capabilities: ['raw_material.assign'], assigned_apparatus: [], assigned_item_groups: ['first'] };
  let active = true, count = 0;
  const auth = { activeSessionToken: s => active && s === session ? session.token : null, refreshSession: async () => {
    session.token = 'fresh';
    if (change === 'role') session.profile.role = 'admin';
    if (change === 'identity') session.profile.ref = 'other';
    if (change === 'permission') session.capabilities = [];
    if (change === 'groups') session.assigned_item_groups = ['other'];
    if (change === 'account') active = false;
    return true;
  } };
  const scope = compile('sessionReadScope'), routes = compile('shared/appRoutes'), initialScope = scope.sessionReadScope(session);
  const authorized = compile('authorizedFetch', { './auth': auth });
  const controls = compile('workerControlsApi', { './authorizedFetch': authorized, './sessionReadScope': scope });
  const dart = compile('shared/dartApparatus', { '../workerControlsApi': controls });
  const api = compile('material/materialHistoryApi', { '../authorizedFetch': authorized, '../shared/mobileApiException': compile('shared/mobileApiException'),
    '../shared/dartApparatus': dart, '../workerControlsApi': controls });
  const oldFetch = global.fetch;
  global.fetch = async () => { count++; return new Response(count === 1 ? '{"error":"expired"}' : '[]',
    { status: count === 1 ? 401 : 200, headers: { 'content-type': 'application/json' } }); };
  const guard = () => { if (!auth.activeSessionToken(session) || scope.sessionReadScope(session) !== initialScope ||
    !routes.canOpenRoute(session, routes.appRoutes.materialHistory)) throw Error('scope changed'); };
  return { session, api, guard, calls: () => count, restore: () => { global.fetch = oldFetch; } };
}
for (const change of ['role', 'identity', 'permission', 'groups', 'account']) {
  test(`history cannot retry its 401 after ${change} changes`, async () => {
    const h = setup(change);
    try { await assert.rejects(h.api.adminRawMaterialHistory(h.session, { limit: 100 }, h.guard)); assert.equal(h.calls(), 1); }
    finally { h.restore(); }
  });
}

test('history with unchanged scope retains its existing 401 retry', async () => {
  const h = setup('none');
  try { assert.deepEqual(await h.api.adminRawMaterialHistory(h.session, { limit: 100 }, h.guard), []); assert.equal(h.calls(), 2); }
  finally { h.restore(); }
});

test('history default call preserves the previous three-argument authorizedFetch signature', async () => {
  let args;
  const auth = { authorizedFetch: async (...value) => { args = value; return { status: 200, json: async () => [] }; } };
  const controls = compile('workerControlsApi', { './authorizedFetch': auth, './sessionReadScope': {} });
  const api = compile('material/materialHistoryApi', { '../authorizedFetch': auth, '../shared/mobileApiException': compile('shared/mobileApiException'),
    '../shared/dartApparatus': compile('shared/dartApparatus', { '../workerControlsApi': controls }), '../workerControlsApi': controls });
  await api.adminRawMaterialHistory({}); assert.equal(args.length, 3);
});

test('history hook guards event and apparatus reads with the individual request lifetime', async () => {
  const scope = compile('sessionReadScope'), routes = compile('shared/appRoutes'); let reads, historyGuard, apparatusGuard;
  class State { constructor(value) { reads = value; } subscribe() {} getSnapshot() { return {}; } }
  const session = { token: 'x', baseUrl: 'https://example.test', profile: { role: 'material_taminotchi', ref: 'one' },
    capabilities: ['raw_material.assign'], assigned_apparatus: [], assigned_item_groups: ['first'] };
  const hook = compile('material/useMaterialHistory', { react: { useMemo: fn => fn(), useEffect() {}, useSyncExternalStore: (_s, get) => get() },
    '../apparatusApi': { adminApparatus: async (_session, options) => { apparatusGuard = options.beforeSend; return []; } },
    '../auth': { activeSessionToken: value => value === session ? value.token : null, registerSessionResetHook: () => () => {} },
    '../sessionReadScope': scope, '../shared/appRoutes': routes,
    './materialHistoryApi': { adminRawMaterialHistory: async (_session, options, guard) => { assert.equal(options.limit, 100); historyGuard = guard; return []; } },
    './materialHistoryState': { MaterialHistoryState: State } });
  let historyCurrent = true, apparatusCurrent = true;
  hook.useMaterialHistory(session); await reads.history(() => historyCurrent && reads.isCurrent());
  await reads.apparatus(() => apparatusCurrent && reads.isCurrent());
  historyGuard(); apparatusGuard(); assert.equal(reads.isCurrent(), true);
  historyCurrent = false; assert.throws(historyGuard, /Sessiya o‘zgardi/); apparatusGuard();
  historyCurrent = true; apparatusCurrent = false; historyGuard(); assert.throws(apparatusGuard, /Sessiya o‘zgardi/);
  apparatusCurrent = true; session.assigned_item_groups = ['other'];
  assert.throws(historyGuard, /Sessiya o‘zgardi/); assert.throws(apparatusGuard, /Sessiya o‘zgardi/); assert.equal(reads.isCurrent(), false);
});

test('disposing an in-flight history prevents its refreshed 401 retry', async () => {
  const h = setup('none'); let release, calls = 0;
  const pendingResponse = new Promise(resolve => { release = resolve; });
  global.fetch = async () => { calls++; return pendingResponse; };
  const { MaterialHistoryState } = compile('material/materialHistoryState', { './materialHistoryPresentation': { materialHistoryErrorMessage: () => 'offline' } });
  const state = new MaterialHistoryState({ history: current => h.api.adminRawMaterialHistory(h.session, { limit: 100 }, () => {
    if (!current()) throw Error('screen disposed');
  }), apparatus: async () => [], isCurrent: () => true });
  try {
    state.activate(); const pending = state.load();
    await new Promise(resolve => setImmediate(resolve)); assert.equal(calls, 1);
    state.dispose(); release(new Response('{"error":"expired"}', { status: 401, headers: { 'content-type': 'application/json' } }));
    await pending; assert.equal(calls, 1); assert.deepEqual(state.getSnapshot().events, []);
  } finally { h.restore(); }
});
