/* global __dirname */
const assert = require('node:assert/strict'), test = require('node:test');
const fs = require('node:fs'), path = require('node:path'), Module = require('node:module'), ts = require('typescript');
const jsx = { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
function load(file, mocks = {}) {
  const filename = path.resolve(__dirname, '../src', file), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths;
  mod.require = id => id === 'react/jsx-runtime' ? jsx : Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { fileName: filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, filename);
  return mod.exports;
}
function hooks() {
  let cursor = 0; const slots = [], effects = [];
  const api = {
    useState(initial) { const i = cursor++; slots[i] ??= { value: typeof initial === 'function' ? initial() : initial };
      return [slots[i].value, value => { slots[i].value = typeof value === 'function' ? value(slots[i].value) : value; }]; },
    useRef(initial) { const i = cursor++; return slots[i] ??= { current: initial }; },
    useEffect(create, deps) { const i = cursor++, old = slots[i];
      if (deps && old?.deps && deps.length === old.deps.length && deps.every((v, n) => Object.is(v, old.deps[n]))) return;
      const slot = slots[i] = { deps }; effects.push(() => { old?.cleanup?.(); slot.cleanup = create(); }); },
    useSyncExternalStore: (_subscribe, snapshot) => snapshot(),
  };
  return { api, render(fn) { cursor = 0; const result = fn(); effects.splice(0).forEach(run => run()); return result; },
    cleanup() { slots.forEach(slot => slot.cleanup?.()); } };
}
function find(node, type) {
  if (Array.isArray(node)) return node.map(child => find(child, type)).find(Boolean);
  if (!node || typeof node !== 'object') return null;
  return node.type === type ? node : find(node.props?.children, type);
}
const settle = () => new Promise(resolve => setImmediate(resolve));
const routes = load('shared/appRoutes.ts'), logic = load('shared/loginLogic.ts');
const admin = { token: 'original-token', profile: { role: 'admin', ref: 'original-admin' }, capabilities: ['admin.access'], imageCacheScope: 'original-scope' };
function fixture(platform, saved = null) {
  const root = hooks(), entry = hooks(), form = hooks(), calls = [];
  let active = saved;
  const native = { Platform: { OS: platform }, View: 'View', ActivityIndicator: 'Spinner', BackHandler: { addEventListener: () => ({ remove() {} }) } };
  const locale = { locale: 'uz', hasExplicitSelection: true, addListener: () => () => {} };
  const localization = { localizedGetter: key => key, localizedMethod: key => key };
  const mobile = { MobileApi: { instance: { baseUrl: 'https://test.invalid' } } };
  const auth = { loadSession: async () => active, activeSessionToken: value => value === active ? value.token : null,
    login: async (...args) => { calls.push(['login', ...args]); active = admin; return admin; },
    logout: async value => { calls.push(['logout', value]); active = null; } };
  const fields = { Section: 'Section' };
  const AppEntry = load('components/AppEntry.tsx', {
    react: entry.api, '@expo/ui': { BottomSheet: 'BottomSheet', FieldGroup: fields, RNHostView: 'RNHostView', Button: 'Button', ListItem: 'ListItem', Text: 'Text', TextInput: 'TextInput', useNativeState: value => ({ value, set() {} }) },
    'react-native': native, 'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' }, '../auth': auth,
    '../LoginScreen': { LoginScreen: 'SharedNativeLogin' }, '../mobileApi': mobile,
    '../savedAccountRuntime': { initializeSavedAccounts: async () => ({ accountsForEndpoint: () => [], activeAccountId: null }) },
    '../shared/localization': localization, '../shared/localization/runtime': { localeController: locale }, '../shared/switchPinRuntime': { switchPinStore: {} },
    '../shared/themeRuntime': { themeController: { variant: 'classic' } }, '../shared/accountEntryLogic': {}, './BaseHost': { BaseHost: 'Host' },
    './WelcomeScreen': { WelcomeScreen: 'SharedNativeWelcome' }, './useBaseTheme': { useBaseTheme: () => ({ colors: {} }) },
  }).AppEntry;
  const Index = load('app/index.tsx', {
    react: root.api, 'expo-router': { Redirect: 'Redirect' }, 'react-native': native,
    '../components/AppEntry': { AppEntry }, '../components/AccountAccessScreen': { AccountAccessScreen: 'AccountAccessScreen' }, '../WorkerScreen': { WorkerScreen: 'WorkerScreen' },
    '../auth': auth, '../profileApi': { profile: async value => { calls.push(['refresh', value]); } }, '../shared/loginLogic': logic,
    '../appLock': { clearAppLock: async value => { calls.push(['clear-lock', value]); } }, '../components/WorkerSecurity': { WorkerSecurityProvider: 'Security' }, '../shared/appRoutes': routes,
    '../shared/switchPinRuntime': { switchPinStore: { clear: async () => {} } }, '../shared/notificationStoresRuntime': { notificationUnreadStore: { load: async () => {} } },
    '../shared/basePreferences': { initializeBasePreferences: async () => {} }, '../shared/securityUnlockRuntime': { unlockAfterLogin: value => calls.push(['unlock', value]) },
    '../shared/productionSnapshotRuntime': {}, '../preparation/preparationRuntime': { usePreparationRuntime() {} }, '../workerQueueRuntime': { useWorkerQueueRuntime() {} },
  }).default;
  const useLoginForm = load('components/useLoginForm.ts', { react: form.api, '../auth': auth, '../authenticateAccount': {}, '../mobileApi': mobile,
    '../shared/loginLogic': logic, '../shared/localization': localization, '../shared/localization/runtime': { localeController: locale } }).useLoginForm;
  return { root, entry, form, calls, Index, AppEntry, useLoginForm,
    renderRoot: () => root.render(Index), renderEntry: props => entry.render(() => AppEntry(props)),
    renderForm: onLogin => form.render(() => useLoginForm(onLogin, false)),
    cleanup: () => { root.cleanup(); entry.cleanup(); form.cleanup(); } };
}

