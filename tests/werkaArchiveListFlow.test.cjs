// Unwired list flow with fake guards and promises only. No account, backend, PDF or route is exercised.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const { testWerkaGuardEvaluator } = require('./support/werkaGuardEvaluator.cjs');
function load(file, cache = new Map()) {
  const filename = [file, `${file}.ts`, path.join(file, 'index.ts')]
    .find(value => fs.existsSync(value) && fs.statSync(value).isFile());
  if (!filename) throw Error(file);
  if (filename.endsWith('.json')) return JSON.parse(fs.readFileSync(filename, 'utf8'));
  if (cache.has(filename)) return cache.get(filename);
  const loaded = new Module(filename); loaded.filename = filename; loaded.paths = require.main.paths;
  cache.set(filename, loaded.exports);
  loaded.require = name => name.startsWith('.') ? load(path.resolve(path.dirname(filename), name), cache) : require(name);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  cache.set(filename, loaded.exports); return loaded.exports;
}
const { WerkaArchiveListFlow } = load(path.resolve(__dirname, '../src/werka/werkaArchiveListFlow.ts'));
function date(year, month, day, hour = 0) {
  const value = new Date(0); value.setHours(hour, 0, 0, 0); value.setFullYear(year, month - 1, day); return value;
}
const ymd = value => value === null ? null : [value.getFullYear(), value.getMonth() + 1, value.getDate()];
const record = id => ({ id, record_type: '', supplier_ref: '', supplier_name: '', item_code: '', item_name: '', uom: 'kg', sent_qty: 1,
  accepted_qty: 0, amount: 0, currency: '', note: '', event_type: '', highlight: '', status: 'pending', created_label: '2024-02-29' });
const response = (...ids) => ({ kind: 'received', period: 'daily', from: date(2024, 2, 29), to: date(2024, 2, 29),
  summary: { recordCount: ids.length, totalsByUOM: [{ uom: 'kg', qty: 2 }] }, items: ids.map(record) });
const defer = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject }; };
function harness(overrides = {}, query = { kind: 'received', period: 'daily', from: null, to: null }) {
  let active = true; const queries = [], snapshots = [];
  const deps = { isCurrent: () => active, evaluateGuard: testWerkaGuardEvaluator,
    load: async input => { queries.push(input); return response(); }, onState: snapshot => snapshots.push(snapshot), ...overrides };
  const flow = new WerkaArchiveListFlow(query, date(2024, 2, 29, 19), deps);
  return { flow, deps, queries, snapshots, invalidate: () => { active = false; } };
}
const tick = () => new Promise(resolve => setImmediate(resolve));

test('start uses source daily defaults exactly once and exposes no PDF or navigation operation', async () => {
  const h = harness(); assert.deepEqual(h.queries, []); assert.equal(h.flow.getSnapshot().filter.calendarOpen, false);
  assert.equal(h.flow.getSnapshot().loading, true); await h.flow.start(); await h.flow.start();
  assert.equal(h.queries.length, 1); assert.deepEqual([h.queries[0].kind, h.queries[0].period, ymd(h.queries[0].from), ymd(h.queries[0].to)],
    ['received', 'daily', [2024, 2, 29], [2024, 2, 29]]);
  assert.equal(h.flow.getSnapshot().loading, false); assert.equal(h.flow.getSnapshot().data.items.length, 0);
  assert.equal(h.flow.downloadPdf, undefined); assert.equal(h.flow.navigate, undefined);
});

test('initial loading/error hide the daily toggle; empty completed data permits it', async () => {
  const pending = defer(), h = harness({ load: () => pending.promise });
  const running = h.flow.start(); h.flow.toggleCalendar(); assert.equal(h.flow.getSnapshot().filter.calendarOpen, false);
  pending.resolve(response()); await running; h.flow.toggleCalendar(); assert.equal(h.flow.getSnapshot().filter.calendarOpen, true);
  const failure = harness({ load: async () => { throw Error('offline'); } }); await failure.flow.start();
  failure.flow.toggleCalendar(); assert.equal(failure.flow.getSnapshot().filter.calendarOpen, false);
  const monthly = harness({}, { kind: 'sent', period: 'monthly', from: null, to: null }); await monthly.flow.start();
  monthly.flow.toggleCalendar(); assert.equal(monthly.flow.getSnapshot().filter.calendarOpen, false);
});

