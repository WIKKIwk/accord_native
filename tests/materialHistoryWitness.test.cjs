const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
function compile(file, mocks = {}) {
  const filename = path.resolve(__dirname, `../src/${file}.ts`), loaded = new Module(filename, module);
  loaded.filename = filename; loaded.paths = module.paths;
  loaded.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return loaded.exports;
}
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const tick = () => new Promise(resolve => setImmediate(resolve));
function setup(options = {}) {
  const session = { token: 'normal', baseUrl: 'https://example.test', profile: { role: 'material_taminotchi', ref: 'one' },
    capabilities: ['raw_material.assign'], assigned_apparatus: [], assigned_item_groups: [], assigned_warehouses: [] };
  const witness = { session }, listeners = new Set(), resets = new Set(), effects = []; let valid = true, retired = false, state, historyGuard, apparatusGuard, calls = 0;
  const auth = { activeSessionToken: value => value === session ? session.token : null,
    isSessionWitnessCurrent: value => { if (!valid) retired = true; return value === witness && valid && !retired; },
    subscribeSessionWitness: fn => { listeners.add(fn); if (options.invalidateOnSubscribe) valid = false; return () => listeners.delete(fn); },
    registerSessionResetHook: fn => { resets.add(fn); return () => resets.delete(fn); } };
  const scope = compile('sessionReadScope'), routes = compile('shared/appRoutes'), testSession = compile('material/materialTestSession');
  const access = compile('material/materialHistoryAccess', { '../auth': auth, '../shared/appRoutes': routes, './materialTestSession': testSession });
  const Real = compile('material/materialHistoryState', { './materialHistoryPresentation': { materialHistoryErrorMessage: () => 'offline' } }).MaterialHistoryState;
  class State extends Real { constructor(reads) { super(reads); state = this; } }
  const history = deferred(), apparatus = deferred();
  const hook = compile('material/useMaterialHistory', { react: { useMemo: fn => fn(), useEffect: fn => { effects.push(fn); },
    useSyncExternalStore: (_s, get) => get() }, '../auth': auth, '../sessionReadScope': scope,
    '../apparatusApi': { adminApparatus: (_session, opts) => { calls++; apparatusGuard = opts.beforeSend; return apparatus.promise; } },
    './materialHistoryApi': { adminRawMaterialHistory: (_session, _opts, guard) => { calls++; historyGuard = guard; return history.promise; } },
    './materialHistoryAccess': access, './materialHistoryState': { MaterialHistoryState: State } });
  if (options.testToken) session.token = 'test-mode-token';
  const view = hook.useMaterialHistory(session, witness), cleanup = effects[0]();
  return { session, witness, view, state, history, apparatus, calls: () => calls, cleanup, subscriptions: () => listeners.size + resets.size,
    reset: () => Promise.all([...resets].map(fn => fn())), historyGuard: () => historyGuard,
    apparatusGuard: () => apparatusGuard, transition: () => { valid = false; listeners.forEach(fn => fn()); },
    restore: () => { valid = true; listeners.forEach(fn => fn()); } };
}
test('tracked transition clears history and catalog immediately and cannot revive the old witness', async () => {
  const h = setup(); assert.equal(h.view.allowed, true); assert.equal(h.calls(), 2);
  h.history.resolve([{ event_id: 'old' }]); h.apparatus.resolve([{ id: 'one' }]); await tick();
  assert.equal(h.state.getSnapshot().events.length, 1); h.transition();
  assert.deepEqual(h.state.getSnapshot().events, []); assert.deepEqual(h.state.getSnapshot().apparatus, []);
  assert.throws(h.historyGuard(), /Sessiya o‘zgardi/); assert.throws(h.apparatusGuard(), /Sessiya o‘zgardi/);
  h.restore(); await h.state.load(); assert.equal(h.calls(), 2); h.cleanup();
});
test('late history and apparatus responses after transition are ignored', async () => {
  const h = setup(); h.transition(); h.history.resolve([{ event_id: 'old' }]); h.apparatus.resolve([{ id: 'old' }]); await tick();
  assert.deepEqual(h.state.getSnapshot().events, []); assert.deepEqual(h.state.getSnapshot().apparatus, []); h.cleanup();
});
test('subscribe-before-recheck and reserved test token start no reads', () => {
  for (const options of [{ invalidateOnSubscribe: true }, { testToken: true }]) {
    const h = setup(options); assert.equal(h.calls(), 0); assert.deepEqual(h.state.getSnapshot().events, []); h.cleanup();
  }
});
test('active token refresh does not invalidate a same-session history witness', async () => {
  const h = setup(); h.session.token = 'refreshed'; h.historyGuard()(); h.apparatusGuard()();
  h.history.resolve([{ event_id: 'fresh' }]); h.apparatus.resolve([]); await tick();
  assert.equal(h.state.getSnapshot().events[0].event_id, 'fresh'); h.cleanup();
});

test('reset clears loaded history and cleanup unsubscribes and refuses late results and callbacks', async () => {
  const h = setup(); assert.equal(h.subscriptions(), 2);
  h.history.resolve([{ event_id: 'loaded' }]); await tick(); await h.reset();
  assert.deepEqual(h.state.getSnapshot().events, []); h.cleanup(); assert.equal(h.subscriptions(), 0);
  h.apparatus.resolve([{ id: 'late' }]); await tick(); await h.view.reload(); await h.view.refresh();
  assert.deepEqual(h.state.getSnapshot().apparatus, []); assert.equal(h.calls(), 2);
  assert.throws(h.historyGuard(), /Sessiya o‘zgardi/); assert.throws(h.apparatusGuard(), /Sessiya o‘zgardi/);
});
