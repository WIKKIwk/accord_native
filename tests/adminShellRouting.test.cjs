/* global __dirname */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const jsx = { Fragment: 'Fragment', jsx: (type, props, key) => ({ type, props, key }), jsxs: (type, props, key) => ({ type, props, key }) };
function load(file, mocks = {}) {
  const filename = path.resolve(__dirname, '../src', file), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths;
  mod.require = id => id === 'react/jsx-runtime' ? jsx : Object.hasOwn(mocks, id) ? mocks[id] : id.startsWith('.') ? {} : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { fileName: filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText, filename);
  return mod.exports;
}
const routes = load('shared/appRoutes.ts'), { appRoutes: r } = routes;
const drawerNavigation = load('admin/adminDrawerNavigation.ts', {
  '../shared/camera/synchronousGuard': load('shared/camera/synchronousGuard.ts'),
  './adminDrawerModel': load('admin/adminDrawerModel.ts'), './adminDrawerNavigationState': load('admin/adminDrawerNavigationState.ts'),
});
const drawerRoot = name => ({ type: 'stack', key: 'root', index: 0, routes: [{ name: 'ios-admin', state: {
  type: 'tab', key: 'tabs', index: 0, routes: [{ name: '(home)', state: { type: 'stack', key: 'home', index: name === 'index' ? 0 : 1,
    routes: name === 'index' ? [{ name: 'index' }] : [{ name: 'index' }, { name }] } }, { name: 'activity' }],
} }] });
const access = load('admin/adminShellAccess.ts', { '../shared/appRoutes': routes });
const session = (role, capabilities, extra = {}) => ({ token: 'token', profile: { role, ref: 'user' }, capabilities, ...extra });
const admin = session('admin', ['admin.access', 'gscale.print']);
const sales = session('sales_manager', ['sales.access']);
const brigader = session('brigader', ['brigader.access']);
const worker = session('aparatchi', ['apparatus.queue.read']);
const prep = session('tayyorlov_masteri', ['preparation.access']);

