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
test('production uses shared search, filter and virtual list with automatic paging', async () => {
  const calls = [], item = { order_id: 'one' };
  const journal = { load: async options => calls.push(['load', options]), start() {}, setVisible() {}, setResumed() {}, invalidate() {} };
  const state = { items: [item], loading: false, error: null, has_more: true, next_offset: 30, summary: null };
  let index = 0;
  const mocks = { 'react/jsx-runtime': jsx, 'expo-image': { Image: 'Image' }, react: { useState: value => [index++ === 2 ? state : value, value => calls.push(['set', value])],
    useRef: value => ({ current: value }), useCallback: fn => fn, useMemo: fn => fn(), useEffect() {} },
    '@expo/ui/jetpack-compose': { useMaterialColors: () => ({}) }, 'expo-symbols': { SymbolView: 'SymbolView' },
    'expo-router': { router: { canGoBack: () => true, back: () => calls.push(['back']), navigate: value => calls.push(['navigate', value]),
      push: value => calls.push(['push', value]) }, useFocusEffect() {}, useLocalSearchParams: () => ({ id: 'one' }) },
    'react-native': { View: 'View', Text: 'Text', ActivityIndicator: 'ActivityIndicator', StyleSheet: { create: v => v } },
    'react-native-reanimated': { useSharedValue: value => ({ value }) }, 'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0 }) },
    '../components/WorkerQueueCard.android': { WorkerQueueCard: 'WorkerQueueCard' }, '../shared/filters/DropdownFilter.android': { DropdownFilter: 'DropdownFilter' },
    '../shared/orders/OrdersHeader': { OrdersHeader: 'OrdersHeader' }, '../shared/orders/OrdersList': { OrdersList: 'OrdersList' },
    './PreparationContext.android': { usePreparationContext: () => ({ session: {} }) }, './PreparationFab.android': { usePreparationFab: () => () => {} },
    './PreparationUI.android': { usePreparationText: () => text => text, PreparationDock: 'PreparationDock', PreparationText: 'PreparationText',
      PreparationButton: 'PreparationButton', PreparationPage: 'PreparationPage', PreparationRow: 'PreparationRow' },
    './preparationJournalFactory': { createPreparationProductionOrdersJournal: () => journal, createPreparationProductionOrderJournal: () => journal },
    './preparationProductionPresentation': { preparationProductionOrderCard: () => ({ title: 'Order', subtitle: 'Customer', metrics: '2 kg' }),
      preparationProductionBatchCard: batch => ({ title: batch.name, subtitle: 'Davom etmoqda', metrics: '12 kg' }),
      preparationProductionMetrics: () => '12 kg' },
  };
  const filename = path.resolve(__dirname, '../src/preparation/PreparationProduction.android.tsx'), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths;
  mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : id.startsWith('.') ? {} : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, filename);
  const tree = mod.exports.PreparationProductionScreen();
  const header = nodes(tree, n => n.type === 'OrdersHeader')[0], list = nodes(tree, n => n.type === 'OrdersList')[0];
  assert.ok(header && list); header.props.onSearchChange('BOPP'); assert.deepEqual(calls.at(-1), ['set', 'BOPP']);
  const filter = nodes(list, n => n.type === 'DropdownFilter')[0];
  assert.deepEqual(filter.props.options.map(v => v.value), ['all', 'active', 'completed']);
  list.props.onEndReached(); assert.deepEqual(calls.at(-1), ['load', { append: true }]);
  assert.equal(nodes(list, n => n.type === 'PreparationButton' && n.props.label === 'Yana yuklash').length, 0);
  const row = nodes(list, n => typeof n.type === 'function' && n.type.name === 'ProductionOrderRow')[0];
  const card = row.type(row.props); assert.equal(card.type, 'WorkerQueueCard'); card.props.onPress();
  assert.deepEqual(calls.at(-1), ['push', { pathname: '/android-preparation/production-order', params: { id: 'one' } }]);
  header.props.onBack(); assert.deepEqual(calls.at(-1), ['back']);

  index = 2;
  state.items = [{ batch_id: 'batch-1', name: 'PE PR' }, { batch_id: 'batch-2', name: 'BOPP' }];
  state.summary = { order_id: 'one', order_code: '0317', order_title: 'Order', customer_name: 'Customer' };
  const detail = mod.exports.PreparationProductionOrderScreen();
  const rows = nodes(detail, n => typeof n.type === 'function' && n.type.name === 'ProductionBatchRow');
  assert.equal(rows.length, 2); assert.equal(rows[0].props.first, true); assert.equal(rows[1].props.last, true);
  const batchCard = rows[1].type(rows[1].props);
  assert.equal(batchCard.type, 'WorkerQueueCard');
  assert.deepEqual(nodes(batchCard, n => n.type === 'Text').map(n => n.props.children), ['BOPP', 'Davom etmoqda\n12 kg']);
  batchCard.props.onPress();
  assert.deepEqual(calls.at(-1), ['push', { pathname: '/android-preparation/production-batch', params: { id: 'batch-2' } }]);
});
