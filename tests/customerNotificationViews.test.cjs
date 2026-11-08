const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const { loadCustomerStates } = require('./support/customerNativeStates.cjs');
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
function fixture(platform, state, confirm = false, locale = 'uz') {
  const cleanups = [], updates = [], refs = [];
  const mocks = { 'react/jsx-runtime': jsx, react: { useCallback: fn => fn, useEffect: fn => { const clean = fn(); if (clean) cleanups.push(clean); },
    useRef: value => { const ref = { current: value }; refs.push(ref); return ref; }, useState: () => [confirm, value => updates.push(value)] },
    '@expo/ui': { ListItem: 'ListItem', Text: 'Text', Host: 'Host', Button: 'Button' },
    '@expo/ui/swift-ui': { Button: 'Button', Host: 'Host', HStack: 'HStack', Image: 'Image', List: 'List', ProgressView: 'ProgressView', Section: 'Section', VStack: 'VStack' },
    '@expo/ui/swift-ui/modifiers': { listStyle: v => ['listStyle', v], refreshable: f => ['refreshable', f], listRowBackground: c => ['background', c],
      accessibilityHidden: () => ['accessibilityHidden'], background: (color, shape) => ['background', color, shape], buttonStyle: v => ['buttonStyle', v],
      contentShape: v => ['contentShape', v], fixedSize: v => ['fixedSize', v], font: v => ['font', v], foregroundStyle: v => ['foregroundStyle', v],
      frame: v => ['frame', v], lineLimit: () => ['lineLimit'], listRowInsets: v => ['listRowInsets', v], padding: v => ['padding', v],
      shapes: { rectangle: () => ['rectangle'], roundedRectangle: v => ['roundedRectangle', v] } },
    '@expo/ui/jetpack-compose': { useMaterialColors: () => ({ surfaceContainerLow: 'bg', surfaceContainer: 'card', surfaceContainerHighest: 'icon-bg', onSurface: 'fg', onSurfaceVariant: 'muted', secondaryContainer: 'highlight', onSecondaryContainer: 'selected' }) },
    'expo-symbols': { SymbolView: 'SymbolView' }, 'expo-router': { useFocusEffect: fn => { const clean = fn(); if (clean) cleanups.push(clean); } }, 'react-native': { ActivityIndicator: 'ActivityIndicator', FlatList: 'FlatList', ScrollView: 'ScrollView', RefreshControl: 'RefreshControl',
      Text: 'Text', View: 'View', PlatformColor: value => value },
    '../components/WorkerQueueCard.android': { WorkerQueueCard: 'WorkerQueueCard' }, '../components/WorkerAlert': { WorkerAlert: 'WorkerAlert' },
    './CustomerContext': { useCustomerText: () => ({ locale, text: key => key }) }, './CustomerStates': loadCustomerStates(platform), './customerPresentation': presentation,
    './useCustomerScreens': { useCustomerNotifications: () => state } };
  return { ...load(`CustomerNotificationsView.${platform}.tsx`, mocks), updates, cleanups, refs };
}
test('both notification views mark the tapped item seen before opening it', async () => {
  for (const platform of ['ios', 'android']) {
    const calls = [], state = { loaded: true, loading: false, error: null, records: [record], highlightedIds: new Set(['dn']),
      refresh: async () => {}, markSeen: async id => calls.push(['seen', id]), clearAll: async () => {} };
    const screen = fixture(platform, state).CustomerNotificationsScreen({ onOpenDetail: id => calls.push(['open', id]) });
    const row = platform === 'ios' ? nodes(screen, item => item.type === 'Button')[0] : nodes(screen, item => item.type === 'FlatList')[0].props.renderItem({ item: record, index: 0 });
    row.props.onPress(); await Promise.resolve(); await Promise.resolve();
    assert.deepEqual(calls, [['seen', 'dn'], ['open', 'dn']]);
    if (platform === 'android') assert.equal(row.props.backgroundColor, 'highlight');
    else assert.ok(row.props.modifiers.some(m => m[0] === 'background' && m[1] === 'secondarySystemFill'));
  }
});

