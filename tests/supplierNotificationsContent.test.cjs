const assert = require('node:assert/strict');
const test = require('node:test');
const { load, renderedNodes } = require('./support/supplierOverviewHarness.cjs');

const model = load('supplier/supplierScreenModel', {
  '../shared/notification/notificationDetailModel': load('shared/notification/notificationDetailModel'),
  '../shared/searchNormalizer': load('shared/searchNormalizer'),
});
const record = (id, extra = {}) => ({ id, status: 'pending', item_code: `CODE-${id}`, item_name: `Item ${id}`,
  sent_qty: 4, accepted_qty: 0, uom: 'kg', highlight: '', note: '', created_label: `Date ${id}`, ...extra });

// Element tree and controller stand-ins: no native renderer, device, network or notification store.
function fixture(platform, { items = [], highlighted = new Set(), store = {}, onReceipt } = {}) {
  let cursor = 0;
  const slots = [], calls = [];
  const react = { useState(initial) {
    const i = cursor++;
    if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial;
    return [slots[i], value => { slots[i] = typeof value === 'function' ? value(slots[i]) : value; }];
  } };
  const jsx = (type, props) => ({ type, props }), components = names => Object.fromEntries(names.split(' ').map(name => [name, name]));
  const controller = { reload: async () => { calls.push('reload'); }, clearAll: async () => { calls.push('clear'); },
    open: async id => { calls.push(`open:${id}`); } };
  const notificationState = { controller, items, highlighted, store: { loadedHistory: false, loadingHistory: false, historyError: null, ...store } };
  const views = load(`supplier/SupplierNotificationsScreen.${platform}`, {
    react, 'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
    '@expo/ui/swift-ui': components('Button HStack Image ProgressView Section Spacer Text VStack'),
    '@expo/ui/swift-ui/modifiers': { listRowBackground: color => ({ color }) },
    '@expo/ui/jetpack-compose': { ...components('Host IconButton RNHostView Text TextButton'), useMaterialColors: () => ({
      onSecondaryContainer: 'on-secondary', secondaryContainer: 'secondary', onSurface: 'on-surface', surfaceContainerLow: 'surface',
    }) },
    '@expo/ui/jetpack-compose/modifiers': { semantics: value => value, testID: value => value },
    'expo-router': { Stack: { Screen: 'Screen' } }, 'expo-symbols': components('SymbolView'),
    'react-native': { ...components('ActivityIndicator Pressable RefreshControl ScrollView Text View'), PlatformColor: value => value },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0 }) },
    '../components/WorkerAlert': components('WorkerAlert'), '../components/WorkerQueueCard.android': components('WorkerQueueCard'),
    '../preparation/PreparationUI': components('PreparationList PreparationText'),
    '../shared/navigation/RoleHeader.android': components('RoleHeader'), '../shared/navigation/RoleHeaderButton': components('RoleHeaderButton'),
    './supplierScreenModel': model, './useSupplierNotifications': { useSupplierNotifications: () => notificationState },
    './useSupplierOverview': { useSupplierText: () => ({ l: key => key, menuTooltip: 'menu' }) },
  }, 'tsx');
  const opened = [];
  const props = { onOpenDrawer: () => calls.push('drawer'), footer: { type: 'SupplierFooter', props: {} },
    ...(onReceipt ? { onReceipt: id => opened.push(id) } : {}) };
  const render = () => { cursor = 0; return renderedNodes(views.SupplierNotificationsScreen(props)); };
  return { calls, opened, notificationState, props, render };
}
const texts = nodes => nodes.filter(node => typeof node === 'string' || typeof node === 'number').map(String);
const press = node => (node.props.onPress ?? node.props.onClick)();
const retry = nodes => nodes.find(node => (node?.props?.label === 'retry' || node?.type === 'TextButton')
  && (node.props.onPress || node.props.onClick));
const refresh = nodes => nodes.find(node => node?.type === 'PreparationList')?.props.refresh
  ?? nodes.find(node => node?.type === 'ScrollView')?.props.refreshControl?.props.onRefresh;
const loading = nodes => nodes.some(node => node?.type === 'ProgressView' || node?.type === 'ActivityIndicator');

