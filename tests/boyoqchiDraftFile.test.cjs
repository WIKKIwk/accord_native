const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
function load(relative, mocks = {}) {
  const filename = path.resolve(__dirname, `../src/${relative}.ts`), loaded = new Module(filename, module);
  loaded.filename = filename; loaded.paths = module.paths;
  loaded.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'),
    { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return loaded.exports;
}
const files = new Map();
class Directory { constructor(parent, name) { this.path = `${parent.path}/${name}`; } create() {} }
class File {
  constructor(directory, name) { this.name = name; this.path = `${directory.path}/${name}`; }
  get exists() { return files.has(this.path); }
  create() { files.set(this.path, ''); }
  write(value) { files.set(this.path, value); }
  async text() { return files.get(this.path); }
  move(destination) { files.set(destination.path, files.get(this.path)); files.delete(this.path); }
  delete() { files.delete(this.path); }
}
const backend = { Directory, File, Paths: { document: { path: '/documents' } } };
const cryptoApi = { CryptoDigestAlgorithm: { SHA256: 'sha256' }, digestStringAsync: async (_, value) =>
  crypto.createHash('sha256').update(value).digest('hex') };
class Store { constructor(storage) { this.storage = storage; } }
const { ReturnedPaintDraftFileStorage } = load('boyoqchi/returnedPaintDraftRuntime', {
  'expo-crypto': cryptoApi, 'expo-file-system': backend, './returnedPaintDraft': { ReturnedPaintDraftStore: Store },
});

test('file adapter separates long account/request scopes, atomically replaces and removes only the target', async () => {
  const store = new ReturnedPaintDraftFileStorage(), a = `boyoqchi:actor:${'id'.repeat(400)}`, b = 'boyoqchi:other:request';
  assert.equal(await store.read(a), null);
  await store.write(a, '{"value":1}');
  await store.write(b, '{"value":2}');
  await store.write(a, '{"value":3}');
  assert.equal(await store.read(a), '{"value":3}');
  assert.equal(await store.read(b), '{"value":2}');
  assert.equal([...files.keys()].some(name => name.endsWith('.tmp')), false);
  await store.remove(a);
  assert.equal(await store.read(a), null);
  assert.equal(await store.read(b), '{"value":2}');
});