test('a real daily choice closes, normalizes and reloads even for the same selected day', async () => {
  const h = harness(); await h.flow.start(); h.flow.toggleCalendar();
  await h.flow.selectDaily(date(2024, 2, 29, 23));
  assert.equal(h.queries.length, 2); assert.deepEqual([ymd(h.queries[1].from), ymd(h.queries[1].to)], [[2024, 2, 29], [2024, 2, 29]]);
  assert.equal(h.flow.getSnapshot().filter.calendarOpen, false); assert.deepEqual(ymd(h.flow.getSnapshot().filter.from), [2024, 2, 29]);
  await h.flow.selectDaily(date(2024, 3, 1)); assert.equal(h.queries.length, 2);
  h.flow.toggleCalendar(); await h.flow.selectDaily(new Date(NaN)); assert.equal(h.queries.length, 2);
});

test('newer date choices fence old results and preserve prior data until the latest response', async () => {
  const pending = []; let count = 0;
  const h = harness({ load: query => { h.queries.push(query); if (++count === 1) return Promise.resolve(response('old'));
    const next = defer(); pending.push(next); return next.promise; } });
  await h.flow.start(); h.flow.toggleCalendar(); const first = h.flow.selectDaily(date(2024, 3, 1));
  assert.equal(h.flow.getSnapshot().loading, true); assert.equal(h.flow.getSnapshot().data.items[0].id, 'old');
  h.flow.toggleCalendar(); const second = h.flow.selectDaily(date(2024, 3, 2));
  assert.deepEqual(h.queries.slice(1).map(query => ymd(query.from)), [[2024, 3, 1], [2024, 3, 2]]);
  pending[1].resolve(response('new')); await second; pending[0].reject(Error('stale')); await first;
  assert.equal(h.flow.getSnapshot().data.items[0].id, 'new'); assert.equal(h.flow.getSnapshot().error, null);
  assert.equal(h.flow.getSnapshot().loading, false); assert.deepEqual(ymd(h.flow.getSnapshot().filter.from), [2024, 3, 2]);
});

test('retained data remains visible after a refresh error; a new refresh clears that error', async () => {
  const pending = defer(), failure = Error('offline'); let count = 0;
  const h = harness({ load: async () => ++count === 1 ? response('old') : count === 2 ? Promise.reject(failure) : pending.promise });
  await h.flow.start(); await h.flow.refresh(); assert.equal(h.flow.getSnapshot().error, failure);
  assert.equal(h.flow.getSnapshot().data.items[0].id, 'old'); const retry = h.flow.refresh();
  assert.equal(h.flow.getSnapshot().error, null); assert.equal(h.flow.getSnapshot().loading, true);
  pending.resolve(response('fresh')); await retry; assert.equal(h.flow.getSnapshot().data.items[0].id, 'fresh');
});

test('account invalidation and disposal suppress late data without claiming the sent read was canceled', async () => {
  for (const action of ['invalidate', 'dispose']) {
    const pending = defer(); let sends = 0;
    const h = harness({ load: () => { sends++; return pending.promise; } }); const running = h.flow.start(), before = h.snapshots.length;
    if (action === 'invalidate') h.invalidate(); else h.flow.dispose();
    pending.resolve(response('late')); await running;
    assert.equal(sends, 1); assert.equal(h.snapshots.length, before); assert.equal(h.flow.getSnapshot(), null);
    await h.flow.refresh(); await h.flow.selectDaily(date(2024, 3, 1)); assert.equal(sends, 1);
  }
});

test('account invalidation during response projection suppresses publication', async () => {
  let active = true; const value = response('one'), records = value.items;
  Object.defineProperty(value, 'items', { get() { active = false; return records; } });
  const h = harness({ isCurrent: () => active, load: async () => value });
  await h.flow.start(); assert.equal(h.flow.getSnapshot(), null);
  assert.equal(h.snapshots.some(snapshot => snapshot.data !== null), false);
});

