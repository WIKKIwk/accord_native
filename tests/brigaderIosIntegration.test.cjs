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
function nodes(tree, predicate) {
  if (!tree || typeof tree !== 'object') return [];
  if (Array.isArray(tree)) return tree.flatMap(child => nodes(child, predicate));
  return [...(predicate(tree) ? [tree] : []), ...nodes(tree.props?.children, predicate)];
}

const r = { adminActivity: '/admin-activity', profile: '/profile' };
const account = { token: 'real', imageCacheScope: 'brigader-one', profile: { role: 'brigader', ref: 'one' }, capabilities: ['brigader.access'] };
const react = { useCallback: fn => fn, useSyncExternalStore: (_subscribe, get) => get() };
const localization = { localizedGetter: key => key };
const runtime = { localeController: { locale: 'uz', addListener() {} } };

function gate(options = {}) {
  const { active = true, allowed = true, os = 'ios', shell = {} } = options;
  const admitted = Object.hasOwn(options, 'admitted') ? options.admitted : account;
  const calls = [], witness = { session: account, generation: 7 };
  const admission = admitted == null ? admitted : { session: admitted, witness };
  const Trigger = Object.assign(function Trigger() {}, { Icon: 'NativeTabs.Icon', Label: 'NativeTabs.Label' });
  const NativeTabs = Object.assign(function NativeTabs() {}, { Trigger });
  let current = active;
  const mayEnter = () => allowed;
  const component = load('brigader/BrigaderLayout.ios.tsx', {
    react, 'expo-router': { Redirect: 'Redirect' }, 'expo-router/native-tabs': { NativeTabs },
    'react-native': { ActivityIndicator: 'ActivityIndicator', Platform: { OS: os }, View: 'View' },
    '../auth': { isSessionWitnessCurrent: value => value === witness && current,
      sessionWitnessVersion: () => 7, subscribeSessionWitness() {} },
    '../admin/AdminDrawer': { AdminDrawer: 'AdminDrawer' }, '../admin/AdminShellContext': { useAdminShell: () => shell },
    '../admin/AdminShellNoticeProvider': { AdminShellNoticeProvider: 'AdminShellNoticeProvider' },
    '../components/WorkerSecurity': { WorkerSecurityProvider: 'WorkerSecurityProvider' }, '../shared/appRoutes': { appRoutes: r },
    '../shared/localization': localization, '../shared/localization/runtime': runtime,
    './brigaderAccess': { brigaderMayEnter: mayEnter }, './BrigaderShellProvider': { BrigaderShellProvider: 'BrigaderShellProvider' },
    './useBrigaderSession': { useBrigaderSession: () => admission },
    './brigaderLogout': { logoutBrigader: async value => { calls.push(value); } },
  }).BrigaderLayout;
  const wrapper = component(), tree = wrapper.type(wrapper.props);
  return { tree, wrapper, calls, witness, mayEnter, expire: () => { current = false; } };
}

test('iOS Brigader direct entry requires the original current admission and platform', () => {
  assert.equal(gate({ admitted: null }).tree.type, 'Redirect');
  assert.equal(gate({ os: 'android' }).tree.type, 'Redirect');
  assert.equal(gate({ allowed: false }).tree.type, 'Redirect');
  assert.equal(gate({ active: false }).tree.type, 'View');
  const waiting = gate({ admitted: undefined });
  assert.equal(waiting.tree.type, 'View');
  const result = gate(), security = result.tree, provider = security.props.children;
  assert.equal(result.wrapper.key, 7);
  assert.equal(security.type, 'WorkerSecurityProvider');
  assert.equal(provider.type, 'BrigaderShellProvider');
  assert.equal(provider.props.session, account);
  assert.equal(provider.props.witness, result.witness);
  assert.equal(provider.props.children.props.mayEnter, result.mayEnter);
});

test('old Brigader logout callback cannot log out a replacement session', async () => {
  const current = gate(); current.tree.props.onLogout(); await Promise.resolve();
  assert.deepEqual(current.calls, [account]);
  const stale = gate(); const logout = stale.tree.props.onLogout; stale.expire(); logout(); await Promise.resolve();
  assert.deepEqual(stale.calls, []);
});

