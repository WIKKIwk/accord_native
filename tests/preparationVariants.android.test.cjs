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
const tick = () => new Promise(resolve => setImmediate(resolve));

function setup() {
  const calls = [], slots = [], options = { orderId: 'order-1', orderCode: '0284', productCode: 'product-1', productTitle: 'Product', materialId: 'PE', materialName: 'PE' };
  let cursor = 0, fab;
  const variant = { id: 'variant-1', name: 'Variant', formula_code: 'F1', formula_count: 0, shares_complete: false };
  const state = { variants: [variant], loading: false, actionsBlocked: false, creating: false };
  const controller = {
    load: async () => { calls.push(['load']); },
    beginCreate: async () => { calls.push(['beginCreate']); state.creating = state.actionsBlocked = true; return 'request-1'; },
    cancelCreate: () => { calls.push(['cancelCreate']); state.creating = state.actionsBlocked = false; },
    beginReuse: () => { calls.push(['beginReuse']); state.creating = state.actionsBlocked = true; return true; },
    cancelReuse: () => { calls.push(['cancelReuse']); state.creating = state.actionsBlocked = false; },
    reuse: async id => { calls.push(['reuse', id]); return variant; },
  };
  state.controller = controller;
  const react = { useCallback: fn => fn, useRef: value => {
    const i = cursor++; return slots[i] ??= { current: value };
  }, useState: value => {
    const i = cursor++; if (!(i in slots)) slots[i] = value;
    return [slots[i], next => { slots[i] = typeof next === 'function' ? next(slots[i]) : next; }];
  } };
  const ui = new Proxy({ usePreparationText: () => value => value, usePreparationDialogs: () => ({}) },
    { get: (object, key) => object[key] ?? key });
  const mocks = {
    'react/jsx-runtime': jsx, react, '@expo/ui/jetpack-compose': { useMaterialColors: () => ({}) },
    '@expo/ui/jetpack-compose/modifiers': {}, 'expo-symbols': { SymbolView: 'SymbolView' },
    'expo-router': { useFocusEffect() {}, useLocalSearchParams: () => ({ data: 'route-data' }),
      router: { canGoBack: () => true, back: () => calls.push(['back']) } },
    'react-native': { View: 'View', Text: 'Text', StyleSheet: { create: value => value } },
    'react-native-reanimated': { useSharedValue: value => ({ value }) },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 24 }) },
    '../components/WorkerQueueCard.android': { WorkerQueueCard: 'WorkerQueueCard' },
    '../nativeSheet': { useNativeSheet: () => ({ open: () => calls.push(['menu']), close() {} }) },
    '../shared/navigation/RoleHeader.android': { RoleHeader: 'RoleHeader' }, '../shared/orders/OrdersList': { OrdersList: 'OrdersList' },
    './PreparationContext.android': { usePreparationContext: () => ({ session: {} }) },
    './PreparationFab.android': { usePreparationFab: (scope, config) => { fab = { scope, ...config }; return () => {}; } },
    './PreparationUI.android': ui, './usePreparationAndroidView.android': { usePreparationVariantsView: () => state },
    './usePreparationNotice': { usePreparationNotice: () => ({ message: '', show() {} }) },
    './preparationNavigation.android': { readPreparationRouteData: () => options, openPreparationFormula: value => calls.push(['formula', value]) },
    './preparationVariantPresentation': { preparationVariantSubtitle: () => 'F1 • Tarkib hali kiritilmagan' },
  };
  const filename = path.resolve(__dirname, '../src/preparation/PreparationVariants.android.tsx'), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths;
  mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : id.startsWith('.') ? {} : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, filename);
  const wrapper = mod.exports.PreparationFormulaVariantsScreen();
  return { calls, state, options, variant, fab: () => fab, render: () => { cursor = 0; return wrapper.type(wrapper.props); } };
}

test('variant cards keep opening, long press and refresh behavior in the shared list', async () => {
  const x = setup(); let tree = x.render();
  const list = nodes(tree, node => node.type === 'OrdersList')[0];
  await list.props.onRefresh(); assert.deepEqual(x.calls.at(-1), ['load']);
  let row = nodes(list, node => node.type?.name === 'VariantRow')[0];
  let card = row.type(row.props);
  assert.equal(card.type, 'WorkerQueueCard');
  card.props.onLongPress(); assert.deepEqual(x.calls.at(-1), ['menu']);
  card.props.onPress();
  assert.deepEqual(x.calls.at(-1), ['formula', { ...x.options, variantId: x.variant.id, variantName: x.variant.name, variantCode: 'F1', openEditorOnLoad: false }]);
  tree = x.render();
  row = nodes(tree, node => node.type?.name === 'VariantRow')[0]; card = row.type(row.props);
  assert.equal(card.props.onPress, undefined); assert.equal(card.props.onLongPress, undefined);
  assert.equal(x.fab().enabled, false);
  nodes(tree, node => node.type === 'RoleHeader')[0].props.navigation.onPress(); assert.deepEqual(x.calls.at(-1), ['back']);
});

test('variant FAB starts create and reuse flows and blocks actions while a flow is active', async () => {
  const x = setup(); x.render();
  assert.equal(x.fab().scope, 'variants');
  assert.deepEqual(x.fab().actions.map(action => action.label), ['Variant qo‘shish', 'Qidirib variant qo‘shish']);
  x.fab().onSelect('add'); await tick();
  let tree = x.render(), dialog = nodes(tree, node => node.type?.name === 'VariantNameDialog')[0];
  assert.ok(dialog); assert.equal(x.fab().enabled, false);
  const before = x.calls.length; x.fab().onSelect('reuse'); assert.equal(x.calls.length, before);
  dialog.props.cancel(); tree = x.render(); assert.equal(x.fab().enabled, true);
  x.fab().onSelect('reuse'); tree = x.render();
  const picker = nodes(tree, node => node.type?.name === 'ReusePicker')[0];
  assert.ok(picker); picker.props.close(); x.render(); assert.deepEqual(x.calls.at(-1), ['cancelReuse']);
  x.fab().onSelect('reuse'); tree = x.render();
  nodes(tree, node => node.type?.name === 'ReusePicker')[0].props.choose('source-1'); await tick();
  assert.ok(x.calls.some(call => call[0] === 'reuse' && call[1] === 'source-1'));
  assert.equal(x.calls.at(-1)[0], 'formula'); assert.equal(x.calls.at(-1)[1].materialId, 'PE');
});
