// Mocked controlled form/events only. No picker, owner, ID generation, route or write is used.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const catalog = require('../src/shared/localization/catalog.json');
function compile(file, mocks = {}) {
  const filename = path.resolve(__dirname, '../src', file), loaded = new Module(filename);
  loaded.filename = filename; loaded.paths = require.main.paths;
  loaded.require = name => Object.hasOwn(mocks, name) ? mocks[name] : require(name);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText, filename); return loaded.exports;
}
const jsx = { Fragment: 'Fragment', jsx: (type, props, key) => ({ type, props, key }), jsxs: (type, props, key) => ({ type, props, key }) };
const localization = compile('shared/localization/index.ts', { './catalog.json': catalog });
const trim = compile('werka/werkaBatchTrim.ts'), parse = compile('werka/werkaUnannouncedInput.ts');
const model = compile('werka/werkaBatchDraftModel.ts', { '../shared/localization': localization, './werkaBatchTrim': trim,
  './werkaUnannouncedInput': parse });
const node = (tree, type) => {
  if (!tree || typeof tree !== 'object') return [];
  if (Array.isArray(tree)) return tree.flatMap(child => node(child, type));
  return [...(tree.type === type ? [tree] : []), ...node(tree.props?.children, type)];
};
const modifier = name => (...args) => ({ name, args });
const customer = { ref: 'C', name: 'Customer', phone: ' +998 ' }, item = { code: 'I', name: 'Item', uom: 'kg' };
const state = (overrides = {}) => ({ customer: null, item: null, quantityText: '', draftCount: 0, ...overrides });
function make(platform, overrides = {}) {
  const ios = Object.fromEntries(['Button', 'HStack', 'Image', 'RNHostView', 'Section', 'Spacer', 'Text', 'VStack'].map(name => [name, name]));
  const android = Object.fromEntries(['Button', 'FilledTonalIconButton', 'Host', 'RNHostView', 'Text'].map(name => [name, name]));
  android.useMaterialColors = () => ({ onSecondaryContainer: 'tonal', onSurfaceVariant: 'muted' });
  const mocks = { 'react/jsx-runtime': jsx, '@expo/ui/swift-ui': ios,
    '@expo/ui/swift-ui/modifiers': Object.fromEntries(['accessibilityLabel', 'disabled', 'font'].map(name => [name, modifier(name)])),
    '@expo/ui/jetpack-compose': android, '@expo/ui/jetpack-compose/modifiers': Object.fromEntries(['fillMaxWidth', 'semantics'].map(name => [name, modifier(name)])),
    'expo-symbols': { SymbolView: 'SymbolView' }, 'react-native': { ScrollView: 'ScrollView', View: 'View' },
    '../components/WorkerSheetButton': { WorkerSheetButton: 'WorkerSheetButton' },
    '../preparation/PreparationUI.ios': { PreparationList: 'PreparationList' }, '../preparation/PreparationUI.android': { PreparationText: 'PreparationText' },
    './WerkaBatchQuantityField': { WerkaBatchQuantityField: 'QuantityField' }, './werkaBatchDraftModel': model };
  const component = compile(`werka/WerkaBatchDraftContent.${platform}.tsx`, mocks).WerkaBatchDraftContent;
  const calls = [], props = { state: state(), locale: 'en', quantityFieldKey: 'initial',
    onPickItem: () => calls.push('pickItem'), onClearItem: () => calls.push('clearItem'),
    onPickCustomer: () => calls.push('pickCustomer'), onClearCustomer: () => calls.push('clearCustomer'),
    onQuantityChange: value => calls.push(['quantity', value]), onSaveLine: () => calls.push('save'), ...overrides };
  const tree = component(props), buttons = platform === 'ios' ? node(tree, 'Button') : node(tree, 'WorkerSheetButton');
  const get = label => buttons.find(button => button.props.label === label);
  const clearButtons = platform === 'ios' ? buttons.filter(button => node(button, 'Image').some(image => image.props.systemName === 'xmark'))
    : node(tree, 'FilledTonalIconButton').filter(button => button.props.enabled !== false);
  return { tree, calls, props, get, clearButtons };
}

