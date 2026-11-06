const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const cache = new Map();
function load(name) {
  const filename = path.resolve(__dirname, '../src/gscale', name);
  if (cache.has(filename)) return cache.get(filename);
  const m = new Module(filename, module); m.filename = filename; m.paths = module.paths;
  m.require = name => name === './gscaleControlLogic' ? {
    hasExactRpsBatchContext: batch => !!batch && !!batch.id.trim() && batch.revision > 0 && !!batch.item_code.trim() && !!batch.warehouse.trim(),
    rpsBatchActionErrorMessage: error => String(error),
  } : require(name);
  m._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  cache.set(filename, m.exports); return m.exports;
}
const { GScaleBatchStateStore } = load('gscaleBatchState.ts');
const batch = (active, revision = 1, last_error = '') => ({ id: 'b', item_code: 'I', warehouse: 'W', active, revision,
  last_error, last_error_at: 'time' });
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };

test('older GET cannot restore a stopped batch or erase a later state', async () => {
  const pending = deferred();
  const store = new GScaleBatchStateStore({ state: () => pending.promise, stop: async () => ({ batch: batch(false, 2) }) });
  const refresh = store.refresh();
  store.apply(batch(false, 2));
  pending.resolve({ batch: batch(true, 1) });
  await refresh;
  assert.equal(store.getSnapshot().batch.active, false); assert.equal(store.getSnapshot().batch.revision, 2);
  store.dispose();
});

test('active batch with a new ERP error is stopped once and retains its error', async () => {
  const calls = [];
  const store = new GScaleBatchStateStore({ state: async () => ({ batch: batch(true) }),
    stop: async (id, revision) => { calls.push([id, revision]); return { batch: batch(false, 3) }; } });
  store.apply(batch(true, 2, 'ERP failed'));
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(calls, [['b', 2]]);
  assert.equal(store.getSnapshot().batch.active, false);
  assert.equal(store.getSnapshot().error, 'ERPNext tasdiqlashda xatolik yuz berdi: ERP failed');
  store.dispose();
});

test('stopping requires confirmed active identity and uses its exact revision', async () => {
  const calls = [];
  const store = new GScaleBatchStateStore({ state: async () => ({ batch: batch(true, 4) }),
    stop: async (id, revision) => { calls.push([id, revision]); return { batch: batch(false, 5) }; } });
  await store.stop();
  assert.match(store.getSnapshot().error, /tasdiqlanmagan/);
  await store.refresh(); await store.stop();
  assert.deepEqual(calls, [['b', 4]]); assert.equal(store.getSnapshot().batch.revision, 5);
  store.dispose();
});
