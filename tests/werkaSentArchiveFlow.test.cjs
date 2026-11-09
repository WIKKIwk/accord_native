// Unwired sent-hub flow with fake guards and promises only. No account, backend, route or native view is exercised.
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
const root = path.resolve(__dirname, '../src/werka');
const { WerkaSentArchiveFlow } = load(path.join(root, 'werkaSentArchiveFlow.ts'));
const { werkaSentArchiveBody } = load(path.join(root, 'werkaSentArchiveModel.ts'));
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
  const flow = new WerkaSentArchiveFlow(date(2026, 11, 8, 18), deps);
  return { flow, deps, queries, snapshots, invalidate: () => { active = false; } };
}
const tick = () => new Promise(resolve => setImmediate(resolve));

test('start sends three source ranges and retains the shared early-loading-clear behavior', async () => {
  const pending = [], h = harness({ load: query => { h.queries.push(query); const next = defer(); pending.push(next); return next.promise; } });
  const running = h.flow.start();
  assert.equal(h.queries.length, 3);
  assert.deepEqual(h.queries.map(query => [query.kind, query.period, ymd(query.from), ymd(query.to)]), [
    ['sent', 'monthly', [2026, 11, 1], [2026, 11, 30]], ['sent', 'yearly', [2026, 1, 1], [2026, 12, 31]],
    ['sent', 'yearly', [2021, 1, 1], [2032, 12, 31]],
  ]);
  assert.equal(h.flow.getSnapshot().loading, true); pending[0].resolve(response()); await tick();
  const early = h.flow.getSnapshot(); assert.equal(early.loading, false);
  assert.equal(werkaSentArchiveBody(early.loading, early.error, early.activeDays, early.activeMonths, early.activeYears), 'content');
  pending[1].resolve(response('2026-03-01')); pending[2].resolve(response('2022-01-01')); await running;
  assert.deepEqual([...h.flow.getSnapshot().activeMonths], [3]); assert.deepEqual([...h.flow.getSnapshot().activeYears], [2022]);
  await h.flow.start(); assert.equal(h.queries.length, 3);
});

test('an error persists across another panel success until a new load starts', async () => {
  const pending = [], failure = Error('offline');
  const h = harness({ load: () => { const next = defer(); pending.push(next); return next.promise; } });
  const running = h.flow.start(); pending[0].reject(failure); await tick();
  assert.equal(h.flow.getSnapshot().error, failure); assert.equal(h.flow.getSnapshot().loading, false);
  pending[1].resolve(response('2026-05-01')); pending[2].resolve(response()); await running;
  assert.equal(h.flow.getSnapshot().error, failure); assert.deepEqual([...h.flow.getSnapshot().activeMonths], [5]);
});

test('repeated monthly page actions apply to latest page and discard stale monthly results', async () => {
  const pending = []; let count = 0;
  const h = harness({ load: query => { h.queries.push(query); if (++count <= 3) return Promise.resolve(response('2026-11-08'));
    const next = defer(); pending.push(next); return next.promise; } });
  await h.flow.start(); h.flow.toggle('monthly'); const first = h.flow.step('monthly', 1), second = h.flow.step('monthly', 1);
  assert.deepEqual(h.queries.slice(3).map(query => ymd(query.from)), [[2027, 1, 1], [2028, 1, 1]]);
  pending[1].resolve(response('2028-03-01')); await second; pending[0].reject(Error('stale')); await first;
  assert.equal(h.flow.getSnapshot().calendar.displayYear, 2028); assert.deepEqual([...h.flow.getSnapshot().activeMonths], [3]);
  assert.equal(h.flow.getSnapshot().error, null); assert.equal(h.flow.getSnapshot().loading, false);
});

test('a new three-panel refresh fences all older panel results while retaining the shared flag', async () => {
  const pending = [], h = harness({ load: () => { const next = defer(); pending.push(next); return next.promise; } });
  const first = h.flow.start(), second = h.flow.refresh(); assert.equal(pending.length, 6);
  pending.slice(0, 3).forEach(next => next.resolve(response('2026-11-08'))); await first;
  assert.equal(h.flow.getSnapshot().loading, true); assert.deepEqual([...h.flow.getSnapshot().activeDays], []);
  pending[3].resolve(response('2026-11-04')); await tick();
  assert.equal(h.flow.getSnapshot().loading, false); assert.deepEqual([...h.flow.getSnapshot().activeDays], [4]);
  pending[4].resolve(response('2026-02-01')); pending[5].resolve(response('2022-01-01')); await second;
  assert.deepEqual([...h.flow.getSnapshot().activeMonths], [2]); assert.deepEqual([...h.flow.getSnapshot().activeYears], [2022]);
});

