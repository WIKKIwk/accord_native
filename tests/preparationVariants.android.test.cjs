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
  const calls = [], children = new Map(), options = { orderId: 'order-1', orderCode: '0284', productCode: 'product-1', productTitle: 'Product', materialId: 'PE', materialName: 'PE' };
  let cursor = 0, fab, slots = [], confirmed = true;
  const variant = { id: 'variant-1', name: 'Variant', formula_code: 'F1', formula_count: 0, shares_complete: false };
  const source = { ...variant, id: 'source-1' };
  const state = { variants: [variant], loading: false, actionsBlocked: false, creating: false };
  const controller = {
    load: async () => { calls.push(['load']); },
    beginCreate: async () => { calls.push(['beginCreate']); state.creating = state.actionsBlocked = true; return 'request-1'; },
    cancelCreate: () => { calls.push(['cancelCreate']); state.creating = state.actionsBlocked = false; },
    beginReuse: () => { calls.push(['beginReuse']); state.creating = state.actionsBlocked = true; return true; },
    cancelReuse: () => { calls.push(['cancelReuse']); state.creating = state.actionsBlocked = false; },
    reuse: async id => { calls.push(['reuse', id]); return variant; },
    rename: async (item, name) => { calls.push(['rename', item.id, name]); return { ...item, name }; },
    remove: async item => { calls.push(['remove', item.id]); return true; },
  };
  state.controller = controller;
  const react = { useCallback: fn => fn, useRef: value => {
    const i = cursor++; return slots[i] ??= { current: value };
  }, useState: value => {
    const storage = slots, i = cursor++; if (!(i in storage)) storage[i] = value;
    return [storage[i], next => { storage[i] = typeof next === 'function' ? next(storage[i]) : next; }];
  } };
  const ui = new Proxy({ usePreparationText: () => value => value, usePreparationDialogs: () => ({
    confirm: async (...args) => { calls.push(['confirm', ...args]); return confirmed; },
  }) },
    { get: (object, key) => object[key] ?? key });
  const menu = Object.assign(function Menu() {}, { Trigger: 'MenuTrigger', Items: 'MenuItems' });
  const menuItem = Object.assign(function Item() {}, { LeadingIcon: 'LeadingIcon', Text: 'ItemText' });
  const mocks = {
    'react/jsx-runtime': jsx, react, '@expo/ui/jetpack-compose': { useMaterialColors: () => ({}), useNativeState: value => ({ value }),
      Host: 'Host', Box: 'Box', RNHostView: 'RNHostView', DropdownMenu: menu, DropdownMenuItem: menuItem,
      OutlinedTextField: Object.assign(() => {}, { Label: 'FieldLabel' }), Text: 'Text' },
    '@expo/ui/jetpack-compose/modifiers': { fillMaxWidth: () => ({}), size: () => ({}), testID: value => value }, 'expo-symbols': { SymbolView: 'SymbolView' },
    'expo-router': { useFocusEffect() {}, useLocalSearchParams: () => ({ data: 'route-data' }),
      router: { canGoBack: () => true, back: () => calls.push(['back']) } },
    'react-native': { View: 'View', Text: 'Text', Pressable: 'Pressable', FlatList: 'FlatList', StyleSheet: { create: value => value } },
    'react-native-reanimated': { useSharedValue: value => ({ value }) },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 24 }) },
    '../components/WorkerQueueCard.android': { WorkerQueueCard: 'WorkerQueueCard' },
    '../components/WorkerOrderSheet': { WorkerOrderSheet: 'WorkerOrderSheet' },
    '../shared/navigation/RoleHeader.android': { RoleHeader: 'RoleHeader' }, '../shared/orders/OrdersList': { OrdersList: 'OrdersList' },
    './PreparationContext.android': { usePreparationContext: () => ({ session: {} }) },
    './PreparationFab.android': { usePreparationFab: (scope, config) => { fab = { scope, ...config }; return () => {}; } },
    './PreparationUI.android': ui, './usePreparationAndroidView.android': { usePreparationVariantsView: () => state },
    './usePreparationNotice': { usePreparationNotice: () => ({ message: '', show() {} }) },
    './preparationNavigation.android': { readPreparationRouteData: () => options, openPreparationFormula: value => calls.push(['formula', value]) },
    './preparationVariantPresentation': { preparationVariantSubtitle: () => 'F1 • Tarkib hali kiritilmagan',
      preparationVariantRemoveMessage: () => 'Remove variant?', preparationVariantRemovedMessage: () => 'Removed' },
    './preparationLibraryPresentation': { preparationCatalogSubtitle: () => 'F1 • Product • PE' },
    './usePreparationReusePicker.android': { usePreparationReusePicker: () => ({ items: [source], loading: false, error: null,
      hasMore: true, setQuery: value => calls.push(['search', value]), loadMore: () => calls.push(['more']) }) },
  };
  const filename = path.resolve(__dirname, '../src/preparation/PreparationVariants.android.tsx'), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths;
  mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : id.startsWith('.') ? {} : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, filename);
  const wrapper = mod.exports.PreparationFormulaVariantsScreen();
  return { calls, state, options, variant, source, menu, menuItem, confirm: value => { confirmed = value; }, fab: () => fab,
    render: () => { cursor = 0; return wrapper.type(wrapper.props); },
    renderPart: node => {
      const previousSlots = slots, previousCursor = cursor;
      if (!children.has(node.type)) children.set(node.type, []);
      slots = children.get(node.type); cursor = 0;
      try { return node.type(node.props); } finally { slots = previousSlots; cursor = previousCursor; }
    } };
}