// V2 supplier_notifications_screen_widgets_part_01.dart:193-244 uses a non-null error guard.
for (const platform of ['ios', 'android']) {
  test(`${platform}: every non-null initial notification error shows retry instead of progress`, () => {
    for (const error of [Error('offline'), false, 0, '']) {
      const f = fixture(platform, { store: { historyError: error } }), nodes = f.render();
      assert.equal(loading(nodes), false, String(error));
      assert.ok(texts(nodes).includes('serverDisconnectedRetry'), String(error));
      assert.equal(typeof refresh(nodes), 'function');
      assert.ok(retry(nodes), String(error)); press(retry(nodes)); assert.deepEqual(f.calls, ['reload']);
    }
  });

  test(`${platform}: notification list retains loading, empty and cached-content states`, () => {
    const waiting = fixture(platform, { store: { loadingHistory: true } });
    assert.equal(loading(waiting.render()), true); assert.equal(refresh(waiting.render()), undefined);
    const empty = fixture(platform, { store: { loadedHistory: true } });
    assert.ok(texts(empty.render()).includes('noNotifications')); assert.equal(typeof refresh(empty.render()), 'function');
    const cached = fixture(platform, { items: [record('first')], store: { loadedHistory: true, historyError: Error('refresh') } });
    const nodes = cached.render(); assert.equal(loading(nodes), false);
    assert.ok(texts(nodes).includes('CODE-first')); assert.ok(!texts(nodes).includes('serverDisconnectedRetry'));
    refresh(nodes)(); assert.deepEqual(cached.calls, ['reload']);
  });

  test(`${platform}: notification rows show source content and only offer the supplied receipt action`, () => {
    const rows = [record('unread', { highlight: ' Custom highlight ', accepted_qty: 2, status: 'accepted' }), record('regular')];
    for (const enabled of [false, true]) {
      const f = fixture(platform, { items: rows, highlighted: new Set(['unread']), store: { loadedHistory: true }, onReceipt: enabled });
      const nodes = f.render(), content = texts(nodes);
      for (const value of ['CODE-unread', ' Custom highlight ', '4 kg jo‘natildi • 2 kg qabul', 'Date unread',
        'CODE-regular', 'Item regular', '4 kg jo‘natildi', 'Date regular']) assert.ok(content.includes(value), value);
      assert.ok(content.indexOf('CODE-unread') < content.indexOf('CODE-regular'));
      const receiptRows = platform === 'ios' ? nodes.filter(node => node?.type === 'Button' && typeof node.props.onPress === 'function')
        : nodes.filter(node => node?.type === 'WorkerQueueCard');
      assert.equal(receiptRows.length, platform === 'ios' && !enabled ? 0 : 2);
      if (enabled) {
        if (platform === 'ios') { assert.deepEqual(receiptRows[0].props.modifiers, [{ color: 'systemFill' }]);
          assert.equal(receiptRows[1].props.modifiers, undefined); }
        else assert.deepEqual(receiptRows.map(row => row.props.backgroundColor), ['secondary', 'surface']);
        receiptRows.forEach(press); assert.deepEqual(f.calls, ['open:unread', 'open:regular']);
      }
      else if (platform === 'android') assert.ok(receiptRows.every(row => row.props.onPress === undefined));
      assert.equal(nodes.filter(node => node?.type === 'SupplierFooter').length, 1);
    }
  });

  test(`${platform}: clear and navigation controls retain their supplied effects`, () => {
    const f = fixture(platform, { store: { loadedHistory: true } });
    let nodes = f.render(), header = nodes.find(node => node?.type === 'Screen');
    if (header) { press(header.props.options.headerLeft()); press(header.props.options.headerRight()); }
    else { nodes.find(node => node?.type === 'RoleHeader').props.navigation.onPress(); press(nodes.find(node => node?.type === 'IconButton')); }
    assert.deepEqual(f.calls, ['drawer']);
    nodes = f.render(); const alert = nodes.find(node => node?.type === 'WorkerAlert').props.alert;
    assert.deepEqual([alert.title, alert.message, alert.cancelLabel, alert.confirmLabel],
      ['clearTitle', 'clearAllNotificationsPrompt', 'no', 'yes']);
    nodes.find(node => node?.type === 'WorkerAlert').props.onDismiss();
    assert.equal(f.render().find(node => node?.type === 'WorkerAlert').props.alert, null);
    assert.deepEqual(f.calls, ['drawer']);
    nodes = f.render(); header = nodes.find(node => node?.type === 'Screen');
    if (header) press(header.props.options.headerRight()); else press(nodes.find(node => node?.type === 'IconButton'));
    f.render().find(node => node?.type === 'WorkerAlert').props.alert.onConfirm();
    assert.deepEqual(f.calls, ['drawer', 'clear']);
    f.props.onRootBack = () => f.calls.push('back'); nodes = f.render(); header = nodes.find(node => node?.type === 'Screen');
    if (header) press(header.props.options.headerLeft()); else nodes.find(node => node?.type === 'RoleHeader').props.navigation.onPress();
    assert.deepEqual(f.calls, ['drawer', 'clear', 'back']);
  });
}