test('Admin home is held while separately ported roles retain their targets', () => {
  for (const value of [admin, session('customer', ['catalog.item.read'])]) {
    assert.equal(access.adminShellMayEnter(value), true);
    assert.equal(routes.homeTarget(value, 'ios'), null);
    assert.equal(routes.homeTarget(value, 'android'), null);
    assert.equal(routes.homeTarget(value, 'web'), null);
  }
  for (const value of [sales, brigader]) { assert.equal(access.adminShellMayEnter(value), false);
    assert.equal(routes.homeTarget(value, 'ios'), null); assert.equal(routes.homeTarget(value, 'android'), null); }
  assert.equal(routes.homeTarget(worker, 'ios'), '/ios-worker'); assert.equal(routes.homeTarget(worker, 'android'), 'worker');
  assert.equal(routes.homeTarget(prep, 'ios'), '/ios-preparation'); assert.equal(routes.homeTarget(prep, 'android'), '/android-preparation');
  assert.equal(routes.homeTarget(session('supplier', ['supplier.access']), 'ios'), null);
});
test('shell and login reject missing session, unauthorized capabilities and role-specific mismatches', () => {
  for (const value of [null, session('admin', []), session('sales_manager', ['admin.access']), session('brigader', ['admin.access']),
    sales, brigader, session('admin', ['admin.access'], { token: ' ' }), session('admin', ['admin.access'], { profile: { role: 'admin', ref: ' ' } }), worker, prep]) {
    assert.equal(access.adminShellMayEnter(value), false);
  }
  assert.equal(routes.homeTarget(session('sales_manager', ['admin.access']), 'ios'), null);
  assert.equal(routes.homeTarget(session('brigader', ['admin.access']), 'android'), null);
});
test('destination requires shell access, current route permission, explicit integration enablement and platform', () => {
  const enabled = new Set([r.adminHome, r.profile, r.gscaleMode, r.adminProductionMapOrders, r.adminFactoryLocations]), held = new Set(), activityEnabled = new Set([r.adminActivity]);
  for (const platform of ['ios', 'android']) {
    assert.equal(access.adminDestinationPath(admin, r.adminHome, platform, enabled), `/${platform}-admin`);
    assert.equal(access.adminDestinationPath(admin, r.adminFactoryLocations, platform, enabled), null);
    assert.equal(access.adminDestinationPath(session('admin', ['admin.access', 'factory.location.manage']), r.adminFactoryLocations, platform, enabled), `/${platform}-admin/factory-locations`);
    assert.equal(access.adminDestinationPath(worker, r.adminFactoryLocations, platform, enabled), null);
    assert.equal(access.adminDestinationPath(admin, r.profile, platform, held), null);
    assert.equal(access.adminDestinationPath(admin, r.profile, platform, enabled), `/${platform}-admin/profile`);
    assert.equal(access.adminDestinationPath(admin, r.gscaleMode, platform, enabled), `/${platform}-gscale`);
    assert.equal(access.adminDestinationPath(admin, r.adminProductionMapOrders, platform, enabled), `/${platform}-admin/work-map`);
    assert.equal(access.adminDestinationPath(session('customer', ['catalog.item.read', 'production.map.read']), r.adminProductionMapOrders, platform, enabled), `/${platform}-admin/work-map`);
    assert.equal(access.adminDestinationPath(session('customer', ['catalog.item.read']), r.adminProductionMapOrders, platform, enabled), null);
    assert.equal(access.adminDestinationPath(session('admin', ['admin.roles.read']), r.adminProductionMapOrders, platform, enabled), null);
    assert.equal(access.adminDestinationPath(worker, r.adminProductionMapOrders, platform, enabled), null);
    assert.equal(access.adminDestinationPath(worker, r.profile, platform, enabled), null);
    assert.equal(access.adminDestinationPath(sales, r.gscaleMode, platform, enabled), null);
    assert.equal(access.adminDestinationPath(admin, r.adminActivity, platform, enabled), null);
    assert.equal(access.adminDestinationPath(session('admin', ['admin.access', 'admin.activity.read']), r.adminActivity, platform, activityEnabled), `/${platform}-admin/activity`);
  }
  assert.equal(access.adminDestinationPath(admin, r.profile, 'web', enabled), null);
  const token = session('admin', ['admin.access', 'gscale.print'], { token: 'test-mode-token' });
  assert.equal(access.adminDestinationPath(token, r.profile, 'ios', enabled), null);
  assert.equal(access.adminDestinationPath(token, r.gscaleMode, 'android', enabled), null);
  assert.equal(access.adminDestinationPath(token, r.adminProductionMapOrders, 'ios', enabled), null);
  const demo = session('admin', ['admin.access', 'admin.activity.read', 'factory.location.manage'], { token: 'test-mode-token' });
  for (const route of [r.adminHome, r.adminActivity, r.adminFactoryLocations]) {
    assert.equal(access.adminDestinationPath(demo, route, 'ios', new Set([route])), null);
  }
});

test('reviewed management destinations require their own capabilities in addition to Admin admission', () => {
  const cases = [[r.adminSettings, 'admin.settings.read', 'settings'],
    [r.adminAdditionalSettings, 'admin.access', 'additional-settings'],
    [r.adminItemGroupCreate, 'catalog.item_group.manage', 'item-groups']];
  for (const [route, capability, suffix] of cases) {
    const enabled = new Set([route]), account = session('admin', ['admin.access', capability]);
    for (const platform of ['ios', 'android']) {
      assert.equal(access.adminDestinationPath(account, route, platform, enabled), `/${platform}-admin/${suffix}`);
      assert.equal(access.adminDestinationPath(account, route, platform, new Set()), null);
      assert.equal(access.adminDestinationPath(worker, route, platform, enabled), null);
      assert.equal(access.adminDestinationPath({ ...account, token: 'test-mode-token' }, route, platform, enabled), null);
    }
  }
});

