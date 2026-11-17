/* global __dirname */
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
  mod.require = id => id === 'react/jsx-runtime' ? jsx : Object.hasOwn(mocks, id) ? mocks[id] : id.startsWith('.') ? {} : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { fileName: filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText, filename);
  return mod.exports;
}
const routes = load('shared/appRoutes.ts'), r = routes.appRoutes;
const dock = load('admin/adminDockModel.ts', { '../shared/appRoutes': routes,
  '../shared/localization': { localizedGetter: key => key } });

function fixture({ focused = true, active = 'home', screen = 'index' } = {}) {
  let current = true;
  const calls = [], session = { token: 'token', profile: { role: 'brigader', ref: 'brigader' }, capabilities: ['brigader.access'] };
  const targets = new Map([[r.brigaderHome, '/android-brigader'], [r.profile, '/android-brigader/profile'], [r.adminActivity, '/android-brigader/activity']]);
  const shell = { session, isCurrent: () => current, activityBinding: {}, destination: route => current ? targets.get(route) ?? null : null };
  const react = { useRef: value => ({ current: value }), useMemo: fn => fn(), useLayoutEffect: fn => { fn(); },
    useSyncExternalStore: (_subscribe, snapshot) => snapshot() };
  const component = load('brigader/BrigaderBottomBar.android.tsx', {
    react, 'expo-router': { router: {}, useIsFocused: () => focused,
      useNavigation: () => ({ getState: () => ({ index: screen === 'index' ? 0 : 1,
        routes: screen === 'index' ? [{ name: 'index' }] : [{ name: 'index' }, { name: screen }] }) }) },
    'react-native': { Keyboard: { dismiss() {} } }, 'react-native-safe-area-context': { useSafeAreaInsets: () => ({ bottom: 24 }) },
    '../shared/appRoutes': routes, '../shared/localization/runtime': { localeController: { locale: 'uz' } },
    '../shared/navigation/RoleBottomBar.android': { RoleBottomBar: 'RoleBottomBar' }, '../admin/AdminShellContext': { useAdminShell: () => shell },
    '../admin/adminDockModel': dock, '../admin/adminRootNavigation': { adminRootNavigation: { schedule: (route, context) => calls.push({ route, context }) } },
  }).BrigaderBottomBar;
  const frame = component({ active });
  return { tree: frame.props.children.find(node => node?.type === 'RoleBottomBar'), calls, expire() { current = false; } };
}

test('Brigader uses native dock with source labels and only live destinations, without fabricating Users/Create actions', () => {
  const f = fixture();
  assert.equal(f.tree.type, 'RoleBottomBar');
  assert.equal(f.tree.props.bottomInset, 24);
  assert.deepEqual(f.tree.props.items.map(item => [item.id, item.label]), [
    ['admin-home', 'adminHomeNavTitle'], ['admin-activity', 'adminActivityNavTitle'],
  ]);
  assert.equal(f.tree.props.active, 'admin-home');
});

test('dock dispatches source root navigation within Brigader paths and preserves its actual back stack', () => {
  const f = fixture({ screen: 'factory-locations' });
  f.tree.props.onSelect('admin-activity');
  assert.equal(f.calls.length, 1);
  assert.equal(f.calls[0].route, r.adminActivity);
  const context = f.calls[0].context;
  assert.equal(context.currentPath(), '/android-brigader/factory-locations');
  assert.equal(context.containsPath('/android-brigader'), true);
  assert.equal(context.containsPath('/android-admin'), false);
  assert.equal(context.destination(r.adminActivity), '/android-brigader/activity');
  assert.equal(context.destination(r.adminSuppliers), null);
});

test('current-home selection, missing destinations, blurred views and replaced accounts cannot schedule navigation', () => {
  const home = fixture(); home.tree.props.onSelect('admin-home'); home.tree.props.onSelect('admin-user'); home.tree.props.onSelect('admin-create');
  assert.equal(home.calls.length, 0);
  const blurred = fixture({ focused: false }); blurred.tree.props.onSelect('admin-activity'); assert.equal(blurred.calls.length, 0);
  const stale = fixture(); stale.expire(); stale.tree.props.onSelect('admin-activity'); assert.equal(stale.calls.length, 0);
  const scheduled = fixture({ screen: 'profile' }); scheduled.tree.props.onSelect('admin-activity'); scheduled.expire();
  assert.equal(scheduled.calls[0].context.isCurrent(), false);
  assert.equal(scheduled.calls[0].context.destination(r.adminActivity), null);
});

function layoutFixture({ platform = 'android', admission: input = 'valid', allowed = true } = {}) {
  const session = { imageCacheScope: 'original-account' }, witness = { generation: 7 }, calls = [];
  let current = true;
  const admission = input === 'valid' ? { session, witness } : input === 'pending' ? undefined : input;
  const root = load('brigader/BrigaderLayout.android.tsx', {
    react: { useCallback: fn => fn, useSyncExternalStore: (_subscribe, snapshot) => snapshot() },
    'expo-router': { Redirect: 'Redirect', Stack: 'Stack' },
    'react-native': { Platform: { OS: platform }, View: 'View', ActivityIndicator: 'ActivityIndicator' },
    '../auth': { isSessionWitnessCurrent: value => current && value === witness,
      logout: value => { calls.push(value); return Promise.resolve(); }, sessionWitnessVersion: () => 7, subscribeSessionWitness() {} },
    '../components/WorkerSecurity': { WorkerSecurityProvider: 'WorkerSecurityProvider' },
    '../admin/AdminDrawer': { AdminDrawer: 'AdminDrawer' },
    '../admin/AdminShellNoticeProvider': { AdminShellNoticeProvider: 'AdminShellNoticeProvider' },
    '../admin/AdminTypography.android': { AdminTypographyProvider: 'AdminTypographyProvider' },
    './BrigaderShellProvider': { BrigaderShellProvider: 'BrigaderShellProvider' },
    './brigaderLogout': { logoutBrigader: value => { calls.push(value); return Promise.resolve(); } },
    './brigaderAccess': { brigaderMayEnter: () => allowed }, './useBrigaderSession': { useBrigaderSession: () => admission },
  }).BrigaderLayout();
  return { tree: root.props.children.type(), session, calls, expire() { current = false; } };
}

test('Android admission never mounts Brigader content for another platform, denied role, or unresolved session', () => {
  for (const options of [{ platform: 'ios' }, { allowed: false }, { admission: null }]) {
    const f = layoutFixture(options); assert.equal(f.tree.type, 'Redirect'); assert.equal(f.tree.props.href, '/');
  }
  const pending = layoutFixture({ admission: 'pending' });
  // An explicitly unresolved load renders only the native loading surface.
  assert.equal(pending.tree.type, 'View');
  assert.equal(pending.tree.props.children.type, 'ActivityIndicator');
});

test('the admitted gate retains its original security scope and rejects a logout after witness replacement', () => {
  const f = layoutFixture();
  assert.equal(f.tree.type, 'WorkerSecurityProvider');
  assert.equal(f.tree.props.session, f.session);
  assert.equal(f.tree.props.children.type, 'BrigaderShellProvider');
  assert.equal(f.tree.props.children.props.children.props.mayEnter(), true);
  f.tree.props.onLogout(); assert.deepEqual(f.calls, [f.session]);
  f.expire(); f.tree.props.onLogout(); assert.equal(f.calls.length, 1);
});
