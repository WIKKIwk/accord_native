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
const trim = value => value.replace(/^[\s\u0085]+|[\s\u0085]+$/g, '');
const logic = load('qolipHomeLogic.ts', { './qolipApiCommon': { trimDart: trim }, './qolipSearchEngine': {} });
const { qolipHomePresentation } = load('qolipHomePresentation.ts', { './qolipHomeLogic': logic });
const drag = load('qolipBlockTabDrag.ts');
const { QolipHomeState } = load('qolipHomeState.ts', { './qolipHomeLogic': logic, './qolipApiCommon': { trimDart: trim } });
const block = name => ({ name, warehouse: 'W' });
const state = (patch = {}) => ({ snapshot: null, orderedBlocks: [], selectedIndex: 0, loading: false, error: false,
  invalid: false, query: '', blockCounts: {}, cellCounts: {}, ...patch });
const result = blocks => ({ warehouses: ['W'], blocks, supports_cross_block_move: true });
const populated = (patch = {}) => qolipHomePresentation(state({ snapshot: result([block(' Alpha '), block('B'), block('C')]), ...patch }));

test('outer home follows invalid, initial loading, settled error and cached loading branch precedence', () => {
  assert.deepEqual(qolipHomePresentation(state({ invalid: true, loading: true, error: true })), { kind: 'invalid' });
  assert.deepEqual(qolipHomePresentation(state({ loading: true })), { kind: 'loading' });
  assert.deepEqual(qolipHomePresentation(state({ error: true })), { kind: 'retry' });
  assert.equal(populated({ loading: true }).kind, 'blocks');
  assert.equal(populated({ error: true }).kind, 'retry');
});

test('the two V2 empty home states depend on warehouses, not on the search query', () => {
  assert.deepEqual(qolipHomePresentation(state({ snapshot: result([]), query: 'x' })), { kind: 'no-blocks' });
  assert.deepEqual(qolipHomePresentation(state({ snapshot: { ...result([]), warehouses: [] } })), { kind: 'unattached' });
  assert.deepEqual(qolipHomePresentation(state()), { kind: 'unattached' });
});

test('tabs preserve supplied order, display names and selected original indices while matching normalized keys', () => {
  const blocks = [block('C'), block(' Alpha '), block('B')], cells = { alpha: { A1: 2 } };
  const view = populated({ orderedBlocks: blocks, selectedIndex: 1, blockCounts: { alpha: 2, c: 0, b: 1000 }, cellCounts: cells, query: 'needle' });
  assert.equal(view.kind, 'blocks'); assert.deepEqual(view.tabs.map(tab => tab.block), blocks);
  assert.deepEqual(view.tabs.map(tab => [tab.key, tab.index, tab.selected, tab.matchCount]), [
    ['c', 0, false, 0], ['alpha', 1, true, 2], ['b', 2, false, 1000],
  ]);
  assert.equal(view.selected.block.name, ' Alpha '); assert.equal(view.cellCounts, cells);
});

test('a temporary Add-page index is clamped to the last real block without exposing an Add destination', () => {
  assert.equal(populated({ selectedIndex: 3 }).selected.key, 'c');
  assert.equal(populated({ selectedIndex: -1 }).selected.key, 'alpha');
});

test('drag center thresholds include the current horizontal scroll offset and freeze original positions', () => {
  const tabs = populated().tabs, layouts = new Map([['alpha', { x: 0, width: 100 }], ['b', { x: 100, width: 80 }], ['c', { x: 180, width: 120 }]]);
  const active = drag.startQolipTabDrag(tabs, 'b', layouts, 110, 30);
  assert.deepEqual([...active.centers], [['alpha', 30], ['b', 120], ['c', 220]]);
  assert.deepEqual([-500, 29, 30, 119, 120, 219, 220, 999].map(x => drag.qolipTabDragTarget(tabs, active.centers, x)), [0, 0, 0, 0, 1, 1, 2, 2]);
  layouts.set('c', { x: 20, width: 10 });
  assert.equal(active.centers.get('c'), 220, 'native preview relayout must not change hit thresholds');
});

test('preview reorders only the dragged tab and preserves the selected block identity', () => {
  const tabs = populated({ selectedIndex: 1 }).tabs;
  const active = { key: 'alpha', centers: new Map(), targetIndex: 2 };
  const preview = drag.previewQolipTabDrag(tabs, active);
  assert.deepEqual(preview.map(tab => tab.key), ['b', 'c', 'alpha']);
  assert.equal(preview.find(tab => tab.selected).key, 'b');
  assert.deepEqual(tabs.map(tab => tab.key), ['alpha', 'b', 'c']);
});

test('release produces one original-index reorder while cancel, unchanged and removed source produce none', () => {
  const tabs = populated().tabs, centers = new Map([['alpha', 30], ['b', 120], ['c', 220]]);
  const active = { key: 'alpha', centers, targetIndex: 1 };
  assert.deepEqual(drag.finishQolipTabDrag(tabs, active, 220), { oldIndex: 0, newIndex: 2 });
  assert.equal(drag.finishQolipTabDrag(tabs, active, 0), null);
  assert.equal(drag.finishQolipTabDrag(tabs, null, 220), null);
  assert.equal(drag.finishQolipTabDrag(tabs.slice(1), active, 220), null);
  const remaining = tabs.slice(1); assert.equal(drag.previewQolipTabDrag(remaining, active), remaining);
});

test('unmeasured tabs cannot start a fabricated drag and absent center maps have no target', () => {
  const tabs = populated().tabs;
  assert.equal(drag.startQolipTabDrag(tabs, 'alpha', new Map(), 0, 0), null);
  assert.equal(drag.startQolipTabDrag(tabs, 'alpha', new Map([['alpha', { x: 0, width: 0 }]]), 0, 0), null);
  assert.equal(drag.qolipTabDragTarget(tabs, new Map(), 0), -1);
  assert.equal(drag.qolipTabDragTarget([], new Map([['gone', 0]]), 0), -1);
});

test('a committed tab reorder reuses the existing Home state persistence and selection rules', async () => {
  const saved = [], home = new QolipHomeState({ blocks: async () => result([block('A'), block('B'), block('C')]),
    locations: async () => [], readOrder: async () => [], saveOrder: async keys => saved.push(keys),
    scope: () => 'one', valid: () => true, afterFrame: fn => fn() });
  try {
    await home.start(); home.select(1);
    const tabs = qolipHomePresentation(home.getSnapshot()).tabs, active = { key: 'a', centers: new Map([['a', 40], ['b', 120], ['c', 200]]), targetIndex: 2 };
    assert.equal(saved.length, 0, 'preview does not persist');
    const move = drag.finishQolipTabDrag(tabs, active, 200); home.reorder(move.oldIndex, move.newIndex);
    assert.deepEqual(saved, [['b', 'c', 'a']]);
    const view = qolipHomePresentation(home.getSnapshot());
    assert.deepEqual(view.tabs.map(tab => tab.key), ['b', 'c', 'a']); assert.equal(view.selected.key, 'b');
  } finally { home.dispose(); }
});