test('daily month events deduplicate, and selection leaves the sent panel open without navigating', async () => {
  const h = harness(); await h.flow.start();
  await h.flow.displayedMonthChanged(date(2026, 11, 28)); assert.equal(h.queries.length, 3);
  await h.flow.displayedMonthChanged(date(2026, 12, 1)); assert.equal(h.queries.length, 4);
  assert.deepEqual(ymd(h.queries[3].from), [2026, 12, 1]);
  const query = h.flow.selectDate(date(2026, 12, 5, 17));
  assert.deepEqual([query.kind, query.period, ymd(query.from), ymd(query.to)], ['sent', 'daily', [2026, 12, 5], [2026, 12, 5]]);
  assert.equal(h.flow.getSnapshot().calendar.open, 'daily'); assert.deepEqual(ymd(h.flow.getSnapshot().calendar.selectedDate), [2026, 12, 5]);
  h.flow.toggle('daily'); assert.equal(h.flow.getSnapshot().calendar.open, null);
  assert.equal(h.flow.selectDate(date(2026, 12, 6)), null); await h.flow.displayedMonthChanged(date(2027, 1, 1));
  assert.equal(h.queries.length, 4);
});

test('active and inactive period cells return source ranges; closed or invalid panels do nothing', async () => {
  const h = harness(); await h.flow.start();
  assert.equal(h.flow.selectPeriod('monthly', 2), null); h.flow.toggle('monthly');
  const month = h.flow.selectPeriod('monthly', 2);
  assert.deepEqual([month.period, ymd(month.from), ymd(month.to)], ['monthly', [2026, 2, 1], [2026, 2, 28]]);
  assert.equal(h.flow.selectPeriod('monthly', 13), null); h.flow.toggle('yearly');
  const year = h.flow.selectPeriod('yearly', 2032);
  assert.deepEqual([year.period, ymd(year.from), ymd(year.to)], ['yearly', [2032, 1, 1], [2032, 12, 31]]);
  assert.equal(h.flow.selectPeriod('yearly', 2033), null); assert.equal(h.flow.selectPeriod('daily', 2026), null);
  await h.flow.step('daily', 1); await h.flow.step('yearly', 0); assert.equal(h.queries.length, 3);
});

test('scope invalidation during the batch prevents later sends and suppresses a sent read result', async () => {
  const pending = defer(); let active = true, updates = 0, sends = 0;
  const h = harness({ isCurrent: () => active, onState: () => { if (++updates === 2) active = false; },
    load: () => { sends++; return pending.promise; } });
  const running = h.flow.start(); assert.equal(sends, 1); pending.resolve(response('2026-11-08')); await running;
  assert.equal(sends, 1); assert.equal(h.flow.getSnapshot(), null);
});

test('date-selection observer invalidation prevents returning navigation arguments', async () => {
  let active = true, invalidateOnNext = false;
  const h = harness({ isCurrent: () => active, onState: () => { if (invalidateOnNext) active = false; } });
  await h.flow.start(); invalidateOnNext = true;
  assert.equal(h.flow.selectDate(date(2026, 11, 9)), null); assert.equal(h.flow.getSnapshot(), null);
});

test('date-selection observer adapter replacement prevents returning navigation arguments', async () => {
  let replace = false; const h = harness({ onState: () => { if (replace) h.deps.load = async () => response(); } });
  await h.flow.start(); replace = true; assert.equal(h.flow.selectDate(date(2026, 11, 9)), null);
});

test('period selection rejects an adapter or observer replaced inside its guard', async () => {
  for (const key of ['load', 'onState']) {
    let armed = false, calls = 0;
    const h = harness({ isCurrent: () => { if (armed && ++calls === 2) h.deps[key] = () => {};
      return true; } });
    await h.flow.start(); h.flow.toggle('monthly'); armed = true;
    assert.equal(h.flow.selectPeriod('monthly', 2), null, key);
  }
});

