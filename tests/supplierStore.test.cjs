const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

function load(file, overrides = {}) {
  const filename = path.resolve(__dirname, '../src', `${file}.ts`);
  const mod = new Module(filename, module); mod.filename = filename; mod.paths = module.paths;
  mod.require = name => Object.hasOwn(overrides, name) ? overrides[name] : require(name);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText, filename);
  return mod.exports;
}
const model = load('shared/notification/notificationDetailModel');
const { SupplierRuntimeStore } = load('shared/dispatchRuntimeStores');
const { SupplierStore } = load('supplier/supplierStore', { '../shared/notification/notificationDetailModel': model });
const record = status => ({ id: status, status, sent_qty: 2, accepted_qty: 0, note: '', created_label: '' });
const wait = () => new Promise(resolve => setImmediate(resolve));
function fixture(overrides = {}) {
  const calls = [], session = { profile: { ref: 'S' } }, runtime = new SupplierRuntimeStore();
  const api = {
    supplierSummary: async s => { calls.push(['summary', s]); return { pendingCount: 9, submittedCount: 8, returnedCount: 7 }; },
    supplierHistory: async s => { calls.push(['history', s]); return []; },
    supplierStatusBreakdown: async (s, kind) => { calls.push(['breakdown', s, kind]); return []; },
    supplierStatusDetails: async (s, kind, code) => { calls.push(['detail', s, kind, code]); return []; },
    ...overrides,
  };
  const store = new SupplierStore(session, api, runtime); store.activate();
  return { store, session, runtime, calls };
}

test('history supplies summary until the server summary loads, including runtime mutations', async () => {
  const f = fixture({ supplierHistory: async () => ['pending', 'draft', 'accepted', 'partial', 'rejected', 'cancelled'].map(record) });
  assert.deepEqual(f.store.summary, { pendingCount: 0, submittedCount: 0, returnedCount: 0 });
  await f.store.bootstrapHistory();
  assert.deepEqual(f.store.summary, { pendingCount: 2, submittedCount: 1, returnedCount: 3 });
  f.store.recordCreatedPending();
  assert.deepEqual(f.store.summary, { pendingCount: 3, submittedCount: 1, returnedCount: 3 });
  await f.store.bootstrapSummary();
  assert.deepEqual(f.store.summary, { pendingCount: 10, submittedCount: 8, returnedCount: 7 });
  f.store.dispose();
});

test('bootstrap caches successes, force refreshes, and concurrent calls are not duplicated', async () => {
  let finish, attempts = 0;
  const pending = new Promise(resolve => { finish = resolve; });
  const f = fixture({ supplierHistory: async () => { attempts++; return pending; } });
  const first = f.store.bootstrapHistory(), second = f.store.bootstrapHistory(true);
  assert.equal(f.store.loadingHistory, true);
  assert.equal(attempts, 1);
  finish([record('accepted')]); await Promise.all([first, second]);
  assert.equal(f.store.loadedHistory, true);
  await f.store.bootstrapHistory(); assert.equal(attempts, 1);
  await f.store.bootstrapHistory(true); assert.equal(attempts, 2);
  f.store.dispose();
});

test('errors remain visible without discarding a prior successful result', async () => {
  let failure = false;
  const f = fixture({ supplierHistory: async () => { if (failure) throw Error('offline'); return [record('pending')]; } });
  await f.store.refreshHistory(); failure = true; await f.store.refreshHistory();
  assert.match(String(f.store.historyError), /offline/);
  assert.equal(f.store.loadedHistory, true);
  assert.equal(f.store.historyItems[0].status, 'pending');
  failure = false; await f.store.refreshHistory(); assert.equal(f.store.historyError, null);
  f.store.dispose();
});

test('empty breakdown and detail results are cached, with Dart-trimmed detail keys', async () => {
  const f = fixture();
  let changes = 0; f.store.subscribe(() => changes++);
  const initial = f.store.bootstrapBreakdown('returned');
  assert.equal(f.store.loadingBreakdown('returned'), true);
  assert.equal(changes, 0); // V2 does not notify at breakdown request start.
  await initial; assert.equal(changes, 1);
  await f.store.bootstrapBreakdown('returned');
  assert.equal(f.calls.filter(call => call[0] === 'breakdown').length, 1);
  await f.store.bootstrapDetail('returned', ' \u0085A\u0085 ');
  await f.store.bootstrapDetail('returned', 'A');
  assert.equal(f.calls.filter(call => call[0] === 'detail').length, 1);
  assert.deepEqual(f.calls.at(-1).slice(2), ['returned', ' \u0085A\u0085 ']);
  assert.deepEqual(f.store.detailItems('returned', 'A'), []);
  await f.store.bootstrapDetail('returned', 'A', true);
  assert.equal(f.calls.filter(call => call[0] === 'detail').length, 2);
  f.store.dispose();
});

test('refreshAll starts summary and history in parallel, and clear resets cached state', async () => {
  let summaryDone, historyDone;
  const f = fixture({
    supplierSummary: async () => new Promise(resolve => { summaryDone = resolve; }),
    supplierHistory: async () => new Promise(resolve => { historyDone = resolve; }),
  });
  const all = f.store.refreshAll(); await wait();
  assert.equal(f.store.loadingSummary, true); assert.equal(f.store.loadingHistory, true);
  summaryDone({ pendingCount: 1, submittedCount: 2, returnedCount: 3 }); historyDone([record('accepted')]);
  await all; assert.equal(f.store.loadedSummary, true); assert.equal(f.store.loadedHistory, true);
  f.store.clear();
  assert.equal(f.store.loadedSummary, false); assert.equal(f.store.loadedHistory, false);
  assert.deepEqual(f.store.historyItems, []);
  assert.deepEqual(f.store.summary, { pendingCount: 0, submittedCount: 0, returnedCount: 0 });
  f.store.dispose();
});

test('runtime listener can be reattached after a provider effect cleanup', () => {
  const f = fixture(); f.store.dispose(); f.store.activate();
  let changes = 0; f.store.subscribe(() => changes++);
  f.runtime.recordCreatedPending();
  assert.equal(changes, 1);
  f.store.dispose();
});
