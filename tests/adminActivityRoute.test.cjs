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
function setup({ hiddenState = 'ready', invalidated = false, bound = true, enabled = true, current = true } = {}) {
  const calls = [], effects = []; let witnessListener, confirm, active = current, generation = 1;
  const session = { token: 'token', profile: { role: 'admin', ref: 'test' }, capabilities: ['admin.activity.read'] };
  const binding = { hidden: {}, generation: () => generation, subscribe: fn => { witnessListener = fn; return () => calls.push('unsub-witness'); } };
  const shell = { session, store: {}, activityBinding: bound ? binding : null, isCurrent: () => active,
    destination: () => enabled ? '/android-admin/activity' : null };
  let instance;
  class Controller {
    constructor(deps) { this.deps = deps; instance = this; this.state = { activity: { activityItems: [{ id: 'private' }] },
      hiddenIds: new Set(['hidden']), hiddenState, invalidated }; }
    getSnapshot = () => this.state; subscribe() { return () => {}; } start() { calls.push('start'); }
    dispose() { calls.push('dispose'); } invalidate() { calls.push('invalidate'); }
    reload() { calls.push('reload'); return Promise.resolve(); } requestClear() { calls.push('request-clear'); return 19; }
    resolveClear(serial, value) { calls.push(['resolve', serial, value]); return Promise.resolve(); }
  }
  const react = { useMemo: fn => fn(), useCallback: fn => fn, useEffect: fn => effects.push(fn), useSyncExternalStore: (_subscribe, get) => get() };
  const mocks = { react, 'expo-router': { Redirect: 'Redirect', router: { canGoBack: () => false, back: () => calls.push('back'),
    replace: path => calls.push(['replace', path]) } }, 'react-native': { Platform: { OS: 'android' },
    Alert: { alert: (...args) => { confirm = args; } }, BackHandler: { addEventListener: (_event, fn) => ({ remove() { calls.push('remove-back'); }, fn }) } },
    '../sessionReadScope': { sessionReadScope: () => 'scope' }, '../shared/appRoutes': { appRoutes: { adminActivity: '/admin-activity' }, canOpenRoute: () => true },
    '../shared/localization': { localizedGetter: key => key }, '../shared/localization/runtime': { localeController: { locale: 'en', addListener() {} } },
    '../shared/notificationStoresRuntime': { refreshHub: {} }, './AdminActivityPending': { AdminActivityPending: 'AdminActivityPending' },
    './AdminActivityScreen': { AdminActivityScreen: 'AdminActivityScreen' }, './adminActivityBackLabel': { adminActivityBackLabel: () => 'Back' },
    './adminActivityController': { AdminActivityController: Controller }, './AdminShellContext': { useAdminShell: () => shell } };
  const Route = load('admin/AdminActivityRouteCore.tsx', mocks).AdminActivityRoute;
  const outer = Route({ footer: 'dock' });
  return { outer, calls, effects, binding, shell, get instance() { return instance; }, get confirm() { return confirm; },
    setActive: value => { active = value; }, setGeneration: value => { generation = value; }, notify: () => witnessListener() };
}
test('activity deep link remains blocked without a current session, safe hidden binding and explicit destination enablement', () => {
  for (const options of [{ bound: false }, { enabled: false }, { current: false }]) assert.equal(setup(options).outer.type, 'Redirect');
  assert.equal(typeof setup().outer.type, 'function');
});
for (const hiddenState of ['loading', 'error']) test(`unknown hidden state ${hiddenState} shows neither activity list nor clear action`, () => {
  const f = setup({ hiddenState }), tree = f.outer.type(f.outer.props);
  assert.equal(tree.type, 'AdminActivityPending'); assert.equal(tree.props.status, hiddenState);
  assert.equal(tree.props.onRequestClear, undefined); assert.equal(tree.props.snapshot, undefined);
  tree.props.onRetry(); assert.deepEqual(f.calls, ['reload']);
});
test('ready hidden state uses the actual activity view and confirmation callback, not a fake empty set', () => {
  const f = setup(), tree = f.outer.type(f.outer.props); assert.equal(tree.type, 'AdminActivityScreen');
  assert.deepEqual([...tree.props.hiddenIds], ['hidden']); assert.deepEqual(tree.props.snapshot.activityItems, [{ id: 'private' }]);
  tree.props.onRequestClear(); assert.equal(f.confirm[0], 'clearTitle'); assert.equal(f.confirm[1], 'clearAllNotificationsPrompt');
  assert.deepEqual(f.confirm[2].map(button => button.text), ['no', 'yes']); f.confirm[2][1].onPress();
  assert.deepEqual(f.calls, ['request-clear', ['resolve', 19, true]]);
});
test('witness notification invalidates immediately and disposal unsubscribes', () => {
  const f = setup(), tree = f.outer.type(f.outer.props); assert.equal(tree.type, 'AdminActivityScreen');
  const cleanup = f.effects.map(effect => effect()).filter(value => typeof value === 'function');
  assert.deepEqual(f.calls, ['start']); f.setGeneration(2); f.notify(); assert.deepEqual(f.calls, ['start', 'invalidate']);
  cleanup.forEach(fn => fn()); assert.ok(f.calls.includes('unsub-witness')); assert.ok(f.calls.includes('dispose'));
});
test('invalidated controller redirects instead of rendering stale data', () => {
  const f = setup({ invalidated: true }); assert.equal(f.outer.type(f.outer.props).type, 'Redirect');
});

