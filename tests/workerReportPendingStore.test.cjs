const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
function load() {
  const rows = new Map(), filename = path.resolve(__dirname, '../src/workerReportPendingStore.ts'), loaded = new Module(filename, module);
  loaded.filename = filename; loaded.paths = module.paths;
  loaded.require = id => id === 'expo-sqlite/kv-store' ? { __esModule: true, default: { getItem: async key => rows.get(key) ?? null,
    setItem: async (key, value) => { rows.set(key, value); }, removeItem: async key => rows.delete(key) } } : require(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return { store: loaded.exports.workerReportPendingStore, rows };
}
test('report persistence keeps actor/apparatus/action scopes separate and rejects corrupt data', async () => {
  const { store, rows } = load(); await store.set('actor-A:machine:complete', { request_id: 'one', produced_qty: 10 });
  assert.equal((await store.get('actor-A:machine:complete')).produced_qty, 10); assert.equal(await store.get('actor-B:machine:complete'), null);
  assert.equal(await store.get('actor-A:machine:astatka'), null);
  const key = [...rows.keys()][0]; rows.set(key, '[]'); await assert.rejects(store.get('actor-A:machine:complete'));
});
test('acknowledgement of an older request cannot erase a newer retained report', async () => {
  const { store } = load(); await store.set('scope', { request_id: 'old' }); await store.set('scope', { request_id: 'new' });
  await store.set('scope', null, 'old'); assert.equal((await store.get('scope')).request_id, 'new');
  await store.set('scope', null, 'new'); assert.equal(await store.get('scope'), null);
});
