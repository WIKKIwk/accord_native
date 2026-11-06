const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

const jsx = { Fragment: 'Fragment', jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
const ui = new Proxy({}, { get: (_, name) => name });
const modifiers = new Proxy({}, { get: (_, name) => (...args) => ({ name, args }) });
const react = { useCallback: fn => fn, useEffect() {}, useMemo: fn => fn(), useRef: value => ({ current: value }),
  useState: value => [value, () => {}], useSyncExternalStore: (_subscribe, getSnapshot) => getSnapshot() };

function load(file, mocks) {
  const filename = path.resolve(__dirname, '../src', file);
  const mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths;
  mod.require = id => id === 'react/jsx-runtime' ? jsx : id === 'react' ? react : Object.hasOwn(mocks, id) ? mocks[id] : id.startsWith('.') ? {} : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, filename);
  return mod.exports;
}

function findAll(node, predicate) {
  if (!node || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap(child => findAll(child, predicate));
  return [...(predicate(node) ? [node] : []), ...findAll(node.props?.children, predicate)];
}

test('both preparation home order buttons push a screen that can be popped', () => {
  const calls = [];
  const router = { push: path => calls.push(['push', path]), replace: path => calls.push(['replace', path]) };
  const home = { snapshot: { assigned_warehouses: ['A'], material_warehouses: [], materials: [] }, warehouse: 'A', locked: false,
    controller: { reload() {}, submit() {}, getSnapshot: () => ({ saving: false }) } };
  const { PreparationHome } = load('preparation/PreparationHome.ios.tsx', {
    '@expo/ui/swift-ui': ui, '@expo/ui/swift-ui/modifiers': modifiers,
    'expo-router': { router, Stack: { Screen: 'Stack.Screen' }, useFocusEffect() {} }, 'react-native': { View: 'View' },
    '../nativeSheet': { useNativeSheet: () => ({ open() {}, close() {} }) },
    '../shared/appRoutes': { appRoutes: {}, canOpenRoute: () => false },
    './PreparationUI': { PreparationList: 'PreparationList', PreparationStatus: 'PreparationStatus', usePreparationText: () => value => value },
    './PreparationContext': { usePreparationContext: () => ({ home, session: {} }) },
    './preparationLogic': { preparationReceiptMode: () => 'warehouse', preparationVisibleMaterials: () => [] },
    './usePreparationNotice': { usePreparationNotice: () => ({ message: '', show() {} }) },
  });
  const buttons = findAll(PreparationHome(), node => node.type === 'Button' && node.props.label === 'Buyurtmalar');
  assert.equal(buttons.length, 2);
  buttons.forEach(button => button.props.onPress());
  assert.deepEqual(calls, [['push', '/ios-preparation/sequence'], ['push', '/ios-preparation/sequence']]);
});

test('preparation orders back returns to the previous page or home on a direct entry', () => {
  const calls = [];
  let canGoBack = true;
  const router = { canGoBack: () => canGoBack, back: () => calls.push('back'), replace: value => calls.push(value) };
  const { PreparationSequence } = load('preparation/PreparationSequence.ios.tsx', {
    '@expo/ui/swift-ui': ui, '@expo/ui/swift-ui/modifiers': modifiers, '@expo/ui': ui,
    'expo-router': { router, useFocusEffect() {} }, 'react-native': { AppState: {} },
    'react-native-reanimated': { useSharedValue: value => ({ value }) },
    '../shared/orders/OrdersWorkspace': { OrdersWorkspace: 'OrdersWorkspace' },
    '../shared/navigation/roleDrawerContext': { useRoleDrawer: () => ({ open() {} }) },
    '../nativeSheet': { useNativeSheet: () => ({ open() {}, close() {} }) },
    './PreparationUI': { usePreparationText: () => value => value },
  });
  const controller = { subscribe() {}, getSnapshot: () => ({ window: { apparatus: [] }, apparatus: '', rows: [], loading: false }) };
  const page = PreparationSequence({ session: {}, controller, selectApparatus() {}, renderDetail() {} });
  assert.equal(page.type, 'OrdersWorkspace');
  page.props.onBack();
  canGoBack = false;
  page.props.onBack();
  assert.deepEqual(calls, ['back', '/ios-preparation']);
});

test('orders toolbar exposes back and drawer actions while the worker root keeps its drawer button', () => {
  const toolbar = function Toolbar() {}; toolbar.Content = 'Toolbar.Content';
  const swift = { ...Object.fromEntries(['Button', 'Host', 'NavigationStack', 'Picker', 'Text', 'ToolbarItem'].map(name => [name, name])),
    Toolbar: toolbar, useNativeState: value => value };
  const { OrdersWorkspace } = load('shared/orders/OrdersWorkspace.ios.tsx', {
    '@expo/ui/swift-ui': swift, '@expo/ui/swift-ui/modifiers': modifiers,
    'expo-router': { Stack: { Screen: 'Stack.Screen' } },
    'react-native': { ActivityIndicator: 'ActivityIndicator', View: 'View', PlatformColor: name => name, StyleSheet: { create: value => value } },
    '../../components/WorkerProfileButton.ios': { WorkerProfileButton: 'WorkerProfileButton' },
    './ordersWorkspaceTypes': { visibleOrdersTabs: tabs => tabs.length ? tabs : [{ id: '', name: 'Apparat' }] },
  });
  const calls = [];
  const props = { session: {}, tabs: [], selected: '', onSelect() {}, onMenu: () => calls.push('menu'), children: () => null };
  const page = OrdersWorkspace({ ...props, onBack: () => calls.push('back') });
  assert.equal(findAll(page, node => node.type === 'Stack.Screen')[0].props.options.gestureEnabled, true);
  const buttons = findAll(page, node => node.type === 'Button');
  buttons.find(button => button.props.label === 'Orqaga').props.onPress();
  buttons.find(button => button.props.label === 'Bo‘limlar').props.onPress();
  assert.deepEqual(calls, ['back', 'menu']);
  const rootButtons = findAll(OrdersWorkspace(props), node => node.type === 'Button');
  assert.equal(rootButtons.filter(button => button.props.label === 'Bo‘limlar').length, 1);
  assert.equal(rootButtons.some(button => button.props.label === 'Orqaga'), false);
});
