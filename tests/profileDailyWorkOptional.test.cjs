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
function load(file, mocks) {
  const filename = path.resolve(__dirname, '../src/components', file), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths;
  mod.require = id => id === 'react/jsx-runtime' ? jsx : Object.hasOwn(mocks, id) ? mocks[id] : id.startsWith('.') ? {} : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, filename);
  return mod.exports;
}
const react = { useCallback: fn => fn, useEffect() {}, useLayoutEffect() {}, useRef: value => ({ current: value }),
  useState: value => [typeof value === 'function' ? value() : value, () => {}], useSyncExternalStore: (_subscribe, get) => get() };
const display = { name: 'Name', role: 'Role', phone: '', legalName: '', apparatusLabels: [] };
const ui = new Proxy({}, { get: (_target, name) => name === 'FieldGroup' ? Object.assign(() => {}, { Section: 'FieldSection' })
  : name === 'useNativeState' ? value => value : String(name) });
const modifiers = new Proxy({ shapes: { rectangle: () => ({}), circle: () => ({}), capsule: () => ({}) } },
  { get: (target, name) => target[name] ?? (() => ({})) });
function render(platform, role, onDailyWork) {
  const sheet = { isOpen: () => false, open() {}, close() {}, update() {} };
  const mocks = {
    react, 'expo-router': { useFocusEffect() {} }, '@expo/ui': ui, '@expo/ui/swift-ui': ui, '@expo/ui/swift-ui/modifiers': modifiers,
    '@expo/ui/jetpack-compose': { PullToRefreshBox: 'PullToRefreshBox', useMaterialColors: () => ({}) },
    'react-native': { Alert: { alert() {} }, useColorScheme: () => 'light', PlatformColor: value => value },
    '../profileModel': { profileDisplay: () => display }, '../nativeSheet': { useNativeSheet: () => sheet },
    '../shared/localization': { localizedGetter: key => key }, '../shared/localization/runtime': { localeController: { locale: 'uz', addListener() {} } },
    '../shared/themeRuntime': { themeController: { setThemeMode: () => Promise.resolve() } },
    './BaseHost': { BaseHost: 'BaseHost' }, './useBaseTheme': { useBaseTheme: () => ({ colors: {} }) },
    './useBaseLocale.ios': { useBaseLocale: () => ({ text: key => key }) },
    './useSwitchPinSetup.ios': { useSwitchPinSetup: () => ({ busy: false, close() {} }) },
  };
  const file = platform === 'ios' ? 'ProfileView.ios.tsx' : platform === 'android' ? 'ProfileView.android.tsx' : 'ProfileView.tsx';
  const { ProfileView } = load(file, mocks);
  return ProfileView({ session: { profile: { role } }, snapshot: { profile: {} }, editing: false, busy: false,
    onRefresh: async () => {}, onOpenEditor() {}, onCloseEditor() {}, onLogout() {}, onDailyWork });
}
function dailyItems(tree, platform) {
  return nodes(tree, node => platform === 'ios' ? typeof node.type === 'function' && node.type.name === 'NavigationRow' && node.props.title === 'Kunlik ish'
    : node.type === 'Button' && node.props.label === 'Kunlik ish');
}

for (const platform of ['ios', 'android', 'web']) {
  test(`${platform}: existing worker callback retains the daily-work row and action`, () => {
    let calls = 0;
    const items = dailyItems(render(platform, 'aparatchi', () => calls++), platform);
    assert.equal(items.length, 1);
    items[0].props.onPress(); assert.equal(calls, 1);
  });
  test(`${platform}: omitting the callback hides the daily-work row`, () => {
    assert.equal(dailyItems(render(platform, 'boyoqchi', undefined), platform).length, 0);
  });
}

test('preparation retains its existing platform-specific daily-work visibility', () => {
  assert.equal(dailyItems(render('android', 'tayyorlov_masteri', () => {}), 'android').length, 0);
  assert.equal(dailyItems(render('ios', 'tayyorlov_masteri', () => {}), 'ios').length, 1);
});

test('ProfileScreen forwards the supplied callback or its absence to the platform view', () => {
  const mocks = {
    react, 'expo-document-picker': {}, 'expo-image-picker': {}, 'expo-router': { useFocusEffect() {} },
    'react-native': { Alert: { alert() {} }, AppState: { addEventListener: () => ({ remove() {} }) }, Platform: { OS: 'ios' } },
    '../auth': { activeSessionToken: () => null },
    '../profileModel': { initialProfileSnapshot: () => ({ profile: {} }), profileDisplay: () => display },
    '../shared/localization/runtime': { localeController: { locale: 'uz', addListener() {} } },
    '../shared/profileAvatarRuntime': { cachedProfileAvatar: () => null },
    './ProfileView': { ProfileView: 'ProfileView' },
  };
  const { ProfileScreen } = load('ProfileScreen.tsx', mocks), callback = () => {}, registerSettingsOpener = () => () => {};
  for (const onDailyWork of [callback, undefined]) {
    const wrapper = ProfileScreen({ session: { imageCacheScope: 'scope', profile: {} }, onLogout() {}, onDailyWork, registerSettingsOpener });
    const view = wrapper.type(wrapper.props);
    assert.equal(view.type, 'ProfileView'); assert.equal(view.props.onDailyWork, onDailyWork);
    assert.equal(view.props.registerSettingsOpener, registerSettingsOpener);
  }
});
