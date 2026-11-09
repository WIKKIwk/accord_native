const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const jsx = { Fragment: 'Fragment', jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
function nodes(node, predicate) {
  if (!node || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap(child => nodes(child, predicate));
  return [...(predicate(node) ? [node] : []), ...nodes(node.props?.children, predicate)];
}
function load(relative, mocks = {}) {
  const filename = path.resolve(__dirname, `../src/${relative}`), loaded = new Module(filename, module);
  loaded.filename = filename; loaded.paths = module.paths;
  loaded.require = id => id === 'react/jsx-runtime' ? jsx : Object.hasOwn(mocks, id) ? mocks[id] : id.startsWith('.') ? {} : require(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, filename);
  return loaded.exports;
}
const react = { useCallback: fn => fn, useEffect() {}, useLayoutEffect() {}, useRef: value => ({ current: value }),
  useState: value => [typeof value === 'function' ? value() : value, () => {}], useSyncExternalStore: (_subscribe, get) => get() };
const ui = new Proxy({}, { get: (_target, name) => name === 'FieldGroup' ? Object.assign(() => {}, { Section: 'FieldSection' })
  : name === 'Toolbar' ? Object.assign(() => {}, { Content: 'Toolbar.Content' }) : name === 'useNativeState' ? value => value : String(name) });
const modifiers = new Proxy({ shapes: { rectangle: () => ({}), circle: () => ({}), capsule: () => ({}) } },
  { get: (target, name) => target[name] ?? (() => ({})) });
function fixture(platform, role = 'boyoqchi', showDirectLogout) {
  const alerts = [], sheets = []; let logouts = 0;
  const newSheet = () => {
    const state = { content: null, options: null, visible: false };
    const sheet = { isOpen: () => state.visible, open: (content, options) => { state.content = content; state.options = options; state.visible = true; },
      update: (content, options) => { state.content = content; state.options = options; }, close: () => { state.visible = false; state.options?.onDismiss?.(); }, state };
    sheets.push(sheet); return sheet;
  };
  const mocks = {
    react, 'expo-router': { useFocusEffect() {} }, '@expo/ui': ui, '@expo/ui/swift-ui': ui, '@expo/ui/swift-ui/modifiers': modifiers,
    '@expo/ui/jetpack-compose': { PullToRefreshBox: 'PullToRefreshBox', useMaterialColors: () => ({}) },
    'react-native': { Alert: { alert: (...args) => alerts.push(args) }, useColorScheme: () => 'light', PlatformColor: value => value },
    '../profileModel': { profileDisplay: () => ({ name: 'Name', role: 'Role', phone: '', legalName: '', apparatusLabels: [] }) },
    '../nativeSheet': { useNativeSheet: newSheet }, '../shared/localization': { localizedGetter: key => key },
    '../shared/localization/runtime': { localeController: { locale: 'uz', addListener() {} } },
    '../shared/themeRuntime': { themeController: { setThemeMode: () => Promise.resolve() } },
    './BaseHost': { BaseHost: 'BaseHost' }, './useBaseTheme': { useBaseTheme: () => ({ colors: {} }) },
    './useBaseLocale.ios': { useBaseLocale: () => ({ text: key => key }) },
    './useSwitchPinSetup.ios': { useSwitchPinSetup: () => ({ busy: false, close() {} }) },
    './ProfileSettings': { ProfileSettings: 'ProfileSettings' }, './ProfileSettings.ios': { ProfileSettings: 'ProfileSettings' },
  };
  const filename = platform === 'ios' ? 'ProfileView.ios.tsx' : platform === 'android' ? 'ProfileView.android.tsx' : 'ProfileView.tsx';
  const { ProfileView } = load(`components/${filename}`, mocks), onLogout = () => { logouts++; };
  const props = { session: { profile: { role } }, snapshot: { profile: {} }, editing: false, busy: false, onRefresh: async () => {},
    onOpenEditor() {}, onCloseEditor() {}, onLogout, ...(showDirectLogout === undefined ? {} : { showDirectLogout }) };
  const tree = ProfileView(props);
  const rows = nodes(tree, node => node.type === 'Button' && (node.props.label === 'logoutTitle' || node.props.label === 'Hisobdan chiqish'));
  return { tree, rows, sheets, alerts, onLogout, logouts: () => logouts };
}
for (const platform of ['ios', 'android', 'web']) {
  test(`${platform}: the role can hide only the direct logout row while defaults remain unchanged`, () => {
    for (const role of ['aparatchi', 'tayyorlov_masteri']) {
      const current = fixture(platform, role);
      assert.equal(current.rows.length, 1);
      assert.equal(current.rows[0].props.onPress, current.onLogout);
    }
    const explicit = fixture(platform, 'boyoqchi', true);
    assert.equal(explicit.rows.length, 1);
    assert.equal(explicit.rows[0].props.onPress, explicit.onLogout);
    const hidden = fixture(platform, 'boyoqchi', false);
    assert.equal(hidden.rows.length, 0);
    if (platform === 'ios') {
      const settings = nodes(hidden.tree, node => node.type === 'ProfileSettings');
      assert.equal(settings.length, 1); assert.equal(settings[0].props.onLogout, hidden.onLogout);
    } else {
      assert.ok(nodes(hidden.tree, node => node.type === 'Button' && (node.props.testID === 'profile-settings' || node.props.label === 'Sozlamalar')).length);
    }
  });
}

test('Android Settings asks once and only confirmation ends the session', () => {
  const f = fixture('android', 'boyoqchi', false);
  nodes(f.tree, node => node.props?.testID === 'profile-settings')[0].props.onPress();
  const settings = nodes(f.sheets[1].state.content, node => node.type === 'ProfileSettings');
  assert.equal(settings.length, 1);
  settings[0].props.onLogout();
  assert.equal(f.alerts.length, 1); assert.equal(f.logouts(), 0);
  const choices = f.alerts[0][2];
  assert.equal(choices[0].style, 'cancel'); choices[0].onPress?.(); assert.equal(f.logouts(), 0);
  choices[1].onPress(); assert.equal(f.logouts(), 1);
});

test('iOS Settings asks once and only confirmation ends the session', () => {
  const f = fixture('ios', 'boyoqchi', false), settings = nodes(f.tree, node => node.type === 'ProfileSettings')[0];
  const { ProfileSettings } = load('components/ProfileSettings.ios.tsx', {
    react, '@expo/ui/swift-ui': ui, '@expo/ui/swift-ui/modifiers': modifiers,
    'react-native': { Alert: { alert: (...args) => f.alerts.push(args) } },
    'expo-constants': { __esModule: true, default: { expoConfig: { version: '1' } } },
    '../appAppearance': { isAppearancePreference: () => true },
    './AppSettings': { useAppSettings: () => ({ appearance: 'system', setAppearance: async () => {} }) },
    './AppUpdateProvider': { useAppUpdate: () => () => {} },
    './usePinSetup.ios': { usePinSetup: () => ({ busy: false, mode: null,
      security: { hasPin: false, canUseBiometric: false, biometric: false } }) },
  });
  const tree = ProfileSettings(settings.props), buttons = nodes(tree, node => node.type === 'Button' && node.props.label === 'disconnectSessionTitle');
  assert.equal(buttons.length, 1); buttons[0].props.onPress();
  assert.equal(f.alerts.length, 1); assert.equal(f.logouts(), 0);
  const choices = f.alerts[0][2];
  assert.equal(choices[0].style, 'cancel'); choices[0].onPress?.(); assert.equal(f.logouts(), 0);
  choices[1].onPress(); assert.equal(f.logouts(), 1);
});

test('shared ProfileScreen forwards the opt-in without changing the default', () => {
  const mocks = {
    react, 'expo-document-picker': {}, 'expo-image-picker': {}, 'expo-router': { useFocusEffect() {} },
    'react-native': { Alert: { alert() {} }, AppState: { addEventListener: () => ({ remove() {} }) }, Platform: { OS: 'ios' } },
    '../auth': { activeSessionToken: () => null },
    '../profileModel': { initialProfileSnapshot: () => ({ profile: {} }), profileDisplay: () => ({}) },
    '../shared/localization/runtime': { localeController: { locale: 'uz', addListener() {} } },
    '../shared/profileAvatarRuntime': { cachedProfileAvatar: () => null }, './ProfileView': { ProfileView: 'ProfileView' },
  };
  const { ProfileScreen } = load('components/ProfileScreen.tsx', mocks), onLogout = () => {};
  for (const value of [undefined, false, true]) {
    const wrapper = ProfileScreen({ session: { imageCacheScope: 'scope', profile: {} }, onLogout, showDirectLogout: value });
    const view = wrapper.type(wrapper.props);
    assert.equal(view.type, 'ProfileView');
    assert.equal(view.props.showDirectLogout, value);
    assert.equal(view.props.onLogout, onLogout);
  }
});
