const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
function load(file, overrides = {}) {
  const filename = path.join(root, file), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths;
  mod.require = id => Object.hasOwn(overrides, id) ? overrides[id] : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, filename);
  return mod.exports;
}
const nav = load('src/customer/customerNavigation.ts');
const routes = load('src/shared/appRoutes.ts');
const session = (role, capabilities) => ({ token: 'token', profile: { role, ref: 'user' }, capabilities });

test('Customer home is connected on both native platforms without changing existing home targets', () => {
  const customer = session('customer', ['customer.access']);
  assert.equal(routes.homeTarget(customer, 'ios'), '/ios-customer');
  assert.equal(routes.homeTarget(customer, 'android'), '/android-customer');
  assert.equal(routes.homeTarget(customer, 'web'), null);
  assert.equal(routes.homeTarget(session('aparatchi', ['apparatus.queue.read']), 'ios'), '/ios-worker');
  assert.equal(routes.homeTarget(session('aparatchi', ['apparatus.queue.read']), 'android'), 'worker');
  assert.equal(routes.homeTarget(session('tayyorlov_masteri', ['preparation.access']), 'ios'), '/ios-preparation');
  assert.equal(routes.homeTarget(session('tayyorlov_masteri', ['preparation.access']), 'android'), '/android-preparation');
});

test('drawer destinations, active routes and the notification badge follow CustomerDock', () => {
  for (const platform of ['ios', 'android']) {
    assert.equal(nav.customerDestinationPath(platform, 'home'), `/${platform}-customer`);
    for (const id of ['notifications', 'profile', 'chat']) assert.equal(nav.customerDestinationPath(platform, id), `/${platform}-customer/${id}`);
    assert.equal(nav.customerDrawerActive(`/${platform}-customer`), 'home');
    assert.equal(nav.customerDrawerActive(`/${platform}-customer/notifications`), 'notifications');
    assert.equal(nav.customerDrawerActive(`/${platform}-customer/profile`), 'profile');
    for (const id of ['chat', 'detail', 'status', 'notifications/detail']) assert.equal(nav.customerDrawerActive(`/${platform}-customer/${id}`), undefined);
  }
  assert.equal(nav.customerNotificationBadge(true, null), true);
  assert.equal(nav.customerNotificationBadge(true, 'home'), true);
  assert.equal(nav.customerNotificationBadge(true, 'notifications'), false);
  assert.equal(nav.customerNotificationBadge(false, 'home'), false);
  assert.equal(nav.customerStatusKind('pending'), 'pending');
  assert.equal(nav.customerStatusKind('confirmed'), 'confirmed');
  assert.equal(nav.customerStatusKind('rejected'), 'rejected');
  assert.equal(nav.customerStatusKind('other'), null);
  assert.equal(nav.customerStatusKind(['pending']), null);
});

test('status and delivery navigation keeps IDs and refreshes after the correct return', () => {
  for (const platform of ['ios', 'android']) {
    const calls = [], store = { refresh: async () => { calls.push('refresh'); } }, focusCallbacks = [];
    const router = { push: route => calls.push(['push', route]), canGoBack: () => true, back: () => calls.push('back'), replace: route => calls.push(['replace', route]) };
    const hooks = load('src/customer/useCustomerNavigation.ts', {
      'expo-router': { router, useFocusEffect: cb => focusCallbacks.push(cb) },
      react: { useCallback: cb => cb, useRef: value => ({ current: value }) }, './CustomerContext': { useCustomerContext: () => ({ store }) },
    });
    const handlers = hooks.useCustomerNavigation(platform);
    focusCallbacks[0](); assert.deepEqual(calls, []);
    handlers.openStatus('confirmed');
    assert.deepEqual(calls.shift(), ['push', { pathname: `/${platform}-customer/status`, params: { kind: 'confirmed' } }]);
    focusCallbacks[0](); assert.deepEqual(calls, ['refresh']); calls.length = 0;
    handlers.openDetail('MAT-DN-42', 'status');
    assert.deepEqual(calls.shift(), ['push', { pathname: `/${platform}-customer/detail`, params: { id: 'MAT-DN-42', origin: 'status' } }]);
    handlers.changed('status'); assert.deepEqual(calls, ['refresh', 'back']); calls.length = 0;
    handlers.openDetail('A/B', 'notifications');
    assert.deepEqual(calls.shift(), ['push', { pathname: platform === 'ios' ? '/ios-customer/notifications/detail' : '/android-customer/detail',
      params: { id: 'A/B', origin: 'notifications' } }]);
    handlers.changed('notifications'); assert.deepEqual(calls, ['back']);
  }
});