test('session hook captures once and rejects stale loads, inactive and unauthorized sessions', async () => {
  async function run(result, { reset = false, unmount = false, active = true } = {}) {
    const updates = []; let effect, resetHook, resolve, unregistered = false, unobserved = false;
    const auth = { loadSession: () => new Promise(value => { resolve = value; }), activeSessionToken: () => active ? 'token' : null,
      captureSessionWitness: value => ({ session: value, generation: 1 }), isSessionWitnessCurrent: value => !!value && active,
      subscribeSessionWitness: () => () => { unobserved = true; }, registerSessionResetHook: fn => { resetHook = fn; return () => { unregistered = true; }; } };
    const hook = load('admin/useAdminShellSession.ts', { react: { useState: initial => [initial, value => updates.push(value)], useEffect: fn => { effect = fn; } },
      '../auth': auth, './adminShellAccess': access });
    assert.equal(hook.useAdminShellSession(), undefined);
    const cleanup = effect(); if (reset) await resetHook(); if (unmount) cleanup(); resolve(result); await new Promise(done => setImmediate(done));
    if (!unmount) cleanup(); assert.equal(unregistered, true); assert.equal(unobserved, true); return updates;
  }
  assert.deepEqual(await run(admin), [{ session: admin, witness: { session: admin, generation: 1 } }]);
  assert.deepEqual(await run(admin, { reset: true }), [undefined]);
  assert.deepEqual(await run(admin, { unmount: true }), []);
  assert.deepEqual(await run(admin, { active: false }), [null]);
  assert.deepEqual(await run(worker), [null]);
});
test('a witness transition invalidates the old shell and never recaptures the stale operation', async () => {
  let effect, listener, valid = true, captures = 0; const updates = [];
  const witness = { session: admin, generation: 1 };
  const auth = { loadSession: async () => admin, activeSessionToken: () => 'token', captureSessionWitness: () => { captures++; return witness; },
    isSessionWitnessCurrent: value => value === witness && valid, subscribeSessionWitness: fn => { listener = fn; return () => {}; },
    registerSessionResetHook: () => () => {} };
  const hook = load('admin/useAdminShellSession.ts', { react: { useState: initial => [initial, value => updates.push(value)], useEffect: fn => { effect = fn; } },
    '../auth': auth, './adminShellAccess': access });
  hook.useAdminShellSession(); const cleanup = effect(); await new Promise(done => setImmediate(done));
  assert.equal(captures, 1); assert.equal(updates[0].witness, witness); valid = false; listener();
  assert.equal(updates.at(-1), undefined); valid = true; listener(); assert.equal(captures, 1); cleanup();
});
function layout(platform, value, active = true, os = platform, pathname = '/ios-admin') {
  const Trigger = Object.assign(function Trigger() {}, { Icon: 'NativeTabs.Icon', Label: 'NativeTabs.Label' });
  const tabs = Object.assign(function NativeTabs() {}, { Trigger });
  const admission = value == null ? value : { session: value, witness: { session: value } };
  const mocks = { react: { useCallback: fn => fn, useSyncExternalStore: (_subscribe, get) => get() },
    'expo-router': { Redirect: 'Redirect', Stack: 'Stack', usePathname: () => pathname }, 'expo-router/native-tabs': { NativeTabs: tabs },
    'react-native': { ActivityIndicator: 'ActivityIndicator', Platform: { OS: os }, View: 'View' },
    '../auth': { isSessionWitnessCurrent: () => active, logout: async () => {}, sessionWitnessVersion: () => 1, subscribeSessionWitness: () => () => {} },
    '../components/WorkerSecurity': { WorkerSecurityProvider: 'WorkerSecurityProvider' }, '../shared/appRoutes': routes,
    '../shared/localization': { localizedGetter: key => key }, '../shared/localization/runtime': { localeController: { locale: 'en', addListener() {} } },
    './AdminDrawer': { AdminDrawer: 'AdminDrawer' }, './AdminTypography.android': { AdminTypographyProvider: 'AdminTypographyProvider' }, './AdminTestTokenNotice': { AdminTestTokenNotice: 'AdminTestTokenNotice' },
    './AdminShellContext': { AdminShellProvider: 'AdminShellProvider', useAdminShell: () => ({ activityBinding: null, destination: () => null }) }, './AdminOwnedNavigationContext': { AdminOwnedNavigationProvider: 'AdminOwnedNavigationProvider' },
    './adminShellAccess': access, './useAdminShellSession': { useAdminShellSession: () => admission } };
  const outer = load(`admin/AdminLayout.${platform}.tsx`, mocks).AdminLayout();
  const gate = platform === 'android' ? outer.props.children : outer;
  return gate.type(gate.props);
}
test('iOS native Home/Activity roots stay stable while genuine pushed Users/owned pages hide the system bar for their own dock', () => {
  const find = (node, predicate) => { if (!node || typeof node !== 'object') return null; if (predicate(node)) return node;
    const children = [node.props?.children].flat(Infinity); for (const child of children) { const found = find(child, predicate); if (found) return found; } return null; };
  for (const pathname of ['/ios-admin', '/ios-admin/users', '/ios-admin/owned/17', '/ios-admin/settings', '/ios-admin/activity']) {
    const tree = layout('ios', admin, true, 'ios', pathname), owner = find(tree, node => node.type === 'AdminOwnedNavigationProvider');
    assert.ok(owner); assert.equal(owner.props.providers, undefined, 'no dummy source-primary provider is injected');
    const tabsOwner = find(tree, node => typeof node.type === 'function' && node.type.name === 'AdminTabs'), tabs = tabsOwner.type();
    assert.equal(tabs.props.hidden, pathname === '/ios-admin/users' || pathname.startsWith('/ios-admin/owned/'));
    assert.deepEqual(tabs.props.children.map(child => child.props.name), ['(home)', 'activity']); assert.equal(tabs.props.activityEnabled, undefined);
  }
});
for (const platform of ['ios', 'android']) {
  test(`${platform} layout denies unauthorized direct route, inactive account and wrong platform`, () => {
    assert.equal(layout(platform, null).type, 'Redirect'); assert.equal(layout(platform, worker).type, 'Redirect');
    assert.equal(layout(platform, admin, false).type, 'View');
    assert.equal(layout(platform, admin, true, platform === 'ios' ? 'android' : 'ios').type, 'Redirect');
    assert.equal(layout(platform, undefined).type, 'View');
    assert.equal(layout(platform, admin).type, 'WorkerSecurityProvider');
  });
  test(`${platform} test token shows an explicit no-network notice rather than a redirect loop or writable screen`, () => {
    const token = session('admin', ['admin.access'], { token: 'test-mode-token' });
    assert.equal(layout(platform, token).type, 'AdminTestTokenNotice');
  });
}
for (const platform of ['ios', 'android']) test(`${platform} profile requires witness and enabled route and reuses shared Profile without direct logout`, () => {
  for (const [current, destination, allowed] of [[true, null, false], [false, '/profile', false], [true, '/profile', true]]) {
    const react = { useSyncExternalStore: (_s, get) => get(), useCallback: fn => fn, useState: initial => [initial, () => {}], useEffect() {} };
    const native = { Platform: { OS: platform }, View: 'View', Pressable: 'Pressable', PlatformColor: value => value,
      StyleSheet: { create: value => value }, BackHandler: { addEventListener: () => ({ remove() {} }) } };
    const mocks = { react, 'expo-router': { Redirect: 'Redirect', Stack: { Screen: 'Stack.Screen' }, router: { canGoBack: () => false, replace() {}, back() {} } },
      'expo-symbols': { SymbolView: 'SymbolView' }, '@expo/ui/jetpack-compose': { useMaterialColors: () => ({ surfaceContainerLow: 'bg' }) },
      'react-native': native, 'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView', useSafeAreaInsets: () => ({ top: 0 }) },
      '../components/ProfileScreen': { ProfileScreen: 'ProfileScreen' }, '../shared/appRoutes': routes,
      '../shared/localization': { localizedGetter: key => key }, '../shared/localization/runtime': { localeController: { locale: 'en', addListener() {} } },
      '../shared/navigation/RoleHeader.android': { RoleHeader: 'RoleHeader' }, './adminActivityBackLabel': { adminActivityBackLabel: () => 'Back' },
      './AdminBottomBar.android': { AdminBottomBar: 'AdminBottomBar' },
      './AdminShellContext': { useAdminShell: () => ({ session: admin, isCurrent: () => current, destination: () => destination, onLogout() {} }) } };
    const tree = load(`admin/AdminProfileRoute.${platform}.tsx`, mocks).AdminProfileRoute();
    if (!allowed) { assert.equal(tree.type, current ? 'Redirect' : 'View'); continue; }
    function find(node) { if (!node || typeof node !== 'object') return null; if (Array.isArray(node)) return node.map(find).find(Boolean);
      if (node.type === 'ProfileScreen') return node; return find(node.props?.children); }
    const profile = find(tree); assert.ok(profile); assert.equal(profile.props.showDirectLogout, false); assert.equal(profile.props.onDailyWork, undefined);
    assert.equal(profile.props.isCurrent(), true); assert.equal(profile.props.settingsDisabled, true); assert.equal(profile.props.settingsUnavailableMessage, undefined);
  }
});
test('home route resolves on child return or unmount and never pushes a held destination', async () => {
  let focus, cleanup, path = '/ios-gscale', pushes = [];
  const hook = load('admin/useAdminRouteReturn.ts', { react: { useCallback: fn => fn, useEffect: fn => { cleanup = fn(); }, useRef: value => ({ current: value }) },
    'expo-router': { router: { push: value => pushes.push(value) }, useFocusEffect: fn => { focus = fn; fn(); } },
    'react-native': { Platform: { OS: 'ios' } }, './AdminShellContext': { useAdminShell: () => ({ isCurrent: () => true, destination: () => path }) } });
  const open = hook.useAdminRouteReturn(); let completed = false;
  const pending = open(r.gscaleMode).then(() => { completed = true; }); await Promise.resolve();
  assert.equal(completed, false); assert.deepEqual(pushes, ['/ios-gscale']); focus(); await pending; assert.equal(completed, true);
  path = null; await open(r.profile); assert.deepEqual(pushes, ['/ios-gscale']);
  path = '/ios-gscale'; const next = open(r.gscaleMode); cleanup(); await next;
});

