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
function compile(filename, mocks) {
  filename = path.resolve(__dirname, '../src', filename);
  const mod = new Module(filename, module); mod.filename = filename; mod.paths = module.paths;
  mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, filename);
  return mod.exports;
}

function setupWarehouse() {
  const calls = [], slots = [];
  let index = 0, sheetContent;
  const home = { warehouse: 'Own', loading: false, saving: false, locked: false, error: null,
    snapshot: { assigned_warehouses: ['Own', 'Other'], managed_warehouses: ['Other'], material_warehouses: ['Own'],
      materials: [{ code: 'A1', name: 'Kley', visible_warehouses: ['own'], balances: { Own: '12' }, can_receive: true },
        { code: 'B2', name: 'Un', visible_warehouses: ['other'], balances: { Other: '7' }, can_receive: true }] } };
  home.controller = { loadForPage() {}, reload: async () => { calls.push(['reload']); },
    selectWarehouse: value => { home.warehouse = value; calls.push(['warehouse', value]); } };
  const react = { useCallback: fn => fn, useEffect() {}, useRef: value => {
    const at = index++; return slots[at] ??= { current: value };
  }, useState: value => {
    const at = index++; if (!(at in slots)) slots[at] = value;
    return [slots[at], next => { slots[at] = typeof next === 'function' ? next(slots[at]) : next; }];
  } };
  const logic = compile('preparation/preparationLogic.ts', {
    './preparationModel': compile('preparation/preparationModel.ts', {}),
  });
  const ui = new Proxy({ usePreparationText: () => text => text, usePreparationDialogs: () => ({}) }, { get: (object, key) => object[key] ?? key });
  const mocks = { 'react/jsx-runtime': jsx, react,
    '@expo/ui/jetpack-compose': { useMaterialColors: () => ({}) },
    'expo-router': { router: { canGoBack: () => true, back: () => calls.push(['back']),
      navigate: route => calls.push(['navigate', route]), push: route => calls.push(['push', route]) }, useFocusEffect() {} },
    'expo-symbols': { SymbolView: 'SymbolView' },
    'react-native': { View: 'View', Text: 'Text', StyleSheet: { create: value => value } },
    'react-native-reanimated': { useSharedValue: value => ({ value }) },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0 }) },
    '../components/WorkerQueueCard.android': { WorkerQueueCard: 'WorkerQueueCard' },
    '../shared/filters/DropdownFilter.android': { DropdownFilter: 'DropdownFilter' },
    '../shared/orders/OrdersHeader': { OrdersHeader: 'OrdersHeader' },
    '../shared/orders/OrdersList': { OrdersList: 'OrdersList' },
    '../nativeSheet': { useNativeSheet: () => ({ open: content => { sheetContent = content; }, close() {} }) },
    './PreparationContext.android': { usePreparationContext: () => ({ home, session: {} }) },
    './PreparationUI.android': ui, './preparationLogic': logic,
    './preparationModel': { preparationDisplay: value => value },
    './usePreparationNotice': { usePreparationNotice: () => ({ message: '', show() {} }) },
  };
  const filename = path.resolve(__dirname, '../src/preparation/PreparationStock.android.tsx'), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths;
  mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : id.startsWith('.') ? {} : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, filename);
  return { calls, home, sheetContent: () => sheetContent, render() { index = 0; return mod.exports.PreparationWarehouseScreen(); } };
}

