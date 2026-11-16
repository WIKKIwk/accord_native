const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
function load(file, mocks = {}) {
  const filename = path.resolve(__dirname, '../src', file), mod = new Module(filename, module);
  mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { fileName: filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, filename);
  return mod.exports;
}
const routes = load('shared/appRoutes.ts'), { appRoutes } = routes;
const dock = load('admin/adminDockModel.ts', { '../shared/appRoutes': routes, '../shared/localization': { localizedGetter: key => key } });
const strict = load('shared/camera/synchronousGuard.ts');
const { AdminRootNavigation } = load('admin/adminRootNavigation.ts', { '../shared/camera/synchronousGuard': strict });
const { StackRouter } = require('../node_modules/expo-router/build/react-navigation/routers/StackRouter.js');
function fixture({ active = 'home', pathname = '/android-admin', focused = true, binding = true, stack } = {}) {
  let current = true, activityEnabled = true;
  const calls = [], cleanups = [], frames = [], session = { token: 'token', profile: { role: 'admin', ref: 'owner' }, capabilities: ['admin.access', 'admin.activity.read', 'admin.users.read'] };
  const currentName = pathname.replace(/\/+$/, '').replace('/android-admin', '').replace(/^\//, '') || 'index';
  const names = stack ?? (currentName === 'index' ? ['index'] : ['index', currentName]);
  let state = { key: 'admin-stack', routeKeySeq: names.length, index: names.length - 1, type: 'stack',
    routeNames: ['index', 'settings', 'additional-settings', 'item-groups', 'activity'], routes: names.map((name, i) => ({ name, key: `${name}-${i}` })) };
  const reducer = StackRouter({ initialRouteName: 'index' }), options = { routeParamList: {}, routeGetIdList: {} };
  const apply = (type, path) => { const name = path === '/android-admin' ? 'index' : path.split('/').at(-1);
    state = reducer.getStateForAction(state, { type, payload: { name } }, options).state; };
  const root = new AdminRootNavigation(callback => frames.push(callback));
  const shell = { session, isCurrent: () => current, activityBinding: binding ? {} : null,
    destination: route => route === appRoutes.adminHome ? '/android-admin' : route === appRoutes.adminActivity && activityEnabled ? '/android-admin/activity' : null };
  const { AdminBottomBar } = load('admin/AdminBottomBar.android.tsx', {
    'react/jsx-runtime': { jsx: (type, props) => ({ type, props }) },
    react: { useMemo: fn => fn(), useRef: value => ({ current: value }), useSyncExternalStore: (_subscribe, get) => get(),
      useLayoutEffect: fn => { const cleanup = fn(); if (cleanup) cleanups.push(cleanup); } },
    'expo-router': { useNavigation: () => ({ getState: () => state }), useIsFocused: () => focused, router: {
      dismissTo: path => { calls.push(['popTo', path]); apply('POP_TO', path); }, push: path => { calls.push(['push', path]); apply('PUSH', path); } } },
    'react-native': { Keyboard: { dismiss() {} } },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ bottom: 24 }) },
    '../shared/appRoutes': routes,
    '../shared/localization/runtime': { localeController: { locale: 'uz', addListener() {} } },
    '../shared/navigation/RoleBottomBar.android': { RoleBottomBar: 'RoleBottomBar' },
    './AdminShellContext': { useAdminShell: () => shell }, './adminDockModel': dock,
    './adminRootNavigation': { adminRootNavigation: root },
  });
  return { tree: AdminBottomBar({ active }), calls, retire: () => { current = false; },
    stack: () => state.routes.slice(0, state.index + 1).map(route => route.name), flush: () => frames.splice(0).forEach(fn => fn()),
    removeActivity: () => { activityEnabled = false; }, unmount: () => cleanups.forEach(fn => fn()) };
}
test('source Home dock returns from a child even when its active tab is still Home', () => {
  const child = fixture({ pathname: '/android-admin/item-groups', active: 'home' });
  child.tree.props.onSelect('admin-home'); assert.deepEqual(child.calls, []); child.flush();
  assert.deepEqual(child.calls, [['popTo', '/android-admin']]); assert.deepEqual(child.stack(), ['index']);
  const home = fixture({ pathname: '/android-admin/', active: 'home' }); home.tree.props.onSelect('admin-home'); home.flush(); assert.deepEqual(home.calls, []);
});
test('settings has no selected source dock destination, and unported User/Create entries stay held', () => {
  const f = fixture({ active: 'settings' });
  assert.equal(f.tree.props.active, ''); assert.equal(f.tree.props.bottomInset, 24);
  assert.deepEqual(f.tree.props.items.map(item => item.id), ['admin-home', 'admin-activity']);
  f.tree.props.onSelect('admin-user'); assert.deepEqual(f.calls, []);
});
test('Activity requires its binding and a destination at render and at selection', () => {
  assert.deepEqual(fixture({ binding: false }).tree.props.items.map(item => item.id), ['admin-home']);
  const f = fixture(); f.tree.props.onSelect('admin-activity'); f.flush(); assert.deepEqual(f.calls, [['push', '/android-admin/activity']]);
  f.removeActivity(); f.tree.props.onSelect('admin-activity'); f.flush(); assert.equal(f.calls.length, 1);
  const selected = fixture({ active: 'activity', pathname: '/android-admin/activity' });
  selected.tree.props.onSelect('admin-activity'); selected.flush(); assert.deepEqual(selected.calls, []);
});
test('native dock callbacks cannot navigate after unmount, account retirement or blur', () => {
  for (const end of [f => f.unmount(), f => f.retire()]) {
    const f = fixture({ pathname: '/android-admin/item-groups' }); end(f); f.tree.props.onSelect('admin-home'); f.flush(); assert.deepEqual(f.calls, []);
  }
  const background = fixture({ focused: false }); background.tree.props.onSelect('admin-activity'); background.flush(); assert.deepEqual(background.calls, []);
});
test('source dock pushes absent Activity while preserving Settings, or pops to an existing Activity', () => {
  const absent = fixture({ active: 'settings', stack: ['index', 'settings', 'additional-settings'] });
  absent.tree.props.onSelect('admin-activity'); absent.flush();
  assert.deepEqual(absent.stack(), ['index', 'settings', 'additional-settings', 'activity']);
  const existing = fixture({ active: 'settings', stack: ['index', 'activity', 'settings', 'additional-settings'] });
  existing.tree.props.onSelect('admin-activity'); existing.flush(); assert.deepEqual(existing.stack(), ['index', 'activity']);
  const deepLink = fixture({ active: 'settings', stack: ['settings'] }); deepLink.tree.props.onSelect('admin-home'); deepLink.flush();
  assert.deepEqual(deepLink.stack(), ['settings', 'index']);
});
test('source dock coalesces the last target in a frame and cancels expired pending dispatch', () => {
  const f = fixture({ active: 'settings', stack: ['index', 'settings'] });
  f.tree.props.onSelect('admin-activity'); f.tree.props.onSelect('admin-home'); f.flush();
  assert.deepEqual(f.calls, [['popTo', '/android-admin']]); assert.deepEqual(f.stack(), ['index']);
  for (const end of [f => f.unmount(), f => f.retire(), f => f.removeActivity()]) {
    const stale = fixture(); stale.tree.props.onSelect('admin-activity'); end(stale); stale.flush(); assert.deepEqual(stale.calls, []);
  }
});