test('drawer shows only reviewed destinations, delays navigation/logout and rechecks current session', () => {
  const originalSetTimeout = global.setTimeout, originalClearTimeout = global.clearTimeout;
  const scheduled = [], calls = []; let current = true, path = '/ios-gscale', cleanup;
  global.setTimeout = (callback, delay) => { const timer = { callback, delay }; scheduled.push(timer); return timer; };
  global.clearTimeout = timer => { timer.cancelled = true; };
  try {
    const drawerModel = { adminDrawerDestinations: () => [
      { routeName: r.adminHome, label: 'Home' }, { routeName: r.gscaleMode, label: 'Scale', push: true }, { routeName: r.adminActivity, label: 'Activity' }] };
    const shell = { session: admin, isCurrent: () => current, destination: route => route === r.gscaleMode ? path : null, onLogout: () => calls.push('logout') };
    const Drawer = load('admin/AdminDrawer.tsx', { react: { useMemo: fn => fn(), useEffect: fn => { cleanup = fn(); },
      useSyncExternalStore: (_subscribe, get) => get() }, 'expo-router': { router: { push: value => calls.push(['push', value]) }, usePathname: () => '/ios-admin', useNavigationContainerRef: () => ({ getRootState: () => drawerRoot('index') }) },
      'react-native': { Platform: { OS: 'ios' } }, '../shared/appRoutes': routes,
      '../shared/localization': { localizedGetter: key => key }, '../shared/localization/runtime': { localeController: { locale: 'en', addListener() {} } },
      '../shared/navigation/RoleDrawer': { RoleDrawer: 'RoleDrawer' }, '../shared/navigation/roleDrawerContext': { useRoleDrawerState: () => ({}) },
      '../shared/navigation/roleDrawerLogout': { confirmRoleDrawerLogout: callback => { calls.push('prompt'); callback(); } },
      './adminDrawerModel': drawerModel, './adminDrawerNavigation': drawerNavigation, './adminHomeSymbols': { adminHomeSymbol: () => ({ ios: 'x', android: 'x' }) }, './AdminShellContext': { useAdminShell: () => shell } }).AdminDrawer;
    const tree = Drawer({ children: 'child' }); assert.deepEqual(tree.props.items.map(item => item.id), [r.adminHome, r.gscaleMode]);
    tree.props.onSelect(r.gscaleMode); assert.equal(scheduled.at(-1).delay, 220); path = null; scheduled.at(-1).callback(); assert.deepEqual(calls, []);
    tree.props.onSelect('logout'); assert.equal(scheduled.at(-1).delay, 120); scheduled.at(-1).callback(); assert.deepEqual(calls, ['prompt', 'logout']);
    tree.props.onSelect('logout'); current = false; scheduled.at(-1).callback(); assert.deepEqual(calls, ['prompt', 'logout']);
    cleanup();
  } finally { global.setTimeout = originalSetTimeout; global.clearTimeout = originalClearTimeout; }
});

