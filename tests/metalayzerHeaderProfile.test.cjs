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
  mod.require = id => id === 'react/jsx-runtime' ? jsx : Object.hasOwn(mocks, id) ? mocks[id] : Module.prototype.require.call(mod, id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText, filename);
  return mod.exports;
}
function nodes(tree, predicate) {
  if (!tree || typeof tree !== 'object') return [];
  if (Array.isArray(tree)) return tree.flatMap(child => nodes(child, predicate));
  return [...(predicate(tree) ? [tree] : []), ...nodes(tree.props?.children, predicate)];
}
const modifiers = new Proxy({}, { get: (_target, name) => (...args) => ({ name, args }) });
const launcher = calls => onProfile => ({ onPress: onProfile, open: () => calls.push('switch'), hint: 'account switch' });

function buttons(platform, calls) {
  const navigation = require('./support/roleNavigation.cjs');
  return navigation.load('RoleHeaderButton.tsx', {
    'expo-symbols': { SymbolView: 'SymbolView' },
    'react-native': { Platform: { OS: platform }, Pressable: 'Pressable', StyleSheet: { create: value => value } },
    './roleNavigationMetrics': navigation.metrics,
    '../../components/useAccountSwitcherLauncher': { useAccountSwitcherLauncher: launcher(calls) },
  });
}

function nativePress(node) {
  while (typeof node.type === 'function') node = node.type(node.props);
  return node;
}

test('Android home, list and profile headers use the shared tap and hold control', () => {
  const calls = []; let current = true;
  const { RoleHeaderButton } = buttons('android', calls);
  const { MetalayzerFrame } = load('metalayzer/MetalayzerFrame.android.tsx', {
    '@expo/ui/jetpack-compose': { useMaterialColors: () => ({ surfaceContainerLow: 'surface', onSurfaceVariant: 'ink' }) },
    'expo-router': { router: { navigate: route => calls.push(route), canGoBack: () => true, back: () => calls.push('back') } },
    'react-native': { View: 'View' }, 'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) },
    '../homashyo/RawSplitBusy': { RawSplitBusy: 'Busy' }, '../shared/chat/useChatUnreadCount': {},
    '../shared/navigation/RoleBottomBar.android': { RoleBottomBar: 'Dock' }, '../shared/navigation/RoleHeader.android': { RoleHeader: 'Header' },
    '../shared/navigation/RoleHeaderButton': { RoleHeaderButton }, '../shared/navigation/roleDrawerContext': { useRoleDrawer: () => ({ open() {} }) },
    './MetalayzerContext': { useMetalayzerContext: () => ({ isCurrent: () => current }) },
  });
  for (const options of [{}, { back: true }, { profile: true }]) {
    const tree = MetalayzerFrame({ title: 'Metalayzer', ...options, children: 'content' });
    const item = nodes(tree, node => node.type === 'Header')[0].props.profileAction;
    assert.equal(item.type, RoleHeaderButton); assert.equal(item.props.icon, 'profile');
    const press = nativePress(item);
    assert.equal(press.props.testID, 'header-profile');
    assert.equal(press.props.delayLongPress, 500);
    press.props.onPress(); press.props.onLongPress();
    assert.deepEqual(calls.slice(-2), ['/android-metalayzer/profile', 'switch']);
    current = false; press.props.onPress(); assert.equal(calls.at(-1), 'switch'); current = true;
  }
});

test('iOS header reuses the avatar with tap for profile and hold for account switching', () => {
  const calls = []; let current = true;
  const { ProfilePressTarget } = load('components/ProfilePressTarget.ios.tsx', {
    '../shared/navigation/RoleHeaderButton': buttons('ios', calls),
    './useAccountSwitcherLauncher': { useAccountSwitcherLauncher: launcher(calls) },
  });
  const { WorkerProfileButton } = load('components/WorkerProfileButton.ios.tsx', {
    '@expo/ui/swift-ui': { HStack: 'HStack', RNHostView: 'RNHostView' }, '@expo/ui/swift-ui/modifiers': modifiers,
    'expo-router': { useFocusEffect() {} }, 'expo-symbols': { SymbolView: 'SymbolView' },
    'react-native': { PlatformColor: value => value }, react: { useCallback: fn => fn, useState: fn => [fn(), () => {}] },
    '../auth': { activeSessionToken: () => 'token' }, '../authorizedFetch': {},
    '../profileModel': { profileAvatarSource: () => null }, './ProfileAvatar': { ProfileAvatar: 'Avatar' },
    './ProfilePressTarget.ios': { ProfilePressTarget },
  });
  const session = { profile: {}, imageCacheScope: 'metal-account' };
  const { MetalayzerHeaderProfile } = load('metalayzer/MetalayzerHeaderProfile.ios.tsx', {
    'expo-router': { router: { navigate: route => calls.push(route) } },
    '../components/BaseHost': { BaseHost: 'Host' }, '../components/WorkerProfileButton.ios': { WorkerProfileButton },
    './MetalayzerContext': { useMetalayzerContext: () => ({ session, isCurrent: () => current }) },
  });
  const header = MetalayzerHeaderProfile(), avatar = header.props.children;
  assert.equal(header.type, 'Host'); assert.equal(avatar.props.session, session);
  const target = nodes(WorkerProfileButton(avatar.props), node => node.type === ProfilePressTarget)[0];
  const press = nativePress(target); assert.equal(press.props.delayLongPress, 500);
  press.props.onPress(); press.props.onLongPress();
  assert.deepEqual(calls, ['/ios-metalayzer/profile', 'switch']);
  current = false; press.props.onPress(); assert.deepEqual(calls, ['/ios-metalayzer/profile', 'switch']);
});

test('iOS home and marked-materials screens place the shared profile control in the toolbar', () => {
  const toolbar = Object.assign(() => {}, { View: 'ToolbarView' });
  const Header = () => null;
  const ui = new Proxy({ useNativeState: value => ({ get: () => value, set() {} }) }, { get: (target, name) => target[name] ?? name });
  const common = { '@expo/ui/swift-ui': ui, '@expo/ui/swift-ui/modifiers': modifiers,
    'expo-router': { Stack: { Screen: 'StackScreen', Toolbar: toolbar }, router: {} },
    react: { useEffect() {}, useRef: value => ({ current: value }), useState: value => [value, () => {}] },
    './MetalayzerHeaderProfile.ios': { MetalayzerHeaderProfile: Header } };
  const home = load('metalayzer/MetalayzerHome.ios.tsx', { ...common,
    './MetalayzerContext': { useMetalayzerContext: () => ({ isCurrent: () => true }) }, './MetalayzerScanner': { MetalayzerScanner: 'Scanner' },
    './useMetalayzerLogic': { useMetalayzerLogic: () => ({ material: null, enabled: true }), formatMetalayzerQuantity() {} },
  }).MetalayzerHome();
  const list = load('metalayzer/MetalayzerList.ios.tsx', { ...common, 'react-native': { PlatformColor: value => value },
    'react-native-reanimated': { useSharedValue: value => value }, '../shared/orders/OrdersList': { OrdersList: 'OrdersList' },
    './metalayzerApi': { formatMetalayzerQuantity() {} }, './useMetalayzerList': { useMetalayzerList: () => ({ items: [], loading: false }) },
  }).MetalayzerList();
  for (const screen of [home, list]) {
    const trailing = nodes(screen, node => node.type === toolbar && node.props.placement === 'right');
    assert.equal(trailing.length, 1);
    const view = nodes(trailing[0], node => node.type === 'ToolbarView')[0];
    assert.equal(view.props.children.type, Header);
  }
});
