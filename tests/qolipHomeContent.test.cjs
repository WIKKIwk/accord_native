const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const catalog = require('../src/shared/localization/catalog.json');
function load(name, dependencies = {}) {
  const filename = path.resolve(__dirname, '../src/qolip', name), m = new Module(filename, module);
  m.require = key => key in dependencies ? dependencies[key] : require(key);
  m._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ESNext,
  } }).outputText, filename);
  return m.exports;
}
const logic = { qolipHomeBlockKey: block => block.name.trim().toLowerCase() };
const { qolipHomePresentation } = load('qolipHomePresentation.ts', { './qolipHomeLogic': logic });
const projection = (patch = {}) => qolipHomePresentation({ invalid: false, loading: false, error: false, orderedBlocks: [],
  selectedIndex: 0, blockCounts: {}, cellCounts: {}, snapshot: null, ...patch });
const blocks = [{ name: ' Alpha ', warehouse: 'W' }, { name: 'B', warehouse: 'Other' }];
const home = patch => projection({ snapshot: { blocks, warehouses: ['W'], supports_cross_block_move: true }, ...patch });
const text = (key, values = {}) => Object.entries(values).reduce((value, [name, count]) => value.replace(`{${name}}`, count), catalog.production[`qolip.${key}`].uz);
function screen(platform, model, overrides = {}) {
  const calls = [], captures = {}; let focused = false;
  const node = name => function NativeNode(props) {
    (captures[name] ??= []).push(props);
    return React.createElement('div', null, props.children ?? props.label ?? null);
  };
  const names = ['Box', 'Button', 'Column', 'Host', 'HStack', 'ProgressView', 'Row', 'Text', 'TextButton', 'VStack', 'ActivityIndicator', 'View', 'OrdersHeader'];
  const nodes = Object.fromEntries(names.map(name => [name, node(name)]));
  function Tabs(props) {
    (captures.Tabs ??= []).push(props);
    return React.createElement('div', null, props.tabs.map(tab => React.createElement('div', { key: tab.key }, props.renderLabel(tab))));
  }
  const ui = { ...nodes, useMaterialColors: () => ({ surfaceContainerLow: 'bg', surfaceContainer: 'strip', surfaceContainerHigh: 'drag',
    primaryContainer: 'selected', primary: 'primary', onSurfaceVariant: 'secondary' }) };
  const mods = Object.fromEntries(['background', 'clip', 'font', 'foregroundStyle', 'frame', 'lineLimit', 'size', 'testID'].map(name => [name, (...args) => ({ name, args })]));
  mods.shapes = { circle: () => ({}) }; mods.Shapes = { Circle: {} };
  const dependencies = {
    react: { ...React, useState: () => [focused, value => { focused = value; }] },
    '@expo/ui/swift-ui': ui, '@expo/ui/jetpack-compose': ui,
    '@expo/ui/swift-ui/modifiers': mods, '@expo/ui/jetpack-compose/modifiers': mods,
    'react-native': { View: nodes.View, ActivityIndicator: nodes.ActivityIndicator, PlatformColor: value => value,
      StyleSheet: { create: value => value }, useColorScheme: () => 'dark' },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 24 }) },
    '../shared/localization': { localizedGetter: key => catalog.getters[key].uz },
    '../shared/orders/OrdersHeader': { OrdersHeader: nodes.OrdersHeader },
    './QolipHomeBlockTabs': { QolipHomeBlockTabs: Tabs }, './useQolipText': { useQolipText: () => ({ text, locale: 'uz' }) },
  };
  const { QolipHomeContent } = load(`QolipHomeContent.${platform}.tsx`, dependencies);
  const props = { home: model, search: '', onSearchChange: value => calls.push(['search', value]),
    onMenu: () => calls.push(['menu']), onProfile: () => calls.push(['profile']), onSelectBlock: index => calls.push(['select', index]),
    onReorderBlocks: (oldIndex, newIndex) => calls.push(['reorder', oldIndex, newIndex]),
    retry: async () => { calls.push(['retry']); }, refreshBlock: async name => { calls.push(['refresh', name]); },
    renderBlock: (block, context) => { (captures.Block ??= []).push({ block, context }); return React.createElement('div', null, block.name); },
    dock: React.createElement('footer', null, 'REAL-DOCK-SLOT'), ...overrides };
  const render = () => { for (const key of Object.keys(captures)) delete captures[key]; return renderToStaticMarkup(React.createElement(QolipHomeContent, props)); };
  return { captures, calls, props, render };
}
for (const platform of ['ios', 'android']) {
  test(`${platform} invalid home renders no header, old body, dock or callback`, () => {
    const h = screen(platform, projection({ invalid: true, loading: true }));
    assert.equal(h.render(), ''); assert.deepEqual(h.captures, {}); assert.deepEqual(h.calls, []);
  });
  test(`${platform} loading and retry use native indicators and V2 common retry wording`, async () => {
    let h = screen(platform, projection({ loading: true })); const html = h.render();
    assert.ok(h.captures[platform === 'ios' ? 'ProgressView' : 'ActivityIndicator']);
    assert.match(html, /REAL-DOCK-SLOT/); assert.equal(h.captures.Block, undefined);
    h = screen(platform, projection({ error: true })); const retryHtml = h.render();
    assert.ok(retryHtml.includes(catalog.getters.serverDisconnectedRetry.uz));
    assert.ok(retryHtml.includes(catalog.getters.retry.uz)); assert.equal(h.captures.Tabs, undefined);
    const action = platform === 'ios' ? h.captures.Button[0].onPress : h.captures.TextButton[0].onClick;
    action(); await Promise.resolve(); assert.deepEqual(h.calls, [['retry']]);
  });
  test(`${platform} the two empty states preserve V2 spelling and have no invented refresh/add control`, () => {
    for (const [model, expected] of [[projection(), 'Block biriktirilmagan'], [projection({ snapshot: { blocks: [], warehouses: ['W'] } }), 'Blok qo‘shilmagan']]) {
      const h = screen(platform, model), html = h.render(); assert.ok(html.includes(expected));
      assert.equal(h.captures.Block, undefined); assert.equal(h.captures.Tabs, undefined);
      assert.equal(h.captures.Button, undefined); assert.equal(h.captures.TextButton, undefined);
      assert.deepEqual(h.calls, []);
    }
  });
  test(`${platform} outer content delegates real tab, block-render and selected-block refresh callbacks`, async () => {
    const cells = { B3: 4 }, h = screen(platform, home({ selectedIndex: 1, blockCounts: { alpha: 1000 }, cellCounts: { b: cells } }));
    const html = h.render(), tabs = h.captures.Tabs[0];
    assert.ok(html.includes(' Alpha ')); assert.ok(html.includes('1000')); assert.equal(html.includes('99+'), false);
    assert.equal(tabs.label(tabs.tabs[0]), ' Alpha , 1000 ta qolip'); assert.equal(tabs.label(tabs.tabs[1]), 'B');
    assert.equal(tabs.colors.match, '#81C784'); assert.equal(tabs.onAdd, undefined);
    assert.equal(h.captures.Block.length, 1); assert.equal(h.captures.Block[0].block, blocks[1]);
    assert.equal(h.captures.Block[0].context.searchCounts, cells); assert.equal(h.captures.Block[0].context.index, 1);
    assert.deepEqual(h.calls, [], 'rendering does not dispatch navigation, storage or network work');
    tabs.onSelect(0); tabs.onReorder(0, 1); await h.captures.Block[0].context.refresh();
    assert.deepEqual(h.calls, [['select', 0], ['reorder', 0, 1], ['refresh', 'B']]);
  });
  test(`${platform} controlled search preserves immediate raw input, forwards Clear and hides profile while focused`, () => {
    const h = screen(platform, home(), { search: ' Raw  ' }); h.render();
    let header = h.captures.OrdersHeader[0]; assert.equal(header.search, ' Raw  '); assert.equal(header.searchPlaceholder, 'Mahsulot qidirish');
    assert.equal(header.showProfile, true); header.onSearchChange(' New  '); header.onSearchChange('');
    header.onSearchFocus(); h.render(); header = h.captures.OrdersHeader[0]; assert.equal(header.showProfile, false);
    header.onSearchBlur(); h.render(); header = h.captures.OrdersHeader[0]; assert.equal(header.showProfile, true);
    header.onMenu(); header.onProfile(); assert.deepEqual(h.calls, [['search', ' New  '], ['search', ''], ['menu'], ['profile']]);
  });
}

for (const platform of ['ios', 'android']) {
  test(`${platform} retained-body owner slot is not keyed by the selected tab and receives the complete real block model`, () => {
    const seen = [], model = home(), h = screen(platform, model, { renderRetainedBlocks: value => { seen.push(value); return React.createElement('div', null, 'RETAINED-REAL-BODIES'); } });
    assert.ok(h.render().includes('RETAINED-REAL-BODIES')); assert.equal(seen[0], model); assert.equal(h.captures.Block, undefined);
    h.props.home = home({ selectedIndex: 1 }); h.render(); assert.equal(seen[1], h.props.home); assert.equal(h.captures.Block, undefined);
  });
}
