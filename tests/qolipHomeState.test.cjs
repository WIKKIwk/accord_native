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
function harness(overrides = {}) {
  const calls = []; let scope = 'one', valid = true;
  const deps = { blocks: async () => { calls.push(['blocks', scope]); return result([block('A'), block('B'), block(' ')]); },
    locations: async name => { calls.push(['locations', name]); return [location('1', name, 'A1')]; },
    readOrder: async () => ['b'], saveOrder: async keys => { calls.push(['saveOrder', keys]); },
    scope: () => scope, valid: () => valid, ...overrides };
  const state = new QolipHomeState(deps);
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