test('native tabs expose a real Activity destination only with its bound original storage', () => {
  for (const [binding, available, hidden] of [[null, true, true], [{}, false, true], [{}, true, false]]) {
    const tree = gate({ shell: { activityBinding: binding, destination: route => available && route === r.adminActivity ? '/ios-brigader/activity' : null } }).tree;
    const tabElement = tree.props.children.props.children.props.children.props.children;
    const tabs = tabElement.type(tabElement.props);
    const triggers = tabs.props.children;
    assert.deepEqual(triggers.map(item => item.props.name), ['(home)', 'activity']);
    assert.equal(triggers[1].props.hidden, hidden);
    assert.equal(triggers[0].props.children[1].props.children, 'adminHomeNavTitle');
    assert.equal(triggers[1].props.children[1].props.children, 'adminActivityNavTitle');
  }
});

test('Brigader native home forwards the original store, return lifecycle and source screen guards', () => {
  const current = () => true, available = () => true, open = async () => {}, store = {}, hub = {}, drawer = () => {};
  const shell = { session: account, store, isCurrent: current, isRouteAvailable: available };
  const Home = load('brigader/BrigaderHomeRoute.ios.tsx', {
    react, '../admin/AdminHomeScreen': { AdminHomeScreen: 'AdminHomeScreen' }, '../admin/useAdminRouteReturn': { useAdminRouteReturn: () => open },
    '../admin/AdminShellContext': { useAdminShell: () => shell }, '../admin/AdminShellProfileAction': { AdminShellProfileAction: 'ProfileAction' },
    '../admin/AdminShellNoticeProvider': { useAdminShellNotice: () => ({ topNotice: 'notice' }) },
    '../shared/localization': localization, '../shared/localization/runtime': runtime,
    '../shared/navigation/roleDrawerContext': { useRoleDrawer: () => ({ open: drawer }) }, '../shared/notificationStoresRuntime': { refreshHub: hub },
  }).BrigaderHomeRoute;
  const tree = Home();
  assert.equal(tree.type, 'AdminHomeScreen');
  assert.equal(tree.props.session, account); assert.equal(tree.props.store, store); assert.equal(tree.props.hub, hub);
  assert.equal(tree.props.isSessionCurrent, current); assert.equal(tree.props.isRouteAvailable, available);
  assert.equal(tree.props.openRoute, open); assert.equal(tree.props.navigation.onPress, drawer); assert.equal(tree.props.topNotice, 'notice');
});

test('profile keeps original ownership for edit/logout and refuses a missing destination', () => {
  let current = true, available = true, logouts = 0, canGoBack = false;
  const navigation = [];
  const shell = { session: account, isCurrent: () => current, destination: () => available ? '/ios-brigader/profile' : null,
    onLogout: () => { logouts++; } };
  const Profile = load('brigader/BrigaderProfileRoute.ios.tsx', {
    react, 'expo-router': { Redirect: 'Redirect', Stack: { Screen: 'Stack.Screen' }, router: { canGoBack: () => canGoBack,
      back: () => navigation.push('back'), replace: value => navigation.push(value) } },
    'react-native': { View: 'View', StyleSheet: { create: value => value }, PlatformColor: value => value }, '../admin/AdminShellContext': { useAdminShell: () => shell },
    '../admin/AdminShellBodyFrame': { AdminShellBodyFrame: 'BodyFrame' }, '../components/ProfileScreen': { ProfileScreen: 'ProfileScreen' },
    '../admin/adminActivityBackLabel': { adminActivityBackLabel: () => 'Orqaga' },
    '../components/useBaseTheme': { useBaseTheme: () => ({ colors: { surfaceContainerHigh: 'surface' } }) },
    '../shared/appRoutes': { appRoutes: r }, '../shared/localization': localization, '../shared/localization/runtime': runtime,
    '../shared/navigation/RoleHeaderButton': { RoleHeaderButton: 'RoleHeaderButton' },
  }).BrigaderProfileRoute;
  available = false; assert.equal(Profile().type, 'Redirect'); available = true;
  const tree = Profile(), profile = tree.props.children[1].props.children.props.children;
  assert.equal(profile.type, 'ProfileScreen'); assert.equal(profile.props.session, account); assert.equal(profile.props.isCurrent, shell.isCurrent);
  assert.equal(profile.props.settingsDisabled, undefined); assert.equal(profile.props.showDirectLogout, false);
  const back = tree.props.children[0].props.options.headerLeft();
  assert.equal(back.props.label, 'Orqaga'); back.props.onPress(); assert.deepEqual(navigation, ['/ios-brigader']);
  canGoBack = true; back.props.onPress(); assert.deepEqual(navigation, ['/ios-brigader', 'back']);
  profile.props.onLogout(); assert.equal(logouts, 1); current = false; profile.props.onLogout(); assert.equal(logouts, 1);
  back.props.onPress(); assert.deepEqual(navigation, ['/ios-brigader', 'back']);
  assert.equal(Profile().type, 'View');
});

