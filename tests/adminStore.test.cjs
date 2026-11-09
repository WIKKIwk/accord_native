const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
function load(file, overrides = {}) {
  const filename = path.resolve(__dirname, '../src', file + '.ts');
  const mod = new Module(filename, module); mod.filename = filename; mod.paths = module.paths;
  mod.require = name => Object.hasOwn(overrides, name) ? overrides[name] : require(name);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return mod.exports;
}
const calls = []; let responseBody = {}, responseStatus = 200;
const summary = load('admin/adminSupplierSummary', { '../authorizedFetch': { authorizedFetch: async (session, path) => {
  calls.push({ session, path }); return new Response(JSON.stringify(responseBody), { status: responseStatus });
} } });
const { AdminStore } = load('admin/adminStore', { './adminSupplierSummary': summary });
const value = { total_suppliers: 5, active_suppliers: 3, blocked_suppliers: 2 };
function deferred() { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }

// Source-derived path. The f119 widget test for first-frame timing fails in the V2 oracle and is not used as a specification.
test('summary read uses V2 route, strict counts, default zero and failure message', async () => {
  calls.length = 0; responseStatus = 200; responseBody = value;
  assert.deepEqual(await summary.adminSupplierSummary({ token: 'test' }), value);
  assert.equal(calls[0].path, '/v1/mobile/admin/suppliers/summary');
  assert.deepEqual(summary.adminSupplierSummaryFromJson({}), { total_suppliers: 0, active_suppliers: 0, blocked_suppliers: 0 });
  assert.throws(() => summary.adminSupplierSummaryFromJson({ active_suppliers: 1.5 }), TypeError);
  assert.throws(() => summary.adminSupplierSummaryFromJson(null), TypeError);
  responseStatus = 403; await assert.rejects(summary.adminSupplierSummary({}), /Admin supplier summary failed/);
});

test('bootstrap emits loading once, deduplicates pending reads, and reuses loaded data unless forced', async () => {
  const request = deferred(), calls = [], states = [];
  const store = new AdminStore(() => { calls.push('read'); return request.promise; }, async () => []);
  store.subscribe(() => states.push(store.getSnapshot()));
  const first = store.bootstrapSummary(), second = store.bootstrapSummary();
  assert.equal(calls.length, 1); assert.equal(store.getSnapshot().loadingSummary, true);
  request.resolve(value); await Promise.all([first, second]);
  assert.equal(store.getSnapshot().loadedSummary, true); assert.deepEqual(store.getSnapshot().summary, value);
  assert.equal(states.length, 2); await store.bootstrapSummary(); assert.equal(calls.length, 1);
  await store.bootstrapSummary(true); assert.equal(calls.length, 2);
});

test('failed refresh preserves previously loaded data and exposes error without throwing', async () => {
  let attempt = 0; const failure = new Error('failed');
  const store = new AdminStore(async () => { if (++attempt === 1) return value; throw failure; }, async () => []);
  await store.refreshSummary(); await store.refreshSummary();
  assert.deepEqual(store.getSnapshot().summary, value); assert.equal(store.getSnapshot().loadedSummary, true);
  assert.equal(store.getSnapshot().summaryError, failure); assert.equal(store.getSnapshot().loadingSummary, false);
});

test('summary and activity run independently and refreshAll waits for both', async () => {
  const a = deferred(), b = deferred();
  const store = new AdminStore(() => a.promise, () => b.promise);
  const done = store.refreshAll();
  assert.equal(store.getSnapshot().loadingSummary, true); assert.equal(store.getSnapshot().loadingActivity, true);
  a.resolve(value); b.resolve([{ id: 'a' }]); await done;
  assert.equal(store.getSnapshot().loadedSummary, true); assert.equal(store.getSnapshot().loadedActivity, true);
  assert.deepEqual(store.getSnapshot().activityItems, [{ id: 'a' }]);
});

test('clear discards stale responses so a prior account cannot refill its replacement state', async () => {
  const old = deferred(), next = deferred(); let n = 0;
  const store = new AdminStore(() => ++n === 1 ? old.promise : next.promise, async () => []);
  const first = store.refreshSummary(); store.clear(); const second = store.refreshSummary();
  old.resolve(value); await first; assert.equal(store.getSnapshot().loadingSummary, true);
  next.resolve({ total_suppliers: 1, active_suppliers: 1, blocked_suppliers: 0 }); await second;
  assert.equal(store.getSnapshot().summary.total_suppliers, 1); assert.equal(store.getSnapshot().loadingSummary, false);
});
