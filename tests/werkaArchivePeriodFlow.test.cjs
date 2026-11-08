// Unwired monthly/yearly flow with fake guards and promises only; no account, backend, route or native view.
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
const { WerkaArchivePeriodFlow } = load(path.resolve(__dirname, '../src/werka/werkaArchivePeriodFlow.ts'));
function date(year, month, day) {
  const value = new Date(0); value.setHours(12, 0, 0, 0); value.setFullYear(year, month - 1, day); return value;
}
const ymd = value => [value.getFullYear(), value.getMonth() + 1, value.getDate()];
const response = (...labels) => ({ items: labels.map(created_label => ({ created_label })) });
const defer = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject }; };
function harness(period, overrides = {}) {
  let active = true; const queries = [], snapshots = [];
  const deps = { isCurrent: () => active, evaluateGuard: testWerkaGuardEvaluator,
    load: async query => { queries.push(query); return response(); }, onState: snapshot => snapshots.push(snapshot), ...overrides };
  const flow = new WerkaArchivePeriodFlow('sent', period, date(2026, 11, 8), deps);
  return { flow, deps, queries, snapshots, invalidate: () => { active = false; } };
}

for (const period of ['monthly', 'yearly']) {
  const initialPage = period === 'monthly' ? { period, year: 2026 } : { period, firstYear: 2021 };
  const queryFrom = period === 'monthly' ? [2026, 1, 1] : [2021, 1, 1];
  const queryTo = period === 'monthly' ? [2026, 12, 31] : [2032, 12, 31];
  test(`${period} starts once with the source range and projects active values from valid records`, async () => {
    const labels = period === 'monthly' ? ['2026-02-01', '2026-02-28', '2026-11-08', '2025-12-31', 'bad']
      : ['2021-02-01', '2021-12-30', '2032-11-08', '2033-01-01', 'bad'];
    const h = harness(period, { load: async query => { h.queries.push(query); return response(...labels); } });
    assert.deepEqual(h.flow.getSnapshot().page, initialPage); assert.equal(h.flow.getSnapshot().loading, true);
    assert.deepEqual(h.queries, []); await h.flow.start(); await h.flow.start();
    assert.equal(h.queries.length, 1); assert.deepEqual([h.queries[0].kind, h.queries[0].period, ymd(h.queries[0].from), ymd(h.queries[0].to)],
      ['sent', 'yearly', queryFrom, queryTo]);
    assert.deepEqual([...h.flow.getSnapshot().active], period === 'monthly' ? [2, 11] : [2021, 2032]);
    assert.equal(h.flow.getSnapshot().loading, false); assert.equal(h.flow.getSnapshot().error, null);
  });

  test(`${period} blank loading emits no synthetic page action, and completed empty remains selectable`, async () => {
    const pending = defer(), h = harness(period, { load: query => { h.queries.push(query); return pending.promise; } });
    const running = h.flow.start();
    assert.equal(h.queries.length, 1); pending.resolve(response()); await running;
    const selection = h.flow.select(period === 'monthly' ? 2 : 2022);
    assert.equal(selection.period, period); assert.deepEqual(ymd(selection.from), period === 'monthly' ? [2026, 2, 1] : [2022, 1, 1]);
    assert.equal(h.flow.select(period === 'monthly' ? 13 : 2033), null);
  });

  test(`${period} repeated real page actions advance from latest state even when the active set is empty`, async () => {
    const pending = []; let first = true;
    const h = harness(period, { load: query => { h.queries.push(query); if (first) { first = false; return Promise.resolve(response()); }
      const next = defer(); pending.push(next); return next.promise; } });
    await h.flow.start(); const one = h.flow.step(1), two = h.flow.step(1);
    assert.deepEqual(h.queries.slice(1).map(query => ymd(query.from)), period === 'monthly' ? [[2027, 1, 1], [2028, 1, 1]]
      : [[2033, 1, 1], [2045, 1, 1]]);
    pending[1].resolve(response()); await two; pending[0].resolve(response()); await one;
    assert.equal(h.flow.getSnapshot().loading, false);
  });

  test(`${period} successive page steps use latest state and reject stale result/loading completion`, async () => {
    const pending = []; let first = true;
    const h = harness(period, { load: query => { h.queries.push(query); if (first) { first = false; return Promise.resolve(response(
      period === 'monthly' ? '2026-01-10' : '2021-01-10')); }
      const next = defer(); pending.push(next); return next.promise; } });
    await h.flow.start(); const one = h.flow.step(1), two = h.flow.step(1);
    assert.equal(h.queries.length, 3);
    assert.deepEqual(h.queries.slice(1).map(query => ymd(query.from)), period === 'monthly' ? [[2027, 1, 1], [2028, 1, 1]]
      : [[2033, 1, 1], [2045, 1, 1]]);
    pending[1].resolve(response(period === 'monthly' ? '2028-02-01' : '2046-02-01')); await two;
    pending[0].reject(Error('stale')); await one;
    assert.deepEqual([...h.flow.getSnapshot().active], period === 'monthly' ? [2] : [2046]);
    assert.equal(h.flow.getSnapshot().loading, false); assert.equal(h.flow.getSnapshot().error, null);
  });

  test(`${period} retained active markers survive loading/error and inactive cells remain selectable`, async () => {
    const pending = defer(), failure = Error('offline'); let count = 0;
    const h = harness(period, { load: async () => ++count === 1 ? response(period === 'monthly' ? '2026-02-10' : '2022-02-10') : pending.promise });
    await h.flow.start(); const refresh = h.flow.refresh();
    assert.equal(h.flow.getSnapshot().loading, true);
    const selection = h.flow.select(period === 'monthly' ? 3 : 2023);
    assert.equal(selection.period, period); assert.deepEqual(ymd(selection.from), period === 'monthly' ? [2026, 3, 1] : [2023, 1, 1]);
    pending.reject(failure); await refresh;
    assert.equal(h.flow.getSnapshot().error, failure); assert.equal(h.flow.getSnapshot().loading, false);
    assert.deepEqual([...h.flow.getSnapshot().active], period === 'monthly' ? [2] : [2022]);
  });

  test(`${period} account invalidation or disposal suppresses a late read without claiming cancellation`, async () => {
    for (const action of ['invalidate', 'dispose']) {
      const pending = defer(), h = harness(period, { load: query => { h.queries.push(query); return pending.promise; } });
      const running = h.flow.start(), before = h.snapshots.length;
      if (action === 'invalidate') h.invalidate(); else h.flow.dispose();
      pending.resolve(response('2026-01-10')); await running;
      assert.equal(h.queries.length, 1); assert.equal(h.snapshots.length, before); assert.equal(h.flow.getSnapshot(), null);
      await h.flow.refresh(); assert.equal(h.flow.select(period === 'monthly' ? 1 : 2022), null);
    }
  });

  test(`${period} observer or adapter replacement prevents a send or late result`, async () => {
    let sends = 0;
    const changed = harness(period, { onState: () => { changed.deps.onState = () => {}; }, load: async () => { sends++; return response(); } });
    await changed.flow.start(); assert.equal(sends, 0);
    const pending = defer(), late = harness(period, { load: () => { sends++; return pending.promise; } });
    const running = late.flow.start(), before = late.snapshots.length;
    late.deps.load = async () => response(); pending.resolve(response('2026-01-10')); await running;
    assert.equal(sends, 1); assert.equal(late.snapshots.length, before); assert.equal(late.flow.getSnapshot().loading, true);
  });

  test(`${period} mutation of snapshots and request dates cannot change the current page or markers`, async () => {
    const h = harness(period, { load: async query => { query.from.setFullYear(1900); query.to.setFullYear(1900);
      return response(period === 'monthly' ? '2026-02-10' : '2022-02-10'); },
    onState: snapshot => { if (snapshot.page.period === 'monthly') snapshot.page.year = 1900; else snapshot.page.firstYear = 1900; snapshot.active.clear(); } });
    await h.flow.start(); const result = h.flow.getSnapshot(); assert.deepEqual(result.page, initialPage);
    assert.deepEqual([...result.active], period === 'monthly' ? [2] : [2022]);
    result.active.clear(); assert.deepEqual([...h.flow.getSnapshot().active], period === 'monthly' ? [2] : [2022]);
  });
}