test('a witness version change creates a fresh admission gate instead of recapturing a stale one', () => {
  let version = 2;
  const mocks = { react: { useCallback: fn => fn, useSyncExternalStore: (_subscribe, get) => get() },
    'expo-router': { Redirect: 'Redirect', Stack: 'Stack' }, 'react-native': { ActivityIndicator: 'ActivityIndicator', Platform: { OS: 'android' }, View: 'View' },
    '../auth': { sessionWitnessVersion: () => version, subscribeSessionWitness: () => () => {}, isSessionWitnessCurrent: () => true, logout: async () => {} },
    '../components/WorkerSecurity': { WorkerSecurityProvider: 'WorkerSecurityProvider' }, './AdminDrawer': { AdminDrawer: 'AdminDrawer' },
    './AdminTypography.android': { AdminTypographyProvider: 'AdminTypographyProvider' }, './AdminTestTokenNotice': { AdminTestTokenNotice: 'AdminTestTokenNotice' }, './AdminShellContext': { AdminShellProvider: 'AdminShellProvider' },
    './adminShellAccess': access, './useAdminShellSession': { useAdminShellSession: () => undefined } };
  const Layout = load('admin/AdminLayout.android.tsx', mocks).AdminLayout;
  const before = Layout(); version++; const after = Layout(); assert.equal(before.type, 'AdminTypographyProvider'); assert.equal(after.type, 'AdminTypographyProvider'); assert.notEqual(before.props.children.key, after.props.children.key);
});
test('test token notice is explicit in all supported languages and has no action or backend dependency', () => {
  let locale = 'uz'; const mocks = { react: { useSyncExternalStore: (_subscribe, get) => get() },
    'react-native': { View: 'View', Text: 'Text', StyleSheet: { create: value => value } },
    '../shared/localization/runtime': { localeController: { get locale() { return locale; }, addListener() {} } } };
  const notice = load('admin/AdminTestTokenNotice.tsx', mocks);
  for (const language of ['uz', 'en', 'ru', 'ur']) {
    locale = language; const tree = notice.AdminTestTokenNotice();
    assert.equal(tree.type, 'View'); assert.equal(tree.props.children.type, 'Text');
    assert.equal(tree.props.children.props.children, notice.adminTestTokenNotice(language));
    assert.equal(tree.props.children.props.onPress, undefined);
  }
});