test('Android populated feed heading uses V2 titleLarge emphasis', () => {
  const state = { loaded: true, loading: false, error: null, records: [record], highlightedIds: new Set(),
    refresh: async () => {}, markSeen: async () => {}, clearAll: async () => {} };
  const screen = fixture('android', state).CustomerNotificationsScreen({ onOpenDetail() {} });
  const heading = nodes(screen, n => n.type === 'FlatList')[0].props.ListHeaderComponent;
  assert.equal(heading.props.children, 'shipmentsFlowTitle');
  assert.equal(heading.props.style.fontSize, 20); assert.equal(heading.props.style.fontWeight, '700');
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
// Source-derived: customer_notifications_screen_widgets_part_01.dart loading, retry and empty branches.
test('initial feed loading takes priority, uses the common centered native state, and leaves the clear dialog mounted', () => {
  for (const platform of ['ios', 'android']) for (const error of [null, Error('offline')]) {
    const state = { loaded: false, loading: true, error, records: [], highlightedIds: new Set(), refresh: async () => {}, markSeen: async () => {}, clearAll: async () => {} };
    const screen = fixture(platform, state, true).CustomerNotificationsScreen({ onOpenDetail() {} });
    const loading = nodes(screen, n => n.type?.name === 'CustomerLoadingState')[0]; assert.ok(loading);
    assert.equal(nodes(screen, n => n.type === 'FlatList' || n.type === 'ScrollView' || n.type === 'List').length, 0);
    assert.ok(nodes(loading.type(loading.props), n => n.type === (platform === 'ios' ? 'ProgressView' : 'LoadingIndicator')).length);
    assert.equal(nodes(screen, n => n.type === 'WorkerAlert')[0].props.alert.title, 'clearTitle');
  }
});

test('failed and empty feeds use source state priority, retain refresh and the real retry callback', async () => {
  for (const platform of ['ios', 'android']) for (const [loaded, loading, error, expected] of [
    [false, false, Error('offline'), 'CustomerRetryState'], [true, false, null, 'CustomerEmptyFeedState'],
    [false, false, null, 'CustomerEmptyFeedState'], [true, true, Error('old'), 'CustomerEmptyFeedState'],
  ]) {
    let refreshes = 0;
    const state = { loaded, loading, error, records: [], highlightedIds: new Set(), refresh: async () => { refreshes++; }, markSeen: async () => {}, clearAll: async () => {} };
    const screen = fixture(platform, state).CustomerNotificationsScreen({ onOpenDetail() {} });
    const list = nodes(screen, n => n.type === (platform === 'ios' ? 'ScrollView' : 'FlatList'))[0]; assert.ok(list);
    if (platform === 'ios') assert.equal(list.props.alwaysBounceVertical, true);
    const empty = platform === 'ios' ? undefined : list.props.ListEmptyComponent;
    if (empty) { assert.equal(empty.type, 'View'); assert.equal(empty.props.style.flexGrow, 1); }
    const view = platform === 'ios' ? list.props.children : empty.props.children;
    assert.equal(view.type.name, expected); list.props.refreshControl.props.onRefresh(); await Promise.resolve(); assert.equal(refreshes, 1);
    const rendered = view.type(view.props);
    if (expected === 'CustomerRetryState') {
      assert.equal(view.props.retry, state.refresh);
      assert.ok(nodes(rendered, n => n.type === 'Text' && n.props.children === 'serverDisconnectedRetry').length);
      const button = nodes(rendered, n => n.type === (platform === 'ios' ? 'Button' : 'TextButton'))[0];
      (button.props.onPress ?? button.props.onClick)(); await Promise.resolve(); assert.equal(refreshes, 2);
    } else {
      assert.ok(nodes(rendered, n => n.type === 'Text' && n.props.children === 'noRecordsYet').length);
      assert.equal(nodes(rendered, n => n.type === 'Button' || n.type === 'TextButton').length, 0);
    }
  }
});

test('cached feed rows remain visible during an initial refresh or error', () => {
  for (const platform of ['ios', 'android']) for (const [loading, error] of [[true, null], [true, Error('offline')], [false, Error('offline')]]) {
    const state = { loaded: false, loading, error, records: [record], highlightedIds: new Set(), refresh: async () => {}, markSeen: async () => {}, clearAll: async () => {} };
    const screen = fixture(platform, state).CustomerNotificationsScreen({ onOpenDetail() {} });
    assert.equal(nodes(screen, n => n.type?.name === 'CustomerLoadingState' || n.type?.name === 'CustomerRetryState').length, 0);
    const row = platform === 'ios' ? nodes(screen, n => n.type === 'Button')[0]
      : nodes(screen, n => n.type === 'FlatList')[0].props.renderItem({ item: record, index: 0 });
    assert.ok(row);
  }
});

test('the empty feed is a read-only 16-padded native panel and follows Urdu direction', () => {
  for (const platform of ['ios', 'android']) for (const [locale, direction] of [['uz', 'leftToRight'], ['ur-PK', 'rightToLeft']]) {
    const state = loadCustomerStates(platform, { locale }).CustomerEmptyFeedState();
    const host = nodes(state, n => n.type === 'Host')[0]; assert.equal(host.props.layoutDirection, direction);
    const label = nodes(state, n => n.type === 'Text' && n.props.children === 'noRecordsYet')[0]; assert.ok(label);
    assert.equal(nodes(state, n => n.type === 'Button' || n.type === 'TextButton').length, 0);
    if (platform === 'ios') {
      const card = nodes(state, n => n.type === 'VStack')[0];
      assert.ok(card.props.modifiers.some(m => m[0] === 'padding' && m[1].all === 16));
      assert.ok(card.props.modifiers.some(m => m[0] === 'background' && m[2][1].cornerRadius === 28));
    } else {
      const card = nodes(state, n => n.type === 'Surface')[0];
      assert.deepEqual(card.props.shape.props.cornerRadii, { topStart: 28, topEnd: 28, bottomStart: 28, bottomEnd: 28 });
      assert.ok(label.props.modifiers.some(m => m[0] === 'paddingAll' && m[1] === 16));
      assert.equal(card.props.onClick, undefined);
    }
  }
});

// Source-derived: customer_notifications_screen_widgets_part_02.dart _CustomerFeedRow.
test('notification content keeps the V2 code and body line limits, with an unrestricted name', () => {
  for (const platform of ['ios', 'android']) for (const note of ['', 'Izoh نام\n'.repeat(20)]) {
    const longRecord = { ...record, item_name: 'Mahsulot نام '.repeat(40), item_code: 'PRODUCT-'.repeat(40), note };
    const state = { loaded: true, loading: false, error: null, records: [longRecord], highlightedIds: new Set(),
      refresh: async () => {}, markSeen: async () => {}, clearAll: async () => {} };
    const screen = fixture(platform, state).CustomerNotificationsScreen({ onOpenDetail() {} });
    const row = platform === 'ios' ? nodes(screen, item => item.type === 'Button')[0]
      : nodes(screen, item => item.type === 'FlatList')[0].props.renderItem({ item: longRecord, index: 0 });
    const texts = nodes(row, item => item.type === 'Text');
    for (const [value, lines] of [[longRecord.item_name, undefined], [longRecord.item_code, 1],
      [note || '3 kg jo‘natildi', 2]]) {
      const text = texts.find(item => item.props.children === value);
      assert.ok(text, `${platform} retains the complete source content`);
      assert.equal(text.props.numberOfLines, lines, `${platform} limit for ${value.slice(0, 20)}`);
      if (platform === 'android' && lines) assert.equal(text.props.ellipsizeMode, 'tail');
    }
  }
});

test('notification rows preserve icon boxes, top-aligned timestamps and one real target', () => {
  for (const platform of ['ios', 'android']) for (const [status, highlighted, expected] of [
    ['accepted', false, platform === 'ios' ? 'checkmark' : 'done'],
    ['rejected', true, platform === 'ios' ? 'xmark' : 'close'],
    ['pending', false, platform === 'ios' ? 'clock' : 'schedule'],
  ]) {
    const item = { ...record, status }, state = { loaded: true, loading: false, error: null, records: [item],
      highlightedIds: new Set(highlighted ? [item.id] : []), refresh: async () => {}, markSeen: async () => {}, clearAll: async () => {} };
    const screen = fixture(platform, state, false, 'ur-PK').CustomerNotificationsScreen({ onOpenDetail() {} });
    const row = platform === 'ios' ? nodes(screen, n => n.type === 'Button')[0]
      : nodes(screen, n => n.type === 'FlatList')[0].props.renderItem({ item, index: 0 });
    assert.equal(typeof row.props.onPress, 'function');
    const name = nodes(row, n => n.type === 'Text' && n.props.children === item.item_name)[0];
    const code = nodes(row, n => n.type === 'Text' && n.props.children === item.item_code)[0];
    const body = nodes(row, n => n.type === 'Text' && n.props.children === '3 kg jo‘natildi')[0];
    const date = nodes(row, n => n.type === 'Text' && n.props.children === item.created_label)[0];
    assert.ok(name && code && body && date); assert.equal(date.props.numberOfLines, undefined);
    if (platform === 'ios') {
      const host = nodes(screen, n => n.type === 'Host')[0]; assert.equal(host.props.layoutDirection, 'rightToLeft');
      const layout = row.props.children; assert.equal(layout.type, 'HStack'); assert.equal(layout.props.alignment, 'top');
      assert.ok(layout.props.modifiers.some(m => m[0] === 'padding' && m[1].all === 16));
      assert.ok(layout.props.modifiers.some(m => m[0] === 'contentShape'));
      const icon = nodes(row, n => n.type === 'Image')[0]; assert.equal(icon.props.systemName, expected); assert.equal(icon.props.size, 20);
      assert.ok(icon.props.modifiers.some(m => m[0] === 'frame' && m[1].width === 40 && m[1].height === 40));
      assert.ok(icon.props.modifiers.some(m => m[0] === 'accessibilityHidden'));
      const iconBackground = icon.props.modifiers.find(m => m[0] === 'background');
      assert.equal(iconBackground[1], highlighted ? 'secondarySystemFill' : 'tertiarySystemFill');
      assert.equal(iconBackground[2][1].cornerRadius, 12);
      assert.ok(date.props.modifiers.some(m => m[0] === 'padding' && m[1].leading === 12));
      assert.ok(code.props.modifiers.some(m => m[0] === 'padding' && m[1].top === 4));
      assert.ok(body.props.modifiers.some(m => m[0] === 'padding' && m[1].top === 8));
      assert.equal(nodes(row.props.children, n => n.type === 'Button').length, 0);
    } else {
      const layout = row.props.children; assert.equal(layout.props.style.alignItems, 'flex-start'); assert.equal(layout.props.style.direction, 'rtl');
      assert.equal(layout.props.style.paddingHorizontal, 8); assert.equal(layout.props.style.paddingVertical, 10);
      const icon = nodes(row, n => n.type === 'SymbolView')[0]; assert.equal(icon.props.name.android, expected); assert.equal(icon.props.size, 20);
      assert.equal(icon.props.accessible, false);
      const box = nodes(row, n => n.type === 'View' && n.props.style?.width === 40)[0];
      assert.equal(box.props.style.height, 40); assert.equal(box.props.style.borderRadius, 12);
      assert.equal(box.props.style.backgroundColor, highlighted ? 'highlight' : 'icon-bg');
      assert.equal(row.props.backgroundColor, highlighted ? 'highlight' : 'card');
      assert.equal(name.props.style.fontWeight, '500'); assert.equal(code.props.style.marginTop, 4); assert.equal(body.props.style.marginTop, 8);
    }
  }
});
