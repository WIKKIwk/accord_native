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
  mod.require = id => id === 'react/jsx-runtime' ? jsx : Object.hasOwn(mocks, id) ? mocks[id]
    : id.startsWith('../../assets/') ? 'asset' : Module.prototype.require.call(mod, id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText, filename);
  return mod.exports;
}
function hooks() {
  const slots = [], effects = [];
  let cursor = 0;
  const api = {
    useState(initial) {
      const i = cursor++;
      if (!slots[i]) slots[i] = { value: typeof initial === 'function' ? initial() : initial };
      return [slots[i].value, value => { slots[i].value = value; }];
    },
    useEffect(effect, deps) {
      const i = cursor++, previous = slots[i];
      if (previous && previous.deps.length === deps.length && deps.every((value, j) => Object.is(value, previous.deps[j]))) return;
      slots[i] = { deps };
      effects.push(() => { previous?.cleanup?.(); slots[i].cleanup = effect(); });
    },
    useSyncExternalStore: (_subscribe, snapshot) => snapshot(),
  };
  return { api, render(fn) { cursor = 0; const value = fn(); effects.splice(0).forEach(run => run()); return value; },
    unmount() { slots.forEach(slot => slot.cleanup?.()); } };
}
function nodes(tree, predicate) {
  if (!tree || typeof tree !== 'object') return [];
  if (Array.isArray(tree)) return tree.flatMap(child => nodes(child, predicate));
  return [...(predicate(tree) ? [tree] : []), ...nodes(tree.props?.children, predicate)];
}
const routes = load('shared/appRoutes.ts');
const catalog = require('../src/shared/localization/catalog.json');
const localization = load('shared/localization/index.ts', { './catalog.json': catalog });
const session = (capabilities = [], assigned = []) => ({ token: 'token', imageCacheScope: 'unassigned',
  profile: { role: 'aparatchi', ref: 'worker' }, capabilities, assigned_apparatus: assigned });

for (const platform of ['ios', 'android']) test(`${platform}: an authenticated worker without workspace permissions retains secured account access`, async () => {
  const react = hooks(), current = session();
  const { default: Index } = load('app/index.tsx', {
    react: react.api, 'expo-router': { Redirect: 'Redirect' },
    'react-native': { Platform: { OS: platform }, ActivityIndicator: 'Loading', View: 'View' },
    '../components/AppEntry': { AppEntry: 'Login' },
    '../components/AccountAccessScreen': { AccountAccessScreen: 'AccountAccess' },
    '../WorkerScreen': { WorkerScreen: 'WorkerQueue' },
    '../auth': { loadSession: async () => current, activeSessionToken: value => value.token },
    '../profileApi': { profile: async () => current },
    '../shared/loginLogic': { bootstrapSession: async read => read(), loadBaseStartup: async read => read() },
    '../appLock': {}, '../components/WorkerSecurity': { WorkerSecurityProvider: 'Security' },
    '../shared/appRoutes': routes, '../shared/switchPinRuntime': {},
    '../shared/notificationStoresRuntime': { notificationUnreadStore: { load() {} } },
    '../shared/basePreferences': {}, '../shared/securityUnlockRuntime': {},
    '../shared/productionSnapshotRuntime': {}, '../preparation/preparationRuntime': { usePreparationRuntime() {} },
    '../workerQueueRuntime': { useWorkerQueueRuntime() {} },
  });
  react.render(Index); await new Promise(resolve => setImmediate(resolve));
  const tree = react.render(Index);
  assert.equal(tree.type, 'Security'); assert.equal(tree.props.session, current);
  assert.equal(tree.props.children.type, 'AccountAccess');
  assert.equal(tree.props.children.props.session, current);
  assert.equal(tree.props.children.props.onLogout, tree.props.onLogout);
  assert.equal(nodes(tree, item => ['WorkerQueue', 'Redirect', 'Login'].includes(item.type)).length, 0);
  // The fix must not grant queue permissions or change any role-home guard.
  assert.equal(routes.canOpenRoute(current, routes.appRoutes.apparatusQueue), false);
  assert.equal(routes.homeTarget(current, platform), null);
  current.capabilities.push('apparatus.queue.read');
  const authorized = react.render(Index);
  assert.equal(platform === 'ios' ? authorized.props.href : authorized.props.children.type,
    platform === 'ios' ? '/ios-worker' : 'WorkerQueue');
  react.unmount();
});

