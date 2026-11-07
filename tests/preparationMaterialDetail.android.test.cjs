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
function load(file, mocks) {
  const filename = path.resolve(__dirname, '../src/preparation', file), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths;
  mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : id.startsWith('.') ? {} : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ESNext } }).outputText, filename);
  return mod.exports;
}

test('material detail reuses the worker pager with Mavjud, Kirim, Chiqim and independent lists', () => {
  const calls = [];
  const tabs = ['available', 'receipts', 'issues'];
  const row = { id: 'one', barcode: 'QR-1', kg: '15.75', has_qr: true, created_at: '2026-11-07T08:00:00Z',
    event_type: 'receipt_posted', actor_name: '', order_code: '', width_mm: null, micron: null, length_m: null };
  const state = { tab: 'available', itemName: 'BOPP', summary: { available_kg: '15.75', receipt_kg: '105', issue_kg: '2.5' },
    pages: Object.fromEntries(tabs.map(tab => [tab, { rows: [{ ...row, id: tab }], loaded: true, loading: false, error: null, hasMore: false }])),
    controller: { select: tab => { calls.push(['tab', tab]); state.tab = tab; }, reload: async () => {}, loadMore: async () => {} } };
  let fab;
  const mocks = { 'react/jsx-runtime': jsx,
    react: { useCallback: fn => fn, useState: value => [value, () => {}] },
    'react-native': { View: 'View', Text: 'Text', ActivityIndicator: 'ActivityIndicator', StyleSheet: { create: value => value } },
    'react-native-reanimated': { useSharedValue: value => ({ value, set() {} }) },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0 }) },
    '@expo/ui/jetpack-compose': { Host: 'Host', Column: 'Column', Row: 'Row', Text: 'ComposeText', useMaterialColors: () => ({}) },
    '@expo/ui/jetpack-compose/modifiers': new Proxy({ Shapes: { RoundedCorner: value => value } }, { get: (object, key) => object[key] ?? (() => ({})) }),
    'expo-router': { useLocalSearchParams: () => ({ code: 'BOPP', warehouse: 'Own' }), useFocusEffect() {},
      router: { canGoBack: () => true, back: () => calls.push(['back']) } },
    '../shared/orders/OrdersWorkspace': { OrdersWorkspace: 'OrdersWorkspace' },
    '../shared/orders/OrdersList': { OrdersList: 'OrdersList' },
    '../shared/navigation/RoleHeader.android': { RoleHeader: 'RoleHeader' },
    '../components/WorkerQueueCard.android': { WorkerQueueCard: 'WorkerQueueCard' },
    './PreparationContext.android': { usePreparationContext: () => ({ session: {}, home: { locked: false, loading: false, warehouse: 'Own', controller: {},
      snapshot: { material_warehouses: [], materials: [{ code: 'BOPP', name: 'BOPP' }] } } }) },
    './PreparationUI.android': { usePreparationText: () => value => value, usePreparationDialogs: () => ({ message: (...args) => calls.push(['dialog', ...args]) }), PreparationText: 'PreparationText', PreparationDock: 'PreparationDock', PreparationButton: 'PreparationButton' },
    './PreparationFab.android': { usePreparationFab: (scope, options) => { fab = { scope, ...options }; return () => {}; } },
    './usePreparationMaterialStock': { usePreparationMaterialStock: (_session, warehouse, code) => { calls.push(['load', warehouse, code]); return state; } },
    './usePreparationNotice': { usePreparationNotice: () => ({ message: '' }) },
    './usePreparationStockActions.android': { usePreparationStockActions: () => ({ receive: async () => {} }) },
    './preparationLogic': { preparationReceiptMode: () => 'scale' },
    './preparationNavigation.android': { openPreparationScale: args => calls.push(['scale', args]) },
    './preparationModel': { preparationDisplay: value => value },
    './preparationMaterialStockApi': { materialStockTabs: tabs },
    './preparationMaterialStockPresentation': { materialStockTabLabels: { available: 'Mavjud', receipts: 'Kirim', issues: 'Chiqim' },
      materialStockRowPresentation: item => ({ title: item.id, detail: item.barcode, amount: `${item.kg} kg`, fullDetails: `Full: ${item.barcode}` }) },
  };
  const { PreparationMaterialDetailScreen } = load('PreparationMaterialDetail.android.tsx', mocks);
  const tree = PreparationMaterialDetailScreen();
  const workspace = nodes(tree, node => node.type === 'OrdersWorkspace')[0];
  assert.deepEqual(workspace.props.tabs.map(tab => tab.name), ['Mavjud', 'Kirim', 'Chiqim']);
  assert.equal(workspace.props.selected, 'available');
  assert.deepEqual(calls[0], ['load', 'Own', 'BOPP']);
  const header = nodes(workspace.props.header, node => node.type === 'RoleHeader')[0];
  assert.equal(header.props.title, 'BOPP'); assert.equal(header.props.subtitle, 'Own');
  header.props.navigation.onPress(); assert.deepEqual(calls.at(-1), ['back']);
  const summary = nodes(workspace.props.header, node => typeof node.type === 'function' && node.type.name === 'StockSummary')[0];
  const summaryText = nodes(summary.type(summary.props), node => node.type === 'ComposeText').map(node => node.props.children);
  assert.deepEqual(summaryText, ['Kirim', '105', 'kg', 'Chiqim', '2.5', 'kg', 'Mavjud', '15.75', 'kg']);
  for (const tab of tabs) {
    const list = workspace.props.children(tab, 'pager');
    assert.equal(list.props.pagerGesture, 'pager');
    const rows = nodes(list, node => typeof node.type === 'function' && node.type.name === 'StockRow');
    assert.deepEqual(rows.map(row => row.props.item.id), [tab]);
    const card = rows[0].type(rows[0].props);
    card.props.onPress();
    assert.deepEqual(calls.at(-1), ['dialog', 'Batafsil ma’lumot', 'Full: QR-1']);
  }
  workspace.props.onSelect('issues'); assert.deepEqual(calls.at(-1), ['tab', 'issues']);
  assert.equal(nodes(tree, node => node.type === 'PreparationDock').length, 1);
  assert.equal(fab.scope, 'material');
  fab.onSelect('receive'); assert.deepEqual(calls.at(-1), ['scale', { warehouse: 'Own' }]);
});
