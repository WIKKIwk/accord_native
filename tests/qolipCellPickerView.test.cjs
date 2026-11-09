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
const entry = (code, name) => ({ qolip_code: code, code: `I-${code}`, name, size: 40, has_qolip_spec: true });
function screen(platform, supplied = {}) {
  const captures = {}, calls = [];
  const controller = { setQuery: query => calls.push(['query', query]), loadMore: async () => calls.push(['more']),
    retry: async () => calls.push(['retry']), toggle: item => calls.push(['toggle', item.qolip_code]), tap: item => { calls.push(['tap', item.qolip_code]); return item; } };
  const items = [entry('Q1', 'First'), entry('Q2', 'Second')];
  const state = { loading: false, error: false, loadingMore: false, hasMore: false, visibleItems: items,
    selected: new Set(), selectedProducts: [], controller, ...supplied };
  const component = name => function Stub(props) { (captures[name] ??= []).push(props); return React.createElement('div', null, props.children ?? props.label ?? null); };
  const names = ['Button', 'Host', 'HStack', 'List', 'ProgressView', 'Spacer', 'Text', 'TextField', 'Toggle', 'VStack', 'Checkbox',
    'OutlinedTextField', 'TextButton', 'ActivityIndicator', 'Pressable', 'View', 'NativeText', 'SymbolView', 'WorkerQueueCard'];
  const nodes = Object.fromEntries(names.map(name => [name, component(name)]));
  nodes.OutlinedTextField.Placeholder = component('Placeholder');
  const FlatList = props => { (captures.FlatList ??= []).push(props); return React.createElement('div', null,
    props.data.map((item, index) => React.createElement(React.Fragment, { key: index }, props.renderItem({ item, index }))), props.ListEmptyComponent, props.ListFooterComponent); };
  const ui = { ...nodes, useNativeState: value => ({ get: () => value, set() {} }), useMaterialColors: () => ({
    onSurface: 'black', onSurfaceVariant: 'gray', primary: 'blue', secondaryContainer: 'silver', surfaceContainerHighest: 'white' }) };
  const modifier = name => (...args) => ({ name, args });
  const mods = Object.fromEntries(['accessibilityIdentifier', 'accessibilityLabel', 'buttonStyle', 'labelStyle', 'labelsHidden', 'onAppear',
    'onLongPressGesture', 'fillMaxWidth', 'semantics', 'testID'].map(name => [name, modifier(name)]));
  const words = { 'products.mold_count': '{count} ta qolip', 'home.mold_select_title': 'Qolip tanlang',
    'home.mold_code_customer_search': 'Qolip code, mahsulot yoki customer nomi', 'action.confirm_selected': 'Tanlangan qoliplarni tasdiqlash' };
  const deps = { '@expo/ui/swift-ui': ui, '@expo/ui/jetpack-compose': ui, '@expo/ui/swift-ui/modifiers': mods,
    '@expo/ui/jetpack-compose/modifiers': mods, 'expo-symbols': { SymbolView: nodes.SymbolView },
    'react-native': { View: nodes.View, Text: nodes.NativeText, Pressable: nodes.Pressable, FlatList, ActivityIndicator: nodes.ActivityIndicator,
      useWindowDimensions: () => ({ height: 800 }) }, '../components/WorkerQueueCard.android': { WorkerQueueCard: nodes.WorkerQueueCard },
    '../shared/localization': { localizedGetter: key => ({ closeAction: 'Yopish', retry: 'Qayta urinish',
      noRecordsYet: 'Bu ro‘yxatda hozircha yozuv yo‘q.', serverDisconnectedRetry: 'Server bilan aloqa uzildi' })[key] },
    './qolipCellPlacement': { qolipPlacementPickerTitle: item => item.name, qolipPlacementPickerSubtitle: item => `${item.qolip_code} • ${item.size}`,
      qolipPlacementProductKey: item => item.qolip_code.trim().toLowerCase() },
    './useQolipCellPicker': { useQolipCellPicker: () => state }, './useQolipText': { useQolipText: () => ({ locale: 'uz',
      text: (key, values = {}) => (words[key] ?? key).replace('{count}', values.count ?? '') }) } };
  const { QolipCellPicker } = load(`qolip/QolipCellPicker.${platform}.tsx`, deps);
  const render = () => renderToStaticMarkup(React.createElement(QolipCellPicker, { placement: {}, close: () => calls.push(['close']),
    single: item => calls.push(['single', item.qolip_code]), multiple: selected => calls.push(['multiple', selected.map(x => x.qolip_code)]) }));
  return { render, captures, calls, items, state };
}
for (const platform of ['ios', 'android']) {
  test(`${platform} cell picker renders loading, retry, empty and input states`, () => {
    let h = screen(platform, { loading: true }); h.render(); assert.ok(h.captures[platform === 'ios' ? 'ProgressView' : 'ActivityIndicator']);
    h = screen(platform, { error: true }); assert.match(h.render(), /Server bilan aloqa uzildi/);
    const retry = platform === 'ios' ? h.captures.Button.find(x => x.label === 'Qayta urinish').onPress : h.captures.TextButton[0].onClick;
    retry(); assert.deepEqual(h.calls, [['retry']]);
    h = screen(platform, { visibleItems: [] }); assert.match(h.render(), /Bu ro‘yxatda hozircha yozuv yo‘q/);
  });
  test(`${platform} cell picker routes single, long-press and selected confirmation`, () => {
    let h = screen(platform); h.render();
    if (platform === 'ios') {
      const row = h.captures.Button.find(x => x.modifiers?.some(m => m.name === 'accessibilityIdentifier' && m.args[0] === 'qolip-picker-row-q1'));
      row.onPress(); row.modifiers.find(m => m.name === 'onLongPressGesture').args[0]();
    } else { h.captures.WorkerQueueCard[0].onPress(); h.captures.WorkerQueueCard[0].onLongPress(); }
    assert.deepEqual(h.calls, [['tap', 'Q1'], ['single', 'Q1'], ['toggle', 'Q1']]);
    h = screen(platform, { selected: new Set(['q1']), selectedProducts: [entry('Q1', 'First')] }); h.render();
    if (platform === 'ios') h.captures.Button.find(x => x.label === 'Tanlangan qoliplarni tasdiqlash').onPress();
    else h.captures.Pressable.find(x => x.testID === 'qolip-picker-confirm').onPress();
    assert.deepEqual(h.calls, [['multiple', ['Q1']]]);
    assert.equal((h.captures[platform === 'ios' ? 'Toggle' : 'Checkbox'] ?? []).length, 2);
  });
}
