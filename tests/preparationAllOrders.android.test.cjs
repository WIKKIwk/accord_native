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

test('Android preparation orders use one tab and a back button without machine selection', () => {
  const calls = [], rows = [{ id: 'one', position: 1, code: '1', title: 'Film', customer_name: '', image_id: '' },
    { id: 'two', position: 2, code: '2', title: 'Film', customer_name: '', image_id: '' }];
  let canGoBack = true;
  const state = { apparatus: '', rows, loading: false, error: null,
    window: { apparatus_id: '', apparatus: [{ id: 'first', name: 'First' }, { id: 'second', name: 'Second' }], next_cursor: 'page2' } };
  const controller = { subscribe() {}, getSnapshot: () => state, searchChanged: value => calls.push(['search', value]),
    reload: async () => {}, loadMore: async () => calls.push(['more']), setForeground() {} };
  const shared = value => ({ value, set(next) { this.value = next; }, get() { return this.value; } });
  const mocks = {
    'react/jsx-runtime': jsx,
    react: { useCallback: fn => fn, useEffect() {}, useMemo: fn => fn(), useRef: value => ({ current: value }),
      useState: value => [value, () => {}], useSyncExternalStore: (_subscribe, get) => get() },
    '@expo/ui/jetpack-compose': { useMaterialColors: () => ({}) },
    '@expo/ui': { Button: 'Button', ListItem: 'ListItem' },
    'expo-router': { router: { canGoBack: () => canGoBack, back: () => calls.push(['back']),
      replace: route => calls.push(['replace', route]), navigate: route => calls.push(['navigate', route]) }, useFocusEffect() {} },
    'react-native': { View: 'View', AppState: { currentState: 'active', addEventListener: () => ({ remove() {} }) } },
    'react-native-reanimated': { useSharedValue: shared },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0 }) },
    '../shared/orders/OrdersWorkspace': { OrdersWorkspace: 'OrdersWorkspace' },
    '../shared/orders/OrdersList': { OrdersList: 'OrdersList' },
    '../shared/orders/OrderListItem': { OrderListItem: 'OrderListItem' },
    '../shared/orders/OrdersHeader': { OrdersHeader: 'OrdersHeader' },
    './PreparationUI.android': { usePreparationText: () => text => text },
  };
  const filename = path.resolve(__dirname, '../src/preparation/PreparationSequence.android.tsx'), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths;
  mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : id.startsWith('.') ? {} : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, filename);
  const page = mod.exports.PreparationSequenceList({ session: {}, controller, openOrder: row => calls.push(['open', row.id]) });
  const workspace = nodes(page, node => node.type === 'OrdersWorkspace')[0];
  assert.deepEqual(workspace.props.tabs, [{ id: '', name: 'Buyurtmalar' }]);
  assert.equal(workspace.props.selected, '');
  const header = nodes(workspace.props.header, node => node.type === 'OrdersHeader')[0];
  assert.equal(header.props.onMenu, undefined);
  header.props.onBack(); header.props.onSearchChange('film');
  assert.deepEqual(calls.slice(0, 2), [['back'], ['search', 'film']]);
  canGoBack = false; header.props.onBack();
  assert.deepEqual(calls.at(-1), ['replace', '/android-preparation']);
  const list = workspace.props.children('');
  list.props.onEndReached();
  assert.deepEqual(calls.at(-1), ['more']);
  assert.equal(nodes(list, node => node.type === 'Button' && node.props.label === 'Yana yuklash').length, 0);
  const items = nodes(list, node => node.type === 'OrderListItem');
  assert.equal(items.length, 2);
  items[1].props.onPress();
  assert.deepEqual(calls.at(-1), ['open', 'two']);
});

