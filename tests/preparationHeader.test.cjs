const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

const jsx = { Fragment: 'Fragment', jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
const react = { createContext: value => ({ value }), useContext: context => context.value, useCallback: fn => fn,
  useEffect() {}, useMemo: fn => fn(), useRef: value => ({ current: value }), useState: value => [value, () => {}],
  useSyncExternalStore: (_subscribe, getSnapshot) => getSnapshot() };

function load(file, mocks) {
  const filename = path.resolve(__dirname, '../src', file), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths;
  mod.require = id => id === 'react/jsx-runtime' ? jsx : id === 'react' ? react
    : Object.hasOwn(mocks, id) ? mocks[id] : id.startsWith('.') ? {} : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, filename);
  return mod.exports;
}

function findAll(node, predicate) {
  if (!node || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap(child => findAll(child, predicate));
  return [...(predicate(node) ? [node] : []), ...findAll(node.props?.children, predicate)];
}

test('iOS preparation headers choose a drawer or an icon-only native back button', () => {
  const layout = load('app/ios-preparation/(home)/_layout.tsx', {
    'expo-router': { Stack: 'Stack' },
    '../../../shared/navigation/RoleDrawerButton': { RoleDrawerButton: 'RoleDrawerButton' },
    '../../../preparation/PreparationUI': { usePreparationText: () => value => value },
  }).default();
  const options = layout.props.screenOptions;
  assert.equal(options.headerBackButtonDisplayMode, 'minimal');
  assert.equal(options.headerBackVisible, true);
  assert.equal(options.headerLeft({ canGoBack: true }), null);
  const drawer = options.headerLeft({ canGoBack: false });
  assert.equal(drawer.type, 'RoleDrawerButton');
  assert.equal(drawer.props.label, 'Tayyorlov bo‘limlari');
});

test('Android preparation headers show only the drawer at home and only back on child pages', () => {
  const calls = [], fabRegistrations = [];
  let canGoBack = true;
  const router = { canGoBack: () => canGoBack, back: () => calls.push('back'), replace: value => calls.push(value), navigate: value => calls.push(value) };
  const ui = new Proxy({}, { get: (_, key) => key === 'useMaterialColors' ? () => ({ surfaceContainerLow: 'surface' }) : key });
  const modifiers = new Proxy({}, { get: (_, key) => (...args) => ({ key, args }) });
  const { PreparationPage } = load('preparation/PreparationUI.android.tsx', {
    '@expo/ui/jetpack-compose': ui, '@expo/ui/jetpack-compose/modifiers': modifiers,
    'expo-router': { router }, 'expo-symbols': { SymbolView: 'SymbolView' },
    'react-native': { View: 'View', Pressable: 'Pressable', ScrollView: 'ScrollView', RefreshControl: 'RefreshControl' },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) },
    '../shared/localization': { uiText: value => value },
    '../shared/localization/runtime': { localeController: { locale: 'uz', addListener() {} } },
    '../shared/navigation/roleDrawerContext': { useRoleDrawer: () => ({ open: () => calls.push('drawer') }) },
    '../shared/navigation/RoleHeader.android': { RoleHeader: 'RoleHeader' },
    '../shared/navigation/RoleBottomBar.android': { RoleBottomBar: 'RoleBottomBar' },
    '../shared/navigation/RoleFab.android': { RoleFab: 'RoleFab' },
    './PreparationFab.android': { usePreparationFab: (scope, options) => { fabRegistrations.push({ scope, ...options }); return () => {}; } },
  });
  const root = PreparationPage({ title: 'Tayyorlov', root: true, drawer: true });
  const rootHeader = findAll(root, node => node.type === 'RoleHeader')[0];
  assert.equal(rootHeader.props.navigation.icon, 'menu');
  assert.equal(rootHeader.props.navigation.label, 'Menyu');
  rootHeader.props.navigation.onPress();
  const child = PreparationPage({ title: 'Ombor', drawer: true });
  const childHeader = findAll(child, node => node.type === 'RoleHeader')[0];
  assert.equal(childHeader.props.navigation.icon, 'back');
  assert.equal(childHeader.props.navigation.label, 'Orqaga');
  childHeader.props.navigation.onPress();
  canGoBack = false;
  childHeader.props.navigation.onPress();
  assert.deepEqual(calls, ['drawer', 'back', '/android-preparation']);
  const actions = [{ id: 'receive', label: 'Kirim', icon: 'add_circle', width: 164 }];
  const select = () => {};
  const withFab = PreparationPage({ title: 'Tayyorlov', root: true, drawer: true, fabActions: actions, onFabSelect: select });
  assert.equal(findAll(withFab, node => node.type === 'RoleFab').length, 0);
  assert.equal(fabRegistrations.at(-1).scope, 'home');
  assert.equal(fabRegistrations.at(-1).actions, actions);
  assert.equal(fabRegistrations.at(-1).onSelect, select);
});

