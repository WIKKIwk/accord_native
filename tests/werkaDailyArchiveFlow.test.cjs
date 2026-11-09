// Unwired flow with fake guards and promises only. No account, backend, frame, route or native picker is used.
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
const { WerkaDailyArchiveFlow } = load(path.resolve(__dirname, '../src/werka/werkaDailyArchiveFlow.ts'));
function date(year, month, day, hour = 0) {
  const value = new Date(0); value.setHours(hour, 0, 0, 0); value.setFullYear(year, month - 1, day); return value;
}
const ymd = value => [value.getFullYear(), value.getMonth() + 1, value.getDate()];
const response = (...labels) => ({ items: labels.map(created_label => ({ created_label })) });
const defer = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject }; };
function harness(overrides = {}) {
  let active = true; const queries = [], snapshots = [];
  const deps = { isCurrent: () => active, evaluateGuard: testWerkaGuardEvaluator,
    load: async query => { queries.push(query); return response(); }, onState: snapshot => snapshots.push(snapshot), ...overrides };
  const flow = new WerkaDailyArchiveFlow('received', date(2024, 1, 31, 20), deps);
  return { flow, deps, queries, snapshots, invalidate: () => { active = false; } };
}

test('start loads once and only the owner can supply the first-frame reveal', async () => {
  const h = harness({ load: async query => { h.queries.push(query); return response('2024-01-03', '2024-01-03', 'bad', '2024-02-02'); } });
  assert.equal(h.flow.getSnapshot().calendar.calendarOpen, false); assert.equal(h.flow.getSnapshot().loading, true);
  assert.deepEqual(h.queries, []); assert.deepEqual(h.snapshots, []);
  await h.flow.start(); await h.flow.start();
  assert.equal(h.queries.length, 1); assert.deepEqual([h.queries[0].kind, h.queries[0].period, ymd(h.queries[0].from), ymd(h.queries[0].to)],
    ['received', 'monthly', [2024, 1, 1], [2024, 1, 31]]);
  assert.deepEqual([...h.flow.getSnapshot().activeDays], [3]); assert.equal(h.flow.getSnapshot().loading, false);
  assert.equal(h.flow.getSnapshot().calendar.calendarOpen, false);
  h.flow.revealAfterFrame(); assert.equal(h.flow.getSnapshot().calendar.calendarOpen, true);
});

test('only a changed real month starts a load, and a later page rejects the old result and error', async () => {
  const pending = [], h = harness({ load: query => { h.queries.push(query); const next = defer(); pending.push(next); return next.promise; } });
  const jan = h.flow.start(); pending[0].resolve(response('2024-01-10')); await jan; h.flow.revealAfterFrame();
  await h.flow.displayedMonthChanged(date(2024, 1, 28)); assert.equal(h.queries.length, 1);
  const feb = h.flow.displayedMonthChanged(date(2024, 2, 17, 18));
  const mar = h.flow.displayedMonthChanged(date(2024, 3, 1));
  assert.deepEqual(h.queries.map(query => ymd(query.from)), [[2024, 1, 1], [2024, 2, 1], [2024, 3, 1]]);
  pending[2].resolve(response('2024-03-29', '2024-03-01', '2024-02-10')); await mar;
  assert.deepEqual([...h.flow.getSnapshot().activeDays], [29, 1]);
  pending[1].reject(Error('stale')); await feb;
  const latest = h.flow.getSnapshot(); assert.deepEqual(ymd(latest.calendar.displayMonth), [2024, 3, 1]);
  assert.deepEqual([...latest.activeDays], [29, 1]); assert.equal(latest.error, null); assert.equal(latest.loading, false);
  await h.flow.displayedMonthChanged(new Date(NaN)); assert.equal(h.queries.length, 3);
});

test('retained active days survive a refresh error while loading and the source error is retained', async () => {
  const pending = defer(), failure = Error('offline'); let count = 0;
  const h = harness({ load: async () => ++count === 1 ? response('2024-01-10') : pending.promise });
  await h.flow.start(); const refresh = h.flow.refresh();
  assert.equal(h.flow.getSnapshot().loading, true); assert.deepEqual([...h.flow.getSnapshot().activeDays], [10]);
  pending.reject(failure); await refresh;
  const result = h.flow.getSnapshot(); assert.equal(result.error, failure); assert.equal(result.loading, false);
  assert.deepEqual([...result.activeDays], [10]);
});

test('same-page concurrent refreshes publish only the latest result and loading completion', async () => {
  const pending = [], h = harness({ load: () => { const next = defer(); pending.push(next); return next.promise; } });
  const start = h.flow.start(), refresh = h.flow.refresh();
  pending[0].resolve(response('2024-01-10')); await start;
  assert.equal(h.flow.getSnapshot().loading, true); assert.deepEqual([...h.flow.getSnapshot().activeDays], []);
  pending[1].resolve(response('2024-01-20')); await refresh;
  assert.equal(h.flow.getSnapshot().loading, false); assert.deepEqual([...h.flow.getSnapshot().activeDays], [20]);
});

