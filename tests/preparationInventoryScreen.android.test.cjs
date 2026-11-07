const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const jsx = { Fragment: 'Fragment', jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
function nodes(node, pred) { if (!node || typeof node !== 'object') return []; if (Array.isArray(node)) return node.flatMap(n => nodes(n, pred));
  return [...(pred(node) ? [node] : []), ...nodes(node.props?.children, pred)]; }
test('inventory uses shared tabs, search and paging and opens QR scanning from the FAB', () => {
  const calls = [], slots = []; let cursor = 0, fab;
  const window = name => ({ rows: [], loading: false, error: null, hasMore: true, refresh: async () => {}, loadMore: () => calls.push(['more', name]) });
  const inventory = { tab: 'assets', query: '', warehouse: '', warehouses: [{ warehouse_id: 'a', name: 'Own' }], locations: { loading: false, error: null, refresh: async () => {} },
    assets: window('assets'), incoming: window('incoming'), outgoing: window('outgoing'), visibleAssets: [], visibleIncoming: [], visibleOutgoing: [], qrAssets: [],
    busy: false, qrError: null, setQuery: value => calls.push(['query', value]), chooseWarehouse: value => calls.push(['warehouse', value]),
    setTab: value => calls.push(['tab', value]), clearQr: () => calls.push(['clear']) };
  const react = { useState(value) { const i = cursor++; if (!(i in slots)) slots[i] = value;
    return [slots[i], next => { slots[i] = typeof next === 'function' ? next(slots[i]) : next; }]; }, useRef: value => ({ current: value }), useEffect() {}, useMemo: fn => fn() };
  const shared = value => ({ value, set(next) { this.value = next; } });
  const ui = new Proxy({ usePreparationText: () => value => value }, { get: (obj, key) => obj[key] ?? key });
  const mocks = { 'react/jsx-runtime': jsx, react, 'expo-image': { Image: 'Image' }, 'expo-camera': { CameraView: 'CameraView',
    useCameraPermissions: () => [{ granted: true }, () => calls.push(['permission'])] }, 'expo-router': { router: {} }, 'expo-symbols': { SymbolView: 'SymbolView' },
    '@expo/ui/jetpack-compose': { useMaterialColors: () => ({}) }, '@expo/ui/jetpack-compose/modifiers': { fillMaxWidth: () => ({}), weight: () => ({}) },
    'react-native': { View: 'View', Text: 'Text', ActivityIndicator: 'ActivityIndicator',
      ScrollView: 'ScrollView', StyleSheet: { create: value => value } }, 'react-native-reanimated': { useSharedValue: shared },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0 }) }, '../components/WorkerQueueCard.android': { WorkerQueueCard: 'WorkerQueueCard' },
    '../shared/filters/DropdownFilter.android': { DropdownFilter: 'DropdownFilter' }, '../shared/orders/OrdersHeader': { OrdersHeader: 'OrdersHeader' },
    '../shared/orders/OrdersList': { OrdersList: 'OrdersList' }, '../shared/orders/OrdersWorkspace': { OrdersWorkspace: 'OrdersWorkspace' },
    './PreparationContext.android': { usePreparationContext: () => ({ session: {}, home: { snapshot: null } }) },
    './PreparationFab.android': { usePreparationFab: (scope, options) => { fab = { scope, ...options }; return () => {}; } },
    './PreparationUI.android': ui, './usePreparationInventory.android': { usePreparationInventory: () => inventory },
  };
  const filename = path.resolve(__dirname, '../src/preparation/PreparationMovements.android.tsx'), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths;
  mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : id.startsWith('.') ? {} : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, filename);
  const render = () => { cursor = 0; return mod.exports.PreparationInventoryScreen(); };
  let page = render(), workspace = nodes(page, n => n.type === 'OrdersWorkspace')[0];
  assert.deepEqual(workspace.props.tabs.map(tab => tab.id), ['assets', 'incoming', 'outgoing']); assert.equal(workspace.props.distributeTabs, true);
  const header = nodes(workspace.props.header, n => n.type === 'OrdersHeader')[0]; header.props.onSearchChange('film'); assert.deepEqual(calls.at(-1), ['query', 'film']);
  let list = workspace.props.children('assets', 'gesture');
  list.props.onEndReached(); assert.deepEqual(calls.at(-1), ['more', 'assets']);
  nodes(list, n => n.type === 'DropdownFilter')[0].props.onChange('a'); assert.deepEqual(calls.at(-1), ['warehouse', 'a']);
  assert.equal(fab.scope, 'inventory'); assert.equal(fab.actions[0].label, 'QR orqali izlash'); fab.onSelect('scan');
  page = render(); workspace = nodes(page, n => n.type === 'OrdersWorkspace')[0]; list = workspace.props.children('assets', 'gesture');
  assert.equal(nodes(list, n => n.type === 'CameraView').length, 1);
  assert.equal(fab.actions[0].label, 'QR izlashni yopish');
  workspace.props.onSelect('incoming'); assert.deepEqual(calls.at(-1), ['tab', 'incoming']);
});
