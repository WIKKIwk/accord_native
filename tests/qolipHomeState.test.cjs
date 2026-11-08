const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
function load(name, dependencies = {}) {
  const filename = path.resolve(__dirname, '../src', name), m = new Module(filename, module);
  m.require = key => key in dependencies ? dependencies[key] : require(key);
  m._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return m.exports;
}
const common = load('qolip/qolipApiCommon.ts', { '../shared/mobileApiException': {} });
const search = load('qolip/qolipSearchEngine.ts', { '../shared/searchNormalizer': load('shared/searchNormalizer.ts') });
const homeLogic = load('qolip/qolipHomeLogic.ts', { './qolipApiCommon': common, './qolipSearchEngine': search });
const { QolipHomeState } = load('qolip/qolipHomeState.ts', { './qolipApiCommon': common, './qolipHomeLogic': homeLogic });
const block = (name, warehouse = 'W') => ({ name, warehouse });
const result = blocks => ({ warehouses: ['W', ' '], blocks, supports_cross_block_move: true });
const location = (id, blockName, label, name = 'Hotlunch') => ({ id, block: blockName, warehouse: 'W', item_code: 'I',
  item_name: name, qolip_code: 'Q', size: 42, quantity: 1, row_letter: 'A', column_number: 1, location_label: label });
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const states = [];
test.afterEach(() => { for (const state of states.splice(0)) state.dispose(); });
function harness(overrides = {}) {
  const calls = []; let scope = 'one', valid = true;
  const deps = { blocks: async () => { calls.push(['blocks', scope]); return result([block('A'), block('B'), block(' ')]); },
    locations: async name => { calls.push(['locations', name]); return [location('1', name, 'A1')]; },
    readOrder: async () => ['b'], saveOrder: async keys => { calls.push(['saveOrder', keys]); },
    scope: () => scope, valid: () => valid, afterFrame: callback => queueMicrotask(callback), ...overrides };
  const state = new QolipHomeState(deps); states.push(state);
  return { state, calls, setScope: value => { scope = value; }, setValid: value => { valid = value; } };
}

test('home load filters blanks, restores order and saves reordered keys while retaining selected block', async () => {
  const h = harness(); await h.state.start();
  assert.deepEqual(h.state.getSnapshot().snapshot.warehouses, ['W']);
  assert.deepEqual(h.state.displayBlocks.map(x => x.name), ['B', 'A']);
  h.state.select(1); h.state.reorder(0, 1);
  assert.deepEqual(h.state.displayBlocks.map(x => x.name), ['A', 'B']);
  assert.equal(h.state.getSnapshot().selectedIndex, 0);
  assert.deepEqual(h.calls.at(-1), ['saveOrder', ['a', 'b']]);
  h.state.reorder(-1, 0); assert.equal(h.calls.filter(x => x[0] === 'saveOrder').length, 1);
});

test('locations are cached per normalized block and older responses cannot replace newer refreshes', async () => {
  const old = deferred(), fresh = deferred(); let reads = 0;
  const h = harness({ locations: () => (++reads === 1 ? old.promise : fresh.promise) });
  await h.state.start(); const a = h.state.locationsFor(' A '), b = h.state.locationsFor('a'); assert.equal(a, b);
  const c = h.state.refreshBlock('A'); fresh.resolve([location('new', 'A', 'A1')]); await c;
  old.resolve([location('old', 'A', 'A1')]); await a;
  assert.equal(h.state.resolvedFor('a')[0].id, 'new'); assert.equal(reads, 2);
});

test('a failed location future stays cached until a refresh is explicitly requested', async () => {
  let reads = 0; const h = harness({ locations: async () => { reads++; if (reads === 1) throw new Error('offline'); return []; } });
  await h.state.start(); await assert.rejects(h.state.locationsFor('A'), /offline/); await assert.rejects(h.state.locationsFor('a'), /offline/);
  assert.equal(reads, 1); await h.state.refreshBlock('A'); assert.equal(reads, 2);
});

