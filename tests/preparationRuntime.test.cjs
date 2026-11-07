const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

function setup(platform) {
  let session = null, listener, reset;
  const stores = [];
  class WarmStore {
    constructor(value) { this.options = value; this.prepares = 0; this.resets = 0; stores.push(this); }
    async prepare() { this.prepares++; }
    reset() { this.resets++; }
  }
  const deps = {
    react: { useEffect: fn => fn() },
    'react-native': { Platform: { OS: platform }, AppState: { currentState: 'active', addEventListener: (event, fn) => { listener = fn; } } },
    '../auth': { currentSession: () => session, activeSessionToken: value => value === session ? value.token : null,
      registerSessionResetHook: fn => { reset = fn; } },
    '../shared/adminSequenceApparatusStore': { adminSequenceApparatusStore: { loadSavedApparatusId: async () => 'apparatus', clearCache: () => {} } },
    '../shared/productionSnapshotRuntime': { productionSnapshotStore: {} },
    './preparationOrdersApi': { preparationOrders: async (value, opts) => ({ value, opts }) },
    './preparationOrdersWarmStore': { PreparationOrdersWarmStore: WarmStore },
  };
  const filename = path.resolve(__dirname, '../src/preparation/preparationRuntime.ts'), loaded = new Module(filename, module);
  loaded.require = id => id in deps ? deps[id] : require(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return { api: loaded.exports, setSession: value => { session = value; }, stores,
    lifecycle: state => listener(state), reset: () => reset() };
}

for (const platform of ['ios', 'android']) test(`${platform}: warm runtime follows preparation session and uses the correct order scope`, async () => {
  const x = setup(platform), prep = { token: 't', profile: { role: 'tayyorlov_masteri' }, capabilities: ['preparation.access'] };
  const [machine, all] = x.stores, active = platform === 'android' ? all : machine;
  x.api.usePreparationRuntime(null); assert.deepEqual(x.stores.map(store => store.resets), [1, 1]);
  x.setSession(prep); x.api.usePreparationRuntime(prep);
  assert.equal(active.prepares, 1);
  assert.equal(await active.options.selectionLoader(), platform === 'android' ? null : 'apparatus');
  const request = await active.options.loader({ apparatus: 'a' });
  assert.equal(request.value, prep);
  assert.equal(!!request.opts.allApparatus, platform === 'android');
  if (platform === 'android') assert.equal(active.options.cacheNamespace, 'preparation-all-orders-v1');
  x.lifecycle('background'); x.api.usePreparationRuntime(prep); assert.equal(active.prepares, 1);
  x.lifecycle('active'); assert.equal(active.prepares, 2);
  await x.reset(); assert.deepEqual(x.stores.map(store => store.resets), [2, 2]);
  x.setSession({ ...prep, token: 'test-mode-token' }); x.api.usePreparationRuntime(prep);
  assert.deepEqual(x.stores.map(store => store.resets), [3, 3]);
});