test('orders header uses a back button for preparation and keeps the worker menu', () => {
  const actions = [];
  const mocks = {
    'react/jsx-runtime': jsx,
    react: { useEffect() {} },
    '@expo/ui': { Host: 'Host', TextInput: 'TextInput', useNativeState: value => ({ get: () => value, set() {} }) },
    'expo-symbols': { SymbolView: 'SymbolView' },
    'react-native': { Platform: { OS: 'android' }, Pressable: 'Pressable', View: 'View', StyleSheet: { create: value => value } },
    '../../components/useWorkerColors': { useWorkerColors: () => ({}) },
    '../navigation/RoleHeaderButton': { RoleHeaderButton: 'RoleHeaderButton' },
  };
  const filename = path.resolve(__dirname, '../src/shared/orders/OrdersHeader.tsx'), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths;
  mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, filename);
  const common = { search: '', onSearchChange() {}, onProfile() {} };
  const back = nodes(mod.exports.OrdersHeader({ ...common, onBack: () => actions.push('back') }), node => node.type === 'RoleHeaderButton')[0];
  assert.equal(back.props.icon, 'back'); assert.equal(back.props.label, 'Orqaga'); back.props.onPress();
  const menu = nodes(mod.exports.OrdersHeader({ ...common, onMenu: () => actions.push('menu') }), node => node.type === 'RoleHeaderButton')[0];
  assert.equal(menu.props.icon, 'menu'); assert.equal(menu.props.label, 'Bo‘limlar'); menu.props.onPress();
  assert.deepEqual(actions, ['back', 'menu']);
});

test('preparation orders keep navigation available on the list and order detail', () => {
  const session = { token: 'token' }, focusEffects = [], row = { id: 'one' };
  let selected = null;
  class Controller { getSnapshot() { return { window: { scope: 'orders' } }; } sessionChanged() {} }
  const mocks = {
    'react/jsx-runtime': jsx,
    react: { useCallback: fn => fn, useEffect() {}, useMemo: fn => fn(), useRef: value => ({ current: value }),
      useState: () => [selected, value => { selected = value; }] },
    '@expo/ui/jetpack-compose': { Host: 'Host', ModalBottomSheet: 'ModalBottomSheet', RNHostView: 'RNHostView', useMaterialColors: () => ({}) },
    '@expo/ui': { Button: 'Button', ListItem: 'ListItem' },
    'expo-router': { router: {}, useFocusEffect: effect => focusEffects.push(effect) },
    'react-native': { View: 'View', useWindowDimensions: () => ({ width: 400, height: 800 }) },
    'react-native-reanimated': {},
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 24, bottom: 16 }) },
    '../auth': { activeSessionToken: () => session.token },
    '../sessionReadScope': { sessionReadScope: () => 'account' },
    './PreparationContext.android': { usePreparationContext: () => ({ session }) },
    './preparationOrdersState': { PreparationOrdersState: Controller },
    './PreparationUI.android': { PreparationDock: 'PreparationDock', PreparationDialogs: 'PreparationDialogs' },
  };
  const filename = path.resolve(__dirname, '../src/preparation/PreparationSequence.android.tsx'), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths;
  mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : id.startsWith('.') ? {} : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, filename);

  let page = mod.exports.PreparationSequenceScreen();
  assert.equal(nodes(page, node => node.type === 'PreparationDock').length, 1);
  const list = nodes(page, node => node.type === mod.exports.PreparationSequenceList)[0];
  list.props.openOrder(row);
  assert.deepEqual(selected, { row, scope: 'orders' });
  page = mod.exports.PreparationSequenceScreen();
  assert.equal(nodes(page, node => node.type === 'PreparationDock').length, 1);
  const sheet = nodes(page, node => typeof node.type === 'function' && node.type.name === 'PreparationDetailSheet')[0];
  assert.ok(sheet);
  const sheetTree = sheet.type(sheet.props);
  const modal = nodes(sheetTree, node => node.type === 'ModalBottomSheet')[0];
  assert.equal(nodes(modal, node => node.type === 'PreparationDock').length, 1);
  focusEffects.at(-1)()();
  assert.equal(selected, null);
});