test('blank loading has no toggle, and closed calendar ignores picker events', async () => {
  const pending = defer(), h = harness({ load: query => { h.queries.push(query); return pending.promise; } });
  const running = h.flow.start(); h.flow.toggleCalendar(); assert.equal(h.flow.getSnapshot().calendar.calendarOpen, false);
  h.flow.revealAfterFrame(); h.flow.toggleCalendar(); assert.equal(h.flow.getSnapshot().calendar.calendarOpen, true);
  pending.resolve(response()); await running;
  h.flow.toggleCalendar(); assert.equal(h.flow.getSnapshot().calendar.calendarOpen, false);
  await h.flow.displayedMonthChanged(date(2024, 2, 1));
  assert.equal(h.flow.selectDate(date(2024, 1, 5)), null); assert.equal(h.queries.length, 1);
});

test('date selection closes and returns a normalized daily range without navigating', async () => {
  const h = harness(); await h.flow.start();
  assert.equal(h.flow.selectDate(date(2024, 2, 29)), null); h.flow.revealAfterFrame();
  const result = h.flow.selectDate(date(2024, 2, 29, 18));
  assert.deepEqual([result.kind, result.period, ymd(result.from), ymd(result.to)], ['received', 'daily', [2024, 2, 29], [2024, 2, 29]]);
  assert.equal(h.flow.getSnapshot().calendar.calendarOpen, false);
  assert.deepEqual(ymd(h.flow.getSnapshot().calendar.displayMonth), [2024, 1, 1]);
  assert.equal(h.flow.selectDate(date(2024, 2, 29)), null); assert.equal(h.flow.selectDate(new Date(NaN)), null);
  assert.equal(h.queries.length, 1);
});

test('session invalidation and disposal suppress late data without claiming the sent read was canceled', async () => {
  for (const action of ['invalidate', 'dispose']) {
    const pending = defer(), h = harness({ load: query => { h.queries.push(query); return pending.promise; } });
    const running = h.flow.start(), before = h.snapshots.length;
    if (action === 'invalidate') h.invalidate(); else h.flow.dispose();
    pending.resolve(response('2024-01-05')); await running;
    assert.equal(h.queries.length, 1); assert.equal(h.snapshots.length, before); assert.equal(h.flow.getSnapshot(), null);
    await h.flow.refresh(); assert.equal(h.flow.selectDate(date(2024, 1, 2)), null); assert.equal(h.queries.length, 1);
  }
});

test('an observer that invalidates the session during selection cannot return navigation arguments', async () => {
  let active = true, invalidateOnNext = false;
  const h = harness({ isCurrent: () => active, onState: () => { if (invalidateOnNext) active = false; } });
  await h.flow.start(); h.flow.revealAfterFrame(); invalidateOnNext = true;
  assert.equal(h.flow.selectDate(date(2024, 1, 4)), null); assert.equal(h.flow.getSnapshot(), null);
});

test('selection does not return navigation arguments after its observer replaces the load adapter', async () => {
  let replace = false; const h = harness({ onState: () => { if (replace) h.deps.load = async () => response(); } });
  await h.flow.start(); h.flow.revealAfterFrame(); replace = true;
  assert.equal(h.flow.selectDate(date(2024, 1, 4)), null);
});

test('blocked, asynchronous or throwing guards and broken evaluators fail closed without unhandled rejection', async () => {
  const unhandled = [], listener = error => unhandled.push(error); process.on('unhandledRejection', listener);
  try {
    for (const guard of [() => false, () => undefined, () => Promise.resolve(true), () => Promise.reject(Error('no')), () => { throw Error('no'); }]) {
      const h = harness({ isCurrent: guard }); await h.flow.start(); assert.deepEqual(h.queries, []); assert.equal(h.flow.getSnapshot(), null);
    }
    for (const evaluateGuard of [() => false, () => Promise.resolve(true), () => Promise.reject(Error('no')), () => { throw Error('no'); }]) {
      const h = harness({ evaluateGuard }); await h.flow.start(); assert.deepEqual(h.queries, []); assert.equal(h.flow.getSnapshot(), null);
    }
    await new Promise(resolve => setImmediate(resolve)); assert.deepEqual(unhandled, []);
  } finally { process.off('unhandledRejection', listener); }
});

test('a reentrant observer changing month stops the superseded load before it is sent', async () => {
  let flow, armed = false, switched = false; const queries = [];
  const h = harness({ load: async query => { queries.push(query); return response('2024-03-02'); },
    onState: () => { if (armed && !switched) { switched = true; void flow.displayedMonthChanged(date(2024, 3, 1)); } } });
  flow = h.flow; await flow.start(); flow.revealAfterFrame(); armed = true;
  await flow.displayedMonthChanged(date(2024, 2, 1)); await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(queries.map(query => ymd(query.from)), [[2024, 1, 1], [2024, 3, 1]]);
  assert.deepEqual([...flow.getSnapshot().activeDays], [2]);
});