test('held shell binds the original witness and enables only reviewed permitted destinations', () => {
  let valid = true; const witness = {}, cleanups = [];
  const react = { createContext: () => ({ Provider: 'Provider' }), useCallback: fn => fn, useMemo: fn => fn(), useEffect: fn => cleanups.push(fn()) };
  class Store { constructor(summary, activity) { this.summary = summary; this.activity = activity; } clear() {} }
  const mocks = { react, '../auth': { isSessionWitnessCurrent: candidate => candidate === witness && valid },
    '../sessionReadScope': { sessionReadScope: value => JSON.stringify([value.baseUrl, value.profile.role, value.profile.ref, value.capabilities]) },
    '../shared/appRoutes': routes, './adminActivityReader': { adminActivityReader: () => async () => [] },
    './adminHomeSummaryReader': { adminHomeSummaryReader: () => async () => ({}) }, './adminShellAccess': access, './adminStore': { AdminStore: Store },
    './adminActivityBinding': { createAdminActivityBinding: (session, witness) => ({ session, witness }) } };
  const Provider = load('admin/AdminShellContext.tsx', mocks).AdminShellProvider;
  const account = { ...admin, capabilities: [...admin.capabilities, 'admin.activity.read', 'factory.location.manage'], baseUrl: 'https://server.example' },
    result = Provider({ session: account, witness, onLogout() {}, children: 'home' });
  const shell = result.props.value;
  assert.equal(shell.witness, witness); assert.equal(shell.activityBinding.session, account); assert.equal(shell.activityBinding.witness, witness);
  assert.equal(shell.destination(r.adminHome, 'ios'), '/ios-admin');
  assert.equal(shell.destination(r.adminHome, 'android'), '/android-admin');
  assert.equal(shell.destination(r.profile, 'ios'), '/ios-admin/profile'); assert.equal(shell.destination(r.profile, 'android'), '/android-admin/profile');
  assert.equal(shell.destination(r.adminProductionMapOrders, 'ios'), '/ios-admin/work-map');
  assert.equal(shell.destination(r.adminProductionMapOrders, 'android'), '/android-admin/work-map');
  assert.equal(shell.destination(r.gscaleMode, 'ios'), null);
  assert.equal(shell.destination(r.adminActivity, 'ios'), '/ios-admin/activity');
  assert.equal(shell.destination(r.adminFactoryLocations, 'android'), '/android-admin/factory-locations');
  valid = false; assert.equal(shell.destination(r.profile, 'ios'), null); assert.equal(shell.destination(r.adminProductionMapOrders, 'ios'), null);
  assert.equal(shell.destination(r.adminActivity, 'ios'), null); assert.equal(shell.destination(r.adminFactoryLocations, 'android'), null);
  valid = true; const demo = Provider({ session: { ...account, token: 'test-mode-token' }, witness, onLogout() {}, children: 'notice' }).props.value;
  assert.equal(demo.destination(r.profile, 'ios'), null); assert.equal(demo.destination(r.adminProductionMapOrders, 'ios'), null); cleanups.filter(fn => typeof fn === 'function').forEach(fn => fn());
});

