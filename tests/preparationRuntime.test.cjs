const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

function setup() {
  let session = null, listener, reset, options, prepares = 0, resets = 0;
  class WarmStore {
    constructor(value) { options = value; }
    async prepare() { prepares++; }
    reset() { resets++; }
  }
  const deps = {
    react: { useEffect: fn => fn() },
    'react-native': { AppState: { currentState: 'active', addEventListener: (event, fn) => { listener = fn; } } },
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
  return { api: loaded.exports, setSession: value => { session = value; }, state: () => ({ prepares, resets }),
    options: () => options, lifecycle: state => listener(state), reset: () => reset() };
}

test('warm runtime follows preparation session, lifecycle and reset', async () => {
  const x = setup(), prep = { token: 't', profile: { role: 'tayyorlov_masteri' }, capabilities: ['preparation.access'] };
  x.api.usePreparationRuntime(null); assert.deepEqual(x.state(), { prepares: 0, resets: 1 });
  x.setSession(prep); x.api.usePreparationRuntime(prep);
  assert.equal(x.state().prepares, 1);
  assert.equal(await x.options().selectionLoader(), 'apparatus');
  assert.equal((await x.options().loader({ apparatus: 'a' })).value, prep);
  x.lifecycle('background'); x.api.usePreparationRuntime(prep); assert.equal(x.state().prepares, 1);
  x.lifecycle('active'); assert.equal(x.state().prepares, 2);
  await x.reset(); assert.equal(x.state().resets, 2);
  x.setSession({ ...prep, token: 'test-mode-token' }); x.api.usePreparationRuntime(prep);
  assert.equal(x.state().resets, 3);
});
