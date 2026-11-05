const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const test = require('node:test');
const ts = require('typescript');
function load(file, overrides = {}) {
  const filename = path.resolve(__dirname, '../src', file + '.ts');
  const mod = new Module(filename, module); mod.filename = filename; mod.paths = module.paths;
  mod.require = name => Object.hasOwn(overrides, name) ? overrides[name] : require(name);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return mod.exports;
}
const models = load('inventoryModels', { './workerControlsApi': { isCanonicalApparatusId: () => true } });
const query = load('shared/inventoryViewQuery', { '../inventoryModels': models });
const { InventoryViewStore } = load('shared/inventoryViewStore', { './inventoryViewQuery': query });
const asset = ref => ({ kind: 'raw_material', asset_ref: ref, item_name: 'Material', qty: 10, order_assignment: null });
const snapshot = (rows, epoch = 'epoch-1', version = 'v1') => ({ event: 'inventory.snapshot', id: 'window', epoch, revision: 0, version, rows });
const delta = ({ upserts = [], removed = [], order, base = 0, revision = 1 }) => ({ event: 'inventory.delta', id: 'window',
  epoch: 'epoch-1', base_revision: base, revision, version: `v${revision + 1}`, upserts, removed, order });
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
function fixture(options = {}) {
  const sockets = [], versions = []; let reads = 0, scope = 'account-a', token = 'token';
  const store = new InventoryViewStore({ scopeReader: () => scope, tokenReader: () => token,
    liveEnabled: options.liveEnabled ?? (() => true), firstMessageTimeoutMs: 1000, reconnectDelayMs: () => 3,
    snapshotLoader: options.snapshotLoader ?? (async () => { reads++; return [models.inventoryAssetFromJson(asset('fallback'))]; }),
    liveLoader: (_query, version, handlers) => { const socket = { handlers, active: true }; versions.push(version); sockets.push(socket);
      return () => { socket.active = false; }; } });
  return { store, sockets, versions, reads: () => reads, setScope: value => { scope = value; }, setToken: value => { token = value; } };
}

// @v2-test test/inventory_view_store_test.dart
test('joined leases retain a live window and apply ordered deltas after disposal', async () => {
  const f = fixture();
  try {
    const first = f.store.assets(), joined = f.store.assets();
    assert.equal(f.sockets.length, 1);
    f.sockets[0].handlers.message(snapshot([asset('a'), asset('b')]));
    await Promise.all([first.ready, joined.ready]);
    const original = first.rows[0]; first.dispose(); joined.dispose();
    assert.equal(f.sockets[0].active, true);
    f.sockets[0].handlers.message(delta({ upserts: [asset('c')], removed: ['raw_material:b'], order: ['raw_material:c', 'raw_material:a'] }));
    const again = f.store.assets(); await again.ready;
    assert.deepEqual(again.rows.map(row => row.asset_ref), ['c', 'a']);
    assert.equal(again.rows[1], original); assert.equal(f.reads(), 0); again.dispose();
  } finally { f.store.reset(); }
});

test('duplicate deltas are ignored; gaps fall back once and reconnect', async () => {
  const f = fixture();
  try {
    const lease = f.store.assets(); f.sockets[0].handlers.message(snapshot([asset('a')])); await lease.ready;
    f.sockets[0].handlers.message(delta({ upserts: [asset('b')], order: ['raw_material:a', 'raw_material:b'] }));
    const current = lease.rows;
    f.sockets[0].handlers.message(delta({ order: [] })); assert.equal(lease.rows, current);
    f.sockets[0].handlers.message(delta({ base: 2, revision: 3, order: [] }));
    assert.equal(lease.trusted, false); await sleep(12);
    assert.equal(f.reads(), 1); assert.equal(f.sockets.length, 2);
    f.sockets[1].handlers.message(snapshot([asset('a')], 'epoch-2'));
    assert.equal(lease.trusted, true); lease.dispose();
  } finally { f.store.reset(); }
});

test('resume and token rotation retain the version but reject stale socket events', async () => {
  const f = fixture();
  try {
    const lease = f.store.assets(); f.sockets[0].handlers.message(snapshot([asset('a')])); await lease.ready;
    const original = lease.rows;
    f.store.configure(false); f.store.configure(true);
    assert.deepEqual(f.versions, [null, 'v1']);
    f.sockets[1].handlers.message({ event: 'inventory.ready', id: 'window', epoch: 'epoch-2', revision: 0, version: 'v1' });
    assert.equal(lease.rows, original); assert.equal(lease.trusted, true);
    f.setToken('new-token'); f.store.configure(true);
    f.sockets[1].handlers.message({ event: 'inventory.reset' });
    assert.equal(lease.rows, original); assert.equal(f.versions[2], 'v1');
    f.sockets[2].handlers.message({ event: 'inventory.ready', id: 'window', epoch: 'epoch-3', revision: 0, version: 'v1' });
    assert.equal(lease.trusted, true); lease.dispose();
  } finally { f.store.reset(); }
});

test('scope changes reject late HTTP snapshots and clear old leases', async () => {
  let resolve; const pending = new Promise(done => { resolve = done; });
  const f = fixture({ liveEnabled: () => false, snapshotLoader: () => pending });
  try {
    const old = f.store.assets(); f.setScope('account-b'); f.store.configure(true);
    resolve([models.inventoryAssetFromJson(asset('stale'))]);
    await old.ready; await sleep(0);
    assert.equal(old.rows, null); old.dispose();
  } finally { f.store.reset(); }
});

test('authorization reset clears rows and blocks reuse in the same scope', async () => {
  const f = fixture();
  try {
    const old = f.store.assets(); f.sockets[0].handlers.message(snapshot([asset('a')])); await old.ready;
    f.sockets[0].handlers.message({ event: 'inventory.reset' });
    assert.equal(old.rows, null); assert.match(old.error, /ruxsatlari/);
    const blocked = f.store.assets(); await blocked.ready; assert.match(blocked.error, /ruxsatlari/);
    assert.equal(f.sockets.length, 1); old.dispose(); blocked.dispose();
  } finally { f.store.reset(); }
});


test('the same callback can be owned independently by multiple leases', async () => {
  const f = fixture();
  try {
    const first = f.store.assets(), second = f.store.assets(); let calls = 0;
    const listener = () => { calls++; }; first.addListener(listener); second.addListener(listener);
    f.sockets[0].handlers.message(snapshot([asset('a')])); await first.ready;
    assert.equal(calls, 2); first.dispose();
    f.sockets[0].handlers.message(delta({ order: ['raw_material:a'] }));
    assert.equal(calls, 3); second.dispose();
  } finally { f.store.reset(); }
});
