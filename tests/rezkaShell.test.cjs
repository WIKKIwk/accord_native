const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const jsx = { Fragment: 'Fragment', jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
function compile(file, mocks = {}) {
  const filename = path.resolve(__dirname, '../src', file), mod = new Module(filename, module); mod.filename = filename; mod.paths = module.paths;
  mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, filename);
  return mod.exports;
}
const route = compile('shared/appRoutes.ts');
const catalog = require('../src/shared/localization/catalog.json');
const localization = { localizedGetter: (key, locale) => { assert.ok(catalog.getters[key], key); return catalog.getters[key][locale]; },
  adminText: (key, locale) => catalog.admin[`admin.${key}`]?.[locale] ?? key,
  productionText: (key, locale) => catalog.production[key]?.[locale] ?? key };
const model = compile('rezka/rezkaShellModel.ts', { '../shared/appRoutes': route, '../shared/localization': localization,
  '../workerControlsApi': { isCanonicalApparatusId: value => /^apparatus:[^:\s]+:[^\s]+$/.test(value.trim()) } });
const session = (role = 'rezka_master', capabilities = ['rezka.master.access']) => ({ token: 'token', baseUrl: 'https://example.test', imageCacheScope: 'image',
  profile: { role, ref: 'master' }, capabilities, assigned_apparatus: ['apparatus:default:1'] });
test('master shell guard rejects unauthorized users and exposes only real prepared destinations', () => {
  const s = session(); assert.equal(model.canEnterRezkaShell(s), true);
  assert.equal(model.canEnterRezkaShell(null), false); assert.equal(model.canEnterRezkaShell(session('aparatchi', ['apparatus.queue.read'])), false);
  assert.equal(model.canEnterRezkaShell(session('rezka_master', ['apparatus.queue.read'])), false);
  const items = model.rezkaShellDrawerItems(s, 'uz'); assert.deepEqual(items.map(item => item.id), ['queue', 'workers', 'daily', 'profile']);
  assert.equal(items[0].label, 'Kuzatish'); assert.equal(items[1].label, catalog.admin['admin.worker.title'].uz);
  assert.ok(!items.some(item => ['chat', 'settings', 'split'].includes(item.id)));
  s.assigned_apparatus = []; assert.deepEqual(model.rezkaShellDrawerItems(s, 'uz').map(item => item.id), ['queue', 'workers', 'profile']);
  assert.equal(model.rezkaShellCanNavigate(s, 'workers'), true); assert.equal(model.rezkaShellCanNavigate(s, 'chat'), false);
  s.capabilities = []; assert.equal(model.rezkaShellCanNavigate(s, 'workers'), false);
});
function shellHook(loaded, options = {}) {
  let state, effect, change = [], reset, watch, resolveLoad; const calls = [];
  const react = { useState: () => [state, value => { state = value; change.push(value); }], useEffect: fn => { effect = fn; }, useSyncExternalStore: (_s, g) => g() };
  const auth = { loadSession: () => { calls.push('load'); return options.delayed ? new Promise(resolve => { resolveLoad = resolve; }) : Promise.resolve(loaded); },
    sessionWitnessTransitioning: () => options.transitioning === true,
    logout: async () => calls.push('logout'), registerSessionResetHook: fn => { reset = fn; return () => calls.push('unregister'); },
    subscribeSessionWitness: fn => { watch = fn; if (options.invalidateDuringSubscribe) options.current = false; return () => calls.push('unwatch'); } };
  let valid = options.current !== false;
  const guard = { captureRezkaSession: s => { calls.push('capture'); return { session: s }; },
    isRezkaSessionCurrent: () => valid && options.current !== false };
  const exports = compile('rezka/useRezkaShell.ts', { react, '../auth': auth, '../appLock': { clearAppLock: async () => {} },
    '../shared/localization/runtime': { localeController: { locale: 'uz', addListener: () => () => {} } }, '../shared/switchPinRuntime': { switchPinStore: { clear: async () => {} } },
    './rezkaSessionGuard': guard, './rezkaShellModel': model });
  exports.useRezkaShellSession(); const cleanup = effect();
  return { state: () => state, changes: () => change, calls, cleanup, invalidate: () => { valid = false; watch?.(); },
    reset: () => reset(), resolve: value => resolveLoad(value), transition: value => { options.transitioning = value; if (value && state && typeof state === 'object') valid = false; watch?.(); } };
}
const flush = () => new Promise(resolve => setImmediate(resolve));
test('shell captures once, subscribes and redacts on transition; stale asynchronous load cannot revive it', async () => {
  const s = session(), t = shellHook(s); await flush(); assert.equal(t.state().session, s); assert.equal(t.calls.filter(x => x === 'capture').length, 1);
  t.invalidate(); assert.equal(t.state(), null); assert.equal(t.calls.filter(x => x === 'capture').length, 1); t.cleanup();
  const delayed = shellHook(s, { delayed: true }); await delayed.reset(); delayed.resolve(s); await flush();
  assert.equal(delayed.state(), null); assert.equal(delayed.calls.includes('capture'), false); delayed.cleanup();
});
test('shell rejects wrong roles and known fake token, and rechecks a transition during subscription', async () => {
  const wrong = shellHook(session('aparatchi', ['apparatus.queue.read'])); await flush(); assert.equal(wrong.state(), null); assert.ok(!wrong.calls.includes('capture')); wrong.cleanup();
  const fake = session(); fake.token = 'test-mode-token'; const t = shellHook(fake); await flush(); assert.equal(t.state(), 'test-token-unavailable'); assert.ok(!t.calls.includes('capture')); t.cleanup();
  const racing = shellHook(session(), { invalidateDuringSubscribe: true }); await flush(); assert.equal(racing.state(), null); racing.cleanup();
});
test('unmounted shell ignores a pending session load', async () => {
  const s = session(), t = shellHook(s, { delayed: true }); t.cleanup(); t.resolve(s); await flush(); assert.equal(t.changes().length, 0);
});
function nodes(node, predicate) { if (!node || typeof node !== 'object') return []; if (Array.isArray(node)) return node.flatMap(n => nodes(n, predicate));
  return [...(predicate(node) ? [node] : []), ...nodes(node.props?.children, predicate)]; }