for (const platform of ['android', 'ios']) {
  test(`${platform}: shared welcome and login form deliver Admin to its native home after authentication`, async () => {
    const f = fixture(platform); try {
      assert.equal(f.renderRoot().type, 'View'); await settle();
      const entry = f.renderRoot(); assert.equal(entry.type, f.AppEntry);
      f.renderEntry(entry.props); await settle();
      const welcome = find(f.renderEntry(entry.props), 'SharedNativeWelcome'); assert.ok(welcome); welcome.props.onStart();
      const login = f.renderEntry(entry.props); assert.equal(login.type, 'SharedNativeLogin');
      let form = f.renderForm(login.props.onLogin); form.setPhone(' 123 '); form.changeCode(' code ');
      form = f.renderForm(login.props.onLogin); assert.equal(form.canSubmit, true); await form.submit();
      assert.deepEqual(f.calls, [['login', 'https://test.invalid', '123', 'code'], ['unlock', admin]]);
      const home = f.renderRoot(); assert.equal(home.type, 'Redirect'); assert.equal(home.props.href, `/${platform}-admin`);
    } finally { f.cleanup(); }
  });
  test(`${platform}: restored Admin session reuses startup validation and reaches home without another login`, async () => {
    const f = fixture(platform, admin); try {
      f.renderRoot(); await settle(); const home = f.renderRoot();
      assert.equal(home.type, 'Redirect'); assert.equal(home.props.href, `/${platform}-admin`); assert.deepEqual(f.calls, [['refresh', admin]]);
    } finally { f.cleanup(); }
  });
  test(`${platform}: unauthorized account stays on the existing access screen with working logout back to common entry`, async () => {
    const denied = { ...admin, capabilities: [] }, f = fixture(platform, denied); try {
      f.renderRoot(); await settle(); const protectedRoot = f.renderRoot(); assert.equal(protectedRoot.type, 'Security');
      assert.equal(protectedRoot.props.children.type, 'AccountAccessScreen'); protectedRoot.props.onLogout(); await settle();
      assert.equal(f.renderRoot().type, f.AppEntry); assert.ok(f.calls.some(call => call[0] === 'logout' && call[1] === denied));
    } finally { f.cleanup(); }
  });
}
