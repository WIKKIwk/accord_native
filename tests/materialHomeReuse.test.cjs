const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const jsx = { Fragment: 'Fragment', jsx: (type, props, key) => ({ type, props, key }), jsxs: (type, props, key) => ({ type, props, key }) };
function nodes(node, predicate) {
  if (!node || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap(child => nodes(child, predicate));
  return [...(predicate(node) ? [node] : []), ...nodes(node.props?.children, predicate)];
}
function load(filename, mocks) {
  filename = path.resolve(__dirname, '../src', filename); const loaded = new Module(filename, module);
  loaded.filename = filename; loaded.paths = module.paths;
  loaded.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, filename);
  return loaded.exports;
}
function setup() {
  const calls = [], session = {}, witness = {}, state = { groups: [], actions: { cards: [], fab: [], select: id => calls.push(['select', id]) } };
  const refresh = async () => { calls.push('refresh'); };
  const mocks = { 'react/jsx-runtime': jsx, '@expo/ui/jetpack-compose': { useMaterialColors: () => ({}) },
    '@expo/ui/swift-ui': { Button: 'Button', HStack: 'HStack', Image: 'Image', Section: 'Section', Text: 'SwiftText' },
    '@expo/ui/swift-ui/modifiers': { frame: value => value }, 'expo-symbols': { SymbolView: 'SymbolView' },
    'expo-router': { Stack: { Screen: 'Stack.Screen' } }, 'react-native': { View: 'View' },
    'react-native-reanimated': { useSharedValue: value => ({ value }) }, 'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0 }) },
    '../components/WorkerQueueCard.android': { WorkerQueueCard: 'WorkerQueueCard' }, '../preparation/PreparationUI': { PreparationList: 'PreparationList' },
    '../preparation/PreparationUI.android': { PreparationText: 'PreparationText' }, '../shared/navigation/RoleHeader.android': { RoleHeader: 'RoleHeader' },
    '../shared/navigation/RoleFab.android': { RoleFab: 'RoleFab' }, '../shared/navigation/roleDrawerContext': { useRoleDrawer: () => ({ open() {} }) },
    '../shared/orders/OrdersList': { OrdersList: 'OrdersList' }, './MaterialContext': { useMaterialContext: () => ({ session, witness }) },
    './useMaterialScope': { useMaterialScope: () => ({ groups: state.groups, refresh }) }, './materialHomeActions': { materialHomeActions: () => state.actions } };
  return { calls, state, android: load('material/MaterialHome.android.tsx', mocks).MaterialHome, ios: load('material/MaterialHome.ios.tsx', mocks).MaterialHome };
}
test('Material Home reuses native list, card and FAB components and their action callbacks', async () => {
  const h = setup(), item = { id: 'receipt', label: 'Kirim', icon: { ios: 'scalemass', android: 'scale' }, width: 150 };
  h.state.actions.cards = [item]; h.state.actions.fab = [item];
  const android = h.android(), list = nodes(android, n => n.type === 'OrdersList')[0], card = nodes(android, n => n.type === 'WorkerQueueCard')[0];
  const fab = nodes(android, n => n.type === 'RoleFab')[0]; assert.ok(list); assert.ok(card); assert.ok(fab);
  assert.deepEqual(fab.props.actions, [{ id: 'receipt', label: 'Kirim', icon: 'scale', width: 150 }]);
  await list.props.onRefresh(); card.props.onPress(); fab.props.onSelect('receipt');
  const ios = h.ios(), iosList = nodes(ios, n => n.type === 'PreparationList')[0], button = nodes(ios, n => n.type === 'Button')[0];
  assert.ok(iosList); assert.ok(button); assert.equal(nodes(ios, n => n.type === 'Image')[0].props.systemName, 'scalemass');
  await iosList.props.refresh(); button.props.onPress();
  assert.deepEqual(h.calls, ['refresh', ['select', 'receipt'], ['select', 'receipt'], 'refresh', ['select', 'receipt']]);
});