test('held shell integration keeps both actual Admin roots closed', () => {
  for (const platform of ['ios', 'android']) {
    const content = fs.readFileSync(path.resolve(__dirname, `../src/app/${platform}-admin/_layout.tsx`), 'utf8');
    assert.match(content, /Redirect href="\/"/);
    assert.doesNotMatch(content, /AdminLayout/);
  }
});

test('Admin drawer returns to existing Home, marks Factory locations and retires delayed native callbacks', () => {
  const originalSetTimeout = global.setTimeout, originalClearTimeout = global.clearTimeout;
  const scheduled = [], calls = []; let current = true, cleanup;
  global.setTimeout = (callback, delay) => { const timer = { callback, delay }; scheduled.push(timer); return timer; };
  global.clearTimeout = timer => { timer.cancelled = true; };
  try {
    const account = { ...admin, capabilities: [...admin.capabilities, 'factory.location.manage'] };
    const enabled = new Set([r.adminHome, r.adminFactoryLocations]);
    const shell = { session: account, isCurrent: () => current, onLogout() {},
      destination: (route, platform) => current ? access.adminDestinationPath(account, route, platform, enabled) : null };
    const Drawer = load('admin/AdminDrawer.tsx', {
      react: { useMemo: fn => fn(), useEffect: fn => { cleanup = fn(); }, useSyncExternalStore: (_subscribe, get) => get() },
      'expo-router': { router: { push: value => calls.push(['push', value]), dismissTo: value => calls.push(['dismissTo', value]) },
        usePathname: () => '/ios-admin/factory-locations', useNavigationContainerRef: () => ({ getRootState: () => drawerRoot('factory-locations') }) }, 'react-native': { Platform: { OS: 'ios' } }, '../shared/appRoutes': routes,
      '../shared/localization': { localizedGetter: key => key }, '../shared/localization/runtime': { localeController: { locale: 'uz', addListener() {} } },
      '../shared/navigation/RoleDrawer': { RoleDrawer: 'RoleDrawer' }, '../shared/navigation/roleDrawerContext': { useRoleDrawerState: () => ({}) },
      '../shared/navigation/roleDrawerLogout': { confirmRoleDrawerLogout() {} }, './adminHomeSymbols': load('admin/adminHomeSymbols.ts'),
      './adminDrawerModel': { adminDrawerDestinations: () => [
        { routeName: r.adminHome, label: 'Home', materialIcon: 'home_outlined' },
        { routeName: r.adminFactoryLocations, label: 'Factory', materialIcon: 'add_location_alt_outlined' },
        { routeName: r.adminSettings, label: 'Held', materialIcon: 'settings_outlined' },
      ] }, './adminDrawerNavigation': drawerNavigation, './AdminShellContext': { useAdminShell: () => shell },
    }).AdminDrawer;
    const tree = Drawer({ children: 'child' });
    assert.equal(tree.props.active, r.adminFactoryLocations);
    assert.deepEqual(tree.props.items.map(item => item.id), [r.adminHome, r.adminFactoryLocations]);
    assert.deepEqual(tree.props.items[1].symbol, { ios: 'mappin.and.ellipse', android: 'add_location_alt' });
    tree.props.onSelect(r.adminHome); assert.equal(scheduled.at(-1).delay, 220); scheduled.at(-1).callback();
    assert.deepEqual(calls, [['dismissTo', '/ios-admin']]);
    const countSelected = scheduled.length; tree.props.onSelect(r.adminFactoryLocations); assert.equal(scheduled.length, countSelected);
    tree.props.onSelect(r.adminHome); const old = scheduled.at(-1); cleanup(); old.callback();
    assert.equal(calls.length, 1); assert.equal(old.cancelled, true);
    const count = scheduled.length; tree.props.onSelect(r.adminHome); assert.equal(scheduled.length, count);
  } finally { global.setTimeout = originalSetTimeout; global.clearTimeout = originalClearTimeout; }
});

