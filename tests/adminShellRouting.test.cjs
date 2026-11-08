const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const jsx = { Fragment: 'Fragment', jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
function load(file, mocks = {}) {
  const filename = path.resolve(__dirname, '../src', file), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths;
  mod.require = id => id === 'react/jsx-runtime' ? jsx : Object.hasOwn(mocks, id) ? mocks[id] : id.startsWith('.') ? {} : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { fileName: filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText, filename);
  return mod.exports;
}
const routes = load('shared/appRoutes.ts'), { appRoutes: r } = routes;
const access = load('admin/adminShellAccess.ts', { '../shared/appRoutes': routes });
const session = (role, capabilities, extra = {}) => ({ token: 'token', profile: { role, ref: 'user' }, capabilities, ...extra });
const admin = session('admin', ['admin.access', 'gscale.print']);
const sales = session('sales_manager', ['sales.access']);
const brigader = session('brigader', ['brigader.access']);
const worker = session('aparatchi', ['apparatus.queue.read']);
const prep = session('tayyorlov_masteri', ['preparation.access']);

test('login selects the Admin home on both platforms and preserves separately ported roles', () => {
  for (const value of [admin, session('customer', ['catalog.item.read'])]) {
    assert.equal(access.adminShellMayEnter(value), true);
    assert.equal(routes.homeTarget(value, 'ios'), '/ios-admin');
    assert.equal(routes.homeTarget(value, 'android'), '/android-admin');
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
  const enabled = new Set([r.profile, r.gscaleMode]), held = new Set();
  for (const platform of ['ios', 'android']) {
    assert.equal(access.adminDestinationPath(admin, r.profile, platform, held), null);
    assert.equal(access.adminDestinationPath(admin, r.profile, platform, enabled), `/${platform}-admin/profile`);
    assert.equal(access.adminDestinationPath(admin, r.gscaleMode, platform, enabled), `/${platform}-gscale`);
    assert.equal(access.adminDestinationPath(worker, r.profile, platform, enabled), null);
    assert.equal(access.adminDestinationPath(sales, r.gscaleMode, platform, enabled), null);
    assert.equal(access.adminDestinationPath(admin, r.adminActivity, platform, enabled), null);
  }
  assert.equal(access.adminDestinationPath(admin, r.profile, 'web', enabled), null);
});

test('session hook rejects a stale load, inactive session, unauthorised session and unmounted result', async () => {
  async function run(result, { reset = false, unmount = false, active = true } = {}) {
    const updates = []; let effect, resetHook, resolve, unregistered = false;
    const auth = { loadSession: () => new Promise(value => { resolve = value; }), activeSessionToken: () => active ? 'token' : null,
      registerSessionResetHook: fn => { resetHook = fn; return () => { unregistered = true; }; } };
    const hook = load('admin/useAdminShellSession.ts', { react: { useState: initial => [initial, value => updates.push(value)], useEffect: fn => { effect = fn; } },
      '../auth': auth, './adminShellAccess': access });
    assert.equal(hook.useAdminShellSession(), undefined);
    const cleanup = effect(); if (reset) await resetHook(); if (unmount) cleanup(); resolve(result); await new Promise(done => setImmediate(done));
    if (!unmount) cleanup(); assert.equal(unregistered, true); return updates;
  }
  assert.deepEqual(await run(admin), [admin]);
  assert.deepEqual(await run(admin, { reset: true }), [null]);
  assert.deepEqual(await run(admin, { unmount: true }), []);
  assert.deepEqual(await run(admin, { active: false }), [null]);
  assert.deepEqual(await run(worker), [null]);
});

function layout(platform, value, active = true, os = platform) {
  const Trigger = Object.assign(function Trigger() {}, { Icon: 'NativeTabs.Icon', Label: 'NativeTabs.Label' });
  const tabs = Object.assign(function NativeTabs() {}, { Trigger });
  const mocks = { react: { useCallback: fn => fn, useSyncExternalStore: (_subscribe, get) => get() },
    'expo-router': { Redirect: 'Redirect', Stack: 'Stack' }, 'expo-router/native-tabs': { NativeTabs: tabs },
    'react-native': { ActivityIndicator: 'ActivityIndicator', Platform: { OS: os }, View: 'View' },
    '../auth': { activeSessionToken: () => active ? 'token' : null, logout: async () => {} },
    '../components/WorkerSecurity': { WorkerSecurityProvider: 'WorkerSecurityProvider' },
    '../shared/localization': { localizedGetter: key => key }, '../shared/localization/runtime': { localeController: { locale: 'en', addListener() {} } },
    './AdminDrawer': { AdminDrawer: 'AdminDrawer' }, './AdminShellContext': { AdminShellProvider: 'AdminShellProvider' },
    './adminShellAccess': access, './useAdminShellSession': { useAdminShellSession: () => value } };
  return load(`admin/AdminLayout.${platform}.tsx`, mocks).AdminLayout();
}
for (const platform of ['ios', 'android']) {
  test(`${platform} layout denies unauthorized direct route, inactive account and wrong platform`, () => {
    assert.equal(layout(platform, null).type, 'Redirect'); assert.equal(layout(platform, worker).type, 'Redirect');
    assert.equal(layout(platform, admin, false).type, 'Redirect');
    assert.equal(layout(platform, admin, true, platform === 'ios' ? 'android' : 'ios').type, 'Redirect');
    assert.equal(layout(platform, undefined).type, 'View');
    assert.equal(layout(platform, admin).type, 'WorkerSecurityProvider');
  });
}
test('prepared profile route cannot bypass the integration hold or inactive session', () => {
  for (const [current, destination, expected] of [[true, null, 'Redirect'], [false, '/ios-admin/profile', 'Redirect'], [true, '/ios-admin/profile', 'View']]) {
    const screen = load('admin/AdminProfileRoute.tsx', { 'expo-router': { Redirect: 'Redirect' }, 'react-native': { Platform: { OS: 'ios' }, View: 'View' },
      '../components/ProfileScreen': { ProfileScreen: 'ProfileScreen' }, '../shared/appRoutes': routes,
      './AdminShellContext': { useAdminShell: () => ({ session: admin, isCurrent: () => current, destination: () => destination, onLogout() {} }) } });
    const tree = screen.AdminProfileRoute(); assert.equal(tree.type, expected);
    if (expected === 'View') assert.equal(tree.props.children.type, 'ProfileScreen');
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
      { routeName: r.adminHome, label: 'Home' }, { routeName: r.gscaleMode, label: 'Scale' }, { routeName: r.adminActivity, label: 'Activity' }] };
    const shell = { session: admin, isCurrent: () => current, destination: route => route === r.gscaleMode ? path : null, onLogout: () => calls.push('logout') };
    const Drawer = load('admin/AdminDrawer.tsx', { react: { useEffect: fn => { cleanup = fn(); }, useRef: value => ({ current: value }),
      useSyncExternalStore: (_subscribe, get) => get() }, 'expo-router': { router: { push: value => calls.push(['push', value]) }, usePathname: () => '/ios-admin' },
      'react-native': { Platform: { OS: 'ios' } }, '../shared/appRoutes': routes,
      '../shared/localization': { localizedGetter: key => key }, '../shared/localization/runtime': { localeController: { locale: 'en', addListener() {} } },
      '../shared/navigation/RoleDrawer': { RoleDrawer: 'RoleDrawer' }, '../shared/navigation/roleDrawerContext': { useRoleDrawerState: () => ({}) },
      '../shared/navigation/roleDrawerLogout': { confirmRoleDrawerLogout: callback => { calls.push('prompt'); callback(); } },
      './adminDrawerModel': drawerModel, './AdminShellContext': { useAdminShell: () => shell } }).AdminDrawer;
    const tree = Drawer({ children: 'child' }); assert.deepEqual(tree.props.items.map(item => item.id), [r.adminHome, r.gscaleMode]);
    tree.props.onSelect(r.gscaleMode); assert.equal(scheduled.at(-1).delay, 220); current = false; scheduled.at(-1).callback(); assert.deepEqual(calls, []);
    current = true; tree.props.onSelect(r.gscaleMode); path = null; scheduled.at(-1).callback(); assert.deepEqual(calls, []);
    tree.props.onSelect('logout'); assert.equal(scheduled.at(-1).delay, 120); current = false; scheduled.at(-1).callback(); assert.deepEqual(calls, []);
    current = true; tree.props.onSelect('logout'); scheduled.at(-1).callback(); assert.deepEqual(calls, ['prompt', 'logout']);
    cleanup(); assert.ok(scheduled.every(timer => timer.cancelled));
  } finally { global.setTimeout = originalSetTimeout; global.clearTimeout = originalClearTimeout; }
});
