const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

const jsx = { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
function load(file, mocks = {}) {
  const filename = path.resolve(__dirname, '../src', file), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths;
  mod.require = id => id === 'react/jsx-runtime' ? jsx : Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, filename);
  return mod.exports;
}
function nodes(node, predicate) {
  if (!node || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap(child => nodes(child, predicate));
  return [...(predicate(node) ? [node] : []), ...nodes(node.props?.children, predicate)];
}
const model = load('chatModel.ts');
function fixture() {
  const calls = [], session = { imageCacheScope: 'account' };
  const colors = { surfaceContainerLow: 'page', surface: 'card', primary: 'primary', onPrimary: 'onPrimary', onSurface: 'text', onSurfaceVariant: 'secondary' };
  const items = [{ id: 'one', title: 'Saidjaxon', preview: 'hzbz', timestamp: 100, unreadCount: 101, peer: null },
    { id: 'two', title: 'Ibrohim', preview: 'Salom', timestamp: 200, unreadCount: 0, peer: null }];
  const state = { items, query: '', error: '', avatarToken: 'avatar', refresh: async () => calls.push('refresh'),
    setQuery: value => { state.query = value; } };
  const navigation = { openDirectory: () => calls.push('directory'), openConversation: item => calls.push(item.id) };
  const { ChatConversationsScreen } = load('components/ChatConversationsScreen.android.tsx', {
    '@expo/ui/jetpack-compose': { useMaterialColors: () => colors },
    'expo-router': { Stack: { Screen: 'Screen' }, router: { back: () => calls.push('fallbackBack') } },
    'expo-symbols': { SymbolView: 'SymbolView' },
    'react-native': { View: 'View', Text: 'Text', ActivityIndicator: 'ActivityIndicator', Pressable: 'Pressable', StyleSheet: { create: value => value } },
    'react-native-gesture-handler': { GestureHandlerRootView: 'GestureHandlerRootView' },
    'react-native-reanimated': { useSharedValue: value => ({ get: () => value, set() {} }) },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 24 }) },
    '../chatModel': model, '../shared/chat/useChatConversations': { useChatConversations: () => state },
    '../shared/orders/OrdersHeader': { OrdersHeader: 'OrdersHeader' }, '../shared/orders/OrdersList': { OrdersList: 'OrdersList' },
    './ChatAvatar': { ChatAvatar: 'ChatAvatar' }, './WorkerQueueCard.android': { WorkerQueueCard: 'WorkerQueueCard' },
  });
  return { state, items, calls, colors, session, render: props => ChatConversationsScreen({ session, navigation, onOpenDrawer: () => calls.push('drawer'), ...props }) };
}

test('Android chat uses the shared themed search and virtual list, preserving conversation actions and unread counts', () => {
  const f = fixture(), tree = f.render();
  assert.equal(tree.type, 'GestureHandlerRootView');
  assert.equal(tree.props.children.props.style[1].backgroundColor, f.colors.surfaceContainerLow);
  assert.equal(tree.props.children.props.style[1].paddingTop, 24);
  assert.equal(nodes(tree, node => node.type === 'Screen')[0].props.options.headerShown, false);
  const header = nodes(tree, node => node.type === 'OrdersHeader')[0];
  header.props.onMenu(); header.props.trailing.props.onPress();
  assert.deepEqual(f.calls, ['drawer', 'directory']);
  const list = nodes(tree, node => node.type === 'OrdersList')[0];
  assert.equal(list.props.onRefresh, f.state.refresh); assert.equal(list.props.passthrough(), true);
  const cards = nodes(tree, node => node.type === 'WorkerQueueCard');
  assert.equal(cards.length, 2); assert.equal(cards[0].props.first, true); assert.equal(cards[1].props.last, true);
  assert.equal(cards[0].props.backgroundColor, f.colors.surface);
  assert.ok(nodes(cards[0], node => node.type === 'Text').some(node => node.props.children === '99+'));
  assert.equal(nodes(cards[0], node => node.type === 'ChatAvatar')[0].props.token, 'avatar');
  cards[1].props.onPress(); assert.equal(f.calls.at(-1), 'two');
  header.props.onSearchChange('HZBZ');
  const filtered = nodes(f.render(), node => node.type === 'WorkerQueueCard');
  assert.equal(filtered.length, 1); assert.equal(filtered[0].props.first, true); assert.equal(filtered[0].props.last, true);
  filtered[0].props.onPress(); assert.equal(f.calls.at(-1), 'one');
  const back = nodes(f.render({ onBack: () => f.calls.push('back') }), node => node.type === 'OrdersHeader')[0];
  assert.equal(back.props.onMenu, undefined); back.props.onBack(); assert.equal(f.calls.at(-1), 'back');
});

test('Android chat retains loading, empty, search-empty and retry states', async () => {
  const f = fixture(); f.state.items = null;
  assert.equal(nodes(f.render(), node => node.type === 'ActivityIndicator').length, 1);
  f.state.items = [];
  assert.ok(nodes(f.render(), node => node.type === 'Text').some(node => node.props.children === 'Hali suhbatlar yo‘q'));
  f.state.query = 'missing';
  assert.ok(nodes(f.render(), node => node.type === 'Text').some(node => node.props.children === 'Chat topilmadi'));
  f.state.error = 'Network error';
  const tree = f.render();
  assert.equal(nodes(tree, node => node.type === 'ActivityIndicator').length, 0);
  nodes(tree, node => node.type === 'Pressable')[0].props.onPress();
  await nodes(tree, node => node.type === 'OrdersList')[0].props.onRefresh();
  assert.deepEqual(f.calls, ['refresh', 'refresh']);
});
