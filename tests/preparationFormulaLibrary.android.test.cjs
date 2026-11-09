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
test('formula library uses the shared search and virtual list with working row actions', async () => {
  const calls = [], sheets = [];
  const set = { set_id: 'S1', name: 'Formula', product_code: 'P', order_codes: [], formulas: [] };
  const recipe = { id: 'R1', name: 'Recipe', product_code: 'P', material_id: 'M', formula_code: 'F1' };
  const legacy = { material_id: 'L', variant_id: 'V', formula: { name: 'A' } };
  const detail = { recipes: [recipe], legacyFormulas: [legacy], busy: false, error: null,
    controller: { reload() {}, formulasFor: entry => [entry.formula] } };
  const state = { query: '', sets: [set], recipes: [recipe], filteredSets: [set], filteredRecipes: [recipe], loading: false,
    error: null, actionsBlocked: false, controller: { setQuery: value => calls.push(['query', value]), load: async () => calls.push(['load']),
      recipeCount: () => 1, recipesFor: () => [recipe] } };
  const ui = new Proxy({ usePreparationText: () => value => value, usePreparationDialogs: () => ({}) }, { get: (obj, key) => obj[key] ?? key });
  const mocks = { 'react/jsx-runtime': jsx, react: { useRef: value => ({ current: value }), useState: value => [value, () => {}], useCallback: fn => fn },
    '@expo/ui/jetpack-compose': { useMaterialColors: () => ({}) }, 'expo-symbols': { SymbolView: 'SymbolView' },
    'expo-router': { router: { canGoBack: () => true, back: () => calls.push(['back']), navigate: route => calls.push(['navigate', route]),
      push: route => calls.push(['push', route]) }, useFocusEffect() {}, useLocalSearchParams: () => ({ data: 'detail' }) },
    'react-native': { View: 'View', Text: 'Text', ActivityIndicator: 'ActivityIndicator', StyleSheet: { create: value => value } },
    'react-native-reanimated': { useSharedValue: value => ({ value }) }, 'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0 }) },
    '../components/WorkerQueueCard.android': { WorkerQueueCard: 'WorkerQueueCard' }, '../shared/orders/OrdersList': { OrdersList: 'OrdersList' },
    '../shared/orders/OrdersHeader': { OrdersHeader: 'OrdersHeader' },
    '../nativeSheet': { useNativeSheet: () => ({ open: content => sheets.push(content), close() {} }) },
    './PreparationContext.android': { usePreparationContext: () => ({ session: {} }) }, './PreparationFab.android': { usePreparationFab: () => () => {} },
    './PreparationUI.android': ui, './usePreparationAndroidView.android': { usePreparationLibraryView: () => state },
    './usePreparationNotice': { usePreparationNotice: () => ({ message: '', show() {} }) },
    './preparationNavigation.android': { openPreparationFormula: options => calls.push(['formula', options]),
      readPreparationRouteData: () => ({ set, recipes: [recipe] }) },
    './usePreparationSetDetail': { usePreparationSetDetail: () => detail },
    './PreparationFormulaDetails.android': { PreparationFormulaDetails: 'FormulaDetails' },
    './preparationLibraryPresentation': { preparationSetSubtitle: () => 'S1\n1 ta formula', preparationCatalogSubtitle: () => 'F1',
      preparationSetRecipeSubtitle: () => 'F1 · M', preparationLegacyFormulaTitle: () => 'Legacy',
      preparationLegacyFormulaSubtitle: () => 'L', preparationSharedFormulaWarning: 'Warning' },
  };
  const filename = path.resolve(__dirname, '../src/preparation/PreparationFormulaLibrary.android.tsx'), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths;
  mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : id.startsWith('.') ? {} : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, filename);
  for (const screen of ['PreparationFormulaOrdersScreen', 'PreparationFormulaCatalogScreen']) {
    const wrapper = mod.exports[screen](), tree = wrapper.type(wrapper.props);
    const header = nodes(tree, node => node.type === 'OrdersHeader')[0], list = nodes(tree, node => node.type === 'OrdersList')[0];
    assert.ok(header && list); assert.equal(header.props.search, '');
    header.props.onSearchChange('F1'); assert.deepEqual(calls.at(-1), ['query', 'F1']);
    await list.props.onRefresh(); assert.deepEqual(calls.at(-1), ['load']);
    const row = nodes(list, node => typeof node.type === 'function' && node.type.name === 'LibraryRow')[0];
    assert.ok(row); const card = row.type(row.props); assert.equal(card.type, 'WorkerQueueCard');
    card.props.onPress(); assert.equal(calls.at(-1)[0], screen === 'PreparationFormulaOrdersScreen' ? 'push' : 'formula');
    card.props.onLongPress(); assert.ok(sheets.length);
    assert.equal(row.type({ ...row.props, disabled: true }).props.onPress, undefined);
    header.props.onBack(); assert.deepEqual(calls.at(-1), ['back']);
    header.props.onProfile(); assert.deepEqual(calls.at(-1), ['navigate', '/android-preparation/profile']);
  }
  const wrapper = mod.exports.PreparationFormulaSetDetailScreen(), tree = wrapper.type(wrapper.props);
  const rows = nodes(tree, node => typeof node.type === 'function' && node.type.name === 'LibraryRow');
  assert.equal(rows.length, 2);
  assert.equal(rows[0].props.first, true); assert.equal(rows[0].props.last, false);
  assert.equal(rows[1].props.first, false); assert.equal(rows[1].props.last, true);
  const first = rows[0].type(rows[0].props), second = rows[1].type(rows[1].props);
  assert.equal(first.type, 'WorkerQueueCard'); assert.equal(second.type, 'WorkerQueueCard');
  first.props.onPress(); assert.equal(calls.at(-1)[1].variantId, recipe.id);
  first.props.onLongPress(); assert.ok(sheets.at(-1));
  second.props.onPress(); assert.equal(sheets.at(-1).type, 'FormulaDetails');
  assert.equal(second.props.onLongPress, undefined);
  assert.equal(rows[0].type({ ...rows[0].props, disabled: true }).props.onPress, undefined);
});