test('Brigader inventory reuses the native worker controls with its own guarded surface and back route', () => {
  const navigation = [], effects = [], serial = { current: 0 }; let current = true, canGoBack = false, feedback = null;
  const surface = { state: { notice: '' }, owner: { current: () => current, clearNotice() { surface.state.notice = ''; } }, t: text => `translated:${text}` };
  const shell = { session: account, isCurrent: () => current };
  const Inventory = load('brigader/BrigaderInventoryRoute.ios.tsx', {
    react: { ...react, useRef: () => serial, useState: () => [feedback, value => { feedback = value; }], useEffect: fn => effects.push(fn) },
    'react-native': { View: 'View' },
    'expo-router': { router: { canGoBack: () => canGoBack, back: () => navigation.push('back'), replace: value => navigation.push(value) } },
    '../admin/AdminShellContext': { useAdminShell: () => shell }, '../components/WorkerInventoryScreen.ios': { WorkerInventoryContent: 'WorkerInventoryContent' },
    './useBrigaderInventorySurface': { useBrigaderInventorySurface: () => surface },
    '../customer/CustomerSnackbar.ios': { CustomerSnackbar: 'CustomerSnackbar' },
  }).BrigaderInventoryRoute;
  const tree = Inventory(), content = tree.props.children[0]; assert.equal(content.type, 'WorkerInventoryContent');
  assert.equal(content.props.surface, surface); assert.equal(content.props.session, account); assert.equal(content.props.sourceMode, true);
  surface.state.notice = 'same'; Inventory(); effects.at(-1)();
  let snackbar = Inventory().props.children[1]; assert.equal(snackbar.props.message, 'translated:same'); assert.equal(snackbar.props.messageId, 1);
  assert.equal(surface.state.notice, ''); surface.state.notice = 'same'; Inventory(); effects.at(-1)();
  snackbar = Inventory().props.children[1]; assert.equal(snackbar.props.messageId, 2);
  snackbar.props.onDismiss(); assert.equal(feedback, null);
  content.props.onBack(); canGoBack = true; content.props.onBack(); current = false; content.props.onBack();
  assert.deepEqual(navigation, ['/ios-brigader', 'back']);
  surface.state.notice = 'old'; Inventory(); effects.at(-1)(); assert.equal(feedback, null);
});

test('iOS source inventory keeps feedback transient and removes the extra sheet footer without changing Worker defaults', () => {
  const surface = { valid: true, loading: false, rows: [], transfers: [], empty: 'Bo‘sh', alert: null, dismissAlert() {}, t: text => text,
    state: { selected: new Set(), busy: new Set(), scanning: false, tab: 'assets', warehouse: '', error: '', notice: 'Saqlandi' },
    owner: { warehouses: [], toggleScanning() {} } };
  const modifiers = new Proxy({}, { get: (_target, name) => (...args) => ({ name, args }) });
  const api = load('components/WorkerInventoryScreen.ios.tsx', {
    '@expo/ui/swift-ui': new Proxy({}, { get: (_target, name) => String(name) }), '@expo/ui/swift-ui/modifiers': modifiers,
    'react-native': { View: 'View' }, 'expo-router': { Stack: { Screen: 'Screen' } }, './WorkerAlert': { WorkerAlert: 'WorkerAlert' },
    './WorkerInventorySheet': { WorkerInventorySheet: 'WorkerInventorySheet' }, './useWorkerInventorySurface': { useWorkerInventorySurface: () => surface },
    './useWorkerInventory': { useWorkerInventoryKey: () => 'worker' },
  });
  const source = api.WorkerInventoryContent({ session: account, surface, onBack() {}, sourceMode: true });
  assert.equal(nodes(source, node => node.type === 'Text' && node.props.children === 'Saqlandi').length, 0);
  assert.equal(nodes(source, node => node.type === 'WorkerInventorySheet')[0].props.showFooter, false);
  const scan = nodes(source, node => node.type === 'Button' && node.props.label === 'QR orqali izlash')[0];
  assert.ok(scan.props.modifiers.some(modifier => modifier.name === 'controlSize' && modifier.args[0] === 'large'));
  const worker = api.WorkerInventoryContent({ session: account, surface, onBack() {} });
  assert.equal(nodes(worker, node => node.type === 'Text' && node.props.children === 'Saqlandi').length, 1);
  assert.equal(nodes(worker, node => node.type === 'WorkerInventorySheet')[0].props.showFooter, undefined);
});
