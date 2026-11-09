const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

function harness(platform) {
  const records = [], calls = [], nativeInitials = [], entry = { id: 'debt-1', item_name: 'Product', item_code: 'I1', qolip_code: 'Q1', quantity: 2 };
  const row = { entry, index: 0, selected: false, expanded: false, returning: false };
  const read = { invalid: false, loading: false, error: false, entries: [entry], visible: [entry], search: '' };
  const selection = { invalid: false, selectionMode: false, selectedIds: new Set(), selectedEntries: [], rows: [row], bulkReturning: false, cancelEnabled: true, bulkEnabled: false };
  const actions = { setSearch: value => calls.push(['search', value]), tap: (...args) => calls.push(['tap', ...args]),
    longPress: value => calls.push(['long', value]), cancelSelection: () => calls.push(['cancel']) };
  const snapshot = { invalid: false, read, selection, actions };
  const component = name => props => { records.push({ name, props }); return React.createElement('div', null, props.label ?? props.children); };
  const ui = Object.fromEntries(['Button', 'Column', 'Host', 'HStack', 'IconButton', 'Image', 'OutlinedTextField', 'ProgressView',
    'RNHostView', 'Row', 'Text', 'TextField', 'VStack'].map(name => [name, component(name)]));
  for (const slot of ['Placeholder', 'LeadingIcon', 'TrailingIcon']) ui.OutlinedTextField[slot] = component(`OutlinedTextField.${slot}`);
  let nativeValue = ''; ui.useNativeState = initial => { nativeInitials.push(initial); nativeValue = initial; return { get: () => nativeValue, set: value => { nativeValue = value; } }; };
  ui.useMaterialColors = () => ({ onSurface: 'surfaceText', onSurfaceVariant: 'secondary', secondaryContainer: 'selected', surface: 'surface' });
  const modifier = name => (...args) => ({ name, args });
  const mods = Object.fromEntries(['accessibilityAddTraits', 'accessibilityIdentifier', 'accessibilityLabel', 'background', 'buttonStyle',
    'contentShape', 'disabled', 'font', 'frame', 'labelStyle', 'lineLimit', 'onLongPressGesture', 'onTapGesture', 'padding',
    'clip', 'combinedClickable', 'fillMaxWidth', 'paddingAll', 'semantics', 'testID', 'weight'].map(name => [name, modifier(name)]));
  mods.shapes = { rectangle: () => 'rect', roundedRectangle: () => 'rounded' }; mods.Shapes = { RoundedCorner: () => 'rounded' };
  const filename = path.resolve(__dirname, `../src/qolip/QolipCheckoutReadContent.${platform}.tsx`), loaded = new Module(filename, module);
  const mocks = { '@expo/ui/swift-ui': ui, '@expo/ui/jetpack-compose': ui, '@expo/ui/swift-ui/modifiers': mods, '@expo/ui/jetpack-compose/modifiers': mods,
    'expo-symbols': { SymbolView: component('SymbolView') }, 'react-native': { ActivityIndicator: component('ActivityIndicator'), ScrollView: component('ScrollView'),
      View: component('View'), PlatformColor: name => name }, 'react-native-safe-area-context': { useSafeAreaInsets: () => ({ bottom: 20 }) },
    '../shared/localization': { localizedGetter: key => key, localizedMethod: (_key, _locale, values) => `quantity:${values.count}` },
    './qolipCheckoutLogic': { qolipCheckoutRowText: value => ({ title: value.item_name, subtitle: `${value.item_code} • ${value.qolip_code}` }),
      qolipCheckoutDetailLines: (_value, quantity) => [{ key: 'product', value: 'Product' }, { key: 'quantity', value: quantity }] },
    './useQolipText': { useQolipText: () => ({ locale: 'uz', text: (key, values) => values ? `${key}:${Object.values(values).join(',')}` : key }) } };
  loaded.require = id => id in mocks ? mocks[id] : require(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ESNext,
  } }).outputText, filename);
  const View = loaded.exports.QolipCheckoutReadContent;
  const render = () => { records.length = 0; return renderToStaticMarkup(React.createElement(View, { snapshot })); };
  const buttons = () => records.filter(record => record.name === 'Button' || record.name === 'IconButton');
  return { snapshot, read, selection, actions, row, entry, calls, records, nativeInitials, render, buttons };
}

