/* global __dirname */
const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');
const s = require('./adminSupplierDetailViewSupport.cjs');
const frame = require('./adminShellFrameViewSupport.cjs');
const colors = { surfaceContainerHigh: '#ddd', surfaceContainerLow: '#eee', onSurface: '#111' };
const modifiers = new Proxy({}, { get: (_target, name) => (...args) => ({ name: String(name), args }) });
const TopAppBar = Object.assign(function Native(props) { return { type: 'TopAppBar', props }; }, { NavigationIcon: 'TopAppBar.NavigationIcon', Title: 'TopAppBar.Title' });
const compose = new Proxy({ TopAppBar }, { get: (target, name) => target[name] ?? String(name) });
const mocks = { './AdminTopBar.android': require('./support/adminChrome.cjs'), react: { useSyncExternalStore: (_subscribe, get) => get(), useCallback: callback => callback, useEffect() {} },
  '@expo/ui/jetpack-compose': compose, '@expo/ui/jetpack-compose/modifiers': modifiers, '@expo/ui/swift-ui': { Button: 'Button' }, '@expo/ui/swift-ui/modifiers': modifiers,
  'expo-symbols': { SymbolView: 'SymbolView' }, 'expo-router': { Stack: { Screen: 'Stack.Screen' }, Redirect: 'Redirect' },
  'react-native': { Platform: { OS: 'android' }, View: 'View', StyleSheet: { create: value => value }, BackHandler: { addEventListener: () => ({ remove() {} }) } },
  'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView', useSafeAreaInsets: () => ({ top: 24 }) },
  '../components/BaseHost.android': { BaseHost: 'BaseHost' }, '../components/BaseHost.ios': { BaseHost: 'BaseHost' }, '../components/ProfileScreen': { ProfileScreen: 'GenuineProfileScreen' },
  '../components/useBaseTheme': { useBaseTheme: () => ({ colors }) }, './AdminTypography.android': { AdminText: 'Text' },
  '../shared/localization': s.l10n, '../shared/localization/runtime': { localeController: { locale: 'uz', addListener() {} } }, './AdminShellBodyFrame': frame.frameModule(colors),
};
const header = s.compile(path.resolve(__dirname, '../src/admin/AdminProfileHeader.android.tsx'), mocks);
test('Profile uses the shared Android header with its standard title and native Back action', () => {
  const calls = [], tree = s.expand(header.AdminProfileHeader({ title: 'Profil', backLabel: 'Back', onBack: () => calls.push('back') }));
  const bar = s.nodes(tree, node => node.type === 'AdminScreenHeader')[0];
  assert.equal(tree.props.style.paddingTop, 24);
  assert.equal(tree.props.style.backgroundColor, colors.surfaceContainerHigh);
  assert.equal(bar.props.standardTitle, true);
  assert.equal(bar.props.title, 'Profil');
  assert.equal(bar.props.navigation.icon, 'back');
  bar.props.navigation.onPress();
  assert.deepEqual(calls, ['back']);
  assert.equal(bar.props.profileAction, undefined);
});
for (const platform of ['android', 'ios']) test(`${platform} owned Profile keeps the genuine shared owner in source frame and omits every disabled Settings replacement`, () => {
  const component = s.compile(path.resolve(__dirname, `../src/admin/AdminOwnedProfileContent.${platform}.tsx`), { ...mocks, './AdminProfileHeader.android': header });
  const props = { session: { profile: { role: 'admin' } }, isCurrent: () => true, canInteract: () => true, onLogout() {}, onBack() {}, backLabel: 'Back', footer: { type: 'GenuineDock' }, profileAction: { type: 'MustNotRenderProfileAction' } }, tree = s.expand(component.AdminOwnedProfileContent(props));
  const body = s.nodes(tree, node => node.props.testID === 'admin-profile-body-frame')[0], reserve = s.nodes(tree, node => node.props.testID === 'admin-profile-body-frame-reserve')[0], profile = s.nodes(body, node => node.type === 'GenuineProfileScreen')[0];
  assert.equal(reserve.props.style[1].marginHorizontal, undefined); assert.equal(reserve.props.style[1].marginBottom, 92); assert.equal(body.props.style[1].borderTopLeftRadius, undefined); assert.equal(body.props.style[1].borderBottomLeftRadius, undefined); assert.equal(body.props.style[2], false);
  assert.equal(profile.props.session, props.session); assert.equal(profile.props.isCurrent, props.isCurrent); assert.equal(profile.props.settingsDisabled, true); assert.equal(profile.props.settingsUnavailableMessage, undefined); assert.equal(profile.props.showDirectLogout, false);
  assert.equal(s.nodes(body, node => node.type === 'GenuineDock').length, 0); assert.equal(s.nodes(tree, node => node.type === 'GenuineDock').length, 1); assert.equal(s.nodes(tree, node => node.type === 'MustNotRenderProfileAction').length, 0);
  if (platform === 'ios') { const native = s.nodes(tree, node => node.type === 'Stack.Screen')[0].props.options.headerLeft(); assert.equal(native.props.children.type, 'Button'); assert.equal(native.props.children.props.systemImage, 'chevron.left'); assert.ok(native.props.children.props.modifiers.some(mod => mod.name === 'frame' && mod.args[0].minWidth === 44 && mod.args[0].minHeight === 44)); }
});
for (const platform of ['android', 'ios']) test(`${platform} standalone Profile preserves actual shell/data admission while applying common source frame`, () => {
  const session = { profile: { role: 'admin' } }, current = () => true, route = s.compile(path.resolve(__dirname, `../src/admin/AdminProfileRoute.${platform}.tsx`), { ...mocks,
    'expo-router': { Stack: { Screen: 'Stack.Screen' }, Redirect: 'Redirect', router: { canGoBack: () => true, back() {} } }, 'react-native': { ...mocks['react-native'], Platform: { OS: platform } },
    '../shared/appRoutes': s.routes, './AdminProfileHeader.android': header, './AdminBottomBar.android': { AdminBottomBar: 'GenuineStandaloneDock' }, './adminActivityBackLabel': { adminActivityBackLabel: () => 'Back' },
    './AdminShellContext': { useAdminShell: () => ({ session, isCurrent: current, destination: () => '/profile', onLogout() {} }) } });
  const tree = s.expand(route.AdminProfileRoute()), body = s.nodes(tree, node => node.props.testID === 'admin-profile-body-frame')[0], profile = s.nodes(body, node => node.type === 'GenuineProfileScreen')[0];
  assert.equal(profile.props.session, session); assert.equal(profile.props.isCurrent, current); assert.equal(profile.props.settingsDisabled, true); assert.equal(profile.props.settingsUnavailableMessage, undefined);
  assert.equal(s.nodes(body, node => node.type === 'GenuineStandaloneDock').length, 0); if (platform === 'android') { assert.equal(s.nodes(tree, node => node.type === 'GenuineStandaloneDock').length, 1); assert.equal(s.nodes(tree, node => node.type === 'AdminScreenHeader')[0].props.standardTitle, true); }
});
