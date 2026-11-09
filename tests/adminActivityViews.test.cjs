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
const l10n = load('shared/localization/index.ts', { './catalog.json': require('../src/shared/localization/catalog.json') });
const model = load('admin/adminActivityModel.ts', { '../shared/localization': l10n });
const symbols = load('admin/adminActivitySymbols.ts');
const dart = load('admin/dartJsonString.ts');
const screenModel = load('admin/adminActivityScreenModel.ts', { './adminActivityModel': model, './adminActivitySymbols': symbols, './dartJsonString': dart });
const colors = { surfaceContainerLow: 'low', surfaceContainerLowest: 'lowest', surfaceContainerHighest: 'highest', onSurface: 'on', onSurfaceVariant: 'variant', primary: 'primary' };
const item = { id: 'first', supplier_name: 'Alpha', created_label: '10:30', sent_qty: 12.5, accepted_qty: 2.5, uom: 'kg', status: 'accepted' };
const other = { ...item, id: 'hidden', supplier_name: 'Hidden' }, last = { ...item, id: 'last', supplier_name: 'Last', created_label: '\u0085', status: 'cancelled', accepted_qty: 0 };
const initial = { loadingActivity: false, loadedActivity: true, activityError: null, activityItems: [item, other, last] };
function render(platform, changes = {}, hidden = new Set(['hidden']), nav = true, locale = 'en') {
  const calls = [], modifiers = new Proxy({}, { get: (_t, key) => (...args) => ({ name: String(key), args }) });
  const swift = new Proxy({}, { get: (_t, key) => String(key) });
  const native = { View: 'View', Text: 'NativeText', Pressable: 'Pressable', ActivityIndicator: 'ActivityIndicator', FlatList: 'FlatList',
    RefreshControl: 'RefreshControl', PlatformColor: value => value, StyleSheet: { create: value => value } };
  const mocks = { react: { useSyncExternalStore: (_subscribe, get) => get() }, '@expo/ui/swift-ui': swift,
    '@expo/ui/swift-ui/modifiers': modifiers, '@expo/ui/jetpack-compose': { useMaterialColors: () => colors },
    'react-native': native, 'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 24, bottom: 16 }) },
    'expo-router': { Stack: { Screen: 'Stack.Screen' } }, 'expo-symbols': { SymbolView: 'SymbolView' },
    '../components/BaseHost.ios': { BaseHost: 'BaseHost' }, '../components/useBaseTheme': { useBaseTheme: () => ({ colors }) },
    '../components/WorkerQueueCard.android': { WorkerQueueCard: 'WorkerQueueCard' }, '../shared/localization': l10n,
    '../shared/localization/runtime': { localeController: { locale, addListener() {} } },
    '../shared/navigation/RoleHeaderButton': { RoleHeaderButton: 'RoleHeaderButton' }, '../shared/navigation/RoleHeader.android': { RoleHeader: 'RoleHeader' },
    './adminActivityScreenModel': screenModel };
  const screen = load(`admin/AdminActivityScreen.${platform}.tsx`, mocks).AdminActivityScreen;
  const navigation = nav ? { icon: 'back', label: 'Back', onPress: () => calls.push('back') } : null;
  const props = { snapshot: { ...initial, ...changes }, hiddenIds: hidden, navigation, footer: { type: 'ExistingDock', props: {} },
    onRefresh: async () => { calls.push('refresh'); }, onRequestClear: () => { calls.push('request-confirmation'); } };
  return { tree: screen(props), calls, props };
}
test('status icons use finite native symbols for every V2 status', () => {
  assert.deepEqual(['draft', 'pending', 'accepted', 'partial', 'rejected', 'cancelled'].map(status => symbols.adminActivitySymbol(status).android),
    ['schedule', 'schedule', 'done_all', 'check', 'close', 'remove']);
});
for (const platform of ['ios', 'android']) {
  test(`${platform} activity delegates real back and clear confirmation and reuses supplied dock`, () => {
    const { tree, calls } = render(platform);
    assert.equal(nodes(tree, n => n.type === 'ExistingDock').length, 1);
    const screen = nodes(tree, n => n.type === 'Stack.Screen')[0];
    const navigation = platform === 'ios' ? screen.props.options.headerLeft().props : nodes(tree, n => n.type === 'RoleHeader')[0].props.navigation;
    assert.equal(navigation.icon, 'back'); navigation.onPress();
    const clear = platform === 'ios' ? screen.props.options.headerRight() : nodes(tree, n => n.type === 'Pressable')[0];
    assert.equal(clear.props.accessibilityLabel, l10n.localizedGetter('clearTitle', 'en')); clear.props.onPress();
    assert.deepEqual(calls, ['back', 'request-confirmation']);
    const noNav = render(platform, {}, new Set(), false).tree;
    assert.equal(platform === 'ios' ? nodes(noNav, n => n.type === 'Stack.Screen')[0].props.options.headerLeft :
      nodes(noNav, n => n.type === 'RoleHeader')[0].props.navigation, undefined);
  });
  test(`${platform} only initial loading/error with no visible rows replaces the list`, () => {
    const hiddenAll = new Set(['first', 'hidden', 'last']);
    const loading = render(platform, { loadingActivity: true, loadedActivity: false }, hiddenAll).tree;
    assert.equal(nodes(loading, n => n.type === (platform === 'ios' ? 'ProgressView' : 'ActivityIndicator')).length, 1);
    const failed = render(platform, { loadedActivity: false, activityError: new Error('offline') }, hiddenAll);
    const retry = nodes(failed.tree, n => platform === 'ios' ? n.type === 'Button' && n.props.label === l10n.localizedGetter('retry', 'en') :
      n.type === 'NativeText' && n.props.accessibilityRole === 'button')[0];
    retry.props.onPress(); assert.deepEqual(failed.calls, ['refresh']);
    const loadedEmpty = render(platform, { activityItems: [] }, new Set()).tree;
    assert.equal(nodes(loadedEmpty, n => n.props?.children === l10n.localizedGetter('adminNoActivity', 'en')).length, 1);
    const laterError = render(platform, { activityError: new Error('later failure') }).tree;
    assert.equal(nodes(laterError, n => n.type === (platform === 'ios' ? 'List' : 'FlatList')).length, 1);
  });
  test(`${platform} visible rows keep source order and no fake row action; refresh is delegated`, async () => {
    const { tree, calls } = render(platform, { loadingActivity: true }); let entries;
    if (platform === 'ios') {
      const list = nodes(tree, n => n.type === 'List')[0];
      await list.props.modifiers.find(m => m.name === 'refreshable').args[0]();
      entries = nodes(list, n => typeof n.type === 'function' && n.type.name === 'ActivityRow');
    } else {
      const list = nodes(tree, n => n.type === 'FlatList')[0];
      assert.equal(list.props.refreshControl.props.refreshing, true); list.props.refreshControl.props.onRefresh();
      entries = list.props.data.map((value, index) => list.props.renderItem({ item: value, index }));
      assert.equal(entries[0].props.first, true); assert.equal(entries[1].props.last, true);
    }
    assert.deepEqual(entries.map(e => e.props.row.id), ['first', 'last']);
    const first = entries[0].type(entries[0].props), second = entries[1].type(entries[1].props);
    assert.ok(nodes(first, n => n.props?.children === 'Alpha').length);
    assert.ok(nodes(first, n => n.props?.children === '13 kg sent • 3 kg accepted').length);
    assert.ok(nodes(first, n => n.props?.children === '10:30').length);
    assert.ok(!nodes(second, n => n.props?.children === '\u0085').length);
    assert.equal(nodes(first, n => n.type === 'Pressable').length, 0);
    if (platform === 'android') assert.equal(first.props.onPress, undefined);
    assert.deepEqual(calls, ['refresh']);
  });
  test(`${platform} localized labels and metric rendering use the shared catalog`, () => {
    for (const locale of ['uz', 'en', 'ru', 'ur']) {
      const { tree } = render(platform, {}, new Set(), true, locale);
      const label = platform === 'ios' ? nodes(tree, n => n.type === 'Stack.Screen')[0].props.options.title :
        nodes(tree, n => n.type === 'RoleHeader')[0].props.title;
      assert.equal(label, l10n.localizedGetter('adminActivityTitle', locale));
      const list = platform === 'android' ? nodes(tree, n => n.type === 'FlatList')[0] : null;
      const element = platform === 'ios' ? nodes(tree, n => typeof n.type === 'function' && n.type.name === 'ActivityRow')[0] :
        list.props.renderItem({ item: list.props.data[0], index: 0 });
      const row = element.type(element.props);
      assert.ok(nodes(row, n => n.props?.children === model.adminActivityMetricLine(item, locale)).length);
    }
  });
}