for (const platform of ['ios', 'android']) {
  test(`${platform} checkout read content shows source row and captures rendered tap flags without return controls`, () => {
    const h = harness(platform), markup = h.render(); assert.match(markup, /Product/); assert.match(markup, /I1 • Q1/); assert.match(markup, /quantity:2/);
    assert.doesNotMatch(markup, /action\.return|selection_return|retry/); assert.equal(h.buttons().length, 0);
    const row = h.records.find(record => (record.name === 'HStack' || record.name === 'Row') &&
      record.props.modifiers?.some(value => value.name === (platform === 'ios' ? 'onTapGesture' : 'combinedClickable')));
    const modifiers = row.props.modifiers;
    const tap = platform === 'ios' ? modifiers.find(value => value.name === 'onTapGesture').args[0]
      : modifiers.find(value => value.name === 'combinedClickable').args[0].onClick;
    const long = platform === 'ios' ? modifiers.find(value => value.name === 'onLongPressGesture').args[0]
      : modifiers.find(value => value.name === 'combinedClickable').args[0].onLongClick;
    h.selection.selectionMode = true; h.row.expanded = true; tap(); long();
    assert.deepEqual(h.calls, [['tap', h.entry, false, false], ['long', h.entry]]);
    assert.equal(h.records.find(record => record.name === 'ScrollView').props.contentContainerStyle.paddingBottom, 132);
  });

  test(`${platform} expanded and selected states show source detail and selection cancel, never a write action`, () => {
    const h = harness(platform); h.row.expanded = true; let markup = h.render();
    assert.match(markup, /checkouts\.product: Product/); assert.match(markup, /checkouts\.quantity: quantity:2/);
    assert.match(markup, /checkouts\.checkout_id: debt-1/); assert.doesNotMatch(markup, /action\.return/);
    h.selection.selectionMode = true; h.selection.selectedIds = new Set(['debt-1']); h.row.selected = true; h.row.expanded = false;
    markup = h.render(); assert.match(markup, /checkouts\.selection_summary:1/); assert.match(markup, /✓/);
    assert.doesNotMatch(markup, /selection_return|action\.return/); const button = h.buttons()[0];
    (platform === 'ios' ? button.props.onPress : button.props.onClick)(); assert.deepEqual(h.calls, [['cancel']]);
  });

  test(`${platform} loading, error, empty and search-empty states are distinct and have no retry`, () => {
    const h = harness(platform); h.read.loading = true; h.read.entries = null; assert.match(h.render(), /checkouts\.loading/);
    h.read.loading = false; h.read.error = true; let markup = h.render(); assert.match(markup, /checkouts\.load_failed/); assert.doesNotMatch(markup, /retry/);
    h.read.error = false; h.read.entries = []; assert.match(h.render(), /checkouts\.empty/);
    h.read.entries = [h.entry]; h.read.visible = []; assert.match(h.render(), /checkouts\.search_empty/);
    h.snapshot.invalid = true; assert.equal(h.render(), ''); assert.equal(h.records.length, 0);
  });

  test(`${platform} remounted search starts with its real query and the clear control only changes search`, () => {
    const h = harness(platform); h.read.search = ' Needle '; h.render(); assert.equal(h.nativeInitials[0], ' Needle ');
    const clear = h.buttons()[0]; (platform === 'ios' ? clear.props.onPress : clear.props.onClick)();
    assert.deepEqual(h.calls, [['search', '']]);
  });
}
