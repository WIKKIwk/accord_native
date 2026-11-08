const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const jsx = { Fragment: 'Fragment', jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
function nodes(node, predicate) {
  if (!node || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap(child => nodes(child, predicate));
  return [...(predicate(node) ? [node] : []), ...nodes(node.props?.children, predicate)];
}
function load(file, mocks = {}) {
  const filename = path.resolve(__dirname, '../src', file), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths;
  mod.require = id => id === 'react/jsx-runtime' ? jsx : Object.hasOwn(mocks, id) ? mocks[id] : id.startsWith('.') ? {} : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { fileName: filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText, filename);
  return mod.exports;
}
const golden = require('./contracts/f11910bb/admin_factory_l10n_probe.json');
const l10n = load('shared/localization/index.ts', { './catalog.json': require('../src/shared/localization/catalog.json') });
const dart = load('admin/dartJsonString.ts');
const editor = load('admin/factoryLocationEditorModel.ts', { './dartJsonString': dart });
const model = load('admin/factoryApparatusPickerModel.ts', { '../shared/localization': l10n, './factoryLocationEditorModel': editor });
const a = { id: 'apparatus:default:a', name: 'Print 7', sort_order: 7 }, b = { id: 'apparatus:default:b', name: 'Print 2', sort_order: 2 };
const c = { id: 'apparatus:custom:c', name: 'Alpha', sort_order: 0 }, list = [b, a, c];
// Locally authored source-derived f119 localization oracle, not an upstream V2 test.
test('factory picker text and selected count match f119 for four languages', () => {
  assert.equal(golden.baseline, fs.readFileSync(path.resolve(__dirname, '../docs/port/V2_BASELINE'), 'utf8').trim());
  for (const [locale, value] of Object.entries(golden.locales)) {
    for (const [key, expected] of Object.entries(value.text)) assert.equal(l10n.adminText(key, locale), expected, `${locale} ${key}`);
    assert.equal(l10n.localizedGetter('closeAction', locale), value.closeAction);
    for (const [count, expected] of Object.entries(value.selected))
      assert.equal(l10n.adminText('factory.selected_count', locale, { count: Number(count) }), expected);
    assert.equal(model.factoryPickerText(locale, 0).confirm, value.text['factory.continue_without_selection']);
    assert.equal(model.factoryPickerText(locale, 2).confirm, value.selected['2']);
  }
});
test('picker groups retain catalog order, filter by V2-style query and preserve duplicate rows', () => {
  const rows = model.factoryPickerRows([b, a, c, c], '', 'en');
  assert.deepEqual(rows.map(row => row.kind === 'heading' ? row.title : row.item.name), ['Default equipment', 'Print 2', 'Print 7', 'Custom equipment', 'Alpha', 'Alpha']);
  assert.equal(new Set(rows.map(row => row.key)).size, rows.length);
  assert.deepEqual(model.factoryPickerRows(list, ' print ', 'en').map(row => row.kind === 'heading' ? row.title : row.item.name), ['Default equipment', 'Print 2', 'Print 7']);
  assert.deepEqual(model.factoryPickerRows(list, 'missing', 'en'), []);
});
test('selection toggle never mutates initial input, preserves hidden IDs and insertion order', () => {
  const initial = new Set(['unknown', a.id]), withoutA = model.toggleFactoryPickerSelection(initial, a.id), withB = model.toggleFactoryPickerSelection(withoutA, b.id);
  assert.deepEqual([...initial], ['unknown', a.id]); assert.deepEqual([...withB], ['unknown', b.id]);
  assert.deepEqual([...model.toggleFactoryPickerSelection(withB, a.id)], ['unknown', b.id, a.id]);
});
test('picker hook keeps changes local until confirm and returns a detached set', () => {
  let slots = [], cursor = 0, confirmed; const react = { useState(initial) { const index = cursor++; if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial;
    return [slots[index], value => { slots[index] = typeof value === 'function' ? value(slots[index]) : value; }]; }, useMemo: fn => fn() };
  const hook = load('admin/useFactoryApparatusPicker.ts', { react, './factoryApparatusPickerModel': model });
  const input = new Set(['unknown', a.id]), props = { apparatus: list, initialSelected: input, onConfirm: value => { confirmed = value; }, onCancel() {} };
  const render = () => { cursor = 0; return hook.useFactoryApparatusPicker(props, 'en'); };
  let state = render(); state.toggle(a.id); state.toggle(b.id); state.setQuery('print'); state = render();
  assert.deepEqual([...input], ['unknown', a.id]); assert.deepEqual([...state.selected], ['unknown', b.id]); assert.equal(confirmed, undefined);
  state.confirm(); assert.deepEqual([...confirmed], ['unknown', b.id]); confirmed.clear(); assert.deepEqual([...state.selected], ['unknown', b.id]);
});
const mods = new Proxy({}, { get: (_target, name) => (...args) => ({ name: String(name), args }) });
const swift = new Proxy({}, { get: (_target, name) => String(name) });
const react = { useSyncExternalStore: (_subscribe, get) => get() };
function renderScreen(platform, overrides = {}) {
  const calls = [], state = { rows: model.factoryPickerRows(list, '', 'en'), selected: new Set([a.id]), text: model.factoryPickerText('en', 1),
    setQuery: value => calls.push(['query', value]), toggle: id => calls.push(['toggle', id]), confirm: () => calls.push('confirm'), ...overrides };
  const native = { View: 'View', Text: 'NativeText', FlatList: 'FlatList', Pressable: 'Pressable', StyleSheet: { create: value => value } };
  const mocks = { react, '@expo/ui': { TextInput: 'TextInput', useNativeState: () => ({}) },
    '@expo/ui/swift-ui': swift, '@expo/ui/swift-ui/modifiers': mods, '@expo/ui/jetpack-compose/modifiers': mods,
    '@expo/ui/jetpack-compose': { Button: 'ComposeButton', RNHostView: 'RNHostView', Text: 'ComposeText', useMaterialColors: () => ({ surface: 'surface',
      onSurface: 'text', onSurfaceVariant: 'secondary', primary: 'primary', onPrimary: 'buttonText', primaryContainer: 'selected' }) }, 'expo-symbols': { SymbolView: 'SymbolView' }, 'react-native': native,
    '../components/BaseHost.ios': { BaseHost: 'BaseHost' }, '../components/BaseHost.android': { BaseHost: 'Host' },
    '../components/useBaseTheme': { useBaseTheme: () => ({ colors: { primaryContainer: 'selected' } }) }, '../components/WorkerQueueCard.android': { WorkerQueueCard: 'WorkerQueueCard' },
    '../components/WorkerIconButton.android': { WorkerIconButton: 'WorkerIconButton' }, '../shared/localization': l10n,
    '../shared/localization/runtime': { localeController: { locale: 'en', addListener() {} } },
    './useFactoryApparatusPicker': { useFactoryApparatusPicker: () => state } };
  const Screen = load(`admin/FactoryApparatusPicker.${platform}.tsx`, mocks).FactoryApparatusPicker;
  return { tree: Screen({ apparatus: list, initialSelected: new Set(), onConfirm() {}, onCancel: () => calls.push('cancel') }), calls, state };
}
for (const platform of ['ios', 'android']) {
  test(`${platform} picker displays the empty result and permits confirming no selection`, () => {
    const { tree, calls, state } = renderScreen(platform, { rows: [], selected: new Set(), text: model.factoryPickerText('en', 0) });
    if (platform === 'ios') {
      assert.ok(nodes(tree, n => n.type === 'Text' && n.props.children === state.text.empty).length);
      nodes(tree, n => n.type === 'Button' && n.props.label === state.text.confirm)[0].props.onPress();
    } else {
      const list = nodes(tree, n => n.type === 'FlatList')[0]; assert.equal(list.props.ListEmptyComponent.props.children, state.text.empty);
      nodes(tree, n => n.type === 'ComposeButton')[0].props.onClick();
    }
    assert.deepEqual(calls, ['confirm']);
  });
  test(`${platform} picker delegates query, selection, confirm and cancel without a fake navigation`, () => {
    const { tree, calls, state } = renderScreen(platform);
    nodes(tree, n => n.type === 'TextInput')[0].props.onChangeText('print');
    if (platform === 'ios') {
      const buttons = nodes(tree, n => n.type === 'Button');
      const close = buttons.find(n => n.props.systemImage === 'xmark');
      assert.equal(close.props.modifiers.find(m => m.name === 'accessibilityLabel').args[0], 'Close'); close.props.onPress();
      buttons.find(n => n.props.label === state.text.confirm).props.onPress();
      const selected = buttons.find(n => typeof n.props.onPress === 'function' && n.props.modifiers?.some(m => m.name === 'accessibilityLabel' && m.args[0] === a.name));
      assert.ok(selected.props.modifiers.some(m => m.name === 'listRowBackground' && m.args[0] === 'selected')); selected.props.onPress();
    } else {
      const close = nodes(tree, n => n.type === 'WorkerIconButton')[0]; assert.equal(close.props.label, 'Close'); close.props.onPress();
      nodes(tree, n => n.type === 'ComposeButton')[0].props.onClick();
      const flat = nodes(tree, n => n.type === 'FlatList')[0], row = flat.props.renderItem({ item: state.rows.find(r => r.kind === 'item' && r.item.id === a.id) });
      assert.equal(row.type, 'WorkerQueueCard'); assert.equal(row.props.backgroundColor, 'selected'); row.props.onPress();
    }
    assert.deepEqual(calls, [['query', 'print'], 'cancel', 'confirm', ['toggle', a.id]]);
  });
}
