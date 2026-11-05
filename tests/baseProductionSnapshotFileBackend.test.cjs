const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const test = require('node:test');
const ts = require('typescript');

const values = new Map(); let nextId = 0;
class Directory {
  create() {}
  list() { return [...values.keys()].map(name => new File(this, name)); }
}
class File {
  constructor(_directory, name) { this.name = name; }
  get exists() { return values.has(this.name); }
  get size() { return values.get(this.name).length; }
  create() { if (this.exists) throw Error('exists'); values.set(this.name, new Uint8Array()); }
  async write(bytes) { values.set(this.name, Uint8Array.from(bytes)); }
  async bytes() { if (!this.exists) throw Error('missing'); return Uint8Array.from(values.get(this.name)); }
  async move(destination) {
    if (destination.exists) throw Error('exists');
    values.set(destination.name, values.get(this.name)); values.delete(this.name); this.name = destination.name;
  }
  delete() { if (!values.delete(this.name)) throw Error('missing'); }
}
const filename = path.resolve(__dirname, '../src/shared/productionSnapshotFileBackend.ts');
const mod = new Module(filename, module); mod.filename = filename; mod.paths = module.paths;
mod.require = name => name === 'expo-file-system' ? { Directory, File, Paths: { document: {} } }
  : name === 'expo-crypto' ? { randomUUID: () => `abcd${++nextId}` } : require(name);
mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
const { FileProductionSnapshotBackend } = mod.exports;

// @v2-test test/production_snapshot_store_test.dart
test('file snapshots survive a new backend, replace safely, and clean interrupted writes', async () => {
  values.clear(); values.set('.pending-abcdef', Uint8Array.of(5));
  const id = 'a'.repeat(64), first = new FileProductionSnapshotBackend(new Directory());
  await first.write(id, Uint8Array.of(1, 2), 1000);
  assert.equal(values.has('.pending-abcdef'), false);
  const restarted = new FileProductionSnapshotBackend(new Directory());
  assert.deepEqual(await restarted.read(id, 2), Uint8Array.of(1, 2));
  assert.equal(await restarted.read(id, 1), null);
  await restarted.write(id, Uint8Array.of(3), 1000);
  assert.deepEqual(await restarted.read(id, 2), Uint8Array.of(3));
  assert.deepEqual(await restarted.entries(), [{ id, bytes: 1, savedAtMs: 1000 }]);
  assert.equal(values.size, 1);
  await restarted.remove(id); assert.equal(await restarted.read(id, 2), null);
});

test('interrupted replacement keeps the newer sequence even if the clock moves backwards', async () => {
  values.clear(); const id = 'b'.repeat(64);
  values.set(`${id}.1000.1.snapshot`, Uint8Array.of(1));
  values.set(`${id}.900.2.snapshot`, Uint8Array.of(2));
  const store = new FileProductionSnapshotBackend(new Directory());
  assert.deepEqual(await store.read(id, 4), Uint8Array.of(2));
  assert.deepEqual(await store.entries(), [{ id, bytes: 1, savedAtMs: 900 }]);
  assert.equal(values.size, 1);
  await store.clear(); assert.equal(values.size, 0);
  await assert.rejects(store.remove('../invalid'), /Invalid production snapshot key/);
});
