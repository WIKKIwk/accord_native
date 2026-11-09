const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
function load(file, mocks = {}) {
  const filename = path.resolve(__dirname, '../src/qolip', file), loaded = new Module(filename, module);
  loaded.require = id => id in mocks ? mocks[id] : require(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ESNext,
  } }).outputText, filename);
  return loaded.exports;
}
function harness(platform) {
  const calls = [], capture = { blocks: [], views: [] }, boundary = { current: () => true, subscribe: () => () => {} };
  let live = true;
  const blocks = [{ key: 'a', block: { name: 'A', warehouse: 'W' }, future: Promise.resolve([]), initialLocations: [] },
    { key: 'b', block: { name: 'B', warehouse: 'X' }, future: Promise.resolve([]), initialLocations: null }];
  const actions = { invoke: callback => { if (live) callback(); }, setSearch: value => calls.push(['search', value]), select: value => calls.push(['select', value]),
    reorder: (oldIndex, newIndex) => calls.push(['reorder', oldIndex, newIndex]), retry: async () => { calls.push(['retry']); }, refreshBlock: async name => { calls.push(['refresh', name]); } };
  const model = { home: { kind: 'blocks', selected: { key: 'a' }, tabs: [], cellCounts: { a: { A1: 2 } } }, search: 'raw ', blocks, boundary, actions };
  const component = load(`QolipHomeOwner.${platform}.tsx`, {
    'react-native': { StyleSheet: { create: value => value }, View: props => { capture.views.push(props); return React.createElement('div', null, props.children); } },
    './QolipHomeContent': { QolipHomeContent: props => { capture.content = props; return React.createElement('section', null, props.renderRetainedBlocks(props.home)); } },
    './QolipHomeBlockBody': { QolipHomeBlockBody: props => { capture.blocks.push(props); return React.createElement('div', null, props.blockKey); } },
    './useGuardedQolipHome': { useGuardedQolipHome: (account, original) => { capture.ownerInput = [account, original]; return model; } },
  }).QolipHomeOwner;
  const props = { session: {}, boundary: {}, onMenu: () => calls.push(['menu']), onProfile: () => calls.push(['profile']),
    openCell: (...args) => calls.push(['open', ...args]), printCell: (...args) => calls.push(['print', ...args]) };
  const render = () => { capture.blocks.length = 0; capture.views.length = 0; delete capture.content; return renderToStaticMarkup(React.createElement(component, props)); };
  return { calls, capture, props, model, blocks, boundary, actions, render, invalidate: () => { live = false; } };
}
for (const platform of ['ios', 'android']) {
  test(`${platform} owner composes real content/body contracts for all cached blocks with one visible native wrapper`, () => {
    const h = harness(platform); assert.equal(h.render(), '<section><div><div><div>a</div></div><div><div>b</div></div></div></section>');
    assert.deepEqual(h.capture.ownerInput, [h.props.session, h.props.boundary]); assert.equal(h.capture.blocks.length, 2);
    const [a, b] = h.capture.blocks; assert.equal(a.future, h.blocks[0].future); assert.equal(a.initialLocations, h.blocks[0].initialLocations);
    assert.equal(b.future, h.blocks[1].future); assert.equal(a.boundary, h.boundary); assert.deepEqual(a.searchCounts, { A1: 2 }); assert.deepEqual(b.searchCounts, {});
    const wrappers = h.capture.views.filter(view => view.pointerEvents); assert.deepEqual(wrappers.map(view => view.style), [{ flex: 1 }, { display: 'none' }]);
    assert.deepEqual(wrappers.map(view => [view.pointerEvents, view.accessibilityElementsHidden, view.importantForAccessibility]),
      [['auto', false, 'auto'], ['none', true, 'no-hide-descendants']]);
    assert.equal(h.capture.content.dock, undefined); assert.equal(h.capture.content.renderBlock, undefined); assert.deepEqual(h.calls, [], 'rendering activates no destination or supplied action');
  });
  test(`${platform} selecting/reordering changes visibility/order without changing retained block keys, future or boundary identities`, () => {
    const h = harness(platform); h.render(); const before = h.capture.blocks.slice(); h.model.home.selected = { key: 'b' }; h.render();
    assert.deepEqual(h.capture.blocks.map(block => block.blockKey), ['a', 'b']);
    for (let index = 0; index < 2; index++) { assert.equal(h.capture.blocks[index].future, before[index].future); assert.equal(h.capture.blocks[index].boundary, before[index].boundary); }
    assert.deepEqual(h.capture.views.filter(view => view.pointerEvents).map(view => view.style), [{ display: 'none' }, { flex: 1 }]);
    h.model.blocks = [h.blocks[1], h.blocks[0]]; h.render(); assert.deepEqual(h.capture.blocks.map(block => block.blockKey), ['b', 'a']);
    assert.equal(h.capture.blocks[0].future, before[1].future);
  });
  test(`${platform} owner binds real menu/profile, search, tab, retry, block refresh and block-aware action callbacks`, async () => {
    const h = harness(platform); h.render(); const content = h.capture.content, body = h.capture.blocks[1], items = [{ id: 'real' }];
    content.onMenu(); content.onProfile(); content.onSearchChange('new'); content.onSelectBlock(1); content.onReorderBlocks(0, 1);
    await content.retry(); await body.refresh(); body.openCell('C', 4, items); body.printCell('D', 5);
    assert.deepEqual(h.calls, [['menu'], ['profile'], ['search', 'new'], ['select', 1], ['reorder', 0, 1], ['retry'], ['refresh', 'B'],
      ['open', h.blocks[1].block, 'C', 4, items], ['print', h.blocks[1].block, 'D', 5]]);
    h.invalidate(); h.calls.length = 0; content.onMenu(); content.onProfile(); body.openCell('A', 1, []); body.printCell('A', 1); assert.deepEqual(h.calls, []);
  });
  test(`${platform} invalid owner has no header, retained body or old callback surface`, () => {
    const h = harness(platform); h.model.home = { kind: 'invalid' }; h.model.search = 'private'; assert.equal(h.render(), ''); assert.equal(h.capture.content, undefined); assert.deepEqual(h.capture.blocks, []);
  });
}

