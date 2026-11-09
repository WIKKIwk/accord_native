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
const localization = load('shared/localization/index.ts', { './catalog.json': require('../src/shared/localization/catalog.json') });
const dart = load('admin/dartJsonString.ts');
const model = load('admin/factoryLocationScreenModel.ts', { '../shared/localization': localization, './dartJsonString': dart });
const a = { id: 'apparatus:default:a', name: 'Print A', sort_order: 1 }, b = { id: 'apparatus:default:b', name: 'Print B', sort_order: 2 };
const location = { id: 'state-a', name: 'State A', active: true, apparatus: [a, b], created_at_unix: 0, updated_at_unix: 0 };
const other = { ...location, id: 'state-b', name: 'State B', active: false, apparatus: [] };
const state = { status: 'ready', saving: false, locations: [location, other], apparatus: [a, b], notice: null };
// These English values were inspected directly in f119 Dart source; the separate Flutter probe did not run.
test('screen text maps to source-audited localization keys, and server errors remain unchanged', () => {
  const text = model.factoryLocationScreenText('en');
  assert.equal(text.loadError, 'Could not load factory states'); assert.equal(text.actions, 'Factory state actions');
  assert.equal(text.edit, 'Edit equipment'); assert.equal(text.rename, 'Rename'); assert.equal(text.deactivate, 'Deactivate');
  assert.equal(text.empty, 'No factory states have been created yet'); assert.equal(text.equipment, 'Equipment state');
  assert.equal(text.ordinary, 'Standard state'); assert.equal(text.inactive, 'Inactive');
  for (const locale of ['uz', 'en', 'ru', 'ur']) {
    const value = model.factoryLocationScreenText(locale);
    assert.equal(value.title, localization.localizedGetter('adminFactoryStatesNavTitle', locale));
    assert.equal(value.retry, localization.localizedGetter('retry', locale));
    assert.equal(value.create, localization.adminText('factory.state_create', locale));
    assert.equal(value.activate, localization.adminText('action.activate', locale));
    assert.equal(model.factoryLocationNoticeText({ source: 'localization', key: 'factory.state_status_failed', serial: 1 }, locale),
      localization.adminText('factory.state_status_failed', locale));
    assert.equal(model.factoryLocationNoticeText({ source: 'server', message: 'unchanged', serial: 1 }, locale), 'unchanged');
  }
});
test('apparatus labels follow directly inspected V2 trim, duplicate and missing-name rules', () => {
  const catalog = [{ id: ' apparatus:default:a ', name: ' First ' }, { id: a.id, name: '\u0085Final\u0085' },
    { id: b.id, name: '  ' }, { id: '', name: 'ignored' }];
  const ids = [' apparatus:default:a ', b.id, '\u0085missing\u0085', ''].map(id => ({ id }));
  assert.equal(model.factoryLocationApparatusLabels({ ...location, apparatus: ids }, catalog), 'Final, apparatus:default:b, missing, ');
  assert.equal(model.factoryLocationApparatusLabels(other, catalog), '');
});
const mods = new Proxy({}, { get: (_target, name) => (...args) => ({ name: String(name), args }) });
const swift = new Proxy({}, { get: (_target, name) => String(name) });
const react = { useEffect() {}, useRef: value => ({ current: value }), useState: value => [value, () => {}],
  useSyncExternalStore: (_subscribe, get) => get() };
