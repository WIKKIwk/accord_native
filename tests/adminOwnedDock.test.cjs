/* global __dirname */
const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');
const s = require('./adminOwnedNavigationSupport.cjs');
const { expand, nodes } = require('./adminSupplierDetailViewSupport.cjs');
const dock = s.load('admin/adminDockModel', { '../shared/appRoutes': s.routes, '../shared/localization': s.l10n });
const { AdminRootNavigation } = s.load('admin/adminRootNavigation', { '../shared/camera/synchronousGuard': s.strict });
function fixture(platform = 'android', active = 'settings') {
  const runtime = s.runtime(), native = s.native(s.stack([s.home, s.users, s.owned('original')])), route = native.state.routes.at(-1), frames = [], pushes = [], actions = [];
  let valid = true, focused = true, ready = true;
  const owner = { rootRemoval: new s.AdminOwnedRootRemoval(() => valid) }, context = { owner, current: () => valid, ready: () => ready },
    shell = { session: { token: 'real', profile: { role: 'admin', ref: 'A' }, capabilities: ['admin.access', 'party.supplier.read', 'admin.activity.read'] }, activityBinding: {},
      destination: name => name === s.routes.appRoutes.adminHome ? `/${platform}-admin` : name === s.routes.appRoutes.adminActivity ? `/${platform}-admin/activity` : null };
  const props = { active, isCurrent: () => valid, canInteract: () => focused }, hook = s.load('admin/useAdminOwnedDock', { react: runtime.react, '../shared/camera/synchronousGuard': s.strict,
    'expo-router': { router: { push: value => pushes.push(value) }, useNavigation: () => native.navigation, useRoute: () => route },
    'react-native': { Platform: { OS: platform }, Keyboard: { dismiss: () => actions.push('unfocus') } }, '../shared/appRoutes': s.routes,
    '../shared/chat/useChatUnreadCount': { useChatUnreadCount: () => 0 },
    '../shared/localization/runtime': { localeController: { locale: 'uz', addListener() {} } }, './adminDockModel': dock,
    './adminRootNavigation': { adminRootNavigation: new AdminRootNavigation(callback => frames.push(callback)) },
    './AdminOwnedNavigationContext': { useAdminOwnedNavigation: () => context }, './AdminShellContext': { useAdminShell: () => shell } });
  return { props, native, shell, runtime, frames, pushes, actions, render: () => runtime.render(() => hook.useAdminOwnedDock(props)), flush: () => frames.splice(0).forEach(callback => callback()),
    valid: value => { valid = value; }, focused: value => { focused = value; }, ready: value => { ready = value; } };
}
for (const platform of ['android', 'ios']) test(`${platform} real owned dock follows source selected-tab behavior and source root scheduling`, () => {
  const f = fixture(platform), model = f.render(); assert.deepEqual(model.destinations.map(item => item.id), ['admin-home', 'admin-user', 'admin-activity']); assert.equal(model.active, '');
  model.select('admin-user'); assert.deepEqual(f.actions, ['unfocus']); assert.equal(f.native.actions.length, 0); f.flush();
  assert.deepEqual(f.native.applied[0], { type: 'POP_TO', payload: { name: 'users' }, source: 'native-original', target: 'original-stack' });
  const selected = fixture(platform, 'user'); selected.render().select('admin-user'); selected.flush(); assert.deepEqual(selected.actions, []); assert.deepEqual(selected.native.actions, []);
  const activity = fixture(platform); activity.render().select('admin-activity'); activity.flush(); assert.deepEqual(activity.pushes, [`/${platform}-admin/activity`]);
  f.runtime.unmount(); selected.runtime.unmount(); activity.runtime.unmount();
});
test('a queued new native route, stale original account, async guard or held primary readiness cancels pending dock navigation', () => {
  for (const change of ['newer', 'account', 'blur', 'ready', 'async']) {
    const f = fixture(), model = f.render(); if (change === 'async') f.props.canInteract = async () => true;
    const original = change === 'async' ? f.render() : model; original.select('admin-home');
    if (change === 'newer') f.native.setState(s.stack([s.home, s.users, s.owned('original'), s.newer]));
    if (change === 'account') f.valid(false); if (change === 'blur') f.focused(false); if (change === 'ready') f.ready(false);
    f.flush(); assert.deepEqual(f.native.actions, [], change); assert.deepEqual(f.pushes, [], change); f.runtime.unmount();
  }
});
test('owned dock only offers allowed destinations and keeps an unavailable primary held', () => {
  const f = fixture(); f.shell.activityBinding = null; assert.deepEqual(f.render().destinations.map(item => item.id), ['admin-home', 'admin-user']);
  f.ready(false); assert.deepEqual(f.render().destinations.map(item => item.id), ['admin-home']); f.runtime.unmount();
});
function nativeDock(platform, { inset = 15, keyboard = 0, role = 'admin' } = {}) {
  const r = s.runtime(), calls = [], model = { active: 'admin-user', select: value => calls.push(value), destinations: dock.adminDockDestinations({ token: 'real', profile: { role: 'admin', ref: 'A' }, capabilities: ['admin.access', 'party.supplier.read', 'admin.activity.read'] }, 'uz').filter(item => !item.primary) };
  const modifiers = new Proxy({}, { get: (_target, name) => (...args) => ({ name: String(name), args }) });
  const component = (name, slots = {}) => Object.assign(function Native(props) { return { type: name, props }; }, slots);
  const colors = { surface: '#fff', surfaceContainerLow: '#eee', surfaceContainerHigh: '#ccc', onSecondaryContainer: '#222', onSurface: '#111', onSurfaceVariant: '#666', secondaryContainer: '#ddd' };
  const native = { NavigationBarItem: component('NavigationBarItem', { Icon: 'NavigationBarItem.Icon', Label: 'NavigationBarItem.Label' }), useMaterialColors: () => colors };
  const ui = new Proxy(native, { get: (value, name) => value[name] ?? String(name) });
  const keyboardListeners = new Map(), shared = value => { let current = value; return { get: () => current, set: next => { current = next; } }; };
  const mocks = { react: r.react, '@expo/ui/jetpack-compose': ui, '@expo/ui/jetpack-compose/modifiers': modifiers, '@expo/ui/swift-ui': ui, '@expo/ui/swift-ui/modifiers': modifiers,
    'expo-symbols': { SymbolView: 'SymbolView' }, 'react-native': { View: 'View', PlatformColor: value => value, StyleSheet: { create: value => value }, Keyboard: { metrics: () => ({ height: keyboard }), addListener: (name, callback) => { keyboardListeners.set(name, callback); return { remove: () => keyboardListeners.delete(name) }; } } },
    'react-native-reanimated': { __esModule: true, default: { View: 'Animated.View' }, useSharedValue: value => r.react.useMemo(() => shared(value), []), useAnimatedStyle: callback => callback() },
    '../components/BaseHost.android': { BaseHost: 'BaseHost' }, '../components/useBaseTheme': { useBaseTheme: () => ({ colors, mode: 'dark', direction: 'rightToLeft' }) }, './AdminTypography.android': { AdminText: 'Text' },
    '../components/BaseHost.ios': { BaseHost: 'Host' }, './adminDockModel': dock,
    './AdminShellContext': { useOptionalAdminShell: () => ({ session: { profile: { role } } }) },
    './useAdminOwnedDock': { useAdminOwnedDock: () => model }, './useAdminShellLayout': { useAdminShellLayout: () => ({ dockBottomInset: inset }) } };
  const navigation = require('./support/roleNavigation.cjs');
  if (platform === 'android') {
    const sharedMocks = { ...mocks, '../../components/BaseHost.android': mocks['../components/BaseHost.android'],
      '../../components/useBaseTheme': mocks['../components/useBaseTheme'], './roleNavigationMetrics': navigation.metrics };
    for (const name of ['outlined/home.xml', 'filled/home_fill.xml', 'outlined/person.xml', 'filled/person_fill.xml', 'outlined/chat_bubble.xml', 'filled/chat_bubble_fill.xml']) {
      sharedMocks[`../../../assets/icons/navigation/${name}`] = name;
    }
    mocks['../shared/navigation/RoleBottomBar.android'] = s.compile(path.resolve(__dirname, '../src/shared/navigation/RoleBottomBar.android.tsx'), sharedMocks);
  } else {
    mocks['../shared/navigation/RoleTabs.ios'] = navigation.tabs(null);
    mocks['../shared/navigation/RoleBottomBar.ios'] = navigation.load('RoleBottomBar.ios.tsx', { ...mocks,
      '../../components/BaseHost.ios': mocks['../components/BaseHost.ios'], '../../components/useBaseTheme': mocks['../components/useBaseTheme'] });
  }
  const { AdminOwnedDock } = s.compile(path.resolve(__dirname, `../src/admin/AdminOwnedDock.${platform}.tsx`), mocks), render = () => r.render(() => expand(AdminOwnedDock({})));
  return { r, calls, keyboardListeners, render };
}
test('Android owned dock uses the shared Compose NavigationBar with the measured source inset', () => {
  const f = nativeDock('android'), tree = f.render(), tabs = nodes(tree, node => node.type === 'NavigationBarItem');
  const bar = nodes(tree, node => node.type === 'NavigationBar')[0];
  assert.equal(tree.props.style[1].height, 95);
  assert.equal(tree.props.children.props.style[1].paddingBottom, 15);
  assert.equal(bar.props.modifiers.some(mod => mod.name === 'height'), false);
  assert.equal(bar.props.containerColor, '#eee');
  assert.equal(tabs.length, 3); assert.deepEqual(tabs.map(item => item.props.selected), [false, true, false]);
  tabs[0].props.onClick(); assert.deepEqual(f.calls, ['admin-home']); assert.equal(nodes(tree, node => node.type === 'Icon' && node.props.source === 'filled/person_fill.xml').length, 1);
  f.keyboardListeners.get('keyboardDidShow')({ endCoordinates: { height: 300 } }); const hidden = f.render(); assert.equal(hidden.props.style[1].height, 0); assert.equal(hidden.props.style[1].transform[0].translateY, 205);
  f.r.unmount(); assert.equal(f.keyboardListeners.size, 0); const unresolved = nativeDock('android', { inset: null }); assert.equal(unresolved.render(), null); unresolved.r.unmount();
});
test('iOS owned dock preserves native buttons/selected semantics and measured source inset while UIKit system tabs are hidden', () => {
  const f = nativeDock('ios'), tree = f.render(); assert.equal(tree.type, 'Host'); assert.equal(tree.props.ignoreSafeArea, 'keyboard');
  const row = nodes(tree, node => node.type === 'HStack')[0]; assert.equal(row.props.modifiers.find(mod => mod.name === 'padding').args[0].bottom, 15);
  assert.equal(row.props.modifiers.find(mod => mod.name === 'background').args[0], '#fff');
  assert.equal(row.props.modifiers.find(mod => mod.name === 'frame').args[0].minHeight, 60); const buttons = nodes(tree, node => node.type === 'Button'); assert.equal(buttons.length, 3);
  assert.ok(buttons[1].props.modifiers.some(mod => mod.name === 'accessibilityAddTraits' && mod.args[0].includes('isSelected'))); buttons[2].props.onPress(); assert.deepEqual(f.calls, ['admin-activity']);
  f.r.unmount(); const unresolved = nativeDock('ios', { inset: null }); assert.equal(unresolved.render(), null); unresolved.r.unmount();
});
test('Brigader uses the same system dock surface as other roles', () => {
  const f = nativeDock('android', { role: 'brigader' });
  const bar = nodes(f.render(), node => node.type === 'NavigationBar')[0];
  assert.equal(bar.props.containerColor, '#eee');
  f.r.unmount();
});
