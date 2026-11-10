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
function loadHeader(os) {
  const mocks = {
    'react/jsx-runtime': jsx,
    react: { useEffect() {} },
    '@expo/ui': { Host: 'Host', TextInput: 'TextInput', useNativeState: value => ({ get: () => value, set() {} }) },
    'expo-symbols': { SymbolView: 'SymbolView' },
    'react-native': { Platform: { OS: os }, Pressable: 'Pressable', View: 'View', StyleSheet: { create: value => value } },
    '../../components/useWorkerColors': { useWorkerColors: () => ({}) },
    '../navigation/RoleHeaderButton': { RoleHeaderButton: 'RoleHeaderButton' },
  };
  const filename = path.resolve(__dirname, '../src/shared/orders/OrdersHeader.tsx');
  const mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths;
  mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, filename);
  return mod.exports.OrdersHeader;
}

for (const platform of ['ios', 'android']) {
  test(`${platform}: existing header defaults retain menu, profile, search and no focus callbacks`, () => {
    const OrdersHeader = loadHeader(platform), calls = [];
    const tree = OrdersHeader({ search: 'abc', onSearchChange: value => calls.push(['search', value]),
      onMenu: () => calls.push(['menu']), onProfile: () => calls.push(['profile']) });
    const buttons = nodes(tree, n => n.type === 'RoleHeaderButton');
    assert.deepEqual(buttons.map(n => [n.props.icon, n.props.label]), [['menu', 'Bo‘limlar'], ['profile', 'Profil']]);
    buttons[0].props.onPress(); buttons[1].props.onPress();
    const input = nodes(tree, n => n.type === 'TextInput')[0];
    assert.equal(input.props.onFocus, undefined); assert.equal(input.props.onBlur, undefined);
    input.props.onChangeText('next');
    const clear = nodes(tree, n => n.type === 'Pressable' && n.props.accessibilityLabel === 'Qidiruvni tozalash')[0];
    clear.props.onPress();
    assert.deepEqual(calls, [['menu'], ['profile'], ['search', 'next'], ['search', '']]);
  });

  test(`${platform}: opting in lets a caller hide profile only while search is focused`, () => {
    const OrdersHeader = loadHeader(platform), calls = [];
    let focused = false;
    const render = () => OrdersHeader({ search: '', onSearchChange() {}, onBack: () => calls.push('back'),
      onProfile: () => calls.push('profile'), showProfile: !focused,
      onSearchFocus: () => { focused = true; calls.push('focus'); },
      onSearchBlur: () => { focused = false; calls.push('blur'); } });
    let tree = render(), buttons = nodes(tree, n => n.type === 'RoleHeaderButton');
    assert.deepEqual(buttons.map(n => n.props.icon), ['back', 'profile']);
    nodes(tree, n => n.type === 'TextInput')[0].props.onFocus();
    tree = render(); buttons = nodes(tree, n => n.type === 'RoleHeaderButton');
    assert.deepEqual(buttons.map(n => n.props.icon), ['back']);
    buttons[0].props.onPress();
    nodes(tree, n => n.type === 'TextInput')[0].props.onBlur();
    tree = render(); buttons = nodes(tree, n => n.type === 'RoleHeaderButton');
    assert.deepEqual(buttons.map(n => n.props.icon), ['back', 'profile']);
    buttons[1].props.onPress();
    assert.deepEqual(calls, ['focus', 'back', 'blur', 'profile']);
  });

  test(`${platform}: a custom trailing action replaces profile and preserves the shared search`, () => {
    const OrdersHeader = loadHeader(platform), calls = [];
    const trailing = jsx.jsx('ComposeButton', { onPress: () => calls.push('compose') });
    const tree = OrdersHeader({ search: 'chat', searchPlaceholder: 'Chatlardan qidirish', trailing,
      onSearchChange: value => calls.push(value), onMenu() {} });
    assert.deepEqual(nodes(tree, node => node.type === 'RoleHeaderButton').map(node => node.props.icon), ['menu']);
    const input = nodes(tree, node => node.type === 'TextInput')[0];
    assert.equal(input.props.placeholder, 'Chatlardan qidirish');
    assert.equal(input.props.textAlign, 'left');
    input.props.onChangeText('next');
    nodes(tree, node => node.type === 'ComposeButton')[0].props.onPress();
    assert.deepEqual(calls, ['next', 'compose']);
  });

  test(`${platform}: optional worker actions precede the existing profile without replacing it`, () => {
    const OrdersHeader = loadHeader(platform), calls = [];
    const tree = OrdersHeader({ search: '', onSearchChange() {}, onMenu() {}, onProfile: () => calls.push('profile'),
      actions: jsx.jsx('PaddonAction', { onPress: () => calls.push('paddon') }) });
    const actions = tree.props.children.filter(node => node?.type === 'PaddonAction' || node?.type === 'RoleHeaderButton');
    assert.deepEqual(actions.map(node => node.type === 'PaddonAction' ? 'paddon' : node.props.icon), ['menu', 'paddon', 'profile']);
    actions[1].props.onPress(); actions[2].props.onPress(); assert.deepEqual(calls, ['paddon', 'profile']);
  });
}