test('search waits 160 ms, cancels stale input and clears results without rescanning', async () => {
  const h = harness(); await h.state.start(); let events = 0; const stop = h.state.subscribe(() => events++);
  h.state.setQuery('not-matching'); h.state.setQuery('hotlunch');
  assert.equal(events, 0); assert.equal(h.calls.filter(x => x[0] === 'locations').length, 0);
  await delay(195); assert.deepEqual({ ...h.state.getSnapshot().blockCounts }, { b: 1, a: 1 });
  const count = h.calls.filter(x => x[0] === 'locations').length; h.state.setQuery('  ');
  assert.deepEqual(h.state.getSnapshot().blockCounts, {}); await delay(180);
  assert.equal(h.calls.filter(x => x[0] === 'locations').length, count); stop(); h.state.dispose();
});

test('changing account clears home state and ignores old responses', async () => {
  const old = deferred(), fresh = deferred(); let reads = 0;
  const h = harness({ blocks: () => (++reads === 1 ? old.promise : fresh.promise) });
  const pending = h.state.start(); h.setScope('two'); h.state.handleSessionChange();
  fresh.resolve(result([block('C')])); await delay(0); old.resolve(result([block('A')])); await pending;
  assert.deepEqual(h.state.displayBlocks.map(x => x.name), ['C']);
  h.setValid(false); h.state.handleSessionChange();
  assert.equal(h.state.getSnapshot().invalid, true); assert.deepEqual(h.state.displayBlocks, []);
});

test('reload replaces the visible FutureBuilder read and resets location cache', async () => {
  const h = harness(); await h.state.start(); await h.state.locationsFor('A');
  await h.state.reload(); assert.equal(h.state.resolvedFor('A'), null); await h.state.locationsFor('A');
  assert.equal(h.calls.filter(x => x[0] === 'locations').length, 2); assert.equal(h.state.getSnapshot().loading, false);
});

test('dispose cancels delayed search and rejects stale responses from view state', async () => {
  const wait = deferred(), h = harness({ blocks: () => wait.promise });
  const pending = h.state.start(); h.state.setQuery('hotlunch'); h.state.dispose(); wait.resolve(result([block('A')])); await pending;
  await delay(175); assert.equal(h.state.getSnapshot().snapshot, null); assert.deepEqual(h.state.getSnapshot().blockCounts, {});
});


test('forced location revision quietly updates blocks and preserves selected block', async () => {
  let reads = 0;
  const h = harness({ blocks: async () => ++reads === 1 ? result([block('A'), block('B')]) : result([block('B'), block('C')]),
    locations: async name => [location(`new-${name}`, name, 'A1')] });
  await h.state.start(); await h.state.locationsFor('A'); await h.state.locationsFor('B'); h.state.select(0);
  h.state.locationsChanged(); await delay(10);
  assert.deepEqual(h.state.displayBlocks.map(item => item.name), ['B', 'C']);
  assert.equal(h.state.getSnapshot().selectedIndex, 0); assert.equal(h.state.resolvedFor('A'), null);
  assert.equal(h.state.resolvedFor('B')[0].id, 'new-B'); assert.equal(h.state.resolvedFor('C')[0].id, 'new-C');
  assert.equal(reads, 2);
  h.state.routeChanged(true); h.state.routeChanged(false); h.state.routeChanged(true); await delay(10);
  assert.equal(reads, 2, 'ordinary return is suppressed during the 30-second cooldown');
});

test('a failed quiet block location read keeps old rows and clears the cooldown for the next return', async () => {
  let reads = 0, locationReads = 0;
  const h = harness({ blocks: async () => { reads++; return result([block('A')]); },
    locations: async () => { if (++locationReads === 2) throw new Error('offline'); return [location(`loc-${locationReads}`, 'A', 'A1')]; } });
  await h.state.start(); await h.state.locationsFor('A'); h.state.locationsChanged(); await delay(10);
  assert.equal(h.state.resolvedFor('A')[0].id, 'loc-1');
  h.state.routeChanged(true); h.state.routeChanged(false); h.state.routeChanged(true); await delay(10);
  assert.equal(reads, 3); assert.equal(h.state.resolvedFor('A')[0].id, 'loc-3');
});

