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
function load(mocks) {
  const filename = path.resolve(__dirname, '../src/preparation/PreparationFab.android.tsx');
  const mod = new Module(filename, module); mod.filename = filename; mod.paths = module.paths;
  mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, filename);
  return mod.exports;
}

test('one FAB stays mounted and visible across home, warehouse loading and back', () => {
  let pathname = '/android-preparation', cursor = 0;
  const state = [], calls = [];
  const react = {
    createContext: () => ({ Provider: 'FabContext' }), useContext() {}, useLayoutEffect() {},
    useRef: value => ({ current: value }), useCallback: fn => fn, useMemo: fn => fn(),
    useState(initial) { const at = cursor++; if (!(at in state)) state[at] = initial;
      return [state[at], next => { state[at] = typeof next === 'function' ? next(state[at]) : next; }]; },
  };
  const mocks = { 'react/jsx-runtime': jsx, react,
    'expo-router': { usePathname: () => pathname, useFocusEffect() {} },
    'react-native': { View: 'View', StyleSheet: { absoluteFill: { position: 'absolute' }, create: value => value } },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ bottom: 24 }) },
    '../shared/navigation/RoleFab.android': { RoleFab: 'RoleFab' },
  };
  const { PreparationFabProvider } = load(mocks);
  const render = () => { cursor = 0; return PreparationFabProvider({ children: 'native-stack' }); };
  const getFab = tree => nodes(tree, node => node.type === 'RoleFab')[0];
  const overlay = tree => nodes(tree, node => node.type === 'View' && node.props.pointerEvents)[0];
  const options = (actions, enabled, visible, name) => ({ actions, enabled, visible,
    onSelect: id => calls.push([name, id]), openLabel: 'Open', closeLabel: 'Close' });
  const homeActions = [{ id: 'warehouse', label: 'Ombor', icon: 'warehouse', width: 164 }];
  const warehouseActions = [{ id: 'scale', label: 'Tarozi kirimi', icon: 'scale', width: 210 },
    { id: 'warehouse', label: 'Ombor qo‘shish', icon: 'warehouse', width: 220 }];

  let tree = render(), context = tree.props.value;
  const firstFab = getFab(tree);
  assert.equal(overlay(tree).props.style[1].opacity, 1);
  assert.equal(overlay(tree).props.pointerEvents, 'none');
  const unregisterHome = context.register('home', {}, options(homeActions, true, true, 'home'));
  context.setDockHeight(104);
  tree = render(); context = tree.props.value;
  assert.equal(getFab(tree).props.bottomOffset, 120);
  assert.equal(overlay(tree).props.pointerEvents, 'box-none');
  getFab(tree).props.onSelect('warehouse');
  assert.deepEqual(calls.at(-1), ['home', 'warehouse']);

  pathname = '/android-preparation/warehouse';
  unregisterHome();
  tree = render(); context = tree.props.value;
  assert.equal(getFab(tree).type, firstFab.type);
  assert.equal(getFab(tree).key, firstFab.key);
  assert.equal(getFab(tree).props.bottomOffset, 120);
  assert.equal(overlay(tree).props.style[1].opacity, 1);
  assert.equal(overlay(tree).props.pointerEvents, 'none');

  context.setDockHeight(24);
  tree = render(); context = tree.props.value;
  assert.equal(getFab(tree).props.bottomOffset, 120, 'a partially measured dock must not move the FAB');
  context.setDockHeight(104);
  tree = render(); context = tree.props.value;
  assert.equal(getFab(tree).props.bottomOffset, 120);

  const warehouseOwner = {};
  let unregisterWarehouse = context.register('warehouse', warehouseOwner, options([], false, true, 'warehouse'));
  tree = render(); context = tree.props.value;
  assert.equal(overlay(tree).props.style[1].opacity, 1);
  assert.equal(overlay(tree).props.pointerEvents, 'none');
  unregisterWarehouse();
  unregisterWarehouse = context.register('warehouse', warehouseOwner, options(warehouseActions, true, true, 'warehouse'));
  tree = render(); context = tree.props.value;
  assert.equal(overlay(tree).props.pointerEvents, 'box-none');
  assert.deepEqual(getFab(tree).props.actions, warehouseActions);
  getFab(tree).props.onSelect('scale');
  assert.deepEqual(calls.at(-1), ['warehouse', 'scale']);
  const newerOwner = {};
  const unregisterNewer = context.register('warehouse', newerOwner, options(warehouseActions, true, true, 'newer'));
  unregisterWarehouse();
  tree = render(); context = tree.props.value;
  getFab(tree).props.onSelect('scale');
  assert.deepEqual(calls.at(-1), ['newer', 'scale']);

  pathname = '/android-preparation/inventory';
  const inventoryActions = [{ id: 'scan', label: 'QR orqali izlash', icon: 'qr_code_scanner', width: 230 }];
  context.register('inventory', {}, options(inventoryActions, true, true, 'inventory'));
  tree = render(); context = tree.props.value;
  assert.equal(getFab(tree).type, firstFab.type);
  assert.deepEqual(getFab(tree).props.actions, inventoryActions);
  getFab(tree).props.onSelect('scan');
  assert.deepEqual(calls.at(-1), ['inventory', 'scan']);

  pathname = '/android-preparation/variants';
  const variantActions = [{ id: 'add', label: 'Variant qo‘shish', icon: 'add', width: 240 },
    { id: 'reuse', label: 'Qidirib variant qo‘shish', icon: 'search', width: 290 }];
  context.register('variants', {}, options(variantActions, true, true, 'variants'));
  tree = render(); context = tree.props.value;
  assert.equal(getFab(tree).type, firstFab.type);
  assert.equal(getFab(tree).key, firstFab.key);
  assert.equal(getFab(tree).props.bottomOffset, 120);
  assert.equal(overlay(tree).props.pointerEvents, 'box-none');
  assert.deepEqual(getFab(tree).props.actions, variantActions);
  getFab(tree).props.onSelect('reuse');
  assert.deepEqual(calls.at(-1), ['variants', 'reuse']);

  pathname = '/android-preparation/history';
  unregisterNewer();
  tree = render(); context = tree.props.value;
  assert.equal(overlay(tree).props.style[1].opacity, 0);
  assert.equal(overlay(tree).props.pointerEvents, 'none');
  assert.equal(getFab(tree).type, firstFab.type);

  pathname = '/android-preparation';
  tree = render(); context = tree.props.value;
  assert.equal(overlay(tree).props.style[1].opacity, 1);
  assert.equal(getFab(tree).props.bottomOffset, 120);
  context.register('home', {}, options(homeActions, true, true, 'home'));
  tree = render();
  assert.equal(overlay(tree).props.pointerEvents, 'box-none');
  assert.deepEqual(getFab(tree).props.actions, homeActions);
});