test('adapter replacement during first publication prevents every batch send', async () => {
  let sends = 0; const h = harness({ onState: () => { h.deps.load = async () => { sends++; return response(); }; },
    load: async () => { sends++; return response(); } });
  await h.flow.start(); assert.equal(sends, 0);
});

test('observer replacement after one sent read prevents later sends and late publication', async () => {
  const pending = defer(); let updates = 0, sends = 0, newUpdates = 0;
  const h = harness({ onState: () => { if (++updates === 2) h.deps.onState = () => { newUpdates++; }; },
    load: () => { sends++; return pending.promise; } });
  const running = h.flow.start(); assert.equal(sends, 1); pending.resolve(response('2026-11-08')); await running;
  assert.equal(sends, 1); assert.equal(updates, 2); assert.equal(newUpdates, 0);
});

test('disposal suppresses all three late results without claiming reads were canceled', async () => {
  const pending = [], h = harness({ load: () => { const next = defer(); pending.push(next); return next.promise; } });
  const running = h.flow.start(), before = h.snapshots.length; h.flow.dispose();
  pending.forEach(next => next.resolve(response('2026-11-08'))); await running;
  assert.equal(h.snapshots.length, before); assert.equal(h.flow.getSnapshot(), null);
  await h.flow.refresh(); assert.equal(h.flow.selectDate(date(2026, 11, 9)), null);
});

test('throwing, asynchronous and invalid guards or evaluators fail closed without unhandled rejections', async () => {
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

test('a scope-bound evaluator rejects account, scope or generation changes inside its guard', async () => {
  for (const key of ['account', 'scope', 'generation']) {
    const live = { account: 'A', scope: 'W1', generation: 1 }, captured = { ...live };
    const same = () => JSON.stringify(live) === JSON.stringify(captured);
    const evaluateGuard = guard => same() && testWerkaGuardEvaluator(guard) === true && same();
    const h = harness({ evaluateGuard, isCurrent: () => { live[key] = key === 'generation' ? 2 : 'changed'; return true; } });
    await h.flow.start(); assert.deepEqual(h.queries, [], key); assert.equal(h.flow.getSnapshot(), null);
  }
});

test('reentrant page actions skip the superseded send and keep the latest page', async () => {
  let flow, armed = false, moved = false, calls = 0; const queries = [], pending = defer();
  const h = harness({ load: query => { queries.push(query); return ++calls <= 3 ? Promise.resolve(response()) : pending.promise; },
    onState: snapshot => { if (armed && !moved && snapshot.calendar.displayYear === 2027) { moved = true; void flow.step('monthly', 1); } } });
  flow = h.flow; await flow.start(); flow.toggle('monthly'); armed = true;
  await flow.step('monthly', 1); assert.deepEqual(queries.slice(3).map(query => ymd(query.from)), [[2028, 1, 1]]);
  pending.resolve(response('2028-03-01')); await tick(); assert.equal(flow.getSnapshot().calendar.displayYear, 2028);
  assert.deepEqual([...flow.getSnapshot().activeMonths], [3]);
});

test('mutating snapshots and adapter query dates cannot change retained page state', async () => {
  const h = harness({ load: async query => { query.from.setFullYear(1900); query.to.setFullYear(1900); return response('2026-11-08'); },
    onState: snapshot => { snapshot.calendar.displayMonth.setFullYear(1900); snapshot.calendar.selectedDate.setFullYear(1900);
      snapshot.activeDays.clear(); snapshot.activeMonths.clear(); snapshot.activeYears.clear(); } });
  await h.flow.start(); const snapshot = h.flow.getSnapshot();
  assert.deepEqual(ymd(snapshot.calendar.displayMonth), [2026, 11, 1]); assert.deepEqual(ymd(snapshot.calendar.selectedDate), [2026, 11, 8]);
  assert.deepEqual([...snapshot.activeDays], [8]); assert.deepEqual([...snapshot.activeMonths], [11]); assert.deepEqual([...snapshot.activeYears], [2026]);
  snapshot.calendar.selectedDate.setFullYear(1901); snapshot.activeDays.clear();
  assert.deepEqual(ymd(h.flow.getSnapshot().calendar.selectedDate), [2026, 11, 8]); assert.deepEqual([...h.flow.getSnapshot().activeDays], [8]);
});