test('Android preparation dock has home, chat and profile with role-scoped routes', () => {
  const calls = [];
  const ui = new Proxy({}, { get: (_, key) => key === 'useMaterialColors' ? () => ({}) : key });
  const { PreparationDock } = load('preparation/PreparationUI.android.tsx', {
    '@expo/ui/jetpack-compose': ui, '@expo/ui/jetpack-compose/modifiers': {},
    'expo-router': { router: { dismissTo: route => calls.push(['dismissTo', route]), navigate: route => calls.push(['navigate', route]) } },
    'react-native': {}, 'react-native-safe-area-context': { useSafeAreaInsets: () => ({ bottom: 24 }) },
    '../shared/localization': { uiText: value => value },
    '../shared/localization/runtime': { localeController: { locale: 'uz', addListener() {} } },
    '../shared/navigation/roleDrawerContext': {}, '../shared/navigation/RoleHeader.android': {}, '../shared/navigation/RoleFab.android': {},
    '../shared/navigation/RoleBottomBar.android': { RoleBottomBar: 'RoleBottomBar' },
  });
  const home = PreparationDock({});
  assert.equal(home.type, 'RoleBottomBar');
  assert.equal(home.props.active, 'home');
  assert.equal(home.props.bottomInset, 24);
  assert.deepEqual(home.props.items.map(item => item.label), ['Tayyorlov', 'Chat', 'Profil']);
  home.props.onSelect('home'); home.props.onSelect('chat'); home.props.onSelect('profile');
  assert.deepEqual(calls, [['dismissTo', '/android-preparation'], ['navigate', '/android-preparation/chat'], ['navigate', '/android-preparation/profile']]);
  const chat = PreparationDock({ chat: true });
  assert.equal(chat.props.active, 'chat');
  const before = calls.length;
  chat.props.onSelect('chat'); assert.equal(calls.length, before);
  chat.props.onSelect('home');
  assert.deepEqual(calls.at(-1), ['dismissTo', '/android-preparation']);
  assert.equal(PreparationDock({ profile: true }).props.active, 'profile');
});

test('Android preparation dock returns home from a child with Home selected and preserves the existing home route', () => {
  const { StackActions, StackRouter } = require('expo-router/build/react-navigation/routers/StackRouter');
  const routeNames = ['index', 'formula', 'chat', 'profile'];
  const options = { routeNames, routeParamList: {}, routeGetIdList: {} };
  const stack = StackRouter({ initialRouteName: 'index' });
  const home = { name: 'index', key: 'existing-preparation-home' };
  let state = { stale: false, type: 'stack', key: 'preparation-stack', index: 2, routeNames,
    routes: [home, { name: 'chat', key: 'chat' }, { name: 'profile', key: 'profile' }] };
  const router = { dismissTo: route => {
    assert.equal(route, '/android-preparation');
    const result = stack.getStateForAction(state, StackActions.popTo('index'), options);
    assert.ok(result?.state); state = result.state;
  } };
  const ui = new Proxy({}, { get: (_, key) => key === 'useMaterialColors' ? () => ({}) : key });
  const { PreparationDock } = load('preparation/PreparationUI.android.tsx', {
    '@expo/ui/jetpack-compose': ui, '@expo/ui/jetpack-compose/modifiers': {}, 'expo-router': { router },
    'react-native': {}, 'react-native-safe-area-context': { useSafeAreaInsets: () => ({ bottom: 0 }) },
    '../shared/localization': { uiText: value => value },
    '../shared/localization/runtime': { localeController: { locale: 'uz', addListener() {} } },
    '../shared/navigation/roleDrawerContext': {}, '../shared/navigation/RoleHeader.android': {}, '../shared/navigation/RoleFab.android': {},
    '../shared/navigation/RoleBottomBar.android': { RoleBottomBar: 'RoleBottomBar' },
  });
  PreparationDock({ profile: true }).props.onSelect('home');
  assert.equal(state.index, 0);
  assert.equal(state.routes[0], home);
  state = { ...state, index: 1, routes: [home, { name: 'formula', key: 'nested-formula' }] };
  PreparationDock({}).props.onSelect('home');
  assert.equal(state.index, 0); assert.deepEqual(state.routes, [home]); assert.equal(state.routes[0], home);
  PreparationDock({}).props.onSelect('home');
  assert.equal(state.routes.length, 1); assert.equal(state.routes[0], home);
  state = { ...state, index: 0, routes: [{ name: 'profile', key: 'direct-profile' }] };
  PreparationDock({ profile: true }).props.onSelect('home');
  assert.equal(state.routes[state.index].name, 'index');
  assert.notEqual(state.routes[state.index].key, 'direct-profile');
});

