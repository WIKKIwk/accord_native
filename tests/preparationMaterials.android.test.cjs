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
test('materials use the warehouse list and retain search, refresh and row actions', async () => {
  const calls = [], sheets = [];
  const state = { query: '', items: [{ item_code: 'B', name: 'BOPP', warehouses: ['Own'] }], loading: false, refreshing: false,
    saving: false, error: null, actionsBlocked: false, controller: { setQuery: value => calls.push(['query', value]),
      load: async refresh => calls.push(['load', refresh]) } };
  state.filtered = state.items;
  const ui = new Proxy({ usePreparationText: () => value => value, usePreparationDialogs: () => ({}) }, { get: (obj, key) => obj[key] ?? key });
  const mocks = { 'react/jsx-runtime': jsx, react: { useRef: value => ({ current: value }), useState: value => [value, () => {}] },
    '@expo/ui/jetpack-compose': { useMaterialColors: () => ({}) },
    '@expo/ui/jetpack-compose/modifiers': {}, 'expo-symbols': { SymbolView: 'SymbolView' },
    'expo-router': { router: { canGoBack: () => true, back: () => calls.push(['back']) } },
    'react-native': { View: 'View', Text: 'Text', ActivityIndicator: 'ActivityIndicator', StyleSheet: { create: value => value } },
    'react-native-reanimated': { useSharedValue: value => ({ value }) },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0 }) },
    '../components/WorkerQueueCard.android': { WorkerQueueCard: 'WorkerQueueCard' },
    '../shared/orders/OrdersList': { OrdersList: 'OrdersList' }, '../shared/navigation/RoleHeader.android': { RoleHeader: 'RoleHeader' },
    '../nativeSheet': { useNativeSheet: () => ({ open: content => sheets.push(content), close() {} }) },
    './PreparationContext.android': { usePreparationContext: () => ({ session: {} }) },
    './PreparationNotice': { PreparationNotice: 'PreparationNotice' },
    './PreparationFab.android': { usePreparationFab: () => () => {} }, './PreparationUI.android': ui,
    './usePreparationAndroidView.android': { usePreparationMaterialsView: () => state },
    './usePreparationNotice': { usePreparationNotice: () => ({ message: '', show() {} }) },
    './usePreparationMaterials': { preparationMaterialsEmptyMessage: () => 'empty' },
  };
  const filename = path.resolve(__dirname, '../src/preparation/PreparationMaterials.android.tsx'), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths;
  mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, filename);
  const tree = mod.exports.PreparationMaterialsScreen();
  const list = nodes(tree, node => node.type === 'OrdersList')[0];
  assert.ok(list); assert.equal(nodes(tree, node => node.type === 'PreparationDock').length, 1);
  await list.props.onRefresh(); assert.deepEqual(calls.at(-1), ['load', true]);
  nodes(list, node => node.type === 'PreparationField')[0].props.onChange('BOPP');
  assert.deepEqual(calls.at(-1), ['query', 'BOPP']);
  const row = nodes(list, node => typeof node.type === 'function' && node.type.name === 'MaterialRow')[0];
  assert.equal(row.props.subtitle, 'Own');
  const card = row.type(row.props);
  assert.equal(card.type, 'WorkerQueueCard'); card.props.onPress();
  assert.equal(sheets[0].props.name, 'BOPP');
  const blocked = row.type({ ...row.props, blocked: true });
  assert.equal(blocked.props.onPress, undefined);
  nodes(tree, node => node.type === 'RoleHeader')[0].props.navigation.onPress();
  assert.deepEqual(calls.at(-1), ['back']);
});
