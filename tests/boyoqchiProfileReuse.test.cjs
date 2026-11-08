const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const jsx = { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
function nodes(node, type) {
  if (!node || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap(child => nodes(child, type));
  return [...(node.type === type ? [node] : []), ...nodes(node.props?.children, type)];
}
function load(relative, mocks) {
  const filename = path.resolve(__dirname, `../src/${relative}.tsx`), loaded = new Module(filename, module);
  loaded.filename = filename; loaded.paths = module.paths;
  loaded.require = id => id === 'react/jsx-runtime' ? jsx : Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, filename);
  return loaded.exports;
}
const session = { imageCacheScope: 'scope', profile: { role: 'boyoqchi', ref: 'paint-1' } }, onLogout = () => {};
const context = { session, onLogout, profileNavigation: { current: null } };

test('Android Boyoqchi reuses shared Profile without an unrelated daily-work action', () => {
  const Profile = load('app/android-boyoqchi/profile', {
    react: { useRef: value => ({ current: value }), useLayoutEffect() {} },
    '@expo/ui/jetpack-compose': { useMaterialColors: () => ({ surfaceContainerLow: 'white' }) },
    'expo-router': { useIsFocused: () => true, useNavigation: () => ({ dispatch() {} }), router: { navigate() {} } },
    'react-native': { View: 'View' }, 'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0 }) },
    '../../components/ProfileScreen': { ProfileScreen: 'ProfileScreen' },
    '../../shared/navigation/RoleHeader.android': { RoleHeader: 'RoleHeader' },
    '../../shared/navigation/roleDrawerContext': { useRoleDrawer: () => ({ open() {} }) },
    '../../boyoqchi/BoyoqchiDock.android': { BoyoqchiDock: 'BoyoqchiDock' },
    '../../boyoqchi/BoyoqchiContext': { useBoyoqchiContext: () => context },
    '../../boyoqchi/boyoqchiProfileNavigation': { registerBoyoqchiProfileNavigation() {} },
    '../../boyoqchi/useBoyoqchiText': { useBoyoqchiGetter: () => key => key, useBoyoqchiText: () => key => key },
  }).default;
  const profiles = nodes(Profile(), 'ProfileScreen');
  assert.equal(profiles.length, 1);
  assert.equal(profiles[0].props.session, session);
  assert.equal(profiles[0].props.onLogout, onLogout);
  assert.equal(Object.hasOwn(profiles[0].props, 'onDailyWork'), false);
  assert.equal(profiles[0].props.showDirectLogout, false);
});

test('iOS Boyoqchi reuses shared Profile without an unrelated daily-work action', () => {
  const settings = { register: (value, opener) => { assert.equal(value, session); assert.equal(typeof opener, 'function'); return () => {}; } };
  const Profile = load('app/ios-boyoqchi/(tabs)/profile/index', {
    react: { useCallback: fn => fn },
    '../../../../boyoqchi/BoyoqchiProfileSettings.ios': { useBoyoqchiProfileSettings: () => settings },
    'expo-router': { router: { navigate() {} } }, 'react-native': { PlatformColor: value => value },
    'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' },
    '../../../../components/ProfileScreen': { ProfileScreen: 'ProfileScreen' },
    '../../../../boyoqchi/BoyoqchiContext': { useBoyoqchiContext: () => context },
  }).default;
  const profiles = nodes(Profile(), 'ProfileScreen');
  assert.equal(profiles.length, 1);
  assert.equal(profiles[0].props.session, session);
  assert.equal(profiles[0].props.onLogout, onLogout);
  assert.equal(Object.hasOwn(profiles[0].props, 'onDailyWork'), false);
  assert.equal(profiles[0].props.showDirectLogout, false);
  assert.equal(typeof profiles[0].props.registerSettingsOpener(() => {}), 'function');
});