test('Admin drawer opens the real Profile route after its delay only while the witness remains current', () => {
  const originalSetTimeout = global.setTimeout, originalClearTimeout = global.clearTimeout; let timer, current = true; const calls = [];
  global.setTimeout = (fn, ms) => { timer = { fn, ms }; return timer; }; global.clearTimeout = () => {};
  try {
    const shell = { session: admin, isCurrent: () => current, destination: route => current && route === r.profile ? '/ios-admin/profile' : null, onLogout() {} };
    const Drawer = load('admin/AdminDrawer.tsx', { react: { useMemo: fn => fn(), useEffect: fn => fn(),
      useSyncExternalStore: (_subscribe, get) => get() }, 'expo-router': { router: { push: path => calls.push(path) }, usePathname: () => '/ios-admin', useNavigationContainerRef: () => ({ getRootState: () => drawerRoot('index') }) },
      'react-native': { Platform: { OS: 'ios' } }, '../shared/appRoutes': routes,
      '../shared/localization': { localizedGetter: key => key }, '../shared/localization/runtime': { localeController: { locale: 'en', addListener() {} } },
      '../shared/navigation/RoleDrawer': { RoleDrawer: 'RoleDrawer' }, '../shared/navigation/roleDrawerContext': { useRoleDrawerState: () => ({}) },
      '../shared/navigation/roleDrawerLogout': { confirmRoleDrawerLogout() {} },
      './adminDrawerModel': { adminDrawerDestinations: () => [{ routeName: r.adminHome, label: 'Home' }, { routeName: r.profile, label: 'Profile', push: true }] }, './adminDrawerNavigation': drawerNavigation,
      './adminHomeSymbols': { adminHomeSymbol: () => ({ ios: 'x', android: 'x' }) },
      './AdminShellContext': { useAdminShell: () => shell } }).AdminDrawer;
    const tree = Drawer({ children: 'child' }); assert.deepEqual(tree.props.items.map(item => item.id), [r.adminHome, r.profile]);
    tree.props.onSelect(r.profile); assert.equal(timer.ms, 220); timer.fn(); assert.deepEqual(calls, ['/ios-admin/profile']);
    tree.props.onSelect(r.profile); current = false; timer.fn(); assert.deepEqual(calls, ['/ios-admin/profile']);
  } finally { global.setTimeout = originalSetTimeout; global.clearTimeout = originalClearTimeout; }
});