test('focused FAB actions dispatch the latest screen callback', () => {
  let cursor = 0, focus, registered;
  const refs = [], calls = [];
  const context = { register: (scope, owner, options) => { registered = { scope, owner, options }; return () => {}; }, setDockHeight() {} };
  const react = { createContext: () => ({ Provider: 'FabContext' }), useContext: () => context,
    useRef(value) { const at = cursor++; return refs[at] ??= { current: value }; },
    useLayoutEffect: effect => effect(), useCallback: fn => fn, useMemo: fn => fn() };
  const mocks = { 'react/jsx-runtime': jsx, react,
    'expo-router': { usePathname() {}, useFocusEffect: callback => { focus = callback; } },
    'react-native': { View: 'View', StyleSheet: { create: value => value } },
    'react-native-safe-area-context': {}, '../shared/navigation/RoleFab.android': { RoleFab: 'RoleFab' } };
  const { usePreparationFab } = load(mocks);
  const options = { actions: [{ id: 'scale', label: 'Tarozi', icon: 'scale', width: 210 }], enabled: true, visible: true,
    onSelect: id => calls.push(['old', id]), openLabel: 'Open', closeLabel: 'Close' };
  cursor = 0; usePreparationFab('warehouse', options); focus();
  assert.equal(registered.scope, 'warehouse');
  const dispatch = registered.options.onSelect;
  cursor = 0; usePreparationFab('warehouse', { ...options, onSelect: id => calls.push(['new', id]) });
  dispatch('scale');
  assert.deepEqual(calls, [['new', 'scale']]);
});
