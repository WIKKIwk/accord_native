const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const jsx = { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
function load(relative, mocks = {}) {
  const filename = path.resolve(__dirname, `../src/${relative}`), loaded = new Module(filename, module);
  loaded.filename = filename; loaded.paths = module.paths;
  loaded.require = id => id === 'react/jsx-runtime' ? jsx : Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, filename);
  return loaded.exports;
}

test('iOS Profile stack uses the localized title and the existing actionable drawer button', () => {
  let opens = 0;
  const { RoleDrawerButton } = load('shared/navigation/RoleDrawerButton.ios.tsx', {
    '@expo/ui/swift-ui': { Button: 'Button', Host: 'Host' }, '@expo/ui/swift-ui/modifiers': { labelStyle: () => ({}) },
    './roleDrawerContext': { useRoleDrawer: () => ({ open: () => { opens++; } }) },
  });
  const Layout = load('held-routes/ios-boyoqchi/(tabs)/profile/_layout.ios.tsx', {
    'expo-router': { Stack: 'Stack' }, '../../../../shared/navigation/RoleDrawerButton': { RoleDrawerButton },
    '../../../../boyoqchi/BoyoqchiProfileSettings.ios': { BoyoqchiProfileSettingsProvider: 'SettingsProvider', BoyoqchiProfileSettingsButton: 'SettingsButton' },
    '../../../../boyoqchi/useBoyoqchiText': { useBoyoqchiGetter: () => key => key === 'profileTitle' ? 'Profil' : key,
      useBoyoqchiText: () => value => value },
  }).default;
  const provider = Layout(), stack = provider.props.children;
  assert.equal(provider.type, 'SettingsProvider');
  assert.equal(stack.props.screenOptions.headerRight().type, 'SettingsButton');
  assert.equal(stack.props.screenOptions.title, 'Profil');
  const button = stack.props.screenOptions.headerLeft();
  assert.equal(button.type, RoleDrawerButton);
  const host = button.type(button.props), nativeButton = host.props.children;
  assert.equal(nativeButton.props.label, 'Bo‘yoqchi bo‘limlari');
  nativeButton.props.onPress(); assert.equal(opens, 1);
});

test('iOS Profile drawer closes the current item and routes other destinations', () => {
  const routes = [], state = { closed: 0 };
  const { selectRoleDrawerItem } = load('shared/navigation/roleDrawerModel.ts');
  const Drawer = load('boyoqchi/BoyoqchiDrawer.tsx', {
    'expo-router': { router: { navigate: href => routes.push(href) }, usePathname: () => '/ios-boyoqchi/profile' },
    'react-native': { Platform: { OS: 'ios' } }, '../shared/navigation/RoleDrawer': { RoleDrawer: 'RoleDrawer' },
    '../shared/navigation/roleDrawerContext': { useRoleDrawerState: () => ({ onOpen() {}, onClose: () => { state.closed++; } }) },
    '../shared/navigation/roleDrawerLogout': { confirmRoleDrawerLogout() {} },
    './BoyoqchiContext': { useBoyoqchiContext: () => ({ onLogout() {}, profileNavigation: { current: null } }) },
    './useBoyoqchiText': { useBoyoqchiGetter: () => key => key, useBoyoqchiText: () => key => key },
    './boyoqchiDockScheduler': { queueBoyoqchiDockNavigation() {} },
  }).BoyoqchiDrawer;
  const props = Drawer({ children: null }).props;
  selectRoleDrawerItem(props.items.find(item => item.id === 'profile'), props);
  assert.deepEqual(routes, []);
  selectRoleDrawerItem(props.items.find(item => item.id === 'astatka'), props);
  assert.deepEqual(routes, ['/ios-boyoqchi/astatka']); assert.equal(state.closed, 2);
});