function nodes(node, predicate) {
  if (!node || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap(child => nodes(child, predicate));
  return [...(predicate(node) ? [node] : []), ...nodes(node.props?.children, predicate)];
}
for (const platform of ['ios', 'android']) test(`${platform} hidden-state pending view exposes retry/back but no clear or activity content`, () => {
  const calls = [], modifiers = new Proxy({}, { get: (_target, key) => (...args) => ({ name: String(key), args }) });
  const swift = new Proxy({}, { get: (_target, key) => String(key) });
  const mocks = { react: { useSyncExternalStore: (_subscribe, get) => get() }, '@expo/ui/swift-ui': swift,
    '@expo/ui/swift-ui/modifiers': modifiers, '@expo/ui/jetpack-compose': { useMaterialColors: () => ({ surfaceContainerLow: 'bg', onSurfaceVariant: 'text', primary: 'primary' }) },
    'react-native': { View: 'View', Text: 'NativeText', ActivityIndicator: 'ActivityIndicator', PlatformColor: value => value, StyleSheet: { create: value => value } },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 12 }) }, 'expo-router': { Stack: { Screen: 'Stack.Screen' } },
    '../components/BaseHost.ios': { BaseHost: 'BaseHost' }, '../shared/navigation/RoleHeaderButton': { RoleHeaderButton: 'RoleHeaderButton' },
    '../shared/navigation/RoleHeader.android': { RoleHeader: 'RoleHeader' }, '../shared/localization': { localizedGetter: key => key },
    '../shared/localization/runtime': { localeController: { locale: 'en', addListener() {} } } };
  const Pending = load(`admin/AdminActivityPending.${platform}.tsx`, mocks).AdminActivityPending;
  const tree = Pending({ status: 'error', onRetry: () => calls.push('retry'), navigation: { icon: 'back', label: 'Back', onPress: () => calls.push('back') }, footer: 'dock' });
  const retry = nodes(tree, n => platform === 'ios' ? n.type === 'Button' : n.type === 'NativeText' && n.props.accessibilityRole === 'button')[0];
  retry.props.onPress(); assert.deepEqual(calls, ['retry']);
  assert.equal(nodes(tree, n => n.type === 'Pressable' || n.type === 'FlatList' || n.type === 'List').length, 0);
  if (platform === 'ios') assert.equal(nodes(tree, n => n.type === 'Stack.Screen')[0].props.options.headerRight, undefined);
});
