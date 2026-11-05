const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const test = require('node:test');
const ts = require('typescript');

const filename = path.resolve(__dirname, '../src/shared/productionSnapshotWebBackend.ts');
const mod = new Module(filename, module); mod.filename = filename; mod.paths = module.paths;
mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
const { WebProductionSnapshotBackend } = mod.exports;

function indexedDb() {
  const rows = new Map(); let created = false;
  const db = { objectStoreNames: { contains: () => created }, createObjectStore() { created = true; },
    transaction() {
      const transaction = { error: null, objectStore() {
        const request = action => {
          const result = {};
          queueMicrotask(() => { result.result = action(); result.onsuccess?.(); queueMicrotask(() => transaction.oncomplete?.()); });
          return result;
        };
        return { get: key => request(() => rows.get(key)), getAll: () => request(() => [...rows.values()]),
          put: row => request(() => { rows.set(row.id, row); return row.id; }),
          delete: key => request(() => { rows.delete(key); }), clear: () => request(() => { rows.clear(); }) };
      } };
      return transaction;
    } };
  const factory = { open() { const request = { result: db }; queueMicrotask(() => {
    if (!created) request.onupgradeneeded?.(); request.onsuccess?.();
  }); return request; } };
  return { factory, rows };
}

// @v2-test test/production_snapshot_store_test.dart
test('web snapshot backend persists bounded blobs across instances and supports removal', async () => {
  const fake = indexedDb(), first = new WebProductionSnapshotBackend(fake.factory), input = Uint8Array.of(1, 2, 3);
  await first.write('key', input, 12); input[0] = 9;
  const second = new WebProductionSnapshotBackend(fake.factory);
  assert.deepEqual(await second.read('key', 3), Uint8Array.of(1, 2, 3));
  assert.equal(await second.read('key', 2), null);
  assert.deepEqual(await second.entries(), [{ id: 'key', savedAtMs: 12, bytes: 3 }]);
  await second.remove('key'); assert.equal(await second.read('key', 3), null);
  await second.write('another', Uint8Array.of(4), 13); await second.clear();
  assert.deepEqual(await second.entries(), []);
});

test('an unavailable IndexedDB fails without caching the failure forever', async () => {
  const backend = new WebProductionSnapshotBackend(undefined);
  await assert.rejects(backend.entries(), /IndexedDB is unavailable/);
  await assert.rejects(backend.entries(), /IndexedDB is unavailable/);
});
