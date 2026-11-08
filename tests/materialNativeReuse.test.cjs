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
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText, filename);
  return loaded.exports;
}
function setup() {
  const calls = [], session = {}, state = { groups: [], events: [{ event_id: 'one', event_type: 'receipt_posted' },
    { event_id: 'two', event_type: 'transfer_out' }], error: null, loading: false };
  state.homeActions = { cards: [], fab: [], select: id => calls.push(['select', id]) };
  const refresh = async () => { calls.push('refresh'); }, sheet = { open: (value, options) => calls.push(['sheet', value, options]), close() {} };
  const react = { useEffect() {}, useState: initial => [initial, () => {}] };
  const mocks = { 'react/jsx-runtime': jsx, react,
    '@expo/ui/jetpack-compose': { Column: 'Column', Host: 'Host', Text: 'ComposeText', useMaterialColors: () => ({}) },
    '@expo/ui/swift-ui': { Button: 'Button', Host: 'Host', HStack: 'HStack', Image: 'Image', List: 'List',
      ProgressView: 'ProgressView', Section: 'Section', Text: 'SwiftText', VStack: 'VStack' },
    '@expo/ui/swift-ui/modifiers': { font: value => value, foregroundStyle: value => value, frame: value => value, lineLimit: value => value },
    'expo-symbols': { SymbolView: 'SymbolView' },
    'expo-router': { Stack: { Screen: 'Stack.Screen' }, router: { canGoBack: () => true, back: () => calls.push('back'), navigate() {} } },
    'react-native': { ActivityIndicator: 'ActivityIndicator', PlatformColor: value => value, Text: 'Text', View: 'View' },
    'react-native-reanimated': { useSharedValue: value => ({ value }) },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) },
    '../auth': { activeSessionToken: () => 'token', registerSessionResetHook: () => () => {} },
    '../components/WorkerQueueCard.android': { WorkerQueueCard: 'WorkerQueueCard' },
    '../nativeSheet': { useNativeSheet: () => sheet },
    '../preparation/PreparationUI': { PreparationList: 'PreparationList' },
    '../preparation/PreparationUI.android': { PreparationText: 'PreparationText' },
    '../shared/navigation/RoleHeader.android': { RoleHeader: 'RoleHeader' },
    '../shared/navigation/RoleFab.android': { RoleFab: 'RoleFab' },
    '../shared/navigation/roleDrawerContext': { useRoleDrawer: () => ({ open() {} }) },
    '../shared/orders/OrdersList': { OrdersList: 'OrdersList' },
    './MaterialContext': { useMaterialContext: () => ({ session }) },
    './useMaterialScope': { useMaterialScope: () => ({ groups: state.groups, refresh }) },
    './materialHomeActions': { materialHomeActions: () => state.homeActions },
    './useMaterialHistory': { useMaterialHistory: () => ({ events: state.events, apparatus: [], error: state.error,
      loading: state.loading, refreshing: false, refresh, reload: () => calls.push('reload') }) },
    './materialHistoryPresentation': { materialHistoryTitle: event => `title-${event.event_id}`, materialHistorySubtitle: () => 'subtitle',
      materialHistoryTime: () => 'time', materialHistoryDetails: () => [] },
    './materialHistorySymbols': load('material/materialHistorySymbols.ts', {}),
  };
  return { calls, state, refresh, homeAndroid: load('material/MaterialHome.android.tsx', mocks).MaterialHome,
    historyAndroid: load('material/MaterialHistory.android.tsx', mocks).MaterialHistory,
    homeIos: load('material/MaterialHome.ios.tsx', mocks).MaterialHome,
    historyIos: load('material/MaterialHistory.ios.tsx', mocks).MaterialHistory };
}

test('Android Material shell reuses the existing OrdersList and preparation text', async () => {
  const h = setup(), tree = h.homeAndroid(), list = nodes(tree, n => n.type === 'OrdersList')[0];
  assert.ok(list); assert.equal(list.props.active, true); assert.equal(list.props.passthrough({}), true);
  assert.equal(nodes(tree, n => n.type === 'PreparationText').length, 2); await list.props.onRefresh();
  assert.deepEqual(h.calls, ['refresh']);
});

test('home actions compose the existing Android card and FAB and native iOS controls', () => {
  const h = setup(), item = { id: 'receipt', label: 'Kirim', icon: { ios: 'scalemass', android: 'scale' }, width: 150 };
  h.state.homeActions.cards = [item]; h.state.homeActions.fab = [item];
  const android = h.homeAndroid(), cards = nodes(android, n => n.type === 'WorkerQueueCard');
  const fab = nodes(android, n => n.type === 'RoleFab')[0];
  assert.equal(cards.length, 1); assert.ok(fab); assert.deepEqual(fab.props.actions, [{ id: 'receipt', label: 'Kirim', icon: 'scale', width: 150 }]);
  cards[0].props.onPress(); fab.props.onSelect('receipt');
  const ios = h.homeIos(), buttons = nodes(ios, n => n.type === 'Button');
  assert.equal(buttons.length, 1); assert.equal(nodes(ios, n => n.type === 'Image')[0].props.systemName, 'scalemass');
  buttons[0].props.onPress(); assert.deepEqual(h.calls, [['select', 'receipt'], ['select', 'receipt'], ['select', 'receipt']]);
});

test('Android Material history reuses OrdersList, WorkerQueueCard and the existing native sheet', async () => {
  const h = setup(), tree = h.historyAndroid(), list = nodes(tree, n => n.type === 'OrdersList')[0];
  const cards = nodes(tree, n => n.type === 'WorkerQueueCard');
  assert.ok(list); assert.equal(cards.length, 2); assert.equal(cards[0].props.first, true); assert.equal(cards[1].props.last, true);
  const icons = nodes(tree, n => n.type === 'SymbolView');
  assert.deepEqual(icons.map(icon => icon.props.name.android), ['add_business', 'chevron_right', 'call_made', 'chevron_right']);
  await list.props.onRefresh(); cards[0].props.onPress();
  assert.equal(h.calls[0], 'refresh'); assert.equal(h.calls[1][0], 'sheet'); assert.equal(h.calls[1][2].dismissible, true);
});

test('iOS Material shell and history reuse the existing native PreparationList', async () => {
  const h = setup(), home = h.homeIos(), history = h.historyIos();
  const homeList = nodes(home, n => n.type === 'PreparationList')[0], historyList = nodes(history, n => n.type === 'PreparationList')[0];
  assert.ok(homeList); assert.ok(historyList); await homeList.props.refresh(); await historyList.props.refresh();
  const historyButtons = nodes(history, n => n.type === 'Button'); assert.equal(historyButtons.length, 2);
  const icons = nodes(history, n => n.type === 'Image');
  assert.deepEqual(icons.map(icon => icon.props.systemName), ['tray.and.arrow.down', 'chevron.right', 'arrow.up.right', 'chevron.right']);
  historyButtons[0].props.onPress(); assert.deepEqual(h.calls.slice(0, 2), ['refresh', 'refresh']);
  assert.equal(h.calls[2][0], 'sheet'); assert.equal(h.calls[2][2].dismissible, true);
});