test('warehouse reuses worker search and list while retaining warehouse selection and management', () => {
  const view = setupWarehouse();
  let tree = view.render();
  const header = nodes(tree, node => node.type === 'OrdersHeader')[0];
  assert.equal(header.props.searchPlaceholder, 'Qidirish');
  assert.ok(nodes(tree, node => node.type === 'OrdersList').length);
  assert.ok(nodes(tree, node => node.type === 'PreparationDock').length);
  header.props.onBack(); header.props.onProfile();
  assert.deepEqual(view.calls.slice(0, 2), [['back'], ['navigate', '/android-preparation/profile']]);

  const filter = nodes(tree, node => node.type === 'DropdownFilter')[0];
  assert.equal(filter.props.selectedLabel, 'Own');
  assert.deepEqual(filter.props.options.map(option => option.label), ['Own', 'Other']);
  assert.equal(filter.props.options[0].onLongPress, undefined);
  filter.props.options[1].onLongPress();
  assert.equal(nodes(view.sheetContent(), node => node.props?.title === 'Nomini o‘zgartirish').length, 1);
  assert.equal(nodes(view.sheetContent(), node => node.props?.title === 'O‘chirish').length, 1);
  filter.props.onChange('Other');
  tree = view.render();
  let rows = nodes(tree, node => typeof node.type === 'function' && node.type.name === 'WarehouseMaterialRow');
  assert.deepEqual(rows.map(row => row.props.item.code), ['B2']);
  const card = nodes(rows[0].type(rows[0].props), node => node.type === 'WorkerQueueCard')[0];
  card.props.onPress();
  assert.deepEqual(view.calls.at(-1), ['push', { pathname: '/android-preparation/material', params: { code: 'B2', warehouse: 'Other' } }]);

  nodes(tree, node => node.type === 'OrdersHeader')[0].props.onSearchChange('A1');
  tree = view.render();
  rows = nodes(tree, node => typeof node.type === 'function' && node.type.name === 'WarehouseMaterialRow');
  assert.equal(rows.length, 0);
  nodes(tree, node => node.type === 'OrdersHeader')[0].props.onSearchChange('B2');
  tree = view.render();
  rows = nodes(tree, node => typeof node.type === 'function' && node.type.name === 'WarehouseMaterialRow');
  assert.deepEqual(rows.map(row => row.props.item.code), ['B2']);
  assert.ok(nodes(tree, node => node.type === 'PreparationButton' && node.props.label === 'Tarozi kirimi').length);
});

test('shared dropdown keeps worker choices and supports warehouse long press', () => {
  const trigger = function Trigger() {}, menu = Object.assign(function Menu() {}, { Trigger: trigger, Items: 'Items' });
  const item = Object.assign(function Item() {}, { Text: 'ItemText' });
  let expanded = false, selected, managed = 0;
  const mocks = { 'react/jsx-runtime': jsx, react: { useState: () => [expanded, value => { expanded = value; }] },
    '@expo/ui': { Host: 'Host', Row: 'Row', Spacer: 'Spacer', Text: 'Text' },
    '@expo/ui/jetpack-compose': { Box: 'Box', DropdownMenu: menu, DropdownMenuItem: item, OutlinedButton: 'Button', Text: 'ComposeText' },
    '@expo/ui/jetpack-compose/modifiers': { combinedClickable: handlers => ({ handlers }), defaultMinSize: () => ({}),
      fillMaxWidth: () => ({}), padding: () => ({}) },
    '../../components/WorkerQueueCard.android': { WorkerQueueCard: 'WorkerQueueCard' },
  };
  const { DropdownFilter } = compile('shared/filters/DropdownFilter.android.tsx', mocks);
  const props = { label: 'Ombor', selectedLabel: 'Own', backgroundColor: 'white', onChange: value => { selected = value; },
    options: [{ value: 'Own', label: 'Own' }, { value: 'Other', label: 'Other', onLongPress: () => { managed++; } }] };
  let tree = DropdownFilter(props);
  nodes(tree, node => node.type === 'Button')[0].props.onClick();
  assert.equal(expanded, true);
  tree = DropdownFilter(props);
  nodes(tree, node => node.type === item)[0].props.onClick();
  assert.equal(selected, 'Own'); assert.equal(expanded, false);
  const box = nodes(tree, node => node.type === 'Box')[0];
  const gestures = box.props.modifiers.find(modifier => modifier.handlers).handlers;
  gestures.onClick(); assert.equal(selected, 'Other');
  const previous = global.requestAnimationFrame;
  global.requestAnimationFrame = callback => callback();
  try { gestures.onLongClick(); } finally { global.requestAnimationFrame = previous; }
  assert.equal(managed, 1);
});

test('worker filter still offers the same queue sizes through the shared dropdown', () => {
  let selected;
  const mocks = { 'react/jsx-runtime': jsx,
    '../workerQueueLimit': { QUEUE_LIMITS: [0, 5, 10] },
    '../shared/filters/DropdownFilter.android': { DropdownFilter: 'DropdownFilter' },
  };
  const { WorkerQueueFilter } = compile('components/WorkerQueueFilter.android.tsx', mocks);
  const tree = WorkerQueueFilter({ value: 5, enabled: true, backgroundColor: 'white', onChange: value => { selected = value; } });
  assert.equal(tree.props.selectedLabel, '5 ta');
  assert.deepEqual(tree.props.options.map(option => option.label), ['Barchasi', '5 ta', '10 ta']);
  tree.props.onChange(10); assert.equal(selected, 10);
});
