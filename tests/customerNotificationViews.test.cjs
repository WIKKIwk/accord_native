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
function load(file, overrides = {}) {
  const filename = path.resolve(__dirname, '../src/customer', file), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths;
  mod.require = id => Object.hasOwn(overrides, id) ? overrides[id] : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, filename);
  return mod.exports;
}
const presentation = load('customerPresentation.ts', { './customerLogic': load('customerLogic.ts') });
const record = { id: 'dn', item_name: 'Product', item_code: 'P1', sent_qty: 3, uom: 'kg', note: '', created_label: 'date', status: 'pending' };
function fixture(platform, state, confirm = false) {
  const cleanups = [], updates = [], refs = [];
  const mocks = { 'react/jsx-runtime': jsx, react: { useCallback: fn => fn, useEffect: fn => { const clean = fn(); if (clean) cleanups.push(clean); },
    useRef: value => { const ref = { current: value }; refs.push(ref); return ref; }, useState: () => [confirm, value => updates.push(value)] },
    '@expo/ui': { ListItem: 'ListItem', Text: 'Text', Host: 'Host', Button: 'Button' },
    '@expo/ui/swift-ui': { Button: 'Button', Host: 'Host', List: 'List', ProgressView: 'ProgressView', Section: 'Section', VStack: 'VStack' },
    '@expo/ui/swift-ui/modifiers': { listStyle: v => ['listStyle', v], refreshable: f => ['refreshable', f], listRowBackground: c => ['background', c] },
    '@expo/ui/jetpack-compose': { useMaterialColors: () => ({ surfaceContainerLow: 'bg', onSurface: 'fg', onSurfaceVariant: 'muted', secondaryContainer: 'highlight', onSecondaryContainer: 'selected' }) },
    'expo-symbols': { SymbolView: 'SymbolView' }, 'expo-router': { useFocusEffect: fn => { const clean = fn(); if (clean) cleanups.push(clean); } }, 'react-native': { ActivityIndicator: 'ActivityIndicator', FlatList: 'FlatList', RefreshControl: 'RefreshControl',
      Text: 'Text', View: 'View', PlatformColor: value => value },
    '../components/WorkerQueueCard.android': { WorkerQueueCard: 'WorkerQueueCard' }, '../components/WorkerAlert': { WorkerAlert: 'WorkerAlert' },
    './CustomerContext': { useCustomerText: () => ({ text: key => key }) }, './customerPresentation': presentation,
    './useCustomerScreens': { useCustomerNotifications: () => state } };
  return { ...load(`CustomerNotificationsView.${platform}.tsx`, mocks), updates, cleanups, refs };
}
test('both notification views mark the tapped item seen before opening it', async () => {
  for (const platform of ['ios', 'android']) {
    const calls = [], state = { loaded: true, loading: false, error: null, records: [record], highlightedIds: new Set(['dn']),
      refresh: async () => {}, markSeen: async id => calls.push(['seen', id]), clearAll: async () => {} };
    const screen = fixture(platform, state).CustomerNotificationsScreen({ onOpenDetail: id => calls.push(['open', id]) });
    const row = platform === 'ios' ? nodes(screen, item => item.type === 'ListItem')[0] : nodes(screen, item => item.type === 'FlatList')[0].props.renderItem({ item: record, index: 0 });
    row.props.onPress(); await Promise.resolve(); await Promise.resolve();
    assert.deepEqual(calls, [['seen', 'dn'], ['open', 'dn']]);
    if (platform === 'android') assert.equal(row.props.backgroundColor, 'highlight');
    else assert.deepEqual(row.props.modifiers, [['background', 'secondarySystemFill']]);
  }
});
test('clear action presents V2 confirmation and only its confirm callback clears', async () => {
  for (const platform of ['ios', 'android']) {
    let clearAction, clears = 0;
    const state = { loaded: true, loading: false, error: null, records: [], highlightedIds: new Set(), refresh: async () => {}, markSeen: async () => {}, clearAll: async () => { clears++; } };
    const first = fixture(platform, state);
    first.CustomerNotificationsScreen({ onOpenDetail() {}, onClearActionChanged: value => { clearAction = value; } });
    assert.equal(typeof clearAction, 'function'); clearAction(); assert.deepEqual(first.updates, [true]); assert.equal(clears, 0);
    const screen = fixture(platform, state, true).CustomerNotificationsScreen({ onOpenDetail() {} });
    const alert = nodes(screen, item => item.type === 'WorkerAlert')[0].props.alert;
    assert.deepEqual([alert.title, alert.message, alert.cancelLabel, alert.confirmLabel], ['clearTitle', 'clearAllNotificationsPrompt', 'no', 'yes']);
    alert.onConfirm(); await Promise.resolve(); assert.equal(clears, 1);
  }
});
test('empty, loading and retry feed states preserve the V2 labels', () => {
  for (const platform of ['ios', 'android']) for (const [loaded, loading, error, expected] of [
    [true, false, null, 'noRecordsYet'], [false, false, Error('offline'), 'serverDisconnectedRetry'], [false, true, null, null],
  ]) {
    const state = { loaded, loading, error, records: [], highlightedIds: new Set(), refresh: async () => {}, markSeen: async () => {}, clearAll: async () => {} };
    const screen = fixture(platform, state).CustomerNotificationsScreen({ onOpenDetail() {} });
    const content = platform === 'android' ? nodes(screen, item => item.type === 'FlatList')[0].props.ListEmptyComponent : screen;
    if (expected) assert.ok(nodes(content, item => item.type === 'Text').some(item => item.props.children === expected));
    else assert.ok(nodes(content, item => item.type === (platform === 'ios' ? 'ProgressView' : 'ActivityIndicator')).length);
  }
});
