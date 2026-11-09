// Pure event descriptions only. No real timer, catalog, owner, account or network.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
function load(file, cache = new Map()) {
  const filename = path.resolve(file.endsWith('.ts') || file.endsWith('.json') ? file : `${file}.ts`);
  if (filename.endsWith('.json')) return require(filename);
  if (cache.has(filename)) return cache.get(filename);
  const module = new Module(filename); module.filename = filename; module.paths = require.main.paths; cache.set(filename, module.exports);
  module.require = name => name.startsWith('.') ? load(path.resolve(path.dirname(filename), name), cache) : require(name);
  module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText, filename);
  cache.set(filename, module.exports); return module.exports;
}
const a = load(path.resolve(__dirname, '../src/werka/werkaBatchCustomerPaging.ts'));
const customer = (index, name = `Customer ${index}`) => ({ ref: String(index), name, phone: '' });
const page = count => Array.from({ length: count }, (_, index) => customer(index));
const start = () => a.werkaBatchCustomerPagingStart(a.werkaBatchCustomerPagingInitial());
const done = (step, rows) => a.werkaBatchCustomerPagingResult(step.state, step.effect.token, rows).state;

test('initial state describes one empty-query read and does not execute it', () => {
  const initial = a.werkaBatchCustomerPagingInitial(), step = a.werkaBatchCustomerPagingStart(initial);
  assert.equal(initial.loading, true); assert.equal(initial.started, false); assert.equal(step.state.started, true);
  assert.deepEqual({ kind: step.effect.kind, query: step.effect.query, offset: step.effect.offset, limit: step.effect.limit },
    { kind: 'read', query: '', offset: 0, limit: 50 });
  assert.equal(a.werkaBatchCustomerPagingStart(step.state).effect, null);
});

test('typing immediately fences an older in-flight result before the source debounce fires', () => {
  const first = start(), change = a.werkaBatchCustomerPagingQuery(first.state, '\u0085ali\u0085');
  assert.equal(change.effect.kind, 'schedule'); assert.equal(change.effect.delayMs, 220);
  assert.equal(change.state.query, '\u0085ali\u0085'); assert.equal(change.state.loading, true);
  assert.deepEqual(change.state.raw, []); assert.equal(change.state.hasMore, false);
  assert.equal(a.werkaBatchCustomerPagingResult(change.state, first.effect.token, [customer(1)]).state, change.state);
  assert.equal(a.werkaBatchCustomerPagingFailure(change.state, first.effect.token).state, change.state);
  // The guard is meaningful only when the owner applies events to latest state.
  assert.equal(a.werkaBatchCustomerPagingResult(first.state, first.effect.token, [customer(1)]).state.raw.length, 1);
  const later = a.werkaBatchCustomerPagingDebounced(change.state, change.effect.token);
  assert.equal(later.effect.kind, 'read'); assert.equal(later.effect.query, 'ali'); assert.equal(later.effect.offset, 0);
  assert.notEqual(later.effect.token, change.effect.token);
  assert.equal(a.werkaBatchCustomerPagingDebounced(later.state, change.effect.token).effect, null);
});

test('successive text events retire old timers and preserve the latest raw query', () => {
  const first = start(), one = a.werkaBatchCustomerPagingQuery(first.state, 'a'), two = a.werkaBatchCustomerPagingQuery(one.state, 'abc ');
  assert.equal(a.werkaBatchCustomerPagingDebounced(two.state, one.effect.token).effect, null);
  const read = a.werkaBatchCustomerPagingDebounced(two.state, two.effect.token);
  assert.equal(read.effect.query, 'abc'); assert.equal(read.state.query, 'abc ');
  assert.equal(a.werkaBatchCustomerPagingDebounced(read.state, two.effect.token).effect, null);
});

test('successful page is defensively copied and source-ranked, with a short page ending pagination', () => {
  const first = start(), change = a.werkaBatchCustomerPagingQuery(first.state, 'abc');
  const read = a.werkaBatchCustomerPagingDebounced(change.state, change.effect.token), input = [customer(1, 'other'), customer(2, 'abc')];
  const state = done(read, input), view = a.werkaBatchCustomerPagingDisplay(state);
  assert.deepEqual(view.customers.map(row => row.name), ['abc', 'other']); assert.equal(view.hasMore, false);
  assert.equal(view.loading, false); assert.equal(view.hasError, false); assert.equal(a.werkaBatchCustomerPagingMore(state).effect, null);
  input[1].name = 'changed'; input.push(customer(3)); assert.deepEqual(view.customers.map(row => row.name), ['abc', 'other']);
  assert.ok(Object.isFrozen(state) && Object.isFrozen(state.raw) && Object.isFrozen(state.raw[0]) && Object.isFrozen(view.customers));
});

test('a full page allows one guarded append with raw offset and preserves duplicates', () => {
  const initial = start(), ready = done(initial, page(50)), more = a.werkaBatchCustomerPagingMore(ready);
  assert.equal(ready.hasMore, true); assert.equal(more.state.loading, false); assert.equal(more.state.loadingMore, true);
  assert.deepEqual({ query: more.effect.query, offset: more.effect.offset, limit: more.effect.limit }, { query: '', offset: 50, limit: 50 });
  assert.equal(a.werkaBatchCustomerPagingMore(more.state).effect, null);
  const next = done(more, [customer(0), customer(50)]);
  assert.equal(next.raw.length, 52); assert.equal(next.raw.filter(row => row.ref === '0').length, 2); assert.equal(next.hasMore, false);
  assert.equal(a.werkaBatchCustomerPagingMore(next).effect, null);
});