test('Android preparation profile goes back normally or returns home when opened directly', () => {
  const calls = [];
  let canGoBack = true;
  const router = { canGoBack: () => canGoBack, back: () => calls.push('back'),
    dismissTo: route => calls.push(['home', route]), replace: route => calls.push(['replace', route]) };
  const { PreparationProfileScreen } = load('preparation/PreparationProfile.android.tsx', {
    '@expo/ui/jetpack-compose': { useMaterialColors: () => ({}) }, 'expo-router': { router },
    'react-native': { View: 'View' }, 'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0 }) },
    '../components/ProfileScreen': { ProfileScreen: 'ProfileScreen' },
    './PreparationContext.android': { usePreparationContext: () => ({ session: {}, onLogout() {} }) },
    '../shared/navigation/RoleHeader.android': { RoleHeader: 'RoleHeader' },
    './PreparationUI.android': { PreparationDock: 'PreparationDock', usePreparationText: () => value => value },
  });
  const page = PreparationProfileScreen();
  const header = findAll(page, node => node.type === 'RoleHeader')[0];
  header.props.navigation.onPress();
  canGoBack = false; header.props.navigation.onPress();
  assert.deepEqual(calls, ['back', ['home', '/android-preparation']]);
});

test('iOS scale uses an icon-only back button for the preparation role', () => {
  for (const role of ['tayyorlov_masteri', 'aparatchi']) {
    const session = { profile: { role }, imageCacheScope: 'scope' };
    const ui = new Proxy({}, { get: (_, key) => key });
    const mods = new Proxy({}, { get: (_, key) => (...args) => ({ key, args }) });
    const { GScaleScreen } = load('gscale/GScaleScreen.ios.tsx', {
      '@expo/ui/swift-ui': ui, '@expo/ui/swift-ui/modifiers': mods, 'expo-image': { Image: 'Image' },
      'expo-router': { router: { canGoBack: () => true }, Stack: { Screen: 'Stack.Screen' } },
      'expo-symbols': { SymbolView: 'SymbolView' }, 'qrcode-generator': {},
      'react-native': { Platform: { OS: 'ios' }, View: 'View' },
      '../components/WorkerSecurity': { WorkerSecurityProvider: 'WorkerSecurityProvider' },
      '../nativeSheet': { useNativeSheet: () => ({ open() {}, close() {} }) },
      '../shared/appRoutes': { appRoutes: {}, canOpenRoute: () => true },
      './gscaleScreenModel': { gscaleDashboardSections: () => [] },
      './useGScaleScreen': { useGScaleSession: () => ({ session, signOut() {} }),
        useGScaleScreen: () => ({ controlOnly: false, state: { device: { selection: null } }, operator: {} }),
        useGScaleText: () => value => value },
    });
    const dashboard = GScaleScreen({ args: {} }).props.children;
    const screen = findAll(dashboard.type(dashboard.props), node => node.type === 'Stack.Screen')[0];
    assert.equal(screen.props.options.headerBackButtonDisplayMode, role === 'tayyorlov_masteri' ? 'minimal' : undefined);
  }
});
