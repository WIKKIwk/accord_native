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
  const calls = [];
  let canGoBack = true;
  const router = { canGoBack: () => canGoBack, back: () => calls.push('back'), replace: value => calls.push(value) };
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
  });
  const root = PreparationPage({ title: 'Tayyorlov', root: true, drawer: true });
  const rootButtons = findAll(root, node => node.type === 'Pressable');
  assert.deepEqual(rootButtons.map(node => node.props.accessibilityLabel), ['Menyu']);
  rootButtons[0].props.onPress();
  const child = PreparationPage({ title: 'Ombor', drawer: true });
  const childButtons = findAll(child, node => node.type === 'Pressable');
  assert.deepEqual(childButtons.map(node => node.props.accessibilityLabel), ['Orqaga']);
  childButtons[0].props.onPress();
  canGoBack = false;
  childButtons[0].props.onPress();
  assert.deepEqual(calls, ['drawer', 'back', '/android-preparation']);
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