test('guarded owner hook activates after commit, connects actual revision/focus/resume events and closes the exact effect lifetime', () => {
  const calls = [], layouts = [], listeners = {}; let focus;
  const actions = { routeChanged: value => calls.push(['focus', value]), locationsChanged: () => calls.push(['revision']), appResumed: () => calls.push(['resume']) };
  const state = { home: { kind: 'loading' }, actions }, owner = { subscribe: () => () => {}, getSnapshot: () => state,
    activate: () => { calls.push(['activate']); return actions; }, suspend: value => { assert.equal(value, actions); calls.push(['suspend']); } };
  const useGuardedQolipHome = load('useGuardedQolipHome.ts', {
    'expo-router': { useFocusEffect: fn => { focus = fn; } },
    react: { useCallback: fn => fn, useLayoutEffect: fn => layouts.push(fn), useMemo: fn => fn(), useSyncExternalStore: (_s, get) => get() },
    'react-native': { AppState: { addEventListener: (_name, fn) => { listeners.app = fn; return { remove: () => calls.push(['removeApp']) }; } } },
    '../shared/qolipDataRevision': { qolipDataRevision: { subscribe: fn => { listeners.revision = fn; return () => calls.push(['removeRevision']); } } },
    './qolipHomeOwnerRuntime': { createQolipHomeOwner: (account, boundary) => { assert.equal(account, 'account'); assert.equal(boundary, 'original'); return owner; } },
  }).useGuardedQolipHome;
  assert.equal(useGuardedQolipHome('account', 'original'), state); assert.deepEqual(calls, []);
  const cleanup = layouts[0](), unfocus = focus(); listeners.revision(); listeners.app('background'); listeners.app('active'); unfocus(); cleanup();
  assert.deepEqual(calls, [['activate'], ['focus', true], ['revision'], ['resume'], ['focus', false], ['removeApp'], ['removeRevision'], ['suspend']]);
});

test('guarded owner hook never registers lifecycle readers for an invalid activation', () => {
  const layouts = []; let lifecycleSubscriptions = 0;
  const owner = { subscribe: () => () => {}, getSnapshot: () => ({ home: { kind: 'invalid' }, actions: null }), activate: () => null };
  const hook = load('useGuardedQolipHome.ts', { 'expo-router': { useFocusEffect() {} }, react: {
    useCallback: fn => fn, useLayoutEffect: fn => layouts.push(fn), useMemo: fn => fn(), useSyncExternalStore: (_s, get) => get(),
  }, 'react-native': { AppState: { addEventListener() { lifecycleSubscriptions++; } } },
  '../shared/qolipDataRevision': { qolipDataRevision: { subscribe() { lifecycleSubscriptions++; } } }, './qolipHomeOwnerRuntime': { createQolipHomeOwner: () => owner } }).useGuardedQolipHome;
  hook({}, {}); assert.equal(layouts[0](), undefined); assert.equal(lifecycleSubscriptions, 0);
});
