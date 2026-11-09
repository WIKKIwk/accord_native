const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const jsx = { Fragment: 'Fragment', jsx: (type, props, key) => ({ type, props, key }), jsxs: (type, props, key) => ({ type, props, key }) };
function load(file, mocks = {}) {
  const filename = path.resolve(__dirname, '../src', file), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths;
  mod.require = id => id === 'react/jsx-runtime' ? jsx : Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { fileName: filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, filename);
  return mod.exports;
}
const nodes = tree => tree && typeof tree === 'object' ? [tree, ...[tree.props?.children].flat(Infinity).flatMap(nodes)] : [];
for (const platform of ['ios', 'android']) test(`${platform} unconnected Closed row renders source expansion states and forwards exact log`, () => {
  const native = platform === 'ios' ? { Divider: 'Divider', Image: 'Image', RNHostView: 'RNHostView', VStack: 'VStack' }
    : { Column: 'Column', HorizontalDivider: 'Divider', RNHostView: 'RNHostView', Text: 'NativeText', useMaterialColors: () => ({ onSurfaceVariant: 'muted' }) };
  const Component = load(`admin/AdminClosedHistoryContent.${platform}.tsx`, { '@expo/ui': { ListItem: 'ListItem', Text: 'NativeText' },
    [`@expo/ui/${platform === 'ios' ? 'swift-ui' : 'jetpack-compose'}`]: native,
    '@expo/ui/swift-ui/modifiers': { accessibilityHidden: value => ({ hidden: value }), font: value => value }, 'expo-symbols': { SymbolView: 'SymbolView' },
    'react-native': { ActivityIndicator: 'ActivityIndicator' }, './AdminClosedHistoryAccessories': { AdminClosedRank: 'Rank', AdminClosedLogIcon: 'LogIcon' },
    './adminClosedLogPresentation': { adminClosedLogRow: log => ({ title: `Title ${log.event_id}`, subtitle: `Actor ${log.event_id}`, icon: 'history' }) },
    './adminWorkMapClosedModel': { adminWorkMapClosedRows: () => [{ headline: 'Hydrated title', supporting: 'Hydrated subtitle' }] },
  }).AdminClosedHistoryContent;
  const calls = [], summary = { logs: [] }, row = { position: '13', headline: 'Summary title', supporting: 'Summary subtitle' },
    state = { ticket: { id: 'o', historyVersion: 'v1', windowGeneration: 1 }, expanded: false, loading: false, error: null, detail: null },
    props = { row, summary, state, catalog: [], onToggle: () => calls.push('toggle'), onRetry: () => calls.push('retry'), onLog: (order, log) => calls.push([order, log]) };
  let tree = nodes(Component(props)), header = tree.find(value => value.props.testID === 'admin-closed-history-header');
  assert.equal(header.props.children.props.children, 'Summary title'); assert.equal(header.props.supportingText, 'Summary subtitle');
  header.props.onPress(); assert.deepEqual(calls, ['toggle']); assert.equal(tree.some(value => value.props.testID === 'admin-closed-log-0'), false);
  state.expanded = true; state.loading = true; tree = nodes(Component(props)); assert.ok(tree.some(value => value.type === 'ActivityIndicator'));
  state.loading = false; state.error = 'Tarix yuklanmadi'; tree = nodes(Component(props));
  const retry = tree.find(value => value.type === 'ListItem' && value.props.children?.props.children === 'Tarix yuklanmadi · Qayta yuklash'); retry.props.onPress();
  assert.deepEqual(calls, ['toggle', 'retry']); state.error = null; tree = nodes(Component(props)); assert.ok(tree.some(value => value.type === 'NativeText' && value.props.children === 'Log yo‘q'));
  const logs = [{ event_id: 'a' }, { event_id: 'b' }], detail = { logs }; state.detail = detail; tree = nodes(Component(props));
  header = tree.find(value => value.props.testID === 'admin-closed-history-header'); assert.equal(header.props.children.props.children, 'Hydrated title'); assert.equal(header.props.supportingText, 'Hydrated subtitle');
  const log = tree.find(value => value.props.testID === 'admin-closed-log-1'); assert.equal(log.props.supportingText, 'Actor b'); log.props.onPress();
  assert.deepEqual(calls.at(-1), [detail, logs[1]]); assert.ok(tree.some(value => value.type === 'Divider'));
  state.expanded = false; tree = nodes(Component(props)); assert.equal(tree.some(value => value.props.testID === 'admin-closed-log-1'), false);
});
test('Closed history accessories render a passive source-sized rank and native action icon', () => {
  const accessories = load('admin/AdminClosedHistoryAccessories.tsx', { 'expo-symbols': { SymbolView: 'SymbolView' },
    'react-native': { StyleSheet: { create: x => x }, Text: 'Text', View: 'View' },
    '../components/useBaseTheme': { useBaseTheme: () => ({ colors: { primaryContainer: 'rank', onPrimaryContainer: 'rank-text', secondaryContainer: 'icon-bg', onSecondaryContainer: 'icon' } }) } });
  const rank = accessories.AdminClosedRank({ position: '13' }); assert.equal(rank.props.children.props.children, '13'); assert.equal(rank.props.style[0].width, 30);
  const icon = accessories.AdminClosedLogIcon({ icon: 'transfer' }); assert.equal(icon.props.style[0].width, 34);
  assert.deepEqual(icon.props.children.props.name, { ios: 'arrow.left.arrow.right', android: 'swap_horiz' }); assert.equal(icon.props.onPress, undefined);
});
for (const platform of ['ios', 'android']) test(`${platform} decoded history can feed the prepared row and log sheet without a route`, async () => {
  const dart = load('admin/dartJsonString.ts'), closed = load('admin/adminWorkMapClosedModel.ts', { './dartJsonString': dart });
  const profile = load('shared/profileSessionGuard.ts'), mobile = load('shared/mobileApiException.ts');
  const parser = load('workerClosedOrders.ts', { './authorizedFetch': {}, './workerControlsApi': { isCanonicalApparatusId: value => value.startsWith('apparatus:'),
    WorkerControlException: class extends Error {} }, './workerProgressBatch': { progressBatchFromJson: value => value } });
  const model = load('admin/adminClosedLogPresentation.ts', { '../shared/localization': { adminText: key => key }, './adminWorkMapClosedModel': closed, './dartJsonString': dart });
  const Controller = load('admin/adminClosedHistoryController.ts', { '../shared/profileSessionGuard': profile, '../shared/mobileApiException': mobile,
    './adminWorkMapClosedModel': closed }).AdminClosedHistoryController;
  const raw = { order_id: 'o', order_number: '17', title: 'Film', history_version: 'v1', logs: [{ event_id: 'e', order_id: 'o', apparatus: 'apparatus:default:press', action: 'start', actor_display_name: 'Ana' }] };
  const summary = parser.closedProductionOrderFromJson({ ...raw, logs: [] }), detail = parser.closedProductionOrderFromJson(raw), row = closed.adminWorkMapClosedRows([summary])[0];
  const lifecycle = new Controller({ id: 'o', historyVersion: 'v1', windowGeneration: 1 }, { isCurrent: () => true, rowIsCurrent: () => true, read: async () => detail });
  const native = platform === 'ios' ? { Divider: 'Divider', Image: 'Image', RNHostView: 'RNHostView', VStack: 'VStack' }
    : { Column: 'Column', HorizontalDivider: 'Divider', RNHostView: 'RNHostView', Text: 'NativeText', useMaterialColors: () => ({ onSurfaceVariant: 'muted' }) };
  const Content = load(`admin/AdminClosedHistoryContent.${platform}.tsx`, { '@expo/ui': { ListItem: 'ListItem', Text: 'NativeText' },
    [`@expo/ui/${platform === 'ios' ? 'swift-ui' : 'jetpack-compose'}`]: native, '@expo/ui/swift-ui/modifiers': { accessibilityHidden: value => value, font: value => value },
    'expo-symbols': { SymbolView: 'SymbolView' }, 'react-native': { ActivityIndicator: 'ActivityIndicator' },
    './AdminClosedHistoryAccessories': { AdminClosedRank: 'Rank', AdminClosedLogIcon: 'LogIcon' }, './adminClosedLogPresentation': model, './adminWorkMapClosedModel': closed }).AdminClosedHistoryContent;
  let selected; const props = { row, summary, catalog: [{ id: 'apparatus:default:press', name: 'Print' }], onToggle: () => lifecycle.toggle(), onRetry: () => lifecycle.retry(),
    onLog: (order, log) => { selected = model.adminClosedLogDetail(order, log, props.catalog, 'en'); } };
  nodes(Content({ ...props, state: lifecycle.getSnapshot() })).find(value => value.props.testID === 'admin-closed-history-header').props.onPress();
  await new Promise(resolve => setImmediate(resolve)); const rowTree = nodes(Content({ ...props, state: lifecycle.getSnapshot() }));
  rowTree.find(value => value.props.testID === 'admin-closed-log-0').props.onPress(); assert.equal(selected.title, 'Boshladi'); assert.equal(selected.apparatus, 'Print');
  const Sheet = load('admin/AdminClosedLogSheet.tsx', { 'expo-symbols': { SymbolView: 'SymbolView' },
    'react-native': { ScrollView: 'ScrollView', StyleSheet: { create: x => x, hairlineWidth: 1 }, Text: 'Text', View: 'View' },
    '../components/useWorkerColors': { useWorkerColors: () => ({ background: 'bg', surface: 'surface', text: 'text', muted: 'muted', icon: 'icon' }) } }).AdminClosedLogSheet;
  const sheet = nodes(Sheet({ model: selected })); assert.ok(sheet.some(value => value.type === 'Text' && value.props.children === 'Ana'));
  assert.ok(sheet.some(value => value.type === 'Text' && value.props.children === 'production.progress_empty')); lifecycle.dispose();
});