test('Android shell composes real Worker and settings screens, with no new Chat route', () => {
  const s = session(), snapshot = { session: s }, states = [false, 'queue', false], actions = []; let index = 0;
  const react = { useState: init => { const i = index++; if (states[i] === undefined) states[i] = init; return [states[i], v => { states[i] = v; actions.push(['state', i, v]); }]; }, useEffect() {} };
  const mocks = { 'react/jsx-runtime': jsx, react, 'expo-router': { Redirect: 'Redirect', router: { replace: x => actions.push(['replace', x]) } },
    'react-native': { ActivityIndicator: 'ActivityIndicator', BackHandler: {}, Platform: { OS: 'android' }, View: 'View' },
    'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView', useSafeAreaInsets: () => ({ bottom: 0 }) },
    '../WorkerScreen': { WorkerScreen: 'WorkerScreen' }, '../components/DailyWorkScreen': { DailyWorkScreen: 'DailyWorkScreen' },
    './RezkaProfile': { RezkaProfile: 'RezkaProfile' }, '../components/WorkerSecurity': { WorkerSecurityProvider: 'WorkerSecurityProvider' },
    '../shared/localization': localization, '../shared/navigation/RoleBottomBar.android': { RoleBottomBar: 'RoleBottomBar' },
    '../shared/navigation/RoleDrawer': { RoleDrawer: 'RoleDrawer' }, '../shared/navigation/roleDrawerLogout': { confirmRoleDrawerLogout: fn => fn() },
    './RezkaWorkerSettings': { RezkaWorkerSettingsScreen: 'RezkaWorkerSettingsScreen' }, './RezkaTestSessionUnavailable': { RezkaTestSessionUnavailable: 'TestUnavailable' },
    './RezkaSessionWaiting': { RezkaSessionWaiting: 'SessionWaiting' },
    './rezkaSessionGuard': { isRezkaSessionCurrent: () => true }, './rezkaShellModel': model,
    './useRezkaShell': { useRezkaShellSession: () => snapshot, useRezkaLocale: () => 'uz', logoutRezkaSession: (_s, fn) => fn() } };
  const { RezkaAndroidShell } = compile('rezka/RezkaAndroidShell.android.tsx', mocks);
  const render = () => { index = 0; return RezkaAndroidShell(); };
  let page = render(); assert.equal(nodes(page, n => n.type === 'WorkerScreen').length, 1);
  let drawer = nodes(page, n => n.type === 'RoleDrawer')[0]; assert.ok(!JSON.stringify(drawer.props.items).includes('chat'));
  drawer.props.onSelect('workers'); page = render(); const settings = nodes(page, n => n.type === 'RezkaWorkerSettingsScreen')[0];
  assert.equal(settings.props.allowAssignments, true); assert.equal(settings.props.snapshot, snapshot);
  const bar = nodes(page, n => n.type === 'RoleBottomBar')[0]; assert.equal(bar.props.active, ''); assert.ok(!JSON.stringify(bar.props.items).includes('chat'));
});

