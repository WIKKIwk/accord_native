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
const relevance = load('qolip/qolipSearchRelevance.ts', { './qolipSearchEngine': search });
const placement = load('qolip/qolipCellPlacement.ts', { './qolipApiCommon': common, './qolipSearchEngine': search, './qolipSearchRelevance': relevance });
const { QolipCellPickerState } = load('qolip/qolipCellPickerState.ts', { './qolipApiCommon': common, './qolipCellPlacement': placement });
const product = (id, name = `Name ${id}`) => ({ code: `I-${id}`, name, item_group: '', customer_names: [], qolip_code: id,
  size: 40, has_qolip_spec: true, is_in_use: false });
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

test('initial and following pages request 80 and retain stable relevance across all loaded rows', async () => {
  const calls = [], all = Array.from({ length: 82 }, (_, index) => product(String(index), index === 81 ? 'Exact' : `Other ${index}`));
  const picker = { loadPage: async (query, offset, limit) => { calls.push([query, offset, limit]); return all.slice(offset, offset + limit); }, close() {} };
  const state = new QolipCellPickerState(() => picker); state.activate(); await state.start();
  assert.equal(state.getSnapshot().items.length, 80); assert.equal(state.getSnapshot().hasMore, true);
  await state.loadMore(); assert.deepEqual(calls, [['', 0, 80], ['', 80, 80]]); assert.equal(state.getSnapshot().hasMore, false);
  state.setQuery('Exact'); await sleep(250); assert.deepEqual(calls.at(-1), ['Exact', 0, 80]);
  // Once a second page is loaded, its exact match is ranked with all earlier results.
  await state.loadMore(); assert.equal(state.visibleItems[0].name, 'Exact'); state.dispose();
});

test('search debounces 220 ms and an older response cannot replace a newer request', async () => {
  const first = deferred(), next = deferred(), calls = [];
  const state = new QolipCellPickerState(() => ({ loadPage: (q, o, n) => { calls.push([q, o, n]); return q ? next.promise : first.promise; }, close() {} }));
  state.activate(); const original = state.start(); state.setQuery('old'); state.setQuery('new'); await sleep(240);
  assert.deepEqual(calls, [['', 0, 80], ['new', 0, 80]]); first.resolve([product('old')]); await original;
  assert.equal(state.getSnapshot().loading, true); next.resolve([product('new')]); await sleep(0);
  assert.deepEqual(state.visibleItems.map(item => item.qolip_code), ['new']); state.dispose();
});

test('long press and taps use normalized mold code, retain selection order and never trigger single selection', async () => {
  const state = new QolipCellPickerState(() => ({ loadPage: async () => [], close() {} })); state.activate(); await state.start();
  const a = product(' Q-1 '), b = product('Q-2'), duplicate = product('q-1'); assert.equal(state.tap(a), a);
  state.toggle(a); assert.equal(state.tap(b), null); assert.deepEqual(state.selectedProducts, [a, b]);
  assert.deepEqual([...state.getSnapshot().selected], ['q-1', 'q-2']); state.toggle(duplicate);
  assert.deepEqual(state.selectedProducts, [b]); state.toggle(a); assert.deepEqual(state.selectedProducts, [b, a]); state.dispose();
});

test('error supports retry, close cancels pending reads and reopening creates a fresh picker', async () => {
  let runs = 0, closed = 0, picks = 0; const wait = deferred();
  const state = new QolipCellPickerState(() => { picks++; return { loadPage: async () => {
    runs++; if (runs === 1) throw new Error('offline'); if (runs === 2) return wait.promise; return [product('new')]; }, close: () => closed++ }; });
  state.activate(); await state.start(); assert.equal(state.getSnapshot().error, true);
  const pending = state.retry(); state.dispose(); assert.equal(closed, 1); state.activate(); await state.start();
  wait.resolve([product('stale')]); await pending; assert.deepEqual(state.visibleItems.map(x => x.qolip_code), ['new']);
  assert.equal(picks, 2); assert.equal(state.getSnapshot().error, false); state.dispose();
});
