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
function fixture(platform) {
  const session = { token: 'real-token', imageCacheScope: 'scope', profile: { role: 'boyoqchi', ref: 'paint-1' } };
  const witness = { session }, onLogout = () => {}, context = { session, witness, onLogout, profileNavigation: { current: null } };
  let valid = true;
  const auth = { isSessionWitnessCurrent: value => value === witness && valid };
  const text = { useBoyoqchiGetter: () => value => value, useBoyoqchiText: () => value => value };
  const Profile = platform === 'android' ? load('app/android-boyoqchi/profile', {
    react: { useCallback: fn => fn, useRef: value => ({ current: value }), useLayoutEffect() {} }, '../../auth': auth,
    '@expo/ui/jetpack-compose': { useMaterialColors: () => ({ surfaceContainerLow: 'white' }) },
    'expo-router': { useIsFocused: () => true, useNavigation: () => ({ dispatch() {} }) },
    'react-native': { View: 'View' }, 'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0 }) },
    '../../components/ProfileScreen': { ProfileScreen: 'ProfileScreen' },
    '../../shared/navigation/RoleHeader.android': { RoleHeader: 'RoleHeader' },
    '../../shared/navigation/roleDrawerContext': { useRoleDrawer: () => ({ open() {} }) },
    '../../boyoqchi/BoyoqchiDock.android': { BoyoqchiDock: 'BoyoqchiDock' },
    '../../boyoqchi/BoyoqchiMessage': { BoyoqchiMessage: 'BoyoqchiMessage' },
    '../../boyoqchi/returnedPaintDemoGuard': { BOYOQCHI_DEMO_UNAVAILABLE: 'Demo unavailable' },
    '../../boyoqchi/BoyoqchiContext': { useBoyoqchiContext: () => context },
    '../../boyoqchi/boyoqchiProfileNavigation': { registerBoyoqchiProfileNavigation() {} }, '../../boyoqchi/useBoyoqchiText': text,
  }).default : load('app/ios-boyoqchi/(tabs)/profile/index', {
    react: { useCallback: fn => fn }, '../../../../auth': auth,
    'react-native': { PlatformColor: value => value }, 'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' },
    '../../../../components/ProfileScreen': { ProfileScreen: 'ProfileScreen' },
    '../../../../boyoqchi/BoyoqchiContext': { useBoyoqchiContext: () => context },
    '../../../../boyoqchi/BoyoqchiMessage': { BoyoqchiMessage: 'BoyoqchiMessage' },
    '../../../../boyoqchi/returnedPaintDemoGuard': { BOYOQCHI_DEMO_UNAVAILABLE: 'Demo unavailable' },
    '../../../../boyoqchi/useBoyoqchiText': text,
  }).default;
  return { session, witness, onLogout, render: () => Profile(), invalidate: () => { valid = false; } };
}
for (const platform of ['android', 'ios']) {
  test(`${platform} reuses Profile with witness guard and explicitly unavailable Settings`, () => {
    const f = fixture(platform), profiles = nodes(f.render(), 'ProfileScreen'); assert.equal(profiles.length, 1);
    const props = profiles[0].props;
    assert.equal(props.session, f.session); assert.equal(props.onLogout, f.onLogout);
    assert.equal(Object.hasOwn(props, 'onDailyWork'), false); assert.equal(props.showDirectLogout, false);
    assert.equal(props.settingsUnavailableMessage, 'Sozlamalar hozircha mavjud emas.');
    assert.equal(Object.hasOwn(props, 'registerSettingsOpener'), false, 'iOS top Settings cannot open the unguarded sheet');
    assert.equal(props.isCurrent(), true);
    f.session.token = 'refreshed-token'; assert.equal(props.isCurrent(), true, 'same-session token refresh remains valid');
    f.session.token = 'test-mode-token'; assert.equal(props.isCurrent(), false, 'a retained callback rejects a fake token');
    f.session.token = 'real-token'; f.invalidate(); assert.equal(props.isCurrent(), false, 'a retained callback rejects a transition');
  });
  test(`${platform} shows demo unavailable without mounting Profile for a fake token`, () => {
    const f = fixture(platform); f.session.token = 'test-mode-token'; const tree = f.render();
    assert.deepEqual(nodes(tree, 'ProfileScreen'), []);
    const notice = nodes(tree, 'BoyoqchiMessage'); assert.equal(notice.length, 1);
    assert.equal(notice[0].props.title, 'Demo unavailable'); assert.equal(notice[0].props.error, true);
  });
}
