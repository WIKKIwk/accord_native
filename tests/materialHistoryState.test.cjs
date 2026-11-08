const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const file = path.resolve(__dirname, '../src/material/materialHistoryState.ts'), loaded = new Module(file, module);
loaded.filename = file; loaded.paths = module.paths;
loaded.require = id => id === './materialHistoryPresentation' ? { materialHistoryErrorMessage: () => 'Serverdan ma’lumot olinmadi' } : require(id);
loaded._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, file);
const { MaterialHistoryState } = loaded.exports;
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };

test('latest refresh wins even when older history arrives later', async () => {
  const a = deferred(), b = deferred(); let calls = 0;
  const state = new MaterialHistoryState({ history: () => ++calls === 1 ? a.promise : b.promise, apparatus: async () => [], isCurrent: () => true });
  state.activate(); const first = state.load(), second = state.load(true);
  assert.equal(state.getSnapshot().refreshing, true);
  b.resolve([{ event_id: 'new' }]); await second;
  a.resolve([{ event_id: 'old' }]); await first;
  assert.equal(state.getSnapshot().events[0].event_id, 'new'); assert.equal(state.getSnapshot().refreshing, false);
});

test('catalog independently loads and failure never hides history', async () => {
  const catalog = deferred();
  const state = new MaterialHistoryState({ history: async () => [{ event_id: 'x' }], apparatus: () => catalog.promise, isCurrent: () => true });
  state.activate(); const history = state.load(), apparatus = state.loadCatalog(); await history;
  await state.load(true); // refreshing history must not invalidate the independent catalog
  catalog.resolve([{ id: 'apparatus:a:b', name: 'Bosma' }]); await apparatus;
  assert.equal(state.getSnapshot().events[0].event_id, 'x'); assert.equal(state.getSnapshot().apparatus[0].name, 'Bosma');
  const failing = new MaterialHistoryState({ history: async () => [{ event_id: 'x' }], apparatus: async () => { throw Error('offline'); }, isCurrent: () => true });
  failing.activate(); await Promise.all([failing.load(), failing.loadCatalog()]); assert.equal(failing.getSnapshot().events.length, 1);
});

test('account switch or disposal clears data and ignores in-flight results', async () => {
  const history = deferred(), catalog = deferred(); let current = true;
  const state = new MaterialHistoryState({ history: () => history.promise, apparatus: () => catalog.promise, isCurrent: () => current });
  state.activate(); const a = state.load(), b = state.loadCatalog(); current = false; state.invalidate();
  history.resolve([{ event_id: 'old' }]); catalog.resolve([{ id: 'old' }]); await Promise.all([a, b]);
  assert.deepEqual(state.getSnapshot().events, []); assert.deepEqual(state.getSnapshot().apparatus, []);
  assert.equal(state.getSnapshot().loading, false);
});
