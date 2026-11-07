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
  mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, filename);
  return mod.exports;
}
const tick = () => new Promise(resolve => setImmediate(resolve));
const candidate = (id, options = ['apparatus:print:1']) => ({ order: { map: {
  id, code: '0004', order_number: '004', title: 'Paket', product_code: 'PET',
} }, apparatus_options: options });

function assignmentSetup(options = {}) {
  const calls = [], frames = new Map(), slots = []; let cursor = 0, frameId = 0, valid = true, cleanup;
  const orders = options.orders ?? [candidate('order-1'), candidate('order-2')];
  const react = {
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = index === 0 ? { lookup: { assignment: null }, candidates: orders, loading: false, error: null } : initial;
      return [slots[index], value => { slots[index] = typeof value === 'function' ? value(slots[index]) : value; }];
    },
    useRef(initial) { const index = cursor++; if (!(index in slots)) slots[index] = { current: initial }; return slots[index]; },
    useEffect(effect, dependencies) { if (dependencies?.length === 0 && !cleanup) cleanup = effect(); },
  };
  const dialogs = {
    choose: async (...args) => { calls.push(['choose', ...args]); return options.apparatus ?? null; },
    confirm: async (...args) => { calls.push(['confirm', ...args]); return options.confirmPromise ?? options.confirm !== false; },
    message: (...args) => calls.push(['message', ...args]),
  };
  const mocks = {
    'react/jsx-runtime': jsx, react, 'react-native': { View: 'View' },
    '../apparatusApi': { adminApparatus: async () => options.catalog ?? [] }, '../auth': {}, '../rawMaterialLookupApi': {},
    '../rawMaterialUnlinkApi': {}, '../sessionReadScope': {},
    './preparationInventoryAssignment': { preparationAssignMaterial: async (_session, id, barcode, apparatus, beforeSend) => {
      beforeSend(); calls.push(['assign', id, barcode, apparatus]);
    } },
    './PreparationInventoryOrderPicker.android': { PreparationInventoryOrderPicker: 'OrderPicker' },
    './preparationOrderCandidateSearch': { preparationOrderCandidateLabel: value => `${value.order.map.code} · ${value.order.map.title}` },
    './PreparationInventoryDetails.android': { InventoryDetailRow: 'DetailRow', InventorySheetButton: 'SheetButton', InventorySheetNote: 'SheetNote' },
    './PreparationUI.android': { PreparationText: 'PreparationText', usePreparationText: () => value => value, usePreparationDialogs: () => dialogs },
  };
  const { PreparationInventoryAssignment } = load('PreparationInventoryAssignmentSection.android.tsx', mocks);
  const props = { session: {}, barcode: 'QR-1', allowAssignment: true,
    changed: async () => { calls.push(['refresh']); }, isCurrent: () => valid };
  const render = () => { cursor = 0; return PreparationInventoryAssignment(props); };
  const previousFrame = global.requestAnimationFrame, previousCancel = global.cancelAnimationFrame;
  global.requestAnimationFrame = callback => { frames.set(++frameId, callback); return frameId; };
  global.cancelAnimationFrame = id => frames.delete(id);
  return { calls, orders, render, invalidate: () => { valid = false; }, unmount: () => cleanup?.(), runFrame: () => {
    const [id, callback] = frames.entries().next().value; frames.delete(id); callback();
  }, restore: () => { global.requestAnimationFrame = previousFrame; global.cancelAnimationFrame = previousCancel; } };
}

test('order picker cancellation does not assign, and selection keeps the chosen order and barcode', async () => {
  const x = assignmentSetup();
  try {
    let tree = x.render();
    nodes(tree, node => node.type === 'SheetButton' && node.props.label === 'Buyurtmaga ulash')[0].props.onPress();
    tree = x.render();
    let picker = nodes(tree, node => node.type === 'OrderPicker')[0];
    assert.deepEqual(picker.props.candidates, x.orders);
    picker.props.onClose();
    assert.equal(nodes(x.render(), node => node.type === 'OrderPicker').length, 0);
    assert.deepEqual(x.calls, []);
    nodes(x.render(), node => node.type === 'SheetButton' && node.props.label === 'Buyurtmaga ulash')[0].props.onPress();
    picker = nodes(x.render(), node => node.type === 'OrderPicker')[0];
    picker.props.onSelect(x.orders[1]);
    assert.equal(nodes(x.render(), node => node.type === 'OrderPicker').length, 0);
    x.runFrame(); await tick();
    assert.deepEqual(x.calls.slice(0, 3), [
      ['confirm', 'Buyurtmaga ulash', '0004 · Paket buyurtmasiga ulansinmi?', 'Ulash'],
      ['assign', 'order-2', 'QR-1', 'apparatus:print:1'], ['refresh'],
    ]);
  } finally { x.restore(); }
});

