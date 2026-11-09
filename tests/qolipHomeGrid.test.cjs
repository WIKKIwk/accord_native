const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
function load(name, dependencies = {}) {
  const filename = path.resolve(__dirname, '../src', name), m = new Module(filename, module);
  m.require = key => key in dependencies ? dependencies[key] : require(key);
  m._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ESNext } }).outputText, filename);
  return m.exports;
}
const common = load('qolip/qolipApiCommon.ts', { '../shared/mobileApiException': {} });
const grid = load('qolip/qolipGridLogic.ts', { './qolipApiCommon': common });
const item = (id, label, quantity, name = 'First') => ({ id, location_label: label, quantity, item_name: name, qolip_code: `Q-${id}`, size: 40 });
function screen(platform, supplied = {}) {
  const captures = {}, calls = [];
  const component = name => function Stub(props) { (captures[name] ??= []).push(props); return React.createElement('div', null, props.children ?? props.label ?? null); };
  const names = ['Button', 'Host', 'HStack', 'Image', 'ProgressView', 'RNHostView', 'Section', 'Spacer', 'Text', 'VStack',
    'Box', 'Column', 'FlowRow', 'Icon', 'Row', 'SymbolView', 'TextButton', 'ActivityIndicator', 'ScrollView', 'NativeText', 'View', 'WorkerQueueCard', 'OrdersList'];
  const nodes = Object.fromEntries(names.map(name => [name, component(name)]));
  const ui = { ...nodes, useMaterialColors: () => ({ surface: 'white', surfaceContainerHighest: 'gray', secondaryContainer: 'lightblue',
    primaryContainer: 'blue', onSecondaryContainer: 'black', onSurface: 'black', onSurfaceVariant: 'gray' }) };
  const mod = name => (...args) => ({ name, args });
  const mods = Object.fromEntries(['accessibilityIdentifier', 'accessibilityLabel', 'background', 'contentShape', 'frame', 'lineLimit',
    'onLongPressGesture', 'onTapGesture', 'clip', 'combinedClickable', 'paddingAll', 'semantics', 'size', 'testID', 'weight'].map(name => [name, mod(name)]));
  mods.shapes = { rectangle: () => ({}), roundedRectangle: () => ({}) }; mods.Shapes = { RoundedCorner: () => ({}), Circle: {} };
  const words = { 'home.occupied_count': '{count} ta joy band', 'home.mold_count_stat': '{count} ta qolip',
    'home.unplaced_count': '{count} ta joylashmagan', 'home.no_molds': 'Bu blokda hali qolip yo‘q',
    'home.attach_hint': 'Pastdagi Biriktirish tugmasi orqali qo‘shing', 'home.unplaced': 'Joylashmagan' };
  const text = (key, values = {}) => Object.entries(values).reduce((value, [name, count]) => value.replace(`{${name}}`, count), words[key] ?? key);
  const deps = { '@expo/ui/swift-ui': ui, '@expo/ui/jetpack-compose': ui, '@expo/ui/swift-ui/modifiers': mods, '@expo/ui/jetpack-compose/modifiers': mods,
    'react-native': { View: nodes.View, Text: nodes.NativeText, ScrollView: nodes.ScrollView, ActivityIndicator: nodes.ActivityIndicator,
      PlatformColor: name => name }, 'react-native-reanimated': { useSharedValue: value => ({ value }) }, 'expo-symbols': { SymbolView: nodes.SymbolView },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ bottom: 12 }) },
    '../../assets/icons/fab-add.xml': 'add', '../components/WorkerQueueCard.android': { WorkerQueueCard: nodes.WorkerQueueCard },
    '../shared/localization': { localizedGetter: key => ({ serverDisconnectedRetry: 'Server bilan aloqa uzildi', retry: 'Qayta urinish' })[key],
      localizedMethod: (key, _locale, values) => `${values.count} ta${key === 'qolipCount' ? ' qolip' : ''}` },
    '../shared/orders/OrdersList': { OrdersList: nodes.OrdersList }, './qolipGridLogic': grid,
    './useQolipGridScroll': { useQolipGridScroll: () => ({ bindScroll() {}, panHandlers: {}, onScroll() {}, onContentSizeChange() {}, onViewportWidth() {} }) },
    './useQolipText': { useQolipText: () => ({ text, locale: 'uz' }) } };
  const { QolipHomeGrid } = load(`qolip/QolipHomeGrid.${platform}.tsx`, deps);
  const props = { locations: [], loading: false, error: false, searchCounts: {}, refresh: async () => { calls.push(['refresh']); },
    openCell: (...args) => calls.push(['open', ...args]), printCell: (...args) => calls.push(['print', ...args]), ...supplied };
  return { captures, calls, props, render: () => renderToStaticMarkup(React.createElement(QolipHomeGrid, props)) };
}
for (const platform of ['ios', 'android']) {
  test(`${platform} grid renders load, retry and cached data during an error`, () => {
    let h = screen(platform, { locations: null, loading: true }); h.render(); assert.ok(h.captures[platform === 'ios' ? 'ProgressView' : 'ActivityIndicator']);
    h = screen(platform, { locations: null, error: true }); assert.match(h.render(), /Server bilan aloqa uzildi/);
    const retry = platform === 'ios' ? h.captures.Button[0].onPress : h.captures.TextButton[0].onClick; retry(); assert.deepEqual(h.calls, [['refresh']]);
    h = screen(platform, { locations: [item('1', 'A1', 2)], loading: true, error: true }); h.render(); assert.ok(h.captures.OrdersList);
  });
  test(`${platform} grid preserves native cell actions, statistics, highlights and unplaced items`, () => {
    const entries = [item('1', 'A1', 2), item('2', 'a1', 3, 'Second'), item('3', '', 4, 'Unplaced')];
    const h = screen(platform, { locations: entries, searchCounts: { A1: 2 } }); const output = h.render();
    assert.match(output, /1 ta joy band/); assert.match(output, /9 ta qolip/); assert.match(output, /1 ta joylashmagan/);
    assert.match(output, /First/); assert.match(output, /Unplaced/); assert.match(output, /Q-3 • 40 • 4 ta qolip/);
    const cells = h.captures[platform === 'ios' ? 'VStack' : 'Column'];
    const name = platform === 'ios' ? 'accessibilityIdentifier' : 'testID';
    const a1 = cells.find(row => row.modifiers?.some(modifier => modifier.name === name && modifier.args[0] === 'qolip-grid-cell-A1'));
    assert.ok(a1);
    if (platform === 'ios') { a1.modifiers.find(m => m.name === 'onTapGesture').args[0](); a1.modifiers.find(m => m.name === 'onLongPressGesture').args[0](); }
    else { const click = a1.modifiers.find(m => m.name === 'combinedClickable').args[0]; click.onClick(); click.onLongClick(); }
    assert.deepEqual(h.calls, [['open', 'A', 1, entries.slice(0, 2)], ['print', 'A', 1]]);
    h.captures.OrdersList[0].onRefresh(); assert.deepEqual(h.calls.at(-1), ['refresh']);
  });
}

test('pinned row header drag updates and clamps the actual horizontal scroll offset', () => {
  let handlers; const calls = [];
  const { useQolipGridScroll } = load('qolip/useQolipGridScroll.ts', {
    react: { useState: fn => [fn()] },
    'react-native': { PanResponder: { create: value => { handlers = value; return { panHandlers: value }; } } },
  });
  const model = useQolipGridScroll(); model.bindScroll({ scrollTo: value => calls.push(value) });
  model.onContentSizeChange(1000); model.onViewportWidth(200); model.onScroll({ nativeEvent: { contentOffset: { x: 100 } } });
  assert.equal(handlers.onMoveShouldSetPanResponder(null, { dx: 9, dy: 3 }), true);
  assert.equal(handlers.onMoveShouldSetPanResponder(null, { dx: 3, dy: 9 }), false);
  handlers.onPanResponderGrant(); handlers.onPanResponderMove(null, { dx: -90 }); handlers.onPanResponderMove(null, { dx: -2000 });
  handlers.onPanResponderMove(null, { dx: 500 }); assert.deepEqual(calls, [
    { x: 190, animated: false }, { x: 800, animated: false }, { x: 0, animated: false },
  ]);
});
