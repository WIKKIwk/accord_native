const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
class ApiError extends Error { constructor(code, message, statusCode) { super(message); this.code = code; this.statusCode = statusCode; } }
const filename = path.resolve(__dirname, '../src/preparation/preparationOrdersWarmStore.ts'), mod = new Module(filename, module);
mod.require = id => id === '../sessionReadScope' ? { sessionReadScope: s => s.scope } : id === '../workerControlsApi' ? { WorkerControlException: ApiError } :
  id === './preparationOrdersApi' ? { preparationOrderListWindowFromJson: raw => { if (raw?.ok !== true) throw Error('bad'); return raw; } } : require(id);
mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ESNext } }).outputText, filename);
const { PreparationOrdersWarmStore } = mod.exports;
const window = (rev = 1, label = 'a') => ({ scope: 'server', epoch: 'e', rev, version: `v${rev}`, apparatus_id: 'apparatus:x:y', apparatus: [],
  rows: [{ id: label }], total: 1, next_cursor: null, search: '' });
function setup(loader) {
  const saved = new Map(), calls = [], session = { scope: 'account-A' };
  const snapshots = { generation: 0, read: async (scope, key) => saved.get(`${scope}:${key}`) ?? null,
    write: async (scope, key, value) => { calls.push(['write', scope, key]); saved.set(`${scope}:${key}`, value); },
    remove: async (scope, key) => { calls.push(['remove', scope, key]); saved.delete(`${scope}:${key}`); } };
  const store = new PreparationOrdersWarmStore({ session: () => session, enabled: () => true, snapshots, loader, selectionLoader: async () => null });
  return { store, snapshots, saved, calls, session };
}
// @v2-test test/preparation_orders_warm_store_test.dart
test('preload and page reads share a single pending request', async () => {
  let release, count = 0; const wait = new Promise(resolve => { release = resolve; });
  const x = setup(async () => { count++; await wait; return window(); });
  const a = x.store.read({ fresh: true }), b = x.store.read({ fresh: true });
  release(); assert.equal((await a).rows[0].id, 'a'); await b; assert.equal(count, 1);
  assert.equal(x.store.peek().rows[0].id, 'a');
});
// @v2-test test/preparation_orders_warm_store_test.dart
test('slow disk restore cannot replace a newer server response', async () => {
  let release; const wait = new Promise(resolve => { release = resolve; });
  const x = setup(async () => window(2, 'new'));
  x.snapshots.read = async () => { await wait; return { schema: 1, search: '', window: { ...window(1, 'old'), ok: true } }; };
  const restore = x.store.restore(); await x.store.read({ fresh: true }); release();
  assert.equal((await restore).rows[0].id, 'new'); assert.equal(x.store.peek().rows[0].id, 'new');
});
// @v2-test test/preparation_orders_warm_store_test.dart
test('confirmed live rows override an earlier HTTP result', async () => {
  let release; const wait = new Promise(resolve => { release = resolve; });
  const x = setup(async () => { await wait; return window(1, 'old'); });
  const pending = x.store.read({ fresh: true }); x.store.remember(window(2, 'new')); release();
  assert.equal((await pending).rows[0].id, 'new'); assert.equal(x.store.peek().rev, 2);
});
// @v2-test test/preparation_orders_warm_store_test.dart
test('an account change discards an in-flight response', async () => {
  let release; const wait = new Promise(resolve => { release = resolve; });
  const x = setup(async () => { await wait; return window(); });
  const pending = x.store.read({ fresh: true }); x.session.scope = 'account-B'; release();
  await assert.rejects(pending, e => e.code === 'session_changed'); assert.equal(x.store.peek(), null);
});
// @v2-test test/preparation_orders_warm_store_test.dart
test('authorization failure withdraws cached labels and saved prefixes', async () => {
  const x = setup(async () => { throw new ApiError('forbidden', 'denied', 403); });
  x.store.remember(window()); assert.ok(x.store.peek());
  await assert.rejects(x.store.read({ fresh: true }), e => e.code === 'forbidden');
  assert.equal(x.store.peek(), null); assert.ok(x.calls.some(call => call[0] === 'remove'));
});
// @v2-test test/preparation_orders_warm_store_test.dart
test('unchanged checkpoints do not repeatedly write the same prefix', () => {
  const x = setup(async () => window()); const first = window(); x.store.remember(first);
  const writes = x.calls.filter(call => call[0] === 'write').length;
  x.store.remember({ ...first, rev: 2 }); assert.equal(x.calls.filter(call => call[0] === 'write').length, writes);
});

test('all-orders cache cannot restore an older machine-scoped snapshot', async () => {
  const x = setup(async () => window());
  x.store.remember(window());
  const all = new PreparationOrdersWarmStore({ session: () => x.session, enabled: () => true, snapshots: x.snapshots,
    cacheNamespace: 'preparation-all-orders-v1', loader: async () => window(2, 'all'), selectionLoader: async () => null });
  assert.equal(await all.restore(), null);
  await all.read({ fresh: true });
  assert.equal(all.peek().rows[0].id, 'all');
  assert.equal(x.store.peek().rows[0].id, 'a');
});