test('native quantity field preserves the source zero hint, unit and actual edit callback', () => {
  const mocks = { 'react/jsx-runtime': jsx, '@expo/ui': { Host: 'Host', TextInput: 'TextInput', useNativeState: initial => ({ value: initial }) },
    'react-native': { Text: 'Text', View: 'View' } };
  const field = compile('werka/WerkaBatchQuantityField.tsx', mocks).WerkaBatchQuantityField;
  const changes = [], tree = field({ label: 'Amount', initial: '2.5', unit: 'kg', onChange: value => changes.push(value) });
  const input = node(tree, 'TextInput')[0]; assert.equal(input.props.placeholder, '0'); assert.equal(input.props.accessibilityLabel, 'Amount');
  assert.equal(input.props.keyboardType, 'decimal-pad'); assert.equal(input.props.value.value, '2.5');
  assert.equal(node(tree, 'Text')[0].props.children, 'kg'); input.props.onChangeText('3.25'); assert.deepEqual(changes, ['3.25']);
});

for (const platform of ['ios', 'android']) {
  test(`${platform} empty draft has real picker callbacks and cannot save`, () => {
    const view = make(platform), itemButton = view.get('Select item'), customerButton = view.get('Select customer'), next = view.get('Next');
    assert.ok(itemButton); assert.ok(customerButton); assert.ok(next); assert.deepEqual(view.calls, []);
    itemButton.props.onPress(); customerButton.props.onPress(); next.props.onPress();
    assert.deepEqual(view.calls, ['pickItem', 'pickCustomer']); assert.equal(node(view.tree, 'QuantityField').length, 0);
    if (platform === 'ios') assert.ok(next.props.modifiers.some(value => value.name === 'disabled' && value.args[0] === true));
    else assert.equal(next.props.disabled, true);
  });

  test(`${platform} selected values expose source clear, quantity and valid save events`, () => {
    const view = make(platform, { state: state({ customer, item, quantityText: '1.5' }), quantityFieldKey: 'reset-2' });
    assert.ok(view.get('Item')); assert.ok(view.get('Customer')); assert.equal(view.clearButtons.length, 2);
    const field = node(view.tree, 'QuantityField')[0]; assert.equal(field.key, 'reset-2'); assert.equal(field.props.initial, '1.5');
    assert.equal(field.props.unit, 'kg'); field.props.onChange('2');
    view.clearButtons[0].props[platform === 'ios' ? 'onPress' : 'onClick']();
    view.clearButtons[1].props[platform === 'ios' ? 'onPress' : 'onClick'](); view.get('Next').props.onPress();
    assert.deepEqual(view.calls, [['quantity', '2'], 'clearItem', 'clearCustomer', 'save']);
  });

  test(`${platform} customer phone appears only before an item is selected`, () => {
    const shown = make(platform, { state: state({ customer }) }), hidden = make(platform, { state: state({ customer: { ...customer, phone: '\u0085' } }) });
    const type = platform === 'ios' ? 'Text' : 'PreparationText';
    assert.ok(node(shown.tree, type).some(value => value.props.children === ' +998 '));
    assert.equal(node(hidden.tree, type).some(value => value.props.children === '\u0085'), false);
  });

  test(`${platform} saved drafts show source add/confirm labels but keep review navigation closed`, () => {
    const view = make(platform, { state: state({ customer, item, quantityText: '0', draftCount: 2 }) });
    assert.equal(model.werkaBatchDraftPresentation(view.props.state, 'en').sourceCanConfirmReview, true);
    const add = view.get('Add another'); assert.ok(add); add.props.onPress(); assert.deepEqual(view.calls, []);
    if (platform === 'ios') {
      const confirm = view.get('Confirm'), list = node(view.tree, 'Button').find(button => node(button, 'Image').some(image => image.props.systemName === 'list.bullet.rectangle'));
      assert.equal(confirm.props.onPress, undefined); assert.ok(confirm.props.modifiers.some(value => value.name === 'disabled' && value.args[0] === true));
      assert.equal(list.props.onPress, undefined); assert.ok(list.props.modifiers.some(value => value.name === 'disabled' && value.args[0] === true));
    } else {
      const confirm = node(view.tree, 'Button')[0], list = node(view.tree, 'FilledTonalIconButton').find(button => button.props.enabled === false);
      assert.equal(confirm.props.enabled, false); assert.equal(confirm.props.onClick, undefined); assert.equal(list.props.onClick, undefined);
    }
  });
}