const jsx = { Fragment: 'Fragment', jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
function nodes(node, predicate) {
  if (!node || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap(child => nodes(child, predicate));
  return [...(predicate(node) ? [node] : []), ...nodes(node.props?.children, predicate)];
}
function routeFixture(platform, params = {}) {
  const calls = [], navigation = { openStatus: kind => calls.push(['status', kind]), openDetail: (id, origin) => calls.push(['detail', id, origin]),
    changed: origin => calls.push(['changed', origin]) };
  const mocks = { 'react/jsx-runtime': jsx,
    react: { useState: initial => [initial, () => {}], useCallback: cb => cb },
    'expo-router': { Redirect: 'Redirect', Stack: { Screen: 'Screen' }, useLocalSearchParams: () => params,
      router: { navigate: route => calls.push(['navigate', route]), dismissTo: route => calls.push(['dismissTo', route]) } },
    '@expo/ui/swift-ui': { Button: 'Button', Host: 'Host' }, '@expo/ui/swift-ui/modifiers': { labelStyle: v => v },
    '@expo/ui/jetpack-compose': { useMaterialColors: () => ({ surfaceContainerLow: 'bg', secondaryContainer: 'secondary', onSecondaryContainer: 'fg' }) },
    'expo-symbols': { SymbolView: 'SymbolView' }, 'react-native': { PlatformColor: value => value, Pressable: 'Pressable', View: 'View' },
    'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView', useSafeAreaInsets: () => ({ top: 1 }) },
    '../components/ProfileScreen': { ProfileScreen: 'ProfileScreen' }, '../shared/localization': { uiText: text => text },
    '../shared/chat/ChatPages': { ChatListPage: 'ChatListPage', ChatRouteStack: 'ChatRouteStack' },
    '../shared/chat/ChatRouteContext': { ChatRouteProvider: 'ChatRouteProvider' },
    '../shared/navigation/RoleDrawerButton': { RoleDrawerButton: 'RoleDrawerButton' },
    '../shared/navigation/RoleHeader.android': { RoleHeader: 'RoleHeader' },
    '../shared/navigation/roleDrawerContext': { useRoleDrawer: () => ({ open: () => calls.push('drawer') }) },
    './CustomerContext': { useCustomerText: () => ({ text: key => key, locale: 'uz' }),
      useCustomerContext: () => ({ session: { token: 'test' }, onLogout() {} }) },
    './CustomerDelivery': { CustomerDeliveryDetailScreen: 'CustomerDeliveryDetailScreen' },
    './CustomerHome': { CustomerHomeScreen: 'CustomerHomeScreen', CustomerStatusDetailScreen: 'CustomerStatusDetailScreen' },
    [`./CustomerNotificationsView.${platform}`]: { CustomerNotificationsScreen: 'CustomerNotificationsScreen' },
    './CustomerShell': { useCustomerChatClosing: () => () => {} }, './CustomerDock.android': { CustomerDock: 'CustomerDock' },
    './customerNavigation': nav, './customerPresentation': { customerStatusTitleKey: kind => `title:${kind}` },
    './useCustomerNavigation': { useCustomerNavigation: () => navigation },
  };
  return { routes: load(`src/customer/CustomerRoutes.${platform}.tsx`, mocks), calls };
}

test('both platform route wrappers connect home, status, notification and delivery screens', () => {
  for (const platform of ['ios', 'android']) {
    const { routes: wrappers, calls } = routeFixture(platform, { kind: 'pending', id: 'DN-42', origin: 'status' });
    const home = wrappers.CustomerHomeRoute();
    const homeScreen = nodes(home, n => n.type === 'CustomerHomeScreen')[0];
    homeScreen.props.onOpenStatus('rejected'); homeScreen.props.onOpenDetail('DN-1');
    const status = nodes(wrappers.CustomerStatusRoute(), n => n.type === 'CustomerStatusDetailScreen')[0];
    assert.equal(status.props.kind, 'pending'); status.props.onOpenDetail('DN-2');
    const notifications = nodes(wrappers.CustomerNotificationsRoute(), n => n.type === 'CustomerNotificationsScreen')[0];
    assert.equal(typeof notifications.props.onClearActionChanged, 'function'); notifications.props.onOpenDetail('DN-3');
    const delivery = nodes(wrappers.CustomerDeliveryRoute(), n => n.type === 'CustomerDeliveryDetailScreen')[0];
    assert.equal(delivery.props.deliveryNoteID, 'DN-42'); delivery.props.onChanged();
    assert.deepEqual(calls, [['status', 'rejected'], ['detail', 'DN-1', 'home'], ['detail', 'DN-2', 'status'],
      ['detail', 'DN-3', 'notifications'], ['changed', 'status']]);
    assert.equal(routeFixture(platform, { kind: 'wrong' }).routes.CustomerStatusRoute().type, 'Redirect');
    assert.equal(routeFixture(platform).routes.CustomerDeliveryRoute().type, 'Redirect');
    const profile = nodes(wrappers.CustomerProfileRoute(), n => n.type === 'ProfileScreen')[0];
    assert.equal(profile.props.session.token, 'test');
  }
});

test('Android Customer dock reuses native bar, suppresses notification dot on its own tab and routes taps', () => {
  for (const active of ['home', 'notifications', 'chat', null]) {
    const calls = [];
    const dock = load('src/customer/CustomerDock.android.tsx', {
      'react/jsx-runtime': jsx, 'expo-router': { useNavigation: parent => { assert.equal(parent, '/android-customer'); return { dispatch: action => calls.push(action) }; } },
      'react-native-safe-area-context': { useSafeAreaInsets: () => ({ bottom: 12 }) },
      '../shared/navigation/RoleBottomBar.android': { RoleBottomBar: 'RoleBottomBar' },
      './CustomerContext': { useCustomerText: () => ({ text: key => key }), useCustomerUnread: () => true, useCustomerContext: () => ({ chatUnread: 2 }) },
      './customerNavigation': nav,
    }).CustomerDock({ active });
    assert.equal(dock.type, 'RoleBottomBar'); assert.equal(dock.props.active, active ?? ''); assert.equal(dock.props.bottomInset, 12);
    assert.deepEqual(dock.props.items.map(item => item.id), ['home', 'notifications', 'chat']);
    assert.equal(dock.props.items[1].showBadge, active !== 'notifications'); assert.equal(dock.props.items[2].showBadge, true);
    if (active) dock.props.onSelect(active);
    dock.props.onSelect('notifications');
    assert.deepEqual(calls, active === 'notifications' ? [] : [{ type: 'NAVIGATE', payload: { name: 'notifications', pop: true } }]);
  }
});

test('Customer drawer delegates current-item and logout behavior to the existing drawer', () => {
  const calls = [], state = { visible: false, onOpen() {}, onClose() {} };
  const drawer = load('src/customer/CustomerDrawer.tsx', {
    'react/jsx-runtime': jsx, 'react-native': { Platform: { OS: 'android' } },
    'expo-router': { router: { replace: path => calls.push(['replace', path]) },
      usePathname: () => '/android-customer' },
    '../shared/localization': { uiText: text => text }, '../shared/navigation/RoleDrawer': { RoleDrawer: 'RoleDrawer' },
    '../shared/navigation/roleDrawerContext': { useRoleDrawerState: () => state },
    '../shared/navigation/roleDrawerLogout': { confirmRoleDrawerLogout: () => calls.push('logout') },
    './CustomerContext': { useCustomerContext: () => ({ onLogout() {} }), useCustomerText: () => ({ text: key => key, locale: 'uz' }) },
    './customerNavigation': nav,
  }).CustomerDrawer({ children: 'content' });
  assert.equal(drawer.type, 'RoleDrawer'); assert.equal(drawer.props.active, 'home'); assert.equal(drawer.props.title, 'Bo‘limlar');
  assert.deepEqual(drawer.props.items.map(item => item.id), ['home', 'notifications', 'profile']);
  drawer.props.onSelect('notifications'); drawer.props.onSelect('profile'); drawer.props.onSelect('logout');
  assert.deepEqual(calls, [['replace', '/android-customer/notifications'], ['replace', '/android-customer/profile'], 'logout']);
});

test('iOS Customer native tabs show the shared Chat unread dot and suppress the notification dot while active', () => {
  for (const count of [0, 2]) for (const pathname of ['/ios-customer', '/ios-customer/notifications']) {
    const Trigger = Object.assign(function Trigger() {}, { Icon: 'Icon', Label: 'Label', Badge: 'Badge' });
    const NativeTabs = Object.assign(function NativeTabs() {}, { Trigger });
    const shell = load('src/customer/CustomerShell.ios.tsx', {
      'react/jsx-runtime': jsx, 'expo-router': { usePathname: () => pathname }, 'expo-router/native-tabs': { NativeTabs },
      react: { createContext: () => ({ Provider: 'Provider' }), useContext: () => () => {}, useState: value => [value, () => {}] },
      './CustomerDrawer': { CustomerDrawer: 'CustomerDrawer' },
      './CustomerContext': { useCustomerText: () => ({ text: key => key }), useCustomerContext: () => ({ chatUnread: count }), useCustomerUnread: () => true },
      './customerNavigation': nav,
    }).CustomerShell();
    const triggers = nodes(shell, node => node.type === Trigger);
    assert.deepEqual(triggers.map(item => item.props.name), ['(home)', 'notifications', 'chat']);
    assert.equal(nodes(triggers[1], node => node.type === 'Badge').length, pathname.endsWith('/notifications') ? 0 : 1);
    assert.equal(nodes(triggers[2], node => node.type === 'Badge').length, count > 0 ? 1 : 0);
  }
});

test('Android Customer dock hides the shared Chat dot at zero unread', () => {
  const dock = load('src/customer/CustomerDock.android.tsx', {
    'react/jsx-runtime': jsx, 'expo-router': { useNavigation: () => ({ dispatch() {} }) },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ bottom: 0 }) },
    '../shared/navigation/RoleBottomBar.android': { RoleBottomBar: 'RoleBottomBar' },
    './CustomerContext': { useCustomerText: () => ({ text: key => key }), useCustomerUnread: () => false, useCustomerContext: () => ({ chatUnread: 0 }) },
    './customerNavigation': nav,
  }).CustomerDock({ active: 'home' });
  assert.equal(dock.props.items[2].showBadge, false);
});

