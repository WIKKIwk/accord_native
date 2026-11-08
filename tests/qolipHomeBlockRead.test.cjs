const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
function load(name, dependencies = {}) {
  const filename = path.resolve(__dirname, '../src/qolip', name), m = new Module(filename, module);
  m.require = key => key in dependencies ? dependencies[key] : require(key);
  m._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return m.exports;
}
const { QolipHomeBlockReadState } = load('qolipHomeBlockReadState.ts');
const trimDart = value => value.replace(/^[\s\u0085]+|[\s\u0085]+$/g, '');
const homeLogic = load('qolipHomeLogic.ts', { './qolipApiCommon': { trimDart }, './qolipSearchEngine': {} });
const { QolipHomeState } = load('qolipHomeState.ts', { './qolipApiCommon': { trimDart }, './qolipHomeLogic': homeLogic });
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const tick = () => new Promise(resolve => setImmediate(resolve));
const rows = id => [{ id, block: 'A', warehouse: 'W', item_name: id, item_code: 'I', qolip_code: 'Q', size: 1,
  quantity: 1, row_letter: 'A', column_number: 1, location_label: 'A1' }];
function harness(initial = null) {
  let current = true, stops = 0; const listeners = new Set();
  const boundary = { current: () => current, subscribe: callback => { listeners.add(callback); return () => { stops++; listeners.delete(callback); }; } };
  const state = new QolipHomeBlockReadState(initial, boundary); let events = 0; state.subscribe(() => events++);
  return { state, boundary, events: () => events, stops: () => stops, listeners,
    invalidate: () => { current = false; for (const callback of [...listeners]) callback(); }, setCurrent: value => { current = value; } };
}
test('block FutureBuilder begins with null or real cached initial data, including an empty list', async () => {
  for (const initial of [null, [], rows('cached')]) {
    const h = harness(initial), future = deferred(); h.state.activate(); h.state.bind(future.promise);
    assert.equal(h.state.getSnapshot().locations, initial); assert.equal(h.state.getSnapshot().loading, true);
    const data = rows('new'); future.resolve(data); await tick();
    assert.deepEqual(h.state.getSnapshot(), { locations: data, loading: false, error: false, invalid: false }); h.state.suspend();
  }
});
test('a replacement future keeps prior data while pending and replaces it on success', async () => {
  const h = harness(), first = rows('first'), next = deferred(); h.state.activate(); h.state.bind(Promise.resolve(first)); await tick();
  h.state.bind(next.promise); assert.equal(h.state.getSnapshot().locations, first); assert.equal(h.state.getSnapshot().loading, true);
  const second = rows('second'); next.resolve(second); await tick(); assert.equal(h.state.getSnapshot().locations, second); h.state.suspend();
});
test('binding the same future does not cause a duplicate subscription or loading reset', async () => {
  const h = harness(), data = rows('first'), future = Promise.resolve(data); h.state.activate(); h.state.bind(future); await tick();
  const snapshot = h.state.getSnapshot(), events = h.events(); h.state.bind(future);
  assert.equal(h.state.getSnapshot(), snapshot); assert.equal(h.events(), events); assert.equal(h.listeners.size, 1); h.state.suspend();
});
test('settled failure clears old data exactly like AsyncSnapshot.withError and exposes retry', async () => {
  const h = harness(rows('cached')), next = deferred(); h.state.activate(); h.state.bind(next.promise);
  next.reject(new Error('offline')); await tick();
  assert.deepEqual(h.state.getSnapshot(), { locations: null, loading: false, error: true, invalid: false });
  const retry = deferred(); h.state.bind(retry.promise); assert.equal(h.state.getSnapshot().loading, true);
  retry.resolve([]); await tick(); assert.deepEqual(h.state.getSnapshot(), { locations: [], loading: false, error: false, invalid: false }); h.state.suspend();
});
test('older successful and rejected futures cannot replace the newer block snapshot', async () => {
  for (const failure of [false, true]) {
    const h = harness(), old = deferred(), fresh = deferred(); h.state.activate(); h.state.bind(old.promise); h.state.bind(fresh.promise);
    const data = rows('fresh'); fresh.resolve(data); await tick(); const snapshot = h.state.getSnapshot();
    if (failure) old.reject(new Error('old')); else old.resolve(rows('old'));
    await tick(); assert.equal(h.state.getSnapshot(), snapshot); assert.equal(h.state.getSnapshot().locations, data); h.state.suspend();
  }
});
test('an invalid original boundary clears cached data and never revives after the predicate later returns true', async () => {
  const h = harness(rows('private')), pending = deferred(); h.state.activate(); h.state.bind(pending.promise); h.invalidate();
  assert.deepEqual(h.state.getSnapshot(), { locations: null, loading: false, error: false, invalid: true });
  assert.equal(h.stops(), 1); assert.equal(h.listeners.size, 0); assert.equal(h.state.canAct(), false);
  h.setCurrent(true); h.state.activate(); pending.resolve(rows('late')); await tick();
  assert.equal(h.state.getSnapshot().invalid, true); assert.equal(h.state.canAct(), false);
});
test('a false, throwing or async current predicate fails closed before a subscription can start', () => {
  for (const current of [() => false, () => { throw new Error('guard'); }, async () => true, async () => { throw new Error('async guard'); }]) {
    let subscriptions = 0; const state = new QolipHomeBlockReadState(rows('private'), { current, subscribe: () => { subscriptions++; return () => {}; } });
    assert.equal(state.getSnapshot().invalid, true); state.activate(); assert.equal(subscriptions, 0); assert.equal(state.canAct(), false);
  }
});
test('subscription exceptions and async subscriptions cannot leave an actionable unguarded body', () => {
  for (const subscribe of [() => { throw new Error('subscription'); }, async () => () => {}, async () => { throw new Error('async subscription'); }]) {
    const state = new QolipHomeBlockReadState(rows('private'), { current: () => true, subscribe });
    assert.throws(() => state.activate()); assert.equal(state.getSnapshot().invalid, true); assert.equal(state.canAct(), false);
  }
});
test('invalidation during boundary registration cleans up and rejects all later completions', () => {
  let current = true, stops = 0;
  const state = new QolipHomeBlockReadState(rows('private'), { current: () => current,
    subscribe: listener => { current = false; listener(); return () => { stops++; }; } });
  state.activate(); assert.equal(stops, 1); assert.equal(state.getSnapshot().invalid, true); assert.equal(state.canAct(), false);
});
test('suspension rejects old completions and actions; strict-effect reactivation needs a fresh binding', async () => {
  const h = harness(), old = deferred(), fresh = deferred(); h.state.activate(); h.state.bind(old.promise); h.state.suspend();
  old.resolve(rows('old')); await tick(); assert.equal(h.state.getSnapshot().locations, null); assert.equal(h.state.canAct(), false);
  h.state.activate(); h.state.bind(fresh.promise); const data = rows('fresh'); fresh.resolve(data); await tick();
  assert.equal(h.state.getSnapshot().locations, data); assert.equal(h.state.canAct(), true); assert.equal(h.stops(), 1); h.state.suspend();
});
test('real Home cached futures retain block data across body remount without another request', async () => {
  const data = rows('cached'); let reads = 0;
  const home = new QolipHomeState({ blocks: async () => ({ blocks: [{ name: 'A', warehouse: 'W' }], warehouses: ['W'], supports_cross_block_move: false }),
    locations: async () => { reads++; return data; }, readOrder: async () => [], saveOrder: async () => {}, scope: () => 'one', valid: () => true, afterFrame: fn => fn() });
  try {
    await home.start(); const a = harness(home.resolvedFor('A')); a.state.activate(); a.state.bind(home.locationsFor('A')); await tick();
    assert.deepEqual(a.state.getSnapshot().locations, data); a.state.suspend();
    const b = harness(home.resolvedFor('a')); assert.deepEqual(b.state.getSnapshot().locations, data);
    b.state.activate(); b.state.bind(home.locationsFor('a')); await tick(); assert.equal(reads, 1); assert.deepEqual(b.state.getSnapshot().locations, data); b.state.suspend();
  } finally { home.dispose(); }
});
test('failed manual refresh clears body data but a failed quiet Home refresh preserves its original future', async () => {
  let reads = 0; const data = rows('cached');
  const home = new QolipHomeState({ blocks: async () => ({ blocks: [{ name: 'A', warehouse: 'W' }], warehouses: ['W'], supports_cross_block_move: false }),
    locations: async () => { if (++reads > 1) throw new Error('offline'); return data; }, readOrder: async () => [], saveOrder: async () => {},
    scope: () => 'one', valid: () => true, afterFrame: fn => fn() });
  const h = harness();
  try {
    await home.start(); h.state.activate(); const original = home.locationsFor('A'); h.state.bind(original); await tick();
    home.locationsChanged(); await tick(); await tick(); assert.equal(home.locationsFor('A'), original);
    h.state.bind(home.locationsFor('A')); assert.deepEqual(h.state.getSnapshot().locations, data);
    const manual = home.refreshBlock('A'); h.state.bind(manual); await tick();
    assert.equal(h.state.getSnapshot().locations, null); assert.equal(h.state.getSnapshot().error, true);
  } finally { h.state.suspend(); home.dispose(); }
});

test('invalidated state observes an already-created failed future without publishing or claiming cancellation', async () => {
  const h = harness(rows('cached')); h.setCurrent(false); h.state.activate(); const future = deferred();
  h.state.bind(future.promise); future.reject(new Error('already dispatched'));
  await assert.rejects(future.promise, /already dispatched/); await tick();
  assert.equal(h.state.getSnapshot().invalid, true); assert.equal(h.state.getSnapshot().locations, null); assert.equal(h.state.canAct(), false);
});
