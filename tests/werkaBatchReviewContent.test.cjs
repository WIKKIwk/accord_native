// Mocked controlled review body only. There is no submit, picker, account or route.
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
const jsx = { Fragment: 'Fragment', jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
const localization = compile('shared/localization/index.ts', { './catalog.json': catalog });
const model = compile('werka/werkaBatchReviewModel.ts', { '../shared/localization': localization });
const node = (tree, type) => {
  if (!tree || typeof tree !== 'object') return [];
  if (Array.isArray(tree)) return tree.flatMap(child => node(child, type));
  return [...(tree.type === type ? [tree] : []), ...node(tree.props?.children, type)];
};
const modifier = name => (...args) => ({ name, args });
const line = (localID, ref, name, code, qty) => ({ localID, customer: { ref, name }, item: { name: `Item ${code}`, code, uom: 'kg' }, qty });
function make(platform, overrides = {}) {
  const ios = Object.fromEntries(['Button', 'HStack', 'Host', 'Image', 'Section', 'Spacer', 'Text', 'VStack'].map(name => [name, name]));
  const android = Object.fromEntries(['Button', 'Column', 'Host', 'IconButton', 'RNHostView', 'Row', 'Text'].map(name => [name, name]));
  android.useMaterialColors = () => ({ onSurfaceVariant: 'muted' });
  const mocks = { 'react/jsx-runtime': jsx, '@expo/ui/swift-ui': ios,
    '@expo/ui/swift-ui/modifiers': Object.fromEntries(['accessibilityLabel', 'buttonStyle', 'disabled', 'font', 'frame'].map(name => [name, modifier(name)])),
    '@expo/ui/jetpack-compose': android, '@expo/ui/jetpack-compose/modifiers': Object.fromEntries(['fillMaxWidth', 'semantics', 'weight'].map(name => [name, modifier(name)])),
    'expo-symbols': { SymbolView: 'SymbolView' }, 'react-native': { ScrollView: 'ScrollView', View: 'View' },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ bottom: 13 }) },
    '../preparation/PreparationUI.ios': { PreparationList: 'PreparationList' }, './werkaBatchReviewModel': model };
  const component = compile(`werka/WerkaBatchReviewContent.${platform}.tsx`, mocks).WerkaBatchReviewContent;
  const removed = [], props = { lines: [line('same', 'A', 'Alice', 'A', 1.5), line('same', 'B', 'Bob', 'B', 2)],
    submitting: false, locale: 'en', onRemove: id => removed.push(id), ...overrides };
  const tree = component(props), deletes = platform === 'ios' ? node(tree, 'Button').filter(button => node(button, 'Image').length) : node(tree, 'IconButton');
  const confirm = platform === 'ios' ? node(tree, 'Button').find(button => button.props.label) : node(tree, 'Button')[0];
  return { tree, props, removed, deletes, confirm };
}

for (const platform of ['ios', 'android']) {
  test(`${platform} review shows source rows and reports only real remove presses`, () => {
    const view = make(platform), text = node(view.tree, 'Text').map(value => value.props.children);
    for (const expected of ['Review list', '2 customers', '2 items in the list', 'Alice', 'Item A', '2 kg • A', 'Bob', 'Item B', '2 kg • B']) {
      assert.ok(text.includes(expected), expected);
    }
    assert.equal(view.deletes.length, 2); assert.deepEqual(view.removed, []);
    view.deletes[1].props[platform === 'ios' ? 'onPress' : 'onClick']();
    assert.deepEqual(view.removed, ['same']);
    const modifiers = view.deletes[0].props.modifiers;
    const label = modifiers.find(value => value.name === (platform === 'ios' ? 'accessibilityLabel' : 'semantics'));
    assert.deepEqual(label.args[0], platform === 'ios' ? 'Delete' : { contentDescription: 'Delete' });
  });

  test(`${platform} review leaves submit unbound even when source would enable it`, () => {
    const view = make(platform); assert.equal(model.werkaBatchReviewPresentation(view.props.lines, false, 'en').sourceCanConfirm, true);
    if (platform === 'ios') {
      assert.equal(view.confirm.props.label, 'Confirm'); assert.equal(view.confirm.props.onPress, undefined);
      assert.ok(view.confirm.props.modifiers.some(value => value.name === 'disabled' && value.args[0] === true));
    } else { assert.equal(view.confirm.props.enabled, false); assert.equal(view.confirm.props.onClick, undefined); }
  });

  test(`${platform} review disables deletion while submitting and shows the minimum warning`, () => {
    const view = make(platform, { lines: [line('x', 'A', 'Alice', 'A', 1)], submitting: true });
    const text = node(view.tree, 'Text').map(value => value.props.children);
    assert.ok(text.includes('At least 2 items are required.'));
    if (platform === 'ios') {
      assert.equal(view.confirm.props.label, 'Sending...');
      assert.ok(view.deletes[0].props.modifiers.some(value => value.name === 'disabled' && value.args[0] === true));
    } else { assert.ok(text.includes('Sending...')); assert.equal(view.deletes[0].props.enabled, false); }
    view.deletes[0].props[platform === 'ios' ? 'onPress' : 'onClick'](); assert.deepEqual(view.removed, []);
  });

  test(`${platform} delete accessibility label follows the resolved locale`, () => {
    const fixture = require('./contracts/f11910bb/werka_material_delete_tooltip_oracle.json');
    for (const [locale, expected] of Object.entries(fixture.values)) {
      const view = make(platform, { locale }), modifiers = view.deletes[0].props.modifiers;
      const label = modifiers.find(value => value.name === (platform === 'ios' ? 'accessibilityLabel' : 'semantics'));
      assert.deepEqual(label.args[0], platform === 'ios' ? expected : { contentDescription: expected });
    }
  });
}
