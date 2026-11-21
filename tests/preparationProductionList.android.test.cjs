const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const jsx = { Fragment: 'Fragment', jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
function nodes(node, pred) {
  if (!node || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap(child => nodes(child, pred));
  return [...(pred(node) ? [node] : []), ...nodes(node.props?.children, pred)];
}
test('production uses shared tabs, search, filter and a paged list for each view', () => {
  const calls = [], item = { order_id: 'one' };
  const journal = { load: async options => calls.push(['load', options]) };
  const state = { items: [{ kind: 'order', order: item }], loading: false, error: null, has_more: true, next_offset: 30, summary: null };
  const tabs = [{ id: 'orders', name: 'Buyurtmalar' }, { id: 'batches', name: 'Batchlar' }, { id: 'rolls', name: 'Rulonlar' }];
  const mocks = { 'react/jsx-runtime': jsx, 'expo-image': { Image: 'Image' }, react: { useState: value => [value, () => {}],
    useRef: value => ({ current: value }), useCallback: fn => fn, useMemo: fn => fn(), useEffect() {} },
    '@expo/ui/jetpack-compose': { useMaterialColors: () => ({}) }, 'expo-symbols': { SymbolView: 'SymbolView' },
    'expo-router': { router: { canGoBack: () => true, back: () => calls.push(['back']), navigate: value => calls.push(['navigate', value]),
      push: value => calls.push(['push', value]) }, useFocusEffect() {}, useLocalSearchParams: () => ({ id: 'one' }) },
    'react-native': { View: 'View', Text: 'Text', ActivityIndicator: 'ActivityIndicator', StyleSheet: { create: v => v } },
    'react-native-reanimated': { useSharedValue: value => ({ value }) }, 'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0 }) },
    '../components/WorkerQueueCard.android': { WorkerQueueCard: 'WorkerQueueCard' }, '../shared/filters/DropdownFilter.android': { DropdownFilter: 'DropdownFilter' },
    '../shared/orders/OrdersHeader': { OrdersHeader: 'OrdersHeader' }, '../shared/orders/OrdersList': { OrdersList: 'OrdersList' },
    '../shared/orders/OrdersWorkspace': { OrdersWorkspace: 'OrdersWorkspace' }, '../nativeSheet': { useNativeSheet: () => ({}) },
    '../shared/orders/ordersWorkspaceTypes': { ORDERS_TAB_BAR_HEIGHT: 48 },
    './PreparationContext.android': { usePreparationContext: () => ({ session: {} }) }, './PreparationFab.android': { usePreparationFab: () => () => {} },
    './PreparationUI.android': { usePreparationText: () => text => text, PreparationDock: 'PreparationDock', PreparationText: 'PreparationText',
      PreparationButton: 'PreparationButton', PreparationPage: 'PreparationPage', PreparationRow: 'PreparationRow' },
    './preparationJournalFactory': { productionViews: tabs, createPreparationProductionOrderJournal: () => journal },
    './usePreparationProductionWorkspace': {
      productionStatuses: [{ value: 'all', label: 'Barchasi' }, { value: 'active', label: 'Davom etmoqda' }, { value: 'completed', label: 'Yakunlangan' }],
      usePreparationJournal: () => ({ state, journal }), usePreparationProductionWorkspace: () => ({
        view: 'orders', status: 'all', state, journal, notes: { selected: new Map() },
        loadMore: () => journal.load({ append: true }), changeQuery: value => calls.push(['search', value]),
        selectView: value => calls.push(['view', value]), changeStatus: value => calls.push(['status', value]),
      }),
    },
    './preparationProductionPresentation': { preparationProductionOrderCard: () => ({ title: 'Order', subtitle: 'Customer', metrics: '2 kg' }),
      preparationProductionBatchCard: batch => ({ title: batch.name, subtitle: 'Davom etmoqda', metrics: '12 kg' }),
      preparationProductionMetrics: () => '12 kg' },
  };
  const filename = path.resolve(__dirname, '../src/preparation/PreparationProduction.android.tsx'), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths;
  mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : id.startsWith('.') ? {} : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, filename);
  const tree = mod.exports.PreparationProductionScreen();
  assert.equal(nodes(tree, n => n.type === 'PreparationDock').length, 0);
  const workspace = nodes(tree, n => n.type === 'OrdersWorkspace')[0];
  assert.deepEqual(workspace.props.tabs, tabs);
  workspace.props.onSelect('batches'); assert.deepEqual(calls.at(-1), ['view', 'batches']);
  const header = nodes(workspace.props.header, n => n.type === 'OrdersHeader')[0], list = workspace.props.children('orders');
  assert.equal(list.type, 'OrdersList');
  assert.deepEqual(workspace.props.children('rolls').props.rows, []);
  header.props.onSearchChange('BOPP'); assert.deepEqual(calls.at(-1), ['search', 'BOPP']);
  const filter = nodes(list, n => n.type === 'DropdownFilter')[0];
  assert.deepEqual(filter.props.options.map(v => v.value), ['all', 'active', 'completed']);
  filter.props.onChange('active'); assert.deepEqual(calls.at(-1), ['status', 'active']);
  list.props.onEndReached(); assert.deepEqual(calls.at(-1), ['load', { append: true }]);
  assert.equal(nodes(list, n => n.type === 'PreparationButton' && n.props.label === 'Yana yuklash').length, 0);
  const row = list.props.renderRow(list.props.rows[0], 0);
  const card = row.type(row.props); assert.equal(card.type, 'WorkerQueueCard'); card.props.onPress();
  assert.deepEqual(calls.at(-1), ['push', { pathname: '/android-preparation/production-order', params: { id: 'one' } }]);
  header.props.onBack(); assert.deepEqual(calls.at(-1), ['back']);

  state.items = [{ batch_id: 'batch-1', name: 'PE PR' }, { batch_id: 'batch-2', name: 'BOPP' }];
  state.summary = { order_id: 'one', order_code: '0317', order_title: 'Order', customer_name: 'Customer', preparation_note: { text: '' } };
  const detail = mod.exports.PreparationProductionOrderScreen();
  const rows = nodes(detail, n => typeof n.type === 'function' && n.type.name === 'ProductionBatchRow');
  assert.equal(rows.length, 2); assert.equal(rows[0].props.first, true); assert.equal(rows[1].props.last, true);
  const batchCard = rows[1].type(rows[1].props);
  assert.equal(batchCard.type, 'WorkerQueueCard');
  assert.deepEqual(nodes(batchCard, n => n.type === 'Text').map(n => n.props.children), ['BOPP', 'Davom etmoqda\n12 kg']);
  batchCard.props.onPress();
  assert.deepEqual(calls.at(-1), ['push', { pathname: '/android-preparation/production-batch', params: { id: 'batch-2' } }]);
});