test('throwing, asynchronous or invalid guards/evaluators fail closed without unhandled rejections', async () => {
  const unhandled = [], listener = error => unhandled.push(error); process.on('unhandledRejection', listener);
  try {
    for (const guard of [() => false, () => undefined, () => Promise.resolve(true), () => Promise.reject(Error('no')), () => { throw Error('no'); }]) {
      const h = harness('monthly', { isCurrent: guard }); await h.flow.start(); assert.deepEqual(h.queries, []); assert.equal(h.flow.getSnapshot(), null);
    }
    for (const evaluateGuard of [() => false, () => Promise.resolve(true), () => Promise.reject(Error('no')), () => { throw Error('no'); }]) {
      const h = harness('yearly', { evaluateGuard }); await h.flow.start(); assert.deepEqual(h.queries, []); assert.equal(h.flow.getSnapshot(), null);
    }
    await new Promise(resolve => setImmediate(resolve)); assert.deepEqual(unhandled, []);
  } finally { process.off('unhandledRejection', listener); }
});

test('a scope-bound evaluator rejects an account, scope or generation change inside its guard', async () => {
  for (const key of ['account', 'scope', 'generation']) {
    const live = { account: 'A', scope: 'W1', generation: 1 }, captured = { ...live };
    const same = () => JSON.stringify(live) === JSON.stringify(captured);
    const evaluateGuard = guard => same() && testWerkaGuardEvaluator(guard) === true && same();
    const h = harness('monthly', { evaluateGuard, isCurrent: () => { live[key] = key === 'generation' ? 2 : 'changed'; return true; } });
    await h.flow.start(); assert.deepEqual(h.queries, [], key); assert.equal(h.flow.getSnapshot(), null);
  }
});

test('invalid clock, page steps and cell values do not fabricate a range', async () => {
  assert.throws(() => new WerkaArchivePeriodFlow('sent', 'monthly', new Date(NaN), {}), RangeError);
  const h = harness('monthly'); await h.flow.start();
  for (const value of [0, 2, NaN, 0.5]) await h.flow.step(value);
  for (const value of [NaN, Infinity, -1, 0, 13, 1.5]) assert.equal(h.flow.select(value), null);
  assert.equal(h.queries.length, 1);
});

test('reentrant page changes or refreshes prevent superseded sends and loading completion', async () => {
  let flow, armed = false, moved = false; const queries = [], pending = defer();
  const h = harness('monthly', { load: query => { queries.push(query); return queries.length === 1
    ? Promise.resolve(response('2026-01-01')) : pending.promise; },
  onState: snapshot => { if (armed && !moved && snapshot.page.year === 2027) { moved = true; void flow.step(1); } } });
  flow = h.flow; await flow.start(); armed = true;
  const skipped = flow.step(1); await skipped;
  assert.deepEqual(queries.map(query => ymd(query.from)), [[2026, 1, 1], [2028, 1, 1]]);
  assert.equal(flow.getSnapshot().loading, true); pending.resolve(response('2028-03-01'));
  await new Promise(resolve => setImmediate(resolve)); assert.equal(flow.getSnapshot().loading, false);
  assert.deepEqual([...flow.getSnapshot().active], [3]);
});