test('a shell mounted during a transition waits, but an invalidated old shell never recaptures', async () => {
  const waiting = shellHook(session(), { transitioning: true }); assert.equal(waiting.state(), 'transition-pending');
  assert.equal(waiting.calls.includes('load'), false); waiting.transition(false); await flush(); assert.ok(waiting.state().session); waiting.cleanup();
  const old = shellHook(session()); await flush(); old.transition(true); assert.equal(old.state(), null);
  old.transition(false); await flush(); assert.equal(old.state(), null); assert.equal(old.calls.filter(x => x === 'capture').length, 1); old.cleanup();
});

test('iOS shell uses native tabs, real worker settings route and refuses invalid snapshots', () => {
  const s = session(), snapshot = { session: s }, calls = [], states = [false, false]; let index = 0, current = true;
  const react = { useState: init => { const i = index++; if (states[i] === undefined) states[i] = init; return [states[i], v => { states[i] = v; }]; } };
  const Trigger = Object.assign(function Trigger() {}, { Icon: 'Icon', Label: 'Label' });
  const NativeTabs = Object.assign(function NativeTabs() {}, { Trigger });
  const mocks = { 'react/jsx-runtime': jsx, react, 'expo-router': { DarkTheme: {}, DefaultTheme: {}, Redirect: 'Redirect', ThemeProvider: 'ThemeProvider',
      usePathname: () => '/ios-rezka', router: { navigate: value => calls.push(['navigate', value]), replace: value => calls.push(['replace', value]) } },
    'expo-router/native-tabs': { NativeTabs }, 'react-native': { Platform: { OS: 'ios' }, ActivityIndicator: 'ActivityIndicator', View: 'View', useColorScheme: () => 'light' },
    '../../components/WorkerSecurity': { WorkerSecurityProvider: 'WorkerSecurityProvider' }, '../../shared/localization': localization,
    '../../shared/navigation/RoleDrawer': { RoleDrawer: 'RoleDrawer' }, '../../shared/navigation/roleDrawerLogout': { confirmRoleDrawerLogout: fn => fn() },
    '../../rezka/RezkaShellContext': { RezkaShellContext: { Provider: 'Provider' } }, '../../rezka/RezkaTestSessionUnavailable': { RezkaTestSessionUnavailable: 'TestUnavailable' },
    '../../rezka/RezkaSessionWaiting': { RezkaSessionWaiting: 'SessionWaiting' }, '../../rezka/rezkaSessionGuard': { isRezkaSessionCurrent: () => current },
    '../../rezka/rezkaShellModel': model, '../../rezka/useRezkaShell': { useRezkaShellSession: () => snapshot, useRezkaLocale: () => 'uz', logoutRezkaSession: (_s, fn) => fn() } };
  const Component = compile('app/ios-rezka/_layout.tsx', mocks).default;
  const render = () => { index = 0; return Component(); }; const page = render(), drawer = nodes(page, n => n.type === 'RoleDrawer')[0];
  assert.ok(drawer); assert.ok(!JSON.stringify(drawer.props.items).includes('chat')); drawer.props.onSelect('workers');
  assert.deepEqual(calls.at(-1), ['navigate', '/ios-rezka/workers']); current = false;
  assert.equal(render().type, 'Redirect'); drawer.props.onSelect('daily'); assert.equal(calls.length, 1);
});

test('iOS worker home reuses WorkerScreen and never adds a Chat route', () => {
  const calls = [], snapshot = { session: session() };
  const Component = compile('app/ios-rezka/(home)/index.tsx', { 'react/jsx-runtime': jsx, '../../../WorkerScreen': { WorkerScreen: 'WorkerScreen' },
    '../../../rezka/RezkaShellContext': { useRezkaShellContext: () => ({ snapshot, openDrawer() {}, onLogout() {}, navigate: id => calls.push(id) }) } }).default;
  const view = Component(); assert.equal(view.type, 'WorkerScreen'); assert.equal(view.props.session, snapshot.session); assert.equal(view.props.nativeNavigation, true);
  view.props.onNavigate('profile'); view.props.onNavigate('daily'); view.props.onNavigate('chat'); assert.deepEqual(calls, ['profile', 'daily']);
});
