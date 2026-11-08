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
function load(file, mocks = {}) {
  const filename = path.resolve(__dirname, '../src', file), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths;
  mod.require = id => id === 'react/jsx-runtime' ? jsx : Object.hasOwn(mocks, id) ? mocks[id] : id.startsWith('.') ? {} : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { fileName: filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText, filename);
  return mod.exports;
}
const routes = load('shared/appRoutes.ts');
const localization = load('shared/localization/index.ts', { './catalog.json': require('../src/shared/localization/catalog.json') });
const model = load('admin/adminHomeModel.ts', { '../shared/appRoutes': routes, '../shared/localization': localization });
const symbols = load('admin/adminHomeSymbols.ts');
const mods = new Proxy({}, { get: (_target, name) => (...args) => ({ name: String(name), args }) });
const swift = new Proxy({}, { get: (_target, name) => String(name) });
const react = { useEffect() {}, useRef: value => ({ current: value }), useState: value => [value, () => {}],
  useSyncExternalStore: (_subscribe, get) => get() };
const baseState = { loadingSummary: false, loadedSummary: true, summaryError: null };
const session = (role, capabilities) => ({ token: 'test', profile: { role, ref: 'test' }, capabilities });
function render(platform, account, state = baseState, navigation = 'menu') {
  const calls = [], opener = async () => {}, controller = { reload: async () => { calls.push('refresh'); },
    openAndReload: async (route, callback) => { assert.equal(callback, opener); calls.push(['open', route]); } };
  const native = { View: 'View', Text: 'NativeText', ScrollView: 'ScrollView', ActivityIndicator: 'ActivityIndicator', RefreshControl: 'RefreshControl',
    PlatformColor: value => value, StyleSheet: { create: value => value } };
  const leading = navigation === null ? null : { icon: navigation, label: 'Navigation', onPress: () => calls.push('navigation') };
  const mocks = { react, '@expo/ui': { ListItem: 'ListItem' }, '@expo/ui/swift-ui': swift, '@expo/ui/swift-ui/modifiers': mods,
    '@expo/ui/jetpack-compose': { useMaterialColors: () => ({ surfaceContainerLow: 'bg', surfaceContainerLowest: 'card', onSurface: 'text',
      onSurfaceVariant: 'secondary', primary: 'primary' }) }, 'expo-router': { Stack: { Screen: 'Stack.Screen' } },
    'expo-symbols': { SymbolView: 'SymbolView' }, 'react-native': native, 'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 24, bottom: 16 }) },
    '../components/BaseHost.ios': { BaseHost: 'BaseHost' }, '../components/WorkerQueueCard.android': { WorkerQueueCard: 'WorkerQueueCard' },
    '../shared/navigation/RoleHeaderButton': { RoleHeaderButton: 'RoleHeaderButton' }, '../shared/navigation/RoleHeader.android': { RoleHeader: 'RoleHeader' },
    '../shared/localization': localization, '../shared/localization/runtime': { localeController: { locale: 'en', addListener() {} } },
    './adminHomeModel': model, './adminHomeSymbols': symbols, './useAdminHome': { useAdminHome: () => ({ state, controller }) } };
  const Screen = load(`admin/AdminHomeScreen.${platform}.tsx`, mocks).AdminHomeScreen;
  return { tree: Screen({ session: account, store: {}, hub: {}, openRoute: opener, navigation: leading,
    footer: { type: 'ExistingDock', props: {} } }), calls };
}
const admin = session('admin', ['admin.access', 'party.supplier.read', 'production.map.manage']);
const sales = session('sales_manager', ['sales.access', 'production.order.create', 'production.order.edit', 'production.map.edit',
  'production.map.read', 'catalog.item.create', 'party.customer.read', 'party.customer.manage']);