const DropdownMenu = Object.assign(() => {}, { Trigger: 'DropdownMenu.Trigger', Items: 'DropdownMenu.Items' });
const DropdownMenuItem = Object.assign(() => {}, { Text: 'DropdownMenuItem.Text' });
function render(platform, changes = {}, ticket = { owner: Symbol('ticket') }) {
  const calls = [], snapshot = { ...state, ...changes }, controller = {
    beginEditor(id) { calls.push(['begin', id]); return ticket; }, load: async () => { calls.push('load'); },
    setActive: async (id, value) => { calls.push(['active', id, value]); } };
  const native = { View: 'View', Text: 'NativeText', FlatList: 'FlatList', Pressable: 'Pressable', RefreshControl: 'RefreshControl',
    ActivityIndicator: 'ActivityIndicator', PlatformColor: color => color, StyleSheet: { create: value => value } };
  const colors = { surface: 'surface', surfaceContainerLow: 'low', surfaceContainerLowest: 'card', surfaceContainerHighest: 'high',
    primary: 'primary', primaryContainer: 'primaryContainer', errorContainer: 'error', onErrorContainer: 'onError', onSurface: 'text', onSurfaceVariant: 'variant' };
  const mocks = { react, '@expo/ui/swift-ui': swift, '@expo/ui/swift-ui/modifiers': mods, '@expo/ui/jetpack-compose/modifiers': mods,
    '@expo/ui/jetpack-compose': { DropdownMenu, DropdownMenuItem, IconButton: 'IconButton', RNHostView: 'RNHostView', SnackbarHost: 'SnackbarHost',
      Text: 'ComposeText', useMaterialColors: () => colors }, 'expo-router': { Stack: { Screen: 'Stack.Screen' } },
    'expo-symbols': { SymbolView: 'SymbolView' }, 'react-native': native, 'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 24, bottom: 16 }) },
    '../components/BaseHost.ios': { BaseHost: 'BaseHost' }, '../components/BaseHost.android': { BaseHost: 'BaseHost' },
    '../components/useBaseTheme': { useBaseTheme: () => ({ colors }) }, '../components/WorkerQueueCard.android': { WorkerQueueCard: 'WorkerQueueCard' },
    '../components/WorkerSheetButton': { WorkerSheetButton: 'WorkerSheetButton' }, '../shared/navigation/RoleHeaderButton': { RoleHeaderButton: 'RoleHeaderButton' },
    '../shared/navigation/RoleHeader.android': { RoleHeader: 'RoleHeader' }, '../shared/localization/runtime': { localeController: { locale: 'en', addListener() {} } },
    './factoryLocationScreenModel': model, './useFactoryLocationScreen': { useFactoryLocationScreen: () => snapshot } };
  const Screen = load(`admin/FactoryLocationScreen.${platform}.tsx`, mocks).FactoryLocationScreen;
  const props = { controller, navigation: { icon: 'back', label: 'Back', onPress: () => calls.push('nav') }, footer: { type: 'ExistingDock', props: {} },
    onOpenEditor: value => calls.push(['edit', value]), onOpenRename: value => calls.push(['rename', value]) };
  return { tree: Screen(props), calls, snapshot, controller, ticket };
}
for (const platform of ['ios', 'android']) {
  test(`${platform} shows loading/error/empty and exposes the real header create callback`, () => {
    for (const status of ['loading', 'error', 'ready']) {
      const r = render(platform, { status, locations: [] });
      const header = platform === 'ios' ? nodes(r.tree, n => n.type === 'Stack.Screen')[0].props.options.headerRight() :
        nodes(r.tree, n => n.type === 'Pressable' && n.props.accessibilityLabel === model.factoryLocationScreenText('en').create)[0];
      assert.equal(header.props.disabled, false); header.props.onPress(); assert.deepEqual(r.calls, [['begin', null], ['edit', r.ticket]]);
      assert.equal(nodes(r.tree, n => n.type === 'ExistingDock').length, 1);
      if (status === 'loading') assert.equal(nodes(r.tree, n => n.type === (platform === 'ios' ? 'ProgressView' : 'ActivityIndicator')).length, 1);
      if (status === 'error') {
        const retry = nodes(r.tree, n => platform === 'ios' ? n.type === 'Button' && n.props.label === model.factoryLocationScreenText('en').retry :
          n.type === 'NativeText' && n.props.accessibilityRole === 'button')[0]; retry.props.onPress(); assert.equal(r.calls.at(-1), 'load');
      }
      if (status === 'ready' && platform === 'ios') assert.ok(nodes(r.tree, n => n.type === 'Text' && n.props.children === model.factoryLocationScreenText('en').empty).length);
      if (status === 'ready' && platform === 'android') assert.ok(nodes(r.tree, n => n.type === 'FlatList')[0].props.ListEmptyComponent);
    }
    for (const changes of [{ saving: true }, { status: 'forbidden' }]) {
      const r = render(platform, changes), header = platform === 'ios' ? nodes(r.tree, n => n.type === 'Stack.Screen')[0].props.options.headerRight() :
        nodes(r.tree, n => n.type === 'Pressable' && n.props.accessibilityLabel === model.factoryLocationScreenText('en').create)[0];
      assert.equal(header.props.disabled, true);
    }
    const noTicket = render(platform, {}, null), header = platform === 'ios' ? nodes(noTicket.tree, n => n.type === 'Stack.Screen')[0].props.options.headerRight() :
      nodes(noTicket.tree, n => n.type === 'Pressable' && n.props.accessibilityLabel === model.factoryLocationScreenText('en').create)[0];
    header.props.onPress(); assert.deepEqual(noTicket.calls, [['begin', null]]);
  });
  test(`${platform} delegates row edit, rename and active change without a duplicate navigation`, () => {
    const r = render(platform), originalFrame = global.requestAnimationFrame; global.requestAnimationFrame = callback => { callback(); return 1; };
    try {
      let row;
      if (platform === 'ios') {
        const element = nodes(r.tree, n => typeof n.type === 'function' && n.type.name === 'LocationRow')[0]; row = element.type(element.props);
        const buttons = nodes(row, n => n.type === 'Button'); buttons.find(n => !n.props.label).props.onPress();
        buttons.find(n => n.props.label === model.factoryLocationScreenText('en').rename).props.onPress();
        buttons.find(n => n.props.label === model.factoryLocationScreenText('en').deactivate).props.onPress();
        assert.ok(nodes(row, n => n.type === 'Text' && n.props.children === 'Print A, Print B').length);
        assert.ok(nodes(row, n => n.type === 'Text' && n.props.children === location.id && n.props.modifiers.some(m => m.name === 'textSelection')).length);
      } else {
        const list = nodes(r.tree, n => n.type === 'FlatList')[0], element = list.props.renderItem({ item: location, index: 0 }); row = element.type(element.props);
        assert.equal(row.type, 'WorkerQueueCard'); assert.equal(row.props.onPress, undefined);
        nodes(row, n => n.type === 'Pressable')[0].props.onPress();
        const options = nodes(row, n => n.type === DropdownMenuItem);
        options[1].props.onClick(); options[2].props.onClick();
        assert.ok(nodes(row, n => n.type === 'NativeText' && n.props.children === 'Print A, Print B').length);
        assert.ok(nodes(row, n => n.type === 'NativeText' && n.props.children === location.id && n.props.selectable).length);
      }
      assert.deepEqual(r.calls, [['begin', location.id], ['edit', r.ticket], ['begin', location.id], ['rename', r.ticket], ['active', location.id, false]]);
    } finally { global.requestAnimationFrame = originalFrame; }
  });
  test(`${platform} refresh, disabled rows and inactive status remain wired to the controller`, async () => {
    const r = render(platform, { saving: true });
    if (platform === 'ios') {
      await nodes(r.tree, n => n.type === 'List')[0].props.modifiers.find(m => m.name === 'refreshable').args[0]();
      const e = nodes(r.tree, n => typeof n.type === 'function' && n.type.name === 'LocationRow')[1], row = e.type(e.props);
      assert.ok(nodes(row, n => n.type === 'Text' && n.props.children === 'Inactive').length);
      assert.ok(nodes(row, n => n.type === 'Menu')[0].props.modifiers.some(m => m.name === 'disabled' && m.args[0]));
      nodes(row, n => n.type === 'Button' && n.props.label === 'Activate')[0].props.onPress();
    } else {
      const list = nodes(r.tree, n => n.type === 'FlatList')[0]; list.props.refreshControl.props.onRefresh();
      const e = list.props.renderItem({ item: other, index: 1 }), row = e.type(e.props);
      assert.ok(nodes(row, n => n.type === 'NativeText' && n.props.children === 'Inactive').length);
      assert.equal(nodes(row, n => n.type === 'Pressable')[0].props.disabled, true); assert.equal(nodes(row, n => n.type === 'IconButton')[0].props.enabled, false);
      const old = global.requestAnimationFrame; global.requestAnimationFrame = callback => { callback(); return 1; };
      try { nodes(row, n => n.type === DropdownMenuItem)[2].props.onClick(); } finally { global.requestAnimationFrame = old; }
    }
    assert.deepEqual(r.calls, ['load', ['active', other.id, true]]);
  });
}
test('screen hook starts and disposes its provided controller and dismisses only the matching notice serial', () => {
  const callbacks = [], events = [], oldSetTimeout = global.setTimeout, oldClearTimeout = global.clearTimeout;
  let timer, duration;
  global.setTimeout = (callback, ms) => { timer = callback; duration = ms; return 7; };
  global.clearTimeout = id => { events.push(['clear', id]); };
  try {
    const controller = { subscribe() {}, getSnapshot: () => ({ notice: { serial: 42 } }), start: () => events.push('start'),
      dispose: () => events.push('dispose'), dismissNotice: serial => events.push(['dismiss', serial]) };
    const hook = load('admin/useFactoryLocationScreen.ts', { react: { useSyncExternalStore: (_s, get) => get(), useEffect: callback => callbacks.push(callback) } });
    assert.equal(hook.useFactoryLocationScreen({ controller }).notice.serial, 42);
    const cleanStart = callbacks[0](), cleanTimer = callbacks[1](); assert.equal(duration, 4000); timer(); cleanTimer(); cleanStart();
    assert.deepEqual(events, ['start', ['dismiss', 42], ['clear', 7], 'dispose']);
  } finally { global.setTimeout = oldSetTimeout; global.clearTimeout = oldClearTimeout; }
});
