const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const filename = path.resolve(__dirname, '../src/shared/adminSequenceApparatusStore.ts'), loaded = new Module(filename, module);
loaded.require = id => id === '../auth' ? { currentSession: () => null } : id === '../appPreferences' ? { appPreferences: {} } : require(id);
loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
const { AdminSequenceApparatusStore } = loaded.exports;

test('apparatus preferences fall back to default and save per profile and default', async () => {
  const values = new Map(), storage = { getItem: async key => values.get(key) ?? null, setItem: async (key, value) => { values.set(key, value); } };
  const store = new AdminSequenceApparatusStore(storage, () => ' first ');
  await store.saveApparatus({ id: ' machine-1 ', name: ' Printer ' });
  assert.equal(values.get(store.preferenceKey('first')), 'machine-1');
  assert.equal(values.get(store.preferenceKey('default')), 'machine-1');
  assert.equal(values.get(store.preferenceNameKey('first')), 'Printer');
  store.clearCache();
  assert.equal(await store.loadSavedApparatusId('other'), 'machine-1');
  assert.equal(store.cachedApparatusName, 'Printer');
  assert.deepEqual(store.resolveApparatus([{ id: 'x', name: ' printer ' }]), { id: 'x', name: ' printer ' });
  assert.deepEqual(store.resolveApparatus([{ id: ' machine-1 ', name: 'other' }, { id: 'x', name: 'Printer' }]).id, ' machine-1 ');
});

test('apparatus selection keeps in-memory values if preference access fails', async () => {
  const store = new AdminSequenceApparatusStore({ getItem: async () => { throw Error('storage'); }, setItem: async () => { throw Error('storage'); } }, () => 'ref');
  await store.saveApparatus({ id: 'a', name: 'A' });
  assert.equal(await store.loadSavedApparatusId(), 'a');
  store.clearCache();
  assert.equal(await store.loadSavedApparatusId(), null);
});