const account = session('customer', ['catalog.item.read', 'catalog.item.create', 'gscale.print', 'rps.batch.manage']);
for (const platform of ['ios', 'android']) {
  const rowType = platform === 'ios' ? 'ListItem' : 'WorkerQueueCard';
  test(`${platform} home renders the four ordered summary shortcuts and reuses the supplied dock`, () => {
    const { tree, calls } = render(platform, admin), rows = nodes(tree, node => node.type === rowType);
    assert.equal(rows.length, 4); assert.equal(nodes(tree, node => node.type === 'ExistingDock').length, 1);
    assert.deepEqual(rows.map(row => nodes(row, n => (n.type === 'Text' || n.type === 'NativeText') && typeof n.props.children === 'string')[0].props.children),
      ['Factory map', 'Quick orders', 'Open order', 'Work map']);
    rows[0].props.onPress(); assert.deepEqual(calls, [['open', routes.appRoutes.adminFactoryMap]]);
  });
  test(`${platform} action rows preserve sales icon omission and permitted action order`, () => {
    const { tree, calls } = render(platform, sales), rows = nodes(tree, node => node.type === rowType);
    const expected = model.adminHomeActions(sales, 'en'); assert.equal(rows.length, expected.length); assert.ok(rows.length > 0);
    rows.forEach((row, index) => {
      if (platform === 'ios') assert.equal(row.props.leading, undefined);
      else assert.equal(nodes(row, n => n.type === 'SymbolView').length, 1);
      assert.equal(nodes(row, n => (n.type === 'Text' || n.type === 'NativeText') && typeof n.props.children === 'string')[0].props.children, expected[index].title);
    });
    rows[0].props.onPress(); assert.deepEqual(calls, [['open', expected[0].routeName]]);
    const other = render(platform, account).tree, otherRows = nodes(other, n => n.type === rowType);
    if (platform === 'ios') assert.ok(otherRows.every(row => row.props.leading?.type === 'SymbolView'));
    else assert.ok(otherRows.every(row => nodes(row, n => n.type === 'SymbolView').length === 2));
  });
  test(`${platform} home separates initial loading, error retry and pull refresh`, async () => {
    const loading = render(platform, admin, { ...baseState, loadingSummary: true, loadedSummary: false }).tree;
    assert.equal(nodes(loading, n => n.type === (platform === 'ios' ? 'ProgressView' : 'ActivityIndicator')).length, 1);
    assert.equal(nodes(loading, n => n.type === rowType).length, 0);
    const failure = render(platform, admin, { ...baseState, loadedSummary: false, summaryError: new Error('offline') });
    const retry = nodes(failure.tree, n => platform === 'ios' ? n.type === 'Button' : n.type === 'NativeText' && n.props.accessibilityRole === 'button')[0];
    retry.props.onPress(); assert.deepEqual(failure.calls, ['refresh']);
    const content = render(platform, admin);
    if (platform === 'ios') {
      const list = nodes(content.tree, n => n.type === 'List')[0]; await list.props.modifiers.find(m => m.name === 'refreshable').args[0]();
    } else {
      const list = nodes(content.tree, n => n.type === 'ScrollView')[0]; list.props.refreshControl.props.onRefresh();
    }
    assert.deepEqual(content.calls, ['refresh']);
  });
  test(`${platform} home delegates the leading control to the role shell`, () => {
    for (const icon of ['menu', 'back']) {
      const { tree, calls } = render(platform, admin, baseState, icon);
      const leading = platform === 'ios' ? nodes(tree, n => n.type === 'Stack.Screen')[0].props.options.headerLeft() :
        nodes(tree, n => n.type === 'RoleHeader')[0].props.navigation;
      assert.equal(platform === 'ios' ? leading.props.icon : leading.icon, icon);
      (platform === 'ios' ? leading.props.onPress : leading.onPress)(); assert.deepEqual(calls, ['navigation']);
    }
    const { tree } = render(platform, admin, baseState, null);
    assert.equal(platform === 'ios' ? nodes(tree, n => n.type === 'Stack.Screen')[0].props.options.headerLeft :
      nodes(tree, n => n.type === 'RoleHeader')[0].props.navigation, undefined);
  });
}
test('each V2 home action icon has an explicit native symbol and unknown names fail', () => {
  const allModel = load('admin/adminHomeModel.ts', { '../shared/appRoutes': { ...routes, canOpenRoute: () => true }, '../shared/localization': localization });
  const all = allModel.adminHomeActions(admin, 'en'); assert.equal(all.length, 23);
  for (const item of all) { const value = symbols.adminHomeSymbol(item.materialIcon); assert.ok(value.ios); assert.ok(value.android); }
  assert.throws(() => symbols.adminHomeSymbol('constructor'), /Unknown Admin home icon/);
});

test('home hook connects the supplied session-scoped store and shared refresh hub', async () => {
  let dependencies, started = 0, disposed = 0, cleanup;
  class Controller { constructor(value) { dependencies = value; } start() { started++; } dispose() { disposed++; } }
  const scoped = session('admin', ['admin.access', 'party.supplier.read']), store = { subscribe() {}, getSnapshot: () => baseState };
  const hub = { topic: '', version: 0, subscribe() {} }, originalFrame = global.requestAnimationFrame;
  let frame; global.requestAnimationFrame = callback => { frame = callback; return 1; };
  const hook = load('admin/useAdminHome.ts', { react: { useMemo: fn => fn(),
    useEffect: fn => { cleanup = fn(); }, useSyncExternalStore: (_subscribe, get) => get() },
    '../auth': { activeSessionToken: value => value === scoped ? 'token' : null }, '../sessionReadScope': { sessionReadScope: () => 'scope' },
    '../shared/appRoutes': { canOpenRoute: (_session, route) => route === '/allowed' }, './adminHomeController': { AdminHomeController: Controller },
    './adminHomeModel': { adminHomeCanLoadSummary: value => value.capabilities.includes('party.supplier.read') } });
  try {
    const result = hook.useAdminHome({ session: scoped, store, hub, openRoute: async () => {} });
    assert.equal(started, 1); assert.equal(dependencies.store, store); assert.equal(dependencies.hub, hub);
    assert.equal(dependencies.isCurrent(), true); assert.equal(dependencies.scope(), 'scope'); assert.equal(dependencies.canLoadSummary(), true);
    assert.equal(dependencies.canOpen('/allowed'), true); assert.equal(dependencies.canOpen('/held'), false);
    const pendingFrame = dependencies.afterFrame(); assert.equal(typeof frame, 'function'); frame(); await pendingFrame;
    assert.equal(result.state, baseState);
    cleanup(); assert.equal(disposed, 1);
  } finally { global.requestAnimationFrame = originalFrame; }
});