test('persistent Customer session provider starts the shared unread hook once with its own session', () => {
  const calls = [], session = { imageCacheScope: 'customer-account', profile: { role: 'customer' } };
  class Notifications { constructor() {} }
  const modules = {
    'react/jsx-runtime': jsx,
    react: { createContext: () => ({ Provider: 'CustomerContextProvider' }), useCallback: fn => fn, useContext() {}, useEffect() {},
      useMemo: fn => fn(), useRef: value => ({ current: value }), useState: () => [session, () => {}], useSyncExternalStore() {} },
    'expo-router': { Redirect: 'Redirect', router: { replace() {} } },
    'react-native': { ActivityIndicator: 'ActivityIndicator', Platform: { OS: 'ios' }, View: 'View' },
    '../auth': { loadSession() {}, logout() {}, registerSessionResetHook() {} }, '../appLock': { clearAppLock() {} },
    '../appPreferences': { appPreferences: {} }, '../components/WorkerSecurity': { WorkerSecurityProvider: 'WorkerSecurityProvider' },
    '../shared/appRoutes': { appRoutes: { customerHome: '/customer-home' }, canOpenRoute: () => true },
    '../shared/chat/useChatUnreadCount': { useChatUnreadCount: value => { calls.push(value); return 4; } },
    '../shared/localization': { localizedGetter() {}, localizedMethod() {} }, '../shared/localization/runtime': { localeController: {} },
    '../shared/notificationStoresRuntime': { notificationHiddenStore: {}, notificationUnreadStore: {}, refreshHub: {} },
    './customerNotifications': { CustomerNotificationsController: Notifications }, './customerRuntime': { createCustomerStore: () => ({}) },
  };
  const gate = load('src/customer/CustomerContext.tsx', modules).CustomerGate({ platform: 'ios', children: 'role-shell' });
  assert.equal(gate.type, 'WorkerSecurityProvider');
  const provider = gate.props.children.type(gate.props.children.props);
  assert.equal(provider.type, 'CustomerContextProvider');
  assert.equal(provider.props.value.session, session); assert.equal(provider.props.value.chatUnread, 4);
  assert.deepEqual(calls, [session]);
});

test('notification listener survives a pushed detail and stops only when its screen unmounts', () => {
  const events = [], effects = [];
  const notifications = { subscribe: () => () => {}, version: 0, items: [], highlightedIds: new Set(),
    start: () => events.push('start'), stop: () => events.push('stop') };
  const store = { subscribe: () => () => {}, version: 0, loading: false, loaded: true, error: null };
  const hooks = load('src/customer/useCustomerScreens.ts', {
    react: { useCallback: fn => fn, useEffect: fn => effects.push(fn), useRef: v => ({ current: v }), useState: v => [v, () => {}],
      useSyncExternalStore() {} },
    './customerApi': {}, './customerLogic': {}, './CustomerContext': { useCustomerContext: () => ({ notifications, store }) },
    '../shared/notificationStoresRuntime': { refreshHub: {} },
  });
  hooks.useCustomerNotifications();
  assert.equal(effects.length, 1); const unmount = effects[0]();
  assert.deepEqual(events, ['start']);
  // Opening a child route does not unmount the feed, so no cleanup fires.
  assert.deepEqual(events, ['start']);
  unmount(); assert.deepEqual(events, ['start', 'stop']);
});
