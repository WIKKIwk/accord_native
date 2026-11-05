const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const test = require('node:test');
const ts = require('typescript');

const filename = path.resolve(__dirname, '../src/shared/productionSnapshotStore.ts');
const mod = new Module(filename, module); mod.filename = filename; mod.paths = module.paths;
mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
const { ProductionSnapshotStore } = mod.exports;
const sha256 = async value => crypto.createHash('sha256').update(value).digest('hex');
const deferred = () => { let resolve; const promise = new Promise(ok => { resolve = ok; }); return { promise, resolve }; };
function backend() {
  const values = new Map();
  return { values, read: async (id, max) => { const row = values.get(id); return row && row.bytes.length <= max ? row.bytes : null; },
    write: async (id, bytes, savedAtMs) => { values.set(id, { bytes: Uint8Array.from(bytes), savedAtMs }); },
    entries: async () => [...values].map(([id, row]) => ({ id, bytes: row.bytes.length, savedAtMs: row.savedAtMs })),
    remove: async id => { values.delete(id); }, clear: async () => { values.clear(); } };
}
function fixture(options = {}) {
  const disk = backend(); let now = 1000;
  return { disk, store: new ProductionSnapshotStore({ backend: disk, sha256, now: () => now, ...options }), setNow: value => { now = value; } };
}

// @v2-test test/production_snapshot_store_test.dart
test('fresh instances restore exact scoped data and reject corrupt envelopes', async () => {
  const f = fixture(), original = { rows: ['a', 'b'], revision: 3 };
  await f.store.write('server/account', 'queue', original);
  const second = new ProductionSnapshotStore({ backend: f.disk, sha256, now: () => 1000 });
  assert.deepEqual(await second.read('server/account', 'queue'), original);
  assert.equal(await second.read('other/account', 'queue'), null);
  const stored = [...f.disk.values.values()][0]; stored.bytes[15] ^= 1;
  assert.equal(await second.read('server/account', 'queue'), null);
  assert.equal(f.disk.values.size, 0);
});

test('expiry, backwards clocks and oldest-entry limits remove cached data', async () => {
  const f = fixture({ maxAgeMs: 100, maxEntries: 2, maxEntryBytes: 1024, maxTotalBytes: 2048 });
  await f.store.write('scope', 'one', { n: 1 });
  f.setNow(1010); await f.store.write('scope', 'two', { n: 2 });
  f.setNow(1020); await f.store.write('scope', 'three', { n: 3 });
  assert.equal(await f.store.read('scope', 'one'), null);
  assert.deepEqual(await f.store.read('scope', 'two'), { n: 2 });
  f.setNow(1000); assert.equal(await f.store.read('scope', 'three'), null);
  f.setNow(1110); assert.equal(await f.store.read('scope', 'two'), null);
});

test('queued writes capture their input and logout invalidates old generations', async () => {
  const f = fixture(), block = deferred(), started = deferred();
  const originalWrite = f.disk.write;
  f.disk.write = async (...args) => { started.resolve(); await block.promise; return originalWrite(...args); };
  const mutable = { n: 1 }, first = f.store.write('scope', 'first', mutable);
  await started.promise;
  const second = f.store.write('scope', 'second', mutable); mutable.n = 9;
  const captured = f.store.generation, clear = f.store.clear();
  block.resolve(); await Promise.all([first, second, clear]);
  await f.store.writeEncoded('scope', 'late', '{"n":3}', captured);
  assert.equal(f.disk.values.size, 0); assert.equal(await f.store.read('scope', 'second'), null);
  await f.store.write('scope', 'fresh', mutable);
  assert.deepEqual(await f.store.read('scope', 'fresh'), { n: 9 });
});

test('a queued write captures the original object even if it is later changed', async () => {
  const f = fixture(), gate = deferred(), started = deferred();
  const originalEntries = f.disk.entries;
  f.disk.entries = async () => { started.resolve(); await gate.promise; return originalEntries(); };
  const value = { list: [1] }, pending = f.store.write('scope', 'key', value);
  await started.promise; value.list.push(2); gate.resolve(); await pending;
  assert.deepEqual(await f.store.read('scope', 'key'), { list: [1] });
});

test('a failed logout clear quarantines old entries until the next safe save', async () => {
  const f = fixture(); await f.store.write('scope', 'old', { secret: true });
  const realClear = f.disk.clear; f.disk.clear = async () => { throw new Error('disk failure'); };
  await f.store.clear();
  assert.equal(await f.store.read('scope', 'old'), null);
  f.disk.clear = realClear;
  await f.store.write('scope', 'new', { safe: true });
  assert.equal(await f.store.read('scope', 'old'), null);
  assert.deepEqual(await f.store.read('scope', 'new'), { safe: true });
});

test('remove invalidates only its pending write, and exact encoded JSON is retained', async () => {
  const f = fixture(), gate = deferred(), started = deferred(), originalEntries = f.disk.entries;
  f.disk.entries = async () => { started.resolve(); await gate.promise; return originalEntries(); };
  const other = f.store.write('scope', 'other', { keep: 1 });
  await started.promise;
  const removed = f.store.write('scope', 'removed', { lose: 1 });
  const removal = f.store.remove('scope', 'removed'); gate.resolve();
  await Promise.all([other, removed, removal]);
  assert.equal(await f.store.read('scope', 'removed'), null);
  assert.deepEqual(await f.store.read('scope', 'other'), { keep: 1 });
  await f.store.writeEncoded('scope', 'raw', ' { "n" : 1 } ');
  assert.deepEqual(await f.store.read('scope', 'raw'), { n: 1 });
  const raw = [...f.disk.values.values()].map(row => Buffer.from(row.bytes).toString()).find(value => value.includes('"n" : 1'));
  assert.ok(raw.startsWith('{"value": { "n" : 1 } ,\n'));
});

test('invalid limits, identities and oversized or non-object JSON are rejected safely', async () => {
  const disk = backend();
  assert.throws(() => new ProductionSnapshotStore({ backend: disk, sha256, maxEntries: 0 }), /limits/);
  const f = fixture({ maxEntryBytes: 256, maxTotalBytes: 256 });
  await f.store.write('', 'key', { a: 1 }); await f.store.writeEncoded('scope', 'key', '[]');
  await f.store.write('scope', 'large', { value: 'a'.repeat(400) });
  assert.equal(f.disk.values.size, 0);
});
