const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const test = require('node:test');
const ts = require('typescript');

const filename = path.resolve(__dirname, '../src/shared/dispatchRuntimeStores.ts');
const mod = new Module(filename, module); mod.filename = filename; mod.paths = module.paths;
mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
const { CustomerDeliveryRuntimeStore, WerkaRuntimeStore, SupplierRuntimeStore, compareCreatedLabelsDesc } = mod.exports;
const record = (id, status, extra = {}) => ({ id, status, sent_qty: 10, accepted_qty: 0, note: '', created_label: '2026-03-27 10:00:00', ...extra });

// @v2-test test/customer_delivery_runtime_store_test.dart
test('a partial delivery moves from customer pending to rejected', () => {
  const store = new CustomerDeliveryRuntimeStore();
  const before = record('MAT-DN-0001', 'pending'), after = record(before.id, 'partial', { accepted_qty: 7, note: 'partial' });
  store.recordTransition(before, after);
  assert.deepEqual(store.applyStatusList('rejected', []), [after]);
  assert.deepEqual(store.applyStatusList('pending', [before]), []);
  assert.deepEqual(store.applySummary({ pendingCount: 1, confirmedCount: 0, rejectedCount: 0 }),
    { pendingCount: 0, confirmedCount: 0, rejectedCount: 1 });
});

// @v2-test test/werka_runtime_store_test.dart
test('reconciliation removes a pending mutation reflected by the server', () => {
  const store = new WerkaRuntimeStore(), pending = record('MAT-DN-0001', 'pending');
  store.recordCreatedPending(pending);
  const summary = { pendingCount: 1, confirmedCount: 0, returnedCount: 0 };
  assert.equal(store.applySummary(summary).pendingCount, 2);
  store.reconcileWithServer([pending], []);
  assert.equal(store.applySummary(summary).pendingCount, 1);
});

test('snapshots, mutation expiry and clear follow V2 notification state', () => {
  let now = 1000, notices = 0;
  const store = new CustomerDeliveryRuntimeStore(() => now), pending = record('a', 'pending');
  store.subscribe(() => notices++);
  store.setStatusSnapshot('pending', [pending]);
  store.setStatusSnapshot('pending', [{ ...pending }]);
  assert.equal(notices, 1);
  store.recordIncoming(record('b', 'pending'));
  const summary = { pendingCount: 8, confirmedCount: 0, rejectedCount: 0 };
  assert.equal(store.applySummary(summary).pendingCount, 2);
  now += 20_000; assert.equal(store.applySummary(summary).pendingCount, 2);
  now++; assert.equal(store.applySummary(summary).pendingCount, 1);
  store.clear(); assert.equal(store.applySummary(summary).pendingCount, 8);
  assert.equal(notices, 3);
});

test('supplier mutations clamp summary counts and expire after twenty seconds', () => {
  let now = 0; const store = new SupplierRuntimeStore(() => now);
  store.recordCreatedPending(); store.recordUnannouncedDecision('pending', 'accepted');
  const summary = { pendingCount: 0, submittedCount: 0, returnedCount: 0 };
  assert.deepEqual(store.applySummary(summary), { pendingCount: 0, submittedCount: 1, returnedCount: 0 });
  now = 20_001; assert.deepEqual(store.applySummary(summary), summary);
});

test('created labels sort by timestamp, then put unparseable labels last', () => {
  const labels = ['unknown-a', '2026-03-26T04:12:31Z', '2026-03-27 10:00:00', 'unknown-z'];
  assert.deepEqual(labels.sort(compareCreatedLabelsDesc), ['2026-03-27 10:00:00', '2026-03-26T04:12:31Z', 'unknown-z', 'unknown-a']);
  assert.equal(compareCreatedLabelsDesc('2026-01-01T05:00:00+05:00', '2026-01-01T00:00:00Z'), 0);
});
