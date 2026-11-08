const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

function loadTs(file, overrides = {}) {
  const filename = path.resolve(__dirname, '../src', file);
  const loaded = new Module(filename, module); loaded.filename = filename; loaded.paths = module.paths;
  loaded.require = name => Object.hasOwn(overrides, name) ? overrides[name] : require(name);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return loaded.exports;
}
const shared = loadTs('shared/dispatchRuntimeStores.ts');
const { CustomerStore } = loadTs('customer/customerStore.ts', { '../shared/dispatchRuntimeStores': shared });
const record = (id, status, date = '2026-01-01 10:00:00') => ({ id, status, sent_qty: 10, accepted_qty: 0, note: '', created_label: date });
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };

function fixture() {
  const calls = [], source = {
    summary: { pendingCount: 20, confirmedCount: 30, rejectedCount: 40 },
    pending: [record('1', 'pending', '2026-01-02 10:00:00')],
    confirmed: [record('2', 'accepted', '2026-01-01 10:00:00')],
    rejected: [record('3', 'rejected', '2026-01-03 10:00:00')],
  };
  const api = {
    customerSummary: async () => { calls.push('summary'); return source.summary; },
    customerStatusDetails: async kind => { calls.push(kind); return source[kind]; },
  };
  const runtime = new shared.CustomerDeliveryRuntimeStore();
  return { calls, source, api, runtime, store: new CustomerStore(api, runtime) };
}

// Source-derived from customer_store.dart; no direct V2 CustomerStore recording was found.
test('bootstrap loads all four requests, snapshots counts, merges history and avoids duplicate bootstrap', async () => {
  const f = fixture(); let notifications = 0; f.store.subscribe(() => notifications++);
  await f.store.bootstrap();
  assert.deepEqual(f.calls, ['summary', 'pending', 'confirmed', 'rejected']);
  assert.equal(f.store.loading, false); assert.equal(f.store.loaded, true); assert.equal(f.store.error, null);
  assert.deepEqual(f.store.summary, { pendingCount: 1, confirmedCount: 1, rejectedCount: 1 });
  assert.deepEqual(f.store.historyItems.map(item => item.id), ['3', '1', '2']);
  assert.deepEqual(f.store.itemsForKind('confirmed').map(item => item.id), ['2']);
  assert.equal(notifications, 5); // loading, three snapshots and final state
  await f.store.bootstrap(); assert.equal(f.calls.length, 4);
  await f.store.bootstrap(true); assert.equal(f.calls.length, 8);
});

test('history deduplicates IDs with the last status list winning', async () => {
  const f = fixture(); f.source.pending = [record('same', 'pending', '2026-01-01')];
  f.source.confirmed = [record('same', 'accepted', '2026-01-02')];
  f.source.rejected = [record('same', 'rejected', '2026-01-03')];
  await f.store.refresh();
  assert.deepEqual(f.store.historyItems.map(item => [item.id, item.status]), [['same', 'rejected']]);
});

test('overlapping refreshes do not issue duplicate reads and a failure waits for every read', async () => {
  const f = fixture(), slow = deferred(), issue = new Error('first error');
  f.api.customerSummary = async () => { f.calls.push('summary'); throw issue; };
  f.api.customerStatusDetails = kind => { f.calls.push(kind); return kind === 'rejected' ? slow.promise : Promise.resolve([]); };
  const first = f.store.refresh();
  await Promise.resolve(); await f.store.bootstrap(true);
  assert.deepEqual(f.calls, ['summary', 'pending', 'confirmed', 'rejected']);
  await Promise.resolve(); await Promise.resolve(); assert.equal(f.store.loading, true);
  slow.resolve([]); await first;
  assert.equal(f.store.loading, false); assert.equal(f.store.loaded, false); assert.equal(f.store.error, issue);
  assert.deepEqual(f.store.historyItems, []);
});

test('later failures keep loaded state and runtime transitions update visible status and counts', async () => {
  const f = fixture(); await f.store.refresh();
  const before = f.source.pending[0], after = { ...before, status: 'partial', accepted_qty: 7 };
  let changed = 0; f.store.subscribe(() => changed++);
  f.store.applyDetailTransition(before, after);
  assert.equal(changed, 1);
  assert.deepEqual(f.store.summary, { pendingCount: 0, confirmedCount: 1, rejectedCount: 2 });
  assert.deepEqual(f.store.pendingItems, []);
  assert.equal(f.store.rejectedItems.some(item => item.id === '1' && item.status === 'partial'), true);
  const issue = new Error('offline'); f.api.customerSummary = async () => { throw issue; };
  await f.store.refresh();
  assert.equal(f.store.loaded, true); assert.equal(f.store.error, issue);
  assert.equal(f.store.historyItems.some(item => item.id === '1' && item.status === 'partial'), true);
});

test('clear resets CustomerStore but does not itself clear the shared runtime store', async () => {
  const f = fixture(); await f.store.refresh(); f.store.applyIncomingRecord(record('incoming', 'pending'));
  f.store.clear();
  assert.equal(f.store.loaded, false); assert.equal(f.store.loading, false); assert.equal(f.store.error, null);
  assert.deepEqual(f.store.historyItems, []);
  assert.equal(f.store.pendingItems.some(item => item.id === 'incoming'), true);
});

test('history and status lists preserve V2 microsecond ordering', async () => {
  const f = fixture();
  f.source.pending = [record('older', 'pending', '2026-01-01T00:00:00.000001Z'),
    record('newer', 'pending', '2026-01-01T00:00:00.000002Z')];
  f.source.confirmed = []; f.source.rejected = [];
  await f.store.refresh();
  assert.deepEqual(f.store.pendingItems.map(item => item.id), ['newer', 'older']);
  assert.deepEqual(f.store.historyItems.map(item => item.id), ['newer', 'older']);
});

test('refresh waits for all requests and keeps the first error by completion time', async () => {
  const f = fixture(), summary = deferred(), pending = deferred(), confirmed = deferred(), rejected = deferred();
  f.api.customerSummary = () => summary.promise;
  f.api.customerStatusDetails = kind => ({ pending, confirmed, rejected })[kind].promise;
  const firstFailure = new Error('pending failed first'), laterFailure = new Error('summary failed later');
  const running = f.store.refresh(); await Promise.resolve();
  pending.reject(firstFailure); await Promise.resolve(); await Promise.resolve();
  summary.reject(laterFailure); confirmed.resolve([]);
  await Promise.resolve(); await Promise.resolve(); assert.equal(f.store.loading, true);
  rejected.resolve([]); await running;
  assert.equal(f.store.error, firstFailure); assert.equal(f.store.loading, false);
});

test('version is stable between changes and dispose detaches the shared runtime listener', async () => {
  const f = fixture(); const initial = f.store.version; let calls = 0;
  f.store.subscribe(() => calls++); await f.store.bootstrap();
  assert.ok(f.store.version > initial); const completed = f.store.version;
  assert.equal(f.store.version, completed); f.store.dispose();
  f.runtime.recordIncoming(record('later', 'pending'));
  assert.equal(f.store.version, completed); assert.equal(calls, 5);
});
