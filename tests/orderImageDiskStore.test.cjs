const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
function load(name, mocks = {}) {
  const filename = path.resolve(__dirname, `../src/${name}.ts`);
  const loaded = new Module(filename, module);
  loaded.filename = filename; loaded.paths = module.paths;
  loaded.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return loaded.exports;
}
function fakeFilesystem() {
  const contents = new Map();
  const join = (base, name) => `${typeof base === 'string' ? base : base.uri}/${name}`;
  class Directory {
    constructor(base, name) { this.uri = name ? join(base, name) : base; }
    create() {}
    list() { return [...contents.keys()].filter(uri => uri.startsWith(`${this.uri}/`)).map(uri => new File(uri)); }
  }
  class File {
    constructor(base, name) { this.uri = name ? join(base, name) : base; }
    get name() { return this.uri.split('/').at(-1); }
    get exists() { return contents.has(this.uri); }
    get size() { return contents.get(this.uri)?.length ?? 0; }
    get modificationTime() { return 0; }
    create() { contents.set(this.uri, new Uint8Array()); }
    async write(bytes) { contents.set(this.uri, Uint8Array.from(bytes)); }
    async bytes() { if (!this.exists) throw Error('missing'); return contents.get(this.uri); }
    async move(destination) { contents.set(destination.uri, contents.get(this.uri)); contents.delete(this.uri); this.uri = destination.uri; }
    delete() { if (!contents.delete(this.uri)) throw Error('missing'); }
  }
  return { contents, Directory, File, Paths: { cache: new Directory('cache') } };
}

test('disk budget evicts managed files only and rejects path traversal', async () => {
  const fake = fakeFilesystem();
  const { FileOrderImageDiskStore } = load('orderImageDiskStore', { 'expo-file-system': fake });
  const store = new FileOrderImageDiskStore(3), first = 'a'.repeat(64), second = 'b'.repeat(64);
  fake.contents.set('cache/order-images-v1/unrelated.txt', Uint8Array.from([8]));
  await store.write(first, Uint8Array.from([1, 2]));
  assert.deepEqual(await store.read(first), Uint8Array.from([1, 2]));
  await store.write(second, Uint8Array.from([3, 4]));
  assert.equal(await store.read(first), null);
  assert.deepEqual(await store.read(second), Uint8Array.from([3, 4]));
  await assert.rejects(store.read('../other'), /Invalid image cache key/);
  await store.clear();
  assert.deepEqual([...fake.contents.keys()], ['cache/order-images-v1/unrelated.txt']);
});