function modelHarness(platform, current = session()) {
  const react = hooks(), calls = [];
  let back, locale = 'uz';
  const { useAccountAccess } = load('components/useAccountAccess.ts', {
    react: react.api, 'expo-router': { router: { push: route => calls.push(['push', route]) } },
    'react-native': { Platform: { OS: platform }, BackHandler: { addEventListener: (_name, callback) => {
      back = callback; return { remove() { back = undefined; } };
    } } },
    '../shared/localization': localization,
    '../shared/localization/runtime': { localeController: { get locale() { return locale; }, addListener() {} } },
    './useAccountSwitcherLauncher': { useAccountSwitcherLauncher: () => ({ open: () => calls.push(['switch']) }) },
  });
  return { react, calls, render: () => react.render(() => useAccountAccess(current)),
    back: () => back?.(), setLocale: value => { locale = value; } };
}

test('the unassigned message is specific to apparatus workers and follows all four locales', () => {
  const h = modelHarness('ios');
  for (const locale of ['uz', 'en', 'ru', 'ur']) {
    h.setLocale(locale); const model = h.render();
    assert.equal(model.unassigned, true);
    assert.equal(model.title, catalog.production['worker.guide.no_machine.title'][locale]);
    assert.equal(model.message, catalog.getters.accountAccessUnassignedBody[locale]);
  }
  for (const current of [session([], ['machine']), { ...session(), profile: { role: 'customer', ref: 'customer' } }]) {
    const other = modelHarness('ios', current).render();
    assert.equal(other.unassigned, false);
    assert.equal(other.message, catalog.getters.accountAccessUnavailableBody.uz);
  }
});

test('Android hardware back closes the current profile and removes the listener', () => {
  const h = modelHarness('android');
  h.render().openProfile(); assert.equal(h.render().profileOpen, true);
  assert.equal(h.back(), true); assert.equal(h.render().profileOpen, false);
  assert.equal(h.back(), undefined);
  h.render().openProfile(); h.render(); h.react.unmount(); assert.equal(h.back(), undefined);
});

const native = new Proxy({}, { get: (_target, name) => String(name) });
const modifiers = new Proxy({}, { get: (_target, name) => (...args) => ({ name, args }) });
for (const platform of ['ios', 'android']) test(`${platform}: the native access page opens the existing switcher and add-account login, and reuses the current profile`, () => {
  const current = session(), h = modelHarness(platform, current), logout = () => {};
  const { AccountAccessScreen } = load(`components/AccountAccessScreen.${platform}.tsx`, {
    [`@expo/ui/${platform === 'ios' ? 'swift-ui' : 'jetpack-compose'}`]: native,
    [`@expo/ui/${platform === 'ios' ? 'swift-ui' : 'jetpack-compose'}/modifiers`]: modifiers,
    'react-native': { View: 'View', ScrollView: 'ScrollView' },
    'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' },
    './BaseHost': { BaseHost: 'Host' }, './ProfileScreen': { ProfileScreen: 'Profile' },
    './WorkerProfileButton.ios': { WorkerProfileButton: 'ProfileButton' },
    '../shared/navigation/RoleHeader.android': { RoleHeader: 'Header' },
    '../shared/navigation/RoleHeaderButton': { RoleHeaderButton: 'ProfileButton' },
    './useAccountAccess': { useAccountAccess: () => h.render() },
    './useBaseTheme': { useBaseTheme: () => ({ colors: { onSurface: '#111', onSurfaceVariant: '#333' } }) },
  });
  const render = () => AccountAccessScreen({ session: current, onLogout: logout });
  let tree = render();
  const action = id => nodes(tree, item => item.props.modifiers?.some(modifier => modifier.args[0] === id))[0];
  const press = item => (item.props.onClick ?? item.props.onPress)();
  press(action('account-access-switch')); press(action('account-access-add'));
  assert.deepEqual(h.calls, [['switch'], ['push', '/add-account']]);
  press(nodes(tree, item => item.type === 'ProfileButton')[0]); tree = render();
  const profile = nodes(tree, item => item.type === 'Profile')[0];
  assert.equal(profile.props.session, current); assert.equal(profile.props.onLogout, logout);
  assert.equal(profile.props.showDirectLogout, true); assert.equal(profile.props.onDailyWork, undefined);
  assert.equal(nodes(tree, item => item.type === 'ProfileButton').length, 1);
  h.react.unmount();
});