test('multiple apparatus choice is preserved and an expired screen cannot assign', async () => {
  const order = candidate('order-3', ['apparatus:print:1', 'apparatus:print:2']);
  const x = assignmentSetup({ orders: [order], apparatus: 'apparatus:print:2', catalog: [
    { id: 'apparatus:print:1', name: 'A' }, { id: 'apparatus:print:2', name: 'B' },
  ] });
  try {
    nodes(x.render(), node => node.type === 'SheetButton')[0].props.onPress();
    nodes(x.render(), node => node.type === 'OrderPicker')[0].props.onSelect(order);
    x.runFrame(); await tick();
    assert.equal(x.calls[0][0], 'choose'); assert.equal(x.calls[0][1], 'Apparatni tanlang');
    assert.deepEqual(x.calls.find(call => call[0] === 'assign'), ['assign', 'order-3', 'QR-1', 'apparatus:print:2']);
  } finally { x.restore(); }
  const stale = assignmentSetup({ orders: [order] });
  try {
    nodes(stale.render(), node => node.type === 'SheetButton')[0].props.onPress();
    nodes(stale.render(), node => node.type === 'OrderPicker')[0].props.onSelect(order);
    stale.invalidate(); stale.runFrame(); await tick();
    assert.deepEqual(stale.calls, []);
  } finally { stale.restore(); }
});

test('cancelling confirmation does not send an assignment', async () => {
  const x = assignmentSetup({ confirm: false });
  try {
    nodes(x.render(), node => node.type === 'SheetButton')[0].props.onPress();
    nodes(x.render(), node => node.type === 'OrderPicker')[0].props.onSelect(x.orders[0]);
    x.runFrame(); await tick();
    assert.equal(x.calls[0][0], 'confirm');
    assert.equal(x.calls.some(call => call[0] === 'assign'), false);
  } finally { x.restore(); }
});

test('closing the material details while confirmation is open does not send an assignment', async () => {
  let resolveConfirmation;
  const confirmPromise = new Promise(resolve => { resolveConfirmation = resolve; });
  const x = assignmentSetup({ confirmPromise });
  try {
    nodes(x.render(), node => node.type === 'SheetButton')[0].props.onPress();
    nodes(x.render(), node => node.type === 'OrderPicker')[0].props.onSelect(x.orders[0]);
    x.runFrame(); await tick();
    assert.equal(x.calls[0][0], 'confirm');
    x.unmount(); resolveConfirmation(true); await tick();
    assert.equal(x.calls.some(call => call[0] === 'assign'), false);
  } finally { x.restore(); }
});

test('native picker waits for its sheet to close before returning the selected order', async () => {
  const calls = [], order = candidate('order-1'); let resolveHide;
  const hide = new Promise(resolve => { resolveHide = resolve; });
  const ui = { usePreparationText: () => value => value };
  const mocks = {
    'react/jsx-runtime': jsx, react: { useRef: value => ({ current: value }), useEffect() {} },
    '@expo/ui': { Host: 'Host', TextInput: 'TextInput', useNativeState: value => ({ value, set(next) { this.value = next; } }) },
    '@expo/ui/jetpack-compose': { useMaterialColors: () => ({}) }, 'expo-symbols': { SymbolView: 'SymbolView' },
    'react-native': { FlatList: 'FlatList', Keyboard: { dismiss: () => calls.push(['keyboard']) }, Text: 'Text', View: 'View',
      StyleSheet: { create: value => value, hairlineWidth: 1 }, useWindowDimensions: () => ({ height: 800 }) },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 24, bottom: 24 }) },
    '../components/WorkerIconButton.android': { WorkerIconButton: 'WorkerIconButton' },
    '../components/WorkerOrderSheet.android': { WorkerOrderSheet: 'WorkerOrderSheet' },
    '../components/WorkerQueueCard.android': { WorkerQueueCard: 'WorkerQueueCard' },
    './preparationOrderCandidateSearch': { preparationOrderCandidateLabel: value => value.order.map.title },
    './usePreparationInventoryOrderPicker': { usePreparationInventoryOrderPicker: () => ({ items: [order], input: '',
      setInput: value => calls.push(['search', value]), loadMore: () => calls.push(['more']) }) },
    './PreparationUI.android': ui,
  };
  const { PreparationInventoryOrderPicker } = load('PreparationInventoryOrderPicker.android.tsx', mocks);
  const tree = PreparationInventoryOrderPicker({ candidates: [order], onClose: () => calls.push(['close']), onSelect: value => calls.push(['select', value]) });
  assert.equal(tree.props.fitContent, true); assert.equal(tree.props.dismissible, true);
  tree.props.sheetRef.current = { hide: () => { calls.push(['hide']); return hide; } };
  const search = nodes(tree, node => node.type === 'TextInput')[0];
  assert.equal(search.props.placeholder, 'Buyurtma qidiring'); search.props.onChangeText('PET');
  const list = nodes(tree, node => node.type === 'FlatList')[0]; list.props.onEndReached();
  const card = list.props.renderItem({ item: order, index: 0 });
  card.props.onPress(); card.props.onPress();
  assert.deepEqual(calls, [['search', 'PET'], ['more'], ['keyboard'], ['hide']]);
  resolveHide(); await tick();
  assert.deepEqual(calls.at(-1), ['select', order]);
  const dismissed = PreparationInventoryOrderPicker({ candidates: [order], onClose: () => calls.push(['close']), onSelect: () => calls.push(['unexpected']) });
  dismissed.props.onClose(); dismissed.props.onClose();
  assert.equal(calls.filter(call => call[0] === 'close').length, 1);
});
