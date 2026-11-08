const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const jsx = { Fragment: 'Fragment', jsx: (type, props, key) => ({ type, props, key }), jsxs: (type, props, key) => ({ type, props, key }) };
function load(relative, mocks = {}, ext = '.ts') {
  const filename = path.resolve(__dirname, `../src/${relative}${ext}`), loaded = new Module(filename, module);
  loaded.filename = filename; loaded.paths = module.paths;
  loaded.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, filename);
  return loaded.exports;
}
function nodes(node, type) {
  if (!node || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap(value => nodes(value, type));
  return [...(node.type === type ? [node] : []), ...nodes(node.props?.children, type)];
}
const routes = load('shared/appRoutes');
const material = caps => ({ token: 'token', imageCacheScope: 'scope', profile: { role: 'material_taminotchi', ref: 'one' }, capabilities: caps });
function setup(platform, initial) {
  const state = { session: initial }, NativeTabs = Object.assign('NativeTabs', { Trigger: Object.assign('Trigger', { Icon: 'Icon', Label: 'Label' }) });
  const mocks = { 'react/jsx-runtime': jsx, react: { useSyncExternalStore: (_s, read) => read() },
    '@expo/ui/jetpack-compose': { useMaterialColors: () => ({}) },
    'expo-router': { Redirect: 'Redirect', Stack: 'Stack', router: { navigate() {} }, usePathname: () => `/${platform}-material` },
    'expo-router/native-tabs': { NativeTabs },
    'react-native': { ActivityIndicator: 'ActivityIndicator', Platform: { OS: platform }, Text: 'Text', View: 'View' },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ bottom: 0 }) },
    '../components/WorkerSecurity': { WorkerSecurityProvider: 'WorkerSecurityProvider' },
    '../shared/appRoutes': routes, '../shared/localization': { localizedGetter: key => key },
    '../shared/localization/runtime': { localeController: { locale: 'uz', addListener: () => () => {} } },
    '../shared/navigation/RoleBottomBar.android': { RoleBottomBar: 'RoleBottomBar' },
    './MaterialContext': { MaterialProvider: 'MaterialProvider' }, './MaterialDrawer': { MaterialDrawer: 'MaterialDrawer' },
    './materialTestSession': load('material/materialTestSession'), './MaterialTestNotice': { MaterialTestNotice: 'MaterialTestNotice' },
    './useMaterialSession': { useMaterialSession: () => ({ session: state.session, witness: {}, onLogout() {} }) } };
  const module = load(`material/MaterialLayout.${platform}`, mocks, '.tsx'); return { state, render: () => module.MaterialLayout() };
}

for (const platform of ['ios', 'android']) {
  test(`${platform} reserved test token shows a stable warning instead of role screens or a redirect`, () => {
    const h = setup(platform, { ...material(['raw_material.assign']), token: 'test-mode-token' }), tree = h.render();
    assert.equal(nodes(tree, 'MaterialTestNotice').length, 1); assert.equal(nodes(tree, 'Redirect').length, 0);
    assert.equal(nodes(tree, 'MaterialProvider').length, 0); assert.equal(nodes(tree, 'WorkerSecurityProvider').length, 0);
  });
  test(`${platform} Material layout blocks unauthenticated, other-role and missing-capability deep links`, () => {
    const h = setup(platform, undefined); assert.equal(nodes(h.render(), 'ActivityIndicator').length, 1);
    h.state.session = null; assert.equal(nodes(h.render(), 'Redirect')[0].props.href, '/');
    h.state.session = { ...material(['raw_material.assign']), profile: { role: 'aparatchi', ref: 'one' } };
    assert.equal(nodes(h.render(), 'Redirect')[0].props.href, '/');
    h.state.session = material([]); assert.equal(nodes(h.render(), 'Text')[0].props.children, 'accessDenied');
    h.state.session = { ...material(['raw_material.assign']), token: '' }; assert.equal(nodes(h.render(), 'Text')[0].props.children, 'accessDenied');
    // V2 routes inventory-only to Material home but canOpenRoute denies it; preserve that discrepancy.
    h.state.session = material(['inventory.movement.manage']); assert.equal(nodes(h.render(), 'Text')[0].props.children, 'accessDenied');
    h.state.session = material(['raw_material.assign']);
    const valid = h.render(); assert.equal(nodes(valid, 'Redirect').length, 0); assert.equal(nodes(valid, 'WorkerSecurityProvider').length, 1);
    assert.equal(nodes(valid, 'MaterialProvider').length, 1); assert.equal(nodes(valid, 'MaterialDrawer').length, 1);
  });
}

test('both Material Profile wrappers reuse ProfileScreen without a daily-work callback', () => {
  for (const platform of ['ios', 'android']) {
    const session = material(['raw_material.assign']), logout = () => {};
    const mocks = { 'react/jsx-runtime': jsx, 'react-native': { View: 'View', PlatformColor: () => 'color' },
      'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView', useSafeAreaInsets: () => ({ top: 0 }) },
      '@expo/ui/jetpack-compose': { useMaterialColors: () => ({}) }, 'expo-router': { router: { canGoBack: () => true, back() {}, navigate() {} } },
      '../components/ProfileScreen': { ProfileScreen: 'ProfileScreen' }, '../shared/navigation/RoleHeader.android': { RoleHeader: 'RoleHeader' },
      './MaterialContext': { useMaterialContext: () => ({ session, onLogout: logout }) } };
    const screen = load(`material/MaterialProfile.${platform}`, mocks, '.tsx').MaterialProfile();
    const profile = nodes(screen, 'ProfileScreen')[0]; assert.ok(profile); assert.equal(profile.props.session, session);
    assert.equal(profile.props.onLogout, logout); assert.equal(profile.props.onDailyWork, undefined);
  }
});
