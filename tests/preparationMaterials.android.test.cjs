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
  const calls = [], sheets = []; let expanded = false, sheetOptions;
  const state = { query: '', items: [{ item_code: 'B', name: 'BOPP', warehouses: ['Own'] }], loading: false, refreshing: false,
    saving: false, error: null, actionsBlocked: false, controller: { setQuery: value => calls.push(['query', value]),
      load: async refresh => calls.push(['load', refresh]), rename: async (item, name) => { calls.push(['rename', item.item_code, name]); return true; },
      remove: async item => { calls.push(['delete', item.item_code]); return true; },
      warehouseChoices: async (item, options) => { calls.push(['choices', item.item_code, options]); return [{ name: 'Own', editable: true, selected: true }]; } } };
  state.filtered = state.items;
  const ui = new Proxy({ usePreparationText: () => value => value, usePreparationDialogs: () => ({
    input: async () => 'Updated', confirm: async () => true,
  }) }, { get: (obj, key) => obj[key] ?? key });
  const menu = Object.assign(function Menu() {}, { Trigger: 'MenuTrigger', Items: 'MenuItems' });
  const menuItem = Object.assign(function Item() {}, { LeadingIcon: 'LeadingIcon', Text: 'ItemText' });
  const mocks = { 'react/jsx-runtime': jsx, react: { useRef: value => ({ current: value }), useState: () => [expanded, value => { expanded = value; }], useEffect() {} },
    '@expo/ui/jetpack-compose': { useMaterialColors: () => ({}), Host: 'Host', DropdownMenu: menu, DropdownMenuItem: menuItem, IconButton: 'IconButton', RNHostView: 'RNHostView', Text: 'ComposeText' },
    '@expo/ui/jetpack-compose/modifiers': { size: () => ({}), semantics: () => ({}) }, 'expo-symbols': { SymbolView: 'SymbolView' },
    'expo-router': { router: { canGoBack: () => true, back: () => calls.push(['back']), navigate: route => calls.push(['navigate', route]) } },
    'react-native': { View: 'View', Text: 'Text', Pressable: 'Pressable', ActivityIndicator: 'ActivityIndicator', StyleSheet: { create: value => value } },
    'react-native-reanimated': { useSharedValue: value => ({ value }) },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0 }) },
    '../components/WorkerQueueCard.android': { WorkerQueueCard: 'WorkerQueueCard' },
    '../shared/orders/OrdersList': { OrdersList: 'OrdersList' }, '../shared/orders/OrdersHeader': { OrdersHeader: 'OrdersHeader' },
    '../nativeSheet': { useNativeSheet: () => ({ open: (content, options) => { sheets.push(content); sheetOptions = options; }, close() {} }) },
    './PreparationContext.android': { usePreparationContext: () => ({ session: {}, home: { snapshot: { material_warehouses: ['Own', 'Other'] } } }) },
    './PreparationNotice': { PreparationNotice: 'PreparationNotice' },
    './PreparationFab.android': { usePreparationFab: () => () => {} }, './PreparationUI.android': ui,
    './usePreparationAndroidView.android': { usePreparationMaterialsView: () => state },
    './usePreparationWarehouseChoices.android': { usePreparationWarehouseChoices() {} },
    './usePreparationNotice': { usePreparationNotice: () => ({ message: '', show() {} }) },
    './preparationLogic': { preparationWarehouseChoices: (editable, selected) => [...new Set([...editable, ...selected])].sort().map(name => ({ name, editable: editable.includes(name), selected: selected.includes(name) })) },
    './usePreparationMaterials': { preparationMaterialsEmptyMessage: () => 'empty', preparationMaterialDeleteMessage: () => 'confirm' },
  };
  const filename = path.resolve(__dirname, '../src/preparation/PreparationMaterials.android.tsx'), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths;
  mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, filename);
  const tree = mod.exports.PreparationMaterialsScreen();
  const list = nodes(tree, node => node.type === 'OrdersList')[0];
  assert.ok(list); assert.equal(nodes(tree, node => node.type === 'PreparationDock').length, 1);
  await list.props.onRefresh(); assert.deepEqual(calls.at(-1), ['load', true]);
  const header = nodes(tree, node => node.type === 'OrdersHeader')[0];
  assert.equal(header.props.search, '');
  assert.equal(header.props.searchPlaceholder, 'Qidirish');
  assert.equal(nodes(list, node => node.type === 'PreparationField').length, 0);
  header.props.onSearchChange('BOPP');
  assert.deepEqual(calls.at(-1), ['query', 'BOPP']);
  const row = nodes(list, node => typeof node.type === 'function' && node.type.name === 'MaterialRow')[0];
  assert.equal(row.props.subtitle, 'Own');
  let card = row.type(row.props);
  assert.equal(card.type, 'WorkerQueueCard');
  assert.equal(nodes(card, node => node.type === menu).length, 0);
  assert.equal(nodes(card, node => node.type === 'Host').length, 0);
  const trigger = nodes(card, node => node.type === 'Pressable')[0];
  assert.equal(trigger.props.accessibilityLabel, 'BOPP — Homashyo amallari');
  trigger.props.onPress();
  assert.equal(expanded, true);
  card = row.type(row.props);
  assert.equal(nodes(card, node => node.type === menu)[0].props.expanded, true);
  const options = nodes(card, node => node.type === menuItem);
  assert.equal(options.length, 3);
  const previousFrame = global.requestAnimationFrame;
  global.requestAnimationFrame = callback => { callback(); return 1; };
  try {
    options[0].props.onClick(); await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(calls.at(-1), ['rename', 'B', 'Updated']); assert.equal(expanded, false);
    options[1].props.onClick();
    assert.equal(sheets[0].props.name, 'BOPP');
    assert.deepEqual(sheets[0].props.initialChoices, [{ name: 'Other', editable: true, selected: false }, { name: 'Own', editable: true, selected: true }]);
    assert.equal(sheetOptions.fitContent, true); assert.equal(sheetOptions.compact, true);
    await sheets[0].props.load(); assert.deepEqual(calls.at(-1), ['choices', 'B', { silent: true }]);
    options[2].props.onClick(); await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(calls.at(-1), ['delete', 'B']);
  } finally { global.requestAnimationFrame = previousFrame; }
  const blocked = row.type({ ...row.props, blocked: true });
  assert.equal(blocked.props.onPress, undefined);
  assert.equal(nodes(blocked, node => node.type === 'Pressable')[0].props.disabled, true);
  header.props.onBack();
  assert.deepEqual(calls.at(-1), ['back']);
  header.props.onProfile();
  assert.deepEqual(calls.at(-1), ['navigate', '/android-preparation/profile']);
});