test('variant cards keep opening and refresh behavior while actions move to the dots', async () => {
  const x = setup(); let tree = x.render();
  const list = nodes(tree, node => node.type === 'OrdersList')[0];
  await list.props.onRefresh(); assert.deepEqual(x.calls.at(-1), ['load']);
  let row = nodes(list, node => node.type?.name === 'VariantRow')[0];
  let card = x.renderPart(row);
  assert.equal(card.type, 'WorkerQueueCard');
  assert.equal(card.props.onLongPress, undefined);
  card.props.onPress();
  assert.deepEqual(x.calls.at(-1), ['formula', { ...x.options, variantId: x.variant.id, variantName: x.variant.name, variantCode: 'F1', openEditorOnLoad: false }]);
  tree = x.render();
  row = nodes(tree, node => node.type?.name === 'VariantRow')[0]; card = x.renderPart(row);
  assert.equal(card.props.onPress, undefined); assert.equal(card.props.onLongPress, undefined);
  assert.equal(nodes(card, node => node.type === 'Pressable')[0].props.disabled, true);
  assert.equal(x.fab().enabled, false);
  nodes(tree, node => node.type === 'RoleHeader')[0].props.navigation.onPress(); assert.deepEqual(x.calls.at(-1), ['back']);
});

test('only dots open the anchored menu and actions target the selected variant', async () => {
  const x = setup(), frames = [], previousFrame = global.requestAnimationFrame;
  global.requestAnimationFrame = callback => { frames.push(callback); return frames.length; };
  const openMenu = () => {
    const row = nodes(x.render(), node => node.type?.name === 'VariantRow')[0];
    let card = x.renderPart(row);
    assert.equal(nodes(card, node => node.type === 'Host').length, 0);
    const trigger = nodes(card, node => node.type === 'Pressable')[0];
    let stopped = false;
    trigger.props.onPress({ stopPropagation: () => { stopped = true; } });
    assert.equal(stopped, true);
    card = x.renderPart(row);
    const sameTrigger = nodes(card, node => node.type === 'Pressable')[0];
    assert.equal(sameTrigger.type, trigger.type); assert.equal(sameTrigger.props.style, trigger.props.style);
    const popup = nodes(card, node => node.type?.name === 'VariantMenu')[0];
    let tree = x.renderPart(popup);
    nodes(tree, node => node.type === 'Host')[0].props.onLayoutContent({ nativeEvent: { width: 48, height: 48 } });
    tree = x.renderPart(popup);
    assert.equal(nodes(tree, node => node.type === x.menu)[0].props.expanded, true);
    return nodes(tree, node => node.type === x.menuItem);
  };
  try {
    let items = openMenu();
    assert.equal(x.calls.some(call => call[0] === 'formula'), false);
    assert.deepEqual(items.map(item => nodes(item, node => node.type === 'Text')[0].props.children), ['Tahrirlash', 'O‘chirish', 'Nomini o‘zgartirish']);
    items[2].props.onClick(); frames.shift()();
    let dialog = nodes(x.render(), node => node.type?.name === 'VariantNameDialog')[0];
    assert.equal(dialog.props.initial, 'Variant'); dialog.props.submit('Updated'); await tick();
    assert.ok(x.calls.some(call => call[0] === 'rename' && call[1] === 'variant-1' && call[2] === 'Updated'));
    x.confirm(false); items = openMenu(); items[1].props.onClick(); frames.shift()(); await tick();
    assert.equal(x.calls.some(call => call[0] === 'remove'), false);
    x.confirm(true); items = openMenu(); items[1].props.onClick(); frames.shift()(); await tick();
    assert.ok(x.calls.some(call => call[0] === 'remove' && call[1] === 'variant-1'));
    items = openMenu(); items[0].props.onClick(); frames.shift()(); await tick();
    assert.equal(x.calls.at(-1)[0], 'formula'); assert.equal(x.calls.at(-1)[1].variantId, 'variant-1');
    assert.equal(x.calls.at(-1)[1].openEditorOnLoad, true);
  } finally { global.requestAnimationFrame = previousFrame; }
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
  const openedPicker = nodes(tree, node => node.type?.name === 'ReusePicker')[0];
  const sheet = openedPicker.type(openedPicker.props);
  nodes(sheet, node => typeof node.props?.onValueChange === 'function')[0].props.onValueChange('PE');
  assert.deepEqual(x.calls.at(-1), ['search', 'PE']);
  const list = nodes(sheet, node => node.type === 'FlatList')[0];
  list.props.onEndReached(); assert.deepEqual(x.calls.at(-1), ['more']);
  const row = list.props.renderItem({ item: x.source, index: 0 }), card = x.renderPart(row);
  assert.equal(card.type, 'WorkerQueueCard');
  card.props.onPress(); await tick();
  assert.ok(x.calls.some(call => call[0] === 'reuse' && call[1] === 'source-1'));
  assert.equal(x.calls.at(-1)[0], 'formula'); assert.equal(x.calls.at(-1)[1].materialId, 'PE');
});
