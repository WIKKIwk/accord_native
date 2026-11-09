// Unwired flow with fake guards and reads only. No account, backend, picker, write or route is used.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const { testWerkaGuardEvaluator } = require('./support/werkaGuardEvaluator.cjs');
function load(file, cache = new Map()) {
  const name = file.endsWith('.ts') ? file : `${file}.ts`;
  if (cache.has(name)) return cache.get(name);
  const loaded = new Module(name); loaded.filename = name; loaded.paths = require.main.paths; cache.set(name, loaded.exports);
  loaded.require = child => child.startsWith('.') ? load(path.resolve(path.dirname(name), child), cache) : require(child);
  loaded._compile(ts.transpileModule(fs.readFileSync(name, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, name);
  cache.set(name, loaded.exports); return loaded.exports;
}
const { WerkaArchiveBatchLookupFlow } = load(path.resolve(__dirname, '../src/werka/werkaArchiveBatchLookupFlow.ts'));
const defer = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const tick = () => new Promise(resolve => setImmediate(resolve));
const option = (name = 'Item', code = 'IT') => ({ customerRef: 'fallback', customerName: 'Fallback', customerPhone: 'phone',
  itemCode: code, itemName: name, uom: 'Kg', warehouse: 'WH' });
const primary = () => ({ ref: 'P', name: 'Primary', phone: '123' });
const secondary = () => ({ ref: 'S', name: 'saidamin', phone: '' });
function harness(overrides = {}, itemName = 'Item') {
  let active = true; const calls = [], states = [];
  const deps = { isCurrent: () => active, evaluateGuard: testWerkaGuardEvaluator,
    loadOptions: async input => { calls.push(['options', input]); return [option()]; },
    loadCustomers: async input => { calls.push(['customers', input]); return [secondary(), primary()]; },
    onState: value => states.push(value), ...overrides };
  const flow = new WerkaArchiveBatchLookupFlow(itemName, deps);
  return { flow, deps, calls, states, invalidate: () => { active = false; } };
}

test('source lookup uses the exact first item then the preferred customer with the source query arguments', async () => {
  const h = harness(); assert.deepEqual(h.flow.getSnapshot(), { state: 'loading' });
  await h.flow.start(); await h.flow.start();
  assert.deepEqual(h.calls, [['options', { query: 'Item', limit: 200 }],
    ['customers', { itemCode: 'IT', itemName: 'Item', query: '', limit: 200, offset: 0 }]]);
  assert.deepEqual(h.flow.getSnapshot(), { state: 'resolved', option: option(), customer: primary() });
  assert.deepEqual(h.states.map(value => value.state), ['loading', 'resolved']);
  for (const name of ['retry', 'pickCustomer', 'send', 'navigate']) assert.equal(h.flow[name], undefined);
});

test('real dependency functions are required; no fake default adapter or observer is supplied', () => {
  const h = harness();
  for (const key of ['isCurrent', 'evaluateGuard', 'loadOptions', 'loadCustomers', 'onState']) {
    assert.throws(() => new WerkaArchiveBatchLookupFlow('Item', { ...h.deps, [key]: undefined }), TypeError);
  }
  assert.throws(() => new WerkaArchiveBatchLookupFlow(null, h.deps), TypeError);
});

test('the first exact code or name match wins, even if later options also match', async () => {
  const first = option('Other', 'Item'), second = option('Item', 'IT');
  const h = harness({ loadOptions: async () => [option('Not this', 'X'), first, second] });
  await h.flow.start(); assert.equal(h.flow.getSnapshot().option.itemCode, 'Item');
  assert.equal(h.calls[0][1].itemName, 'Other');
});

test('missing, rejected or malformed item results resolve to the source missing state without a customer read', async () => {
  for (const loadOptions of [async () => [], async () => [option('Other', 'X')],
    async () => { throw Error('offline'); }, async () => null, async () => [{ itemName: null }]]) {
    let customerCalls = 0; const h = harness({ loadOptions, loadCustomers: async () => { customerCalls++; return []; } });
    await h.flow.start(); assert.deepEqual(h.flow.getSnapshot(), { state: 'missing' }); assert.equal(customerCalls, 0);
  }
});

test('failed or empty customer lookup falls back to the matched option, while nonempty refs prefer a non-secondary customer', async () => {
  for (const loadCustomers of [async () => [], async () => { throw Error('offline'); },
    async () => [{ ref: '\u0085', name: 'Ignored', phone: '' }]]) {
    const h = harness({ loadCustomers }); await h.flow.start();
    assert.deepEqual(h.flow.getSnapshot().customer, { ref: 'fallback', name: 'Fallback', phone: 'phone' });
  }
  const h = harness({ loadCustomers: async () => [secondary(), primary()] }); await h.flow.start();
  assert.deepEqual(h.flow.getSnapshot().customer, primary());
});

test('account invalidation or disposal during item read suppresses customer read and stale state', async () => {
  for (const stop of ['invalidate', 'dispose']) {
    const pending = defer(); let reads = 0; const h = harness({ loadOptions: () => pending.promise,
      loadCustomers: async () => { reads++; return [primary()]; } });
    const running = h.flow.start(), before = h.states.length;
    if (stop === 'invalidate') h.invalidate(); else h.flow.dispose();
    pending.resolve([option()]); await running;
    assert.equal(reads, 0); assert.equal(h.states.length, before); assert.equal(h.flow.getSnapshot(), null);
    await h.flow.start(); assert.equal(reads, 0);
  }
});

test('account invalidation or disposal during customer read suppresses both a result and an error fallback', async () => {
  for (const stop of ['invalidate', 'dispose']) for (const reject of [false, true]) {
    const pending = defer(); let customerReads = 0; const h = harness({ loadCustomers: () => { customerReads++; return pending.promise; } });
    const running = h.flow.start(); await tick(); const before = h.states.length;
    if (stop === 'invalidate') h.invalidate(); else h.flow.dispose();
    if (reject) pending.reject(Error('late')); else pending.resolve([primary()]);
    await running; assert.equal(customerReads, 1); assert.equal(h.states.length, before); assert.equal(h.flow.getSnapshot(), null);
  }
});

test('invalidation while projecting the matched option stops before the second read', async () => {
  for (const field of ['itemName', 'warehouse']) {
    let active = true, customerReads = 0; const value = option(), original = value[field];
    Object.defineProperty(value, field, { get() { active = false; return original; } });
    const h = harness({ isCurrent: () => active, loadOptions: async () => [value],
      loadCustomers: async () => { customerReads++; return []; } });
    await h.flow.start(); assert.equal(customerReads, 0); assert.equal(h.flow.getSnapshot(), null);
    assert.equal(h.states.some(state => state.state === 'resolved'), false);
  }
});

test('invalidation while projecting customers suppresses publication', async () => {
  let active = true; const value = primary();
  Object.defineProperty(value, 'name', { get() { active = false; return 'Primary'; } });
  const h = harness({ isCurrent: () => active, loadCustomers: async () => [value] });
  await h.flow.start(); assert.equal(h.flow.getSnapshot(), null);
  assert.equal(h.states.some(state => state.state === 'resolved'), false);
});

test('replacing either adapter or the observer suppresses pending lookup results', async () => {
  for (const dependency of ['loadOptions', 'loadCustomers', 'onState']) {
    const pending = defer(); const h = harness({ loadOptions: () => pending.promise });
    const running = h.flow.start(), before = h.states.length;
    h.deps[dependency] = async () => []; pending.resolve([option()]); await running;
    assert.equal(h.states.length, before); assert.equal(h.calls.length, 0);
    assert.deepEqual(h.flow.getSnapshot(), { state: 'loading' });
  }
});

test('adapter or observer replacement while the customer read is pending suppresses success and fallback', async () => {
  for (const dependency of ['loadOptions', 'loadCustomers', 'onState']) for (const reject of [false, true]) {
    const pending = defer(); const h = harness({ loadCustomers: () => pending.promise });
    const running = h.flow.start(); await tick(); const before = h.states.length;
    h.deps[dependency] = async () => [];
    if (reject) pending.reject(Error('late')); else pending.resolve([primary()]);
    await running; assert.equal(h.states.length, before); assert.deepEqual(h.flow.getSnapshot(), { state: 'loading' });
  }
});

test('observer invalidation, replacement or failure before the first read prevents it', async () => {
  for (const change of ['invalidate', 'replace', 'throw']) {
    let reads = 0, h; h = harness({ loadOptions: async () => { reads++; return [option()]; }, onState: () => {
      if (change === 'invalidate') h.invalidate(); else if (change === 'replace') h.deps.loadOptions = async () => [];
      else throw Error('observer');
    } });
    await h.flow.start(); assert.equal(reads, 0);
  }
});

test('asynchronous or rejected observer results fail closed without an unhandled rejection', async () => {
  const unhandled = [], listener = error => unhandled.push(error); process.on('unhandledRejection', listener);
  try {
    for (const onState of [() => Promise.resolve(), () => Promise.reject(Error('observer'))]) {
      let reads = 0; const h = harness({ onState, loadOptions: async () => { reads++; return [option()]; } });
      await h.flow.start(); assert.equal(reads, 0);
    }
    await tick(); assert.deepEqual(unhandled, []);
  } finally { process.off('unhandledRejection', listener); }
});

test('required evaluator and guard must synchronously return literal true without rejected thenables escaping', async () => {
  const unhandled = [], listener = error => unhandled.push(error); process.on('unhandledRejection', listener);
  try {
    for (const key of ['isCurrent', 'evaluateGuard']) for (const value of [() => false, () => undefined,
      () => Promise.resolve(true), () => Promise.reject(Error('no')), () => { throw Error('no'); }]) {
      const h = harness({ [key]: value }); await h.flow.start(); assert.deepEqual(h.calls, []); assert.equal(h.flow.getSnapshot(), null);
    }
    await tick(); assert.deepEqual(unhandled, []);
  } finally { process.off('unhandledRejection', listener); }
});

test('scope-bound evaluator rejects a change inside the guard', async () => {
  for (const key of ['account', 'scope', 'generation']) {
    const live = { account: 'A', scope: 'W', generation: 1 }, original = { ...live };
    const same = () => JSON.stringify(live) === JSON.stringify(original);
    const h = harness({ evaluateGuard: guard => same() && testWerkaGuardEvaluator(guard) === true && same(),
      isCurrent: () => { live[key] = key === 'generation' ? 2 : 'changed'; return true; } });
    await h.flow.start(); assert.deepEqual(h.calls, []); assert.equal(h.flow.getSnapshot(), null);
  }
});

test('reentrant starts do not duplicate source reads', async () => {
  const pending = defer(); let h, options = 0;
  h = harness({ loadOptions: () => { options++; return pending.promise; },
    onState: state => { if (state.state === 'loading') void h.flow.start(); } });
  const running = h.flow.start(); assert.equal(options, 1); pending.resolve([option()]); await running;
  assert.equal(options, 1); assert.equal(h.flow.getSnapshot().state, 'resolved');
});

test('a reentrant guard cannot recurse or trigger a second lookup', async () => {
  let h, reads = 0, nested;
  h = harness({ isCurrent: () => { nested = h.flow.getSnapshot(); void h.flow.start(); return true; },
    loadOptions: async () => { reads++; return [option()]; } });
  await h.flow.start(); assert.equal(reads, 1); assert.equal(nested, null);
  assert.equal(h.flow.getSnapshot().state, 'resolved');
});

test('copies option, customer, query and snapshots instead of retaining mutable adapter values', async () => {
  const pending = defer(), selected = option(), customer = primary(); let query;
  const h = harness({ loadOptions: async input => { input.query = 'changed'; return [selected]; },
    loadCustomers: input => { query = input; input.itemCode = 'changed'; return pending.promise; },
    onState: snapshot => { if (snapshot.state === 'resolved') { snapshot.option.itemCode = 'observer'; snapshot.customer.name = 'observer'; } } });
  const running = h.flow.start(); await tick(); selected.itemCode = 'late'; pending.resolve([customer]); await running;
  customer.name = 'late'; query.itemName = 'later';
  const snapshot = h.flow.getSnapshot(); assert.equal(snapshot.option.itemCode, 'IT'); assert.equal(snapshot.customer.name, 'Primary');
  snapshot.option.itemCode = 'outer'; snapshot.customer.name = 'outer';
  assert.equal(h.flow.getSnapshot().option.itemCode, 'IT'); assert.equal(h.flow.getSnapshot().customer.name, 'Primary');
});
