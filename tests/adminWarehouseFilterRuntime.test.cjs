const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
function load(file, mocks = {}) {
  const filename = path.resolve(__dirname, '../src', file), mod = new Module(filename, module); mod.filename = filename; mod.paths = module.paths;
  mod.require = name => Object.hasOwn(mocks, name) ? mocks[name] : name.startsWith('.') ? {} : require(name);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename); return mod.exports;
}
const { AdminWarehouseFilterStore } = load('admin/adminWarehouseFilterStore.ts', { '../shared/camera/synchronousGuard': load('shared/camera/synchronousGuard.ts'), './dartJsonString': load('admin/dartJsonString.ts') });
const hooks = [], { adminWarehouseFilterRuntime } = load('admin/adminWarehouseFilterRuntime.ts', { '../auth': { registerSessionResetHook: hook => { hooks.push(hook); return () => {}; } } });
function deferred() { let resolve; const promise = new Promise(yes => { resolve = yes; }); return { promise, resolve }; }
const tick = () => new Promise(resolve => setImmediate(resolve));
function storage() { const values = new Map(), calls = []; return { values, calls, async getItem(key) { return values.get(key) ?? null; },
  async setItem(key, value) { calls.push([key, value]); values.set(key, value); }, async removeItem(key) { values.delete(key); } }; }
test('warm selection is shared only by the same storage and read scope; pure stores remain private', async () => {
  const db = storage(), shared = adminWarehouseFilterRuntime(db, 'account-scope');
  const first = new AdminWarehouseFilterStore(db, 'Ref', () => true, shared); await first.saveWarehouse('A');
  const next = new AdminWarehouseFilterStore(db, 'Ref', () => true, adminWarehouseFilterRuntime(db, 'account-scope'));
  assert.equal(next.cachedWarehouse, 'A'); assert.equal(new AdminWarehouseFilterStore(db, 'Ref', () => true).cachedWarehouse, null);
  assert.equal(new AdminWarehouseFilterStore(db, 'Ref', () => true, adminWarehouseFilterRuntime(db, 'changed-permissions')).cachedWarehouse, null);
  const otherStorage = storage(); assert.equal(new AdminWarehouseFilterStore(otherStorage, 'Ref', () => true, adminWarehouseFilterRuntime(otherStorage, 'account-scope')).cachedWarehouse, null);
  assert.equal(hooks.length, 1);
});
test('two original owners share one storage queue, so a slow old profile write cannot overtake the newer selection', async () => {
  const db = storage(), slow = deferred(); let writes = 0;
  db.setItem = async (key, value) => { db.calls.push([key, value]); if (++writes === 1) await slow.promise; db.values.set(key, value); };
  let firstCurrent = true; const first = new AdminWarehouseFilterStore(db, 'Ref', () => firstCurrent, adminWarehouseFilterRuntime(db, 'scope'));
  const old = first.saveWarehouse('Old'); await tick(); assert.equal(db.calls.length, 1);
  const next = new AdminWarehouseFilterStore(db, 'Ref', () => true, adminWarehouseFilterRuntime(db, 'scope')); assert.equal(next.cachedWarehouse, 'Old');
  const latest = next.saveWarehouse('New'); firstCurrent = false; await tick(); assert.equal(db.calls.length, 1);
  slow.resolve(); await Promise.all([old, latest]);
  assert.deepEqual(db.calls.map(row => row[1]), ['Old', 'New', 'New']); assert.equal(db.values.get('admin.warehouses.selected_warehouse.Ref'), 'New'); assert.equal(db.values.get('admin.warehouses.selected_warehouse.default'), 'New');
});
test('auth reset invalidates all warm revisions but preserves the draining per-storage queue for the new owner', async () => {
  const db = storage(), slow = deferred(); let writes = 0;
  db.setItem = async (key, value) => { db.calls.push([key, value]); if (++writes === 1) await slow.promise; db.values.set(key, value); };
  const before = adminWarehouseFilterRuntime(db, 'scope'), first = new AdminWarehouseFilterStore(db, 'Ref', () => true, before);
  const old = first.saveWarehouse('Old'); await tick(); const queuedOld = first.saveWarehouse('Queued old');
  const revision = before.memory.revision; await hooks[0](); assert.ok(before.memory.revision > revision); assert.equal(first.cachedWarehouse, null);
  const after = adminWarehouseFilterRuntime(db, 'scope'); assert.notEqual(after.memory, before.memory); assert.equal(after.queue, before.queue);
  const next = new AdminWarehouseFilterStore(db, 'Ref', () => true, after); assert.equal(next.cachedWarehouse, null);
  const latest = next.saveWarehouse('After reset'); await tick(); assert.deepEqual(db.calls.map(row => row[1]), ['Old']);
  slow.resolve(); await Promise.all([old, queuedOld, latest]);
  assert.deepEqual(db.calls.map(row => row[1]), ['Old', 'After reset', 'After reset']); assert.equal(db.values.get('admin.warehouses.selected_warehouse.Ref'), 'After reset'); assert.equal(db.values.get('admin.warehouses.selected_warehouse.default'), 'After reset');
  assert.equal(adminWarehouseFilterRuntime(db, 'scope').memory.warehouse, 'After reset'); assert.equal(hooks.length, 1);
});