test('observer invalidation or replacing the load adapter before send prevents the send', async () => {
  let active = true, sends = 0;
  const invalidated = harness({ isCurrent: () => active, onState: () => { active = false; },
    load: async () => { sends++; return response(); } });
  await invalidated.flow.start(); assert.equal(sends, 0); assert.equal(invalidated.flow.getSnapshot(), null);
  const replaced = harness({ onState: () => { replaced.deps.load = async () => { sends++; return response(); }; },
    load: async () => { sends++; return response(); } });
  await replaced.flow.start(); assert.equal(sends, 0);
  const observer = harness({ onState: () => { observer.deps.onState = () => {}; },
    load: async () => { sends++; return response(); } });
  await observer.flow.start(); assert.equal(sends, 0);
});

test('a replaced adapter cannot publish its late result or pretend its sent read was canceled', async () => {
  const pending = defer(); let sends = 0;
  const h = harness({ load: () => { sends++; return pending.promise; } });
  const running = h.flow.start(), before = h.snapshots.length;
  h.deps.load = async () => response('2024-01-20');
  pending.resolve(response('2024-01-04')); await running;
  assert.equal(sends, 1); assert.equal(h.snapshots.length, before);
  assert.equal(h.flow.getSnapshot().loading, true); assert.deepEqual([...h.flow.getSnapshot().activeDays], []);
});

test('a replaced observer receives neither a late result nor a false cancellation', async () => {
  const pending = defer(); let sends = 0, newUpdates = 0;
  const h = harness({ load: () => { sends++; return pending.promise; } });
  const running = h.flow.start(), before = h.snapshots.length;
  h.deps.onState = () => { newUpdates++; };
  pending.resolve(response('2024-01-04')); await running;
  assert.equal(sends, 1); assert.equal(h.snapshots.length, before); assert.equal(newUpdates, 0);
  assert.equal(h.flow.getSnapshot().loading, true); assert.deepEqual([...h.flow.getSnapshot().activeDays], []);
});

test('a scope-bound evaluator notices account, scope or generation changes inside its guard', async () => {
  for (const key of ['account', 'scope', 'generation']) {
    const live = { account: 'A', scope: 'W1', generation: 1 }, captured = { ...live };
    const same = () => JSON.stringify(live) === JSON.stringify(captured);
    const evaluateGuard = guard => same() && testWerkaGuardEvaluator(guard) === true && same();
    const h = harness({ evaluateGuard, isCurrent: () => { live[key] = key === 'generation' ? 2 : 'changed'; return true; } });
    await h.flow.start(); assert.deepEqual(h.queries, [], key); assert.equal(h.flow.getSnapshot(), null);
  }
});

test('snapshot and request mutations cannot change the retained calendar or its result month', async () => {
  const h = harness({ load: async query => { query.from.setFullYear(1990); query.to.setFullYear(1990); return response('2024-01-08'); },
    onState: snapshot => { snapshot.calendar.displayMonth.setFullYear(1980); snapshot.calendar.selectedDate.setFullYear(1980); snapshot.activeDays.clear(); } });
  await h.flow.start(); const result = h.flow.getSnapshot();
  assert.deepEqual(ymd(result.calendar.displayMonth), [2024, 1, 1]); assert.deepEqual(ymd(result.calendar.selectedDate), [2024, 1, 31]);
  assert.deepEqual([...result.activeDays], [8]);
  result.calendar.displayMonth.setFullYear(1970); result.activeDays.clear();
  assert.deepEqual(ymd(h.flow.getSnapshot().calendar.displayMonth), [2024, 1, 1]); assert.deepEqual([...h.flow.getSnapshot().activeDays], [8]);
});

test('a reentrant refresh during result publication prevents the earlier finally from clearing loading', async () => {
  const first = defer(), second = defer(); let flow, count = 0, refreshed = false;
  const h = harness({ load: () => ++count === 1 ? first.promise : second.promise,
    onState: snapshot => { if (!refreshed && snapshot.activeDays.has(4)) { refreshed = true; void flow.refresh(); } } });
  flow = h.flow; const start = flow.start(); first.resolve(response('2024-01-04')); await start;
  assert.equal(count, 2); assert.equal(flow.getSnapshot().loading, true); assert.deepEqual([...flow.getSnapshot().activeDays], [4]);
  second.resolve(response('2024-01-06')); await new Promise(resolve => setImmediate(resolve));
  assert.equal(flow.getSnapshot().loading, false); assert.deepEqual([...flow.getSnapshot().activeDays], [6]);
});