test('forced revisions while a quiet refresh is running queue exactly one newer refresh', async () => {
  const slow = deferred(); let reads = 0;
  const h = harness({ blocks: () => { reads++; return reads === 2 ? slow.promise : Promise.resolve(result([block(`B${reads}`)])); } });
  await h.state.start(); h.state.locationsChanged(); h.state.locationsChanged(); h.state.locationsChanged();
  assert.equal(reads, 2); slow.resolve(result([block('stale')])); await delay(15);
  assert.equal(reads, 3); assert.deepEqual(h.state.displayBlocks.map(x => x.name), ['B3']);
});

test('a later manual location refresh wins over an older quiet read', async () => {
  const quiet = deferred(); let locationReads = 0;
  const h = harness({ blocks: async () => result([block('A')]), locations: () => {
    locationReads++; if (locationReads === 2) return quiet.promise;
    return Promise.resolve([location(`loc-${locationReads}`, 'A', 'A1')]);
  } });
  await h.state.start(); await h.state.locationsFor('A'); h.state.locationsChanged(); await delay(0);
  await h.state.refreshBlock('A'); quiet.resolve([location('stale', 'A', 'A1')]); await delay(10);
  assert.equal(h.state.resolvedFor('A')[0].id, 'loc-3');
});


test('route return requests refresh only after the provided frame callback and only if still current', async () => {
  const callbacks = []; let reads = 0, locationReads = 0;
  const h = harness({ afterFrame: callback => callbacks.push(callback), blocks: async () => { reads++; return result([block('A')]); },
    locations: async () => { if (++locationReads === 1) throw new Error('offline'); return []; } });
  await h.state.start(); h.state.locationsChanged(); await delay(10);
  h.state.routeChanged(true); h.state.routeChanged(false); h.state.routeChanged(true);
  assert.equal(reads, 2); assert.equal(callbacks.length, 1);
  h.state.routeChanged(false); callbacks.shift()(); await delay(0); assert.equal(reads, 2);
  h.state.routeChanged(true); callbacks.shift()(); await delay(10); assert.equal(reads, 3);
});

test('a failed quiet block list keeps the existing snapshot and retries on return', async () => {
  let reads = 0;
  const h = harness({ blocks: async () => { if (++reads === 2) throw new Error('offline'); return result([block('A')]); } });
  await h.state.start(); h.state.locationsChanged(); await delay(10);
  assert.deepEqual(h.state.displayBlocks.map(x => x.name), ['A']); assert.equal(h.state.getSnapshot().error, false);
  h.state.routeChanged(true); h.state.routeChanged(false); h.state.routeChanged(true); await delay(10);
  assert.equal(reads, 3); assert.equal(h.state.getSnapshot().error, false);
});

test('account switch discards a late quiet response from the previous account', async () => {
  const oldQuiet = deferred(); let reads = 0;
  const h = harness({ blocks: () => { reads++; return reads === 2 ? oldQuiet.promise
    : Promise.resolve(result([block(reads === 1 ? 'Old' : 'New')])); } });
  await h.state.start(); h.state.locationsChanged(); h.setScope('two'); h.state.handleSessionChange();
  await delay(10); oldQuiet.resolve(result([block('Stale')])); await delay(10);
  assert.deepEqual(h.state.displayBlocks.map(x => x.name), ['New']);
});

test('pre-switch invalidation clears old account data even before the active session object changes', async () => {
  const quiet = deferred(); let reads = 0;
  const h = harness({ blocks: () => ++reads === 1 ? Promise.resolve(result([block('Old')])) : quiet.promise });
  await h.state.start(); h.state.locationsChanged(); h.state.invalidateSession();
  assert.equal(h.state.getSnapshot().invalid, true); assert.deepEqual(h.state.displayBlocks, []);
  quiet.resolve(result([block('Stale')])); await delay(10);
  assert.equal(h.state.getSnapshot().invalid, true); assert.deepEqual(h.state.displayBlocks, []);
});