test('observer or adapter replacement prevents a send or a late result', async () => {
  let sends = 0; const changed = harness({ onState: () => { changed.deps.onState = () => {}; },
    load: async () => { sends++; return response(); } });
  await changed.flow.start(); assert.equal(sends, 0);
  const pending = defer(), late = harness({ load: () => { sends++; return pending.promise; } });
  const running = late.flow.start(), before = late.snapshots.length; late.deps.load = async () => response();
  pending.resolve(response('late')); await running; assert.equal(sends, 1); assert.equal(late.snapshots.length, before);
  assert.equal(late.flow.getSnapshot().loading, true); assert.equal(late.flow.getSnapshot().data, null);
});

test('malformed result is treated as an error rather than a successful archive', async () => {
  const h = harness({ load: async () => ({ items: [] }) }); await h.flow.start();
  assert.equal(h.flow.getSnapshot().data, null); assert.ok(h.flow.getSnapshot().error instanceof Error);
  assert.equal(h.flow.getSnapshot().loading, false);
});

test('throwing, asynchronous and invalid guards or evaluators fail closed without unhandled rejection', async () => {
  const unhandled = [], listener = error => unhandled.push(error); process.on('unhandledRejection', listener);
  try {
    for (const guard of [() => false, () => undefined, () => Promise.resolve(true), () => Promise.reject(Error('no')), () => { throw Error('no'); }]) {
      const h = harness({ isCurrent: guard }); await h.flow.start(); assert.deepEqual(h.queries, []); assert.equal(h.flow.getSnapshot(), null);
    }
    for (const evaluateGuard of [() => false, () => Promise.resolve(true), () => Promise.reject(Error('no')), () => { throw Error('no'); }]) {
      const h = harness({ evaluateGuard }); await h.flow.start(); assert.deepEqual(h.queries, []); assert.equal(h.flow.getSnapshot(), null);
    }
    await tick(); assert.deepEqual(unhandled, []);
  } finally { process.off('unhandledRejection', listener); }
});

test('a scope-bound evaluator rejects an account, scope or generation change inside its guard', async () => {
  for (const key of ['account', 'scope', 'generation']) {
    const live = { account: 'A', scope: 'W1', generation: 1 }, captured = { ...live };
    const same = () => JSON.stringify(live) === JSON.stringify(captured);
    const evaluateGuard = guard => same() && testWerkaGuardEvaluator(guard) === true && same();
    const h = harness({ evaluateGuard, isCurrent: () => { live[key] = key === 'generation' ? 2 : 'changed'; return true; } });
    await h.flow.start(); assert.deepEqual(h.queries, [], key); assert.equal(h.flow.getSnapshot(), null);
  }
});

test('reentrant refresh rejects the superseded send and loading completion', async () => {
  let flow, refreshed = false; const pending = defer(), queries = [];
  const h = harness({ load: query => { queries.push(query); return pending.promise; },
    onState: () => { if (!refreshed) { refreshed = true; void flow.refresh(); } } });
  flow = h.flow; const start = flow.start(); await start;
  assert.equal(queries.length, 1); assert.equal(flow.getSnapshot().loading, true);
  pending.resolve(response('latest')); await tick(); assert.equal(flow.getSnapshot().loading, false);
  assert.equal(flow.getSnapshot().data.items[0].id, 'latest');
});

test('input, query, response and snapshot mutations do not alter retained data or date state', async () => {
  const original = response('one'), from = date(2024, 2, 29, 7), to = date(2024, 2, 29, 9);
  const h = harness({ load: async query => { query.from.setFullYear(1900); query.to.setFullYear(1900); return original; },
    onState: snapshot => { snapshot.filter.from?.setFullYear(1900); snapshot.filter.to?.setFullYear(1900);
      if (snapshot.data) { snapshot.data.items[0].id = 'changed'; snapshot.data.summary.totalsByUOM[0].qty = 999; } } },
  { kind: 'received', period: 'daily', from, to });
  await h.flow.start(); original.items[0].id = 'later'; original.summary.totalsByUOM[0].qty = 500;
  const snapshot = h.flow.getSnapshot(); assert.deepEqual(ymd(snapshot.filter.from), [2024, 2, 29]);
  assert.equal(snapshot.data.items[0].id, 'one'); assert.equal(snapshot.data.summary.totalsByUOM[0].qty, 2);
  snapshot.data.items[0].id = 'outer'; assert.equal(h.flow.getSnapshot().data.items[0].id, 'one');
  assert.equal(from.getHours(), 7); assert.equal(to.getHours(), 9);
});