test('a page of at least the source page size leaves more pages possible', () => {
  for (const length of [49, 50, 51]) {
    const ready = done(start(), page(length)); assert.equal(ready.hasMore, length >= 50);
  }
});

test('an append failure retains data behind the error and retry describes a fresh reset only on a real retry event', () => {
  const ready = done(start(), page(50)), more = a.werkaBatchCustomerPagingMore(ready);
  const failed = a.werkaBatchCustomerPagingFailure(more.state, more.effect.token).state;
  assert.equal(failed.hasError, true); assert.equal(failed.raw.length, 50); assert.equal(failed.loadingMore, false);
  assert.equal(a.werkaBatchCustomerPagingMore(failed).effect, null);
  const retry = a.werkaBatchCustomerPagingRetry(failed);
  assert.equal(retry.effect.offset, 0); assert.equal(retry.effect.query, ''); assert.equal(retry.state.raw.length, 0);
  assert.equal(retry.state.loading, true); assert.equal(retry.state.hasError, false);
  assert.equal(a.werkaBatchCustomerPagingRetry(retry.state).effect, null);
});

test('malformed current pages fail atomically and malformed stale pages do nothing', () => {
  for (const invalid of [null, {}, ['bad'], [{ ref: '1', name: 3, phone: '' }]]) {
    const read = start(), failed = a.werkaBatchCustomerPagingResult(read.state, read.effect.token, invalid);
    assert.equal(failed.state.hasError, true); assert.deepEqual(failed.state.raw, []); assert.equal(failed.effect, null);
    const change = a.werkaBatchCustomerPagingQuery(read.state, 'next');
    assert.equal(a.werkaBatchCustomerPagingResult(change.state, read.effect.token, invalid).state, change.state);
  }
});

test('typing during an append retires that page and does not auto-request another', () => {
  const ready = done(start(), page(50)), append = a.werkaBatchCustomerPagingMore(ready);
  const changed = a.werkaBatchCustomerPagingQuery(append.state, 'new');
  assert.equal(changed.effect.kind, 'schedule'); assert.deepEqual(changed.state.raw, []);
  assert.equal(a.werkaBatchCustomerPagingResult(changed.state, append.effect.token, [customer(51)]).state, changed.state);
  assert.equal(a.werkaBatchCustomerPagingMore(changed.state).effect, null);
});

test('closed instances ignore every later timer, page, retry and query event', () => {
  const read = start(), closed = a.werkaBatchCustomerPagingClose(read.state);
  assert.equal(closed.closed, true); assert.deepEqual(closed.raw, []); assert.equal(closed.loading, false);
  assert.equal(a.werkaBatchCustomerPagingClose(closed), closed);
  assert.equal(a.werkaBatchCustomerPagingResult(closed, read.effect.token, [customer(1)]).state, closed);
  assert.equal(a.werkaBatchCustomerPagingFailure(closed, read.effect.token).state, closed);
  assert.equal(a.werkaBatchCustomerPagingDebounced(closed, read.effect.token).state, closed);
  assert.equal(a.werkaBatchCustomerPagingQuery(closed, 'later').state, closed);
  assert.equal(a.werkaBatchCustomerPagingMore(closed).state, closed); assert.equal(a.werkaBatchCustomerPagingRetry(closed).state, closed);
});

test('opaque tokens prevent stale cross-instance and cloned-token completions', () => {
  const old = start(), fresh = start(), cloned = { ...fresh.effect.token };
  assert.notEqual(old.effect.token, fresh.effect.token);
  assert.equal(a.werkaBatchCustomerPagingResult(fresh.state, old.effect.token, [customer(1)]).state, fresh.state);
  assert.equal(a.werkaBatchCustomerPagingResult(fresh.state, cloned, [customer(1)]).state, fresh.state);
  assert.equal(done(fresh, [customer(2)]).raw[0].ref, '2');
  assert.ok(Object.isFrozen(fresh.effect) && Object.isFrozen(fresh.effect.token) && Object.isFrozen(fresh));
});

test('single-query ordering is recomputed over the complete raw accumulation', () => {
  const first = start(), query = a.werkaBatchCustomerPagingQuery(first.state, 'abc');
  const read = a.werkaBatchCustomerPagingDebounced(query.state, query.effect.token);
  const ready = done(read, [customer(1, 'Other'), ...page(49)]), more = a.werkaBatchCustomerPagingMore(ready);
  const final = done(more, [customer(1, 'abc'), customer(1, 'abc')]), view = a.werkaBatchCustomerPagingDisplay(final);
  assert.deepEqual(view.customers.slice(0, 2).map(row => row.name), ['abc', 'abc']);
  assert.equal(final.raw.length, 52); assert.equal(final.raw[0].name, 'Other');
});

test('unstarted transitions do not issue work and invalid query types fail closed', () => {
  const initial = a.werkaBatchCustomerPagingInitial();
  assert.equal(a.werkaBatchCustomerPagingQuery(initial, 'abc').effect, null);
  assert.equal(a.werkaBatchCustomerPagingMore(initial).effect, null); assert.equal(a.werkaBatchCustomerPagingRetry(initial).effect, null);
  assert.throws(() => a.werkaBatchCustomerPagingQuery(initial, null), /Invalid customer query/);
});

test('paging descriptions do not import timers, catalog, account, route or activity store', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../src/werka/werkaBatchCustomerPaging.ts'), 'utf8');
  assert.doesNotMatch(source, /setTimeout\(|setInterval\(|authorizedFetch|SearchActivityStore|werkaCustomers|expo-router/);
});
