const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const jsx = { Fragment: 'Fragment', jsx: (type, props, key) => ({ type, props, key }), jsxs: (type, props, key) => ({ type, props, key }) };
function nodes(node, predicate) {
  if (!node || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap(child => nodes(child, predicate));
  return [...(predicate(node) ? [node] : []), ...nodes(node.props?.children, predicate)];
}
function load(relative, mocks) {
  const filename = path.resolve(__dirname, '../src', relative), loaded = new Module(filename, module);
  loaded.filename = filename; loaded.paths = module.paths;
  loaded.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText, filename);
  return loaded.exports;
}
const flush = () => new Promise(resolve => setImmediate(resolve));

function setup() {
  const calls = [], stateSlots = [], refs = [], effects = [], sheets = [];
  let cursor = 0, refCursor = 0, effectCursor = 0, sheetCursor = 0, current = true;
  const candidate = { barcode: 'QR-1', item_name: 'Film', item_code: 'IT-1', item_group: 'Film', warehouse: 'W1', qty: 12, uom: 'kg',
    apparatus_options: ['machine-a', 'machine-b'] };
  const assigned = { barcode: 'QR-2', order_id: 'order-1', item_name: 'Linked Film', item_code: 'IT-2', item_group: 'Film',
    apparatus: 'machine-a', stock_warehouse: 'W1', stock_qty: 8, stock_uom: 'kg', stock_status: 'available', assigned_at: '', consumed_qty: 0 };
  const state = { tab: 'manual', loading: false, error: null, orders: [{ map: { id: 'order-1', code: '1', title: 'Order', product_code: 'P1' } }],
    assignments: [assigned], apparatusOptions: [], selectedApparatus: '', candidates: [candidate], candidatesLoading: false,
    candidatesError: null, barcode: '', lookup: null, scanLoading: false, scanError: '', saving: false, assigningBarcode: '',
    unlinkingKey: '', expandedKey: null, notice: '' };
  const controller = {
    isCurrent: () => current, refresh: async () => {}, setTab: value => { state.tab = value; }, retryCandidates: async () => {},
    selectOrder: id => calls.push(['order', id]), selectApparatus: id => calls.push(['apparatus', id]),
    async assignCandidate(row, confirm, choose) {
      if (!await confirm() || !current) return;
      const machine = await choose(row.apparatus_options);
      if (current && machine !== null) calls.push(['assign', row.barcode, machine]);
    },
    async unlink(row, confirm) { if (await confirm() && current) calls.push(['unlink', row.barcode]); },
    save: async () => {}, scan: async code => { if (current) calls.push(['scan', code]); }, expand: key => { state.expandedKey = key; },
  };
  const model = { controller, state, t: key => key, groupScopeReady: true, selectedOrderLabel: 'Order', visibleAssignments: [assigned],
    canUnlink: () => true, assignmentKey: row => `${row.order_id}|${row.barcode}`, statusLabel: () => 'Available', formatQty: (qty, unit) => `${qty} ${unit}`,
    apparatusLabel: id => id === 'machine-a' ? 'First machine' : 'Second machine', orderLabel: () => 'Order',
    unlinkConfirmationMessage: () => 'Unlink this order?', diagnosticMessage: '', scannedOrderTitle: '', scannedOrderLabel: '',
    scannedStatusLabel: '', scannedLockMessage: '', canSave: false, assignmentAssignee: () => '', formatAssignmentTimestamp: () => '' };
  const react = {
    useState(initial) {
      const index = cursor++; if (!(index in stateSlots)) stateSlots[index] = initial;
      return [stateSlots[index], value => { stateSlots[index] = typeof value === 'function' ? value(stateSlots[index]) : value; }];
    },
    useRef(initial) { const index = refCursor++; return refs[index] ??= { current: initial }; },
    useSyncExternalStore: (_subscribe, get) => get(),
    useEffect(callback, dependencies) {
      const index = effectCursor++, old = effects[index];
      if (old && old.dependencies.every((value, i) => value === dependencies[i])) return;
      old?.cleanup?.(); effects[index] = { dependencies, cleanup: callback() };
    },
  };
  const Alert = Object.assign(function Alert() {}, { Trigger: 'Alert.Trigger', Message: 'Alert.Message', Actions: 'Alert.Actions' });
  const modifiers = Object.fromEntries(['buttonStyle', 'disabled', 'font', 'foregroundStyle', 'frame', 'pickerStyle', 'tag'].map(key => [key, value => ({ key, value })]));
  const mocks = { 'react/jsx-runtime': jsx, react,
    '@expo/ui/swift-ui': { Alert, Button: 'Button', Host: 'Host', HStack: 'HStack', Image: 'Image', Picker: 'Picker', ProgressView: 'ProgressView',
      Section: 'Section', Text: 'Text', VStack: 'VStack' }, '@expo/ui/swift-ui/modifiers': modifiers,
    'expo-router': { Stack: { Screen: 'Stack.Screen' } },
    'react-native': { PlatformColor: value => value, View: 'View', useWindowDimensions: () => ({ width: 390, height: 844 }) },
    '../homashyo/RawSplitScanner': { RawSplitScanner: 'RawSplitScanner' },
    '../nativeSheet': { useNativeSheet() {
      const index = sheetCursor++;
      return sheets[index] ??= { content: null, options: null, open(content, options) { this.content = content; this.options = options; calls.push(['sheet', index]); },
        close() { calls.push(['close', index]); }, isOpen() { return false; } };
    } }, '../preparation/PreparationUI': { PreparationList: 'PreparationList' },
    './MaterialAssignmentNotice': { MaterialAssignmentNotice: 'MaterialAssignmentNotice' },
    '../shared/localization': { localizedGetter: key => key },
    '../shared/localization/runtime': { localeController: { locale: 'uz' } },
    '../shared/orders/PickerSheetContent.ios': { PickerSheetContent: 'PickerSheetContent' },
    '../shared/searchNormalizer': { searchMatches: () => true }, './useMaterialAssignments': { useMaterialAssignments: () => model },
    './useMaterialAssignmentPicker': { useMaterialAssignmentPicker: () => ({ input: '', items: [], hasMore: false, setInput() {}, loadMore() {} }) },
  };
  const component = load('material/MaterialAssignments.ios.tsx', mocks).MaterialAssignments;
  const render = () => { cursor = 0; refCursor = 0; effectCursor = 0; sheetCursor = 0; return component(); };
  const button = (tree, label) => nodes(tree, node => node.type === 'Button' && node.props.label === label)[0];
  const candidateButton = tree => nodes(tree, node => node.type === 'Button' && nodes(node, text => text.type === 'Text' && text.props.children === 'Film').length)[0];
  return { render, calls, state, model, candidate, assigned, sheets, button, candidateButton, Alert, setCurrent: value => { current = value; } };
}

test('iOS candidate closes details before showing native apparatus dialog and assigning once', async () => {
  const h = setup(); h.candidateButton(h.render()).props.onPress();
  assert.deepEqual(h.calls, [['sheet', 0]]);
  const details = h.sheets[0], tree = details.content.type(details.content.props);
  const accept = h.button(tree, 'raw_material.assign_to_order');
  accept.props.onPress(); accept.props.onPress();
  await flush(); assert.deepEqual(h.calls, [['sheet', 0], ['close', 0]]);
  assert.equal(nodes(h.render(), node => node.type === h.Alert).length, 0);
  details.options.onDismiss(); await flush();
  const dialog = h.render(); assert.equal(nodes(dialog, node => node.type === h.Alert).length, 1);
  h.button(dialog, 'Second machine').props.onPress(); await flush();
  assert.deepEqual(h.calls.at(-1), ['assign', 'QR-1', 'machine-b']);
  assert.equal(nodes(h.render(), node => node.type === h.Alert).length, 0);
});

test('cancelled details and an expired account lifetime cannot assign', async () => {
  const cancelled = setup(); cancelled.candidateButton(cancelled.render()).props.onPress();
  cancelled.sheets[0].options.onDismiss(); await flush();
  assert.equal(nodes(cancelled.render(), node => node.type === cancelled.Alert).length, 0);
  assert.equal(cancelled.calls.filter(call => call[0] === 'assign').length, 0);
  const expired = setup(); expired.candidateButton(expired.render()).props.onPress();
  const content = expired.sheets[0].content;
  expired.button(content.type(content.props), 'raw_material.assign_to_order').props.onPress();
  expired.sheets[0].options.onDismiss(); await flush();
  const dialog = expired.render(), oldChoose = expired.button(dialog, 'First machine');
  expired.setCurrent(false); expired.render(); oldChoose.props.onPress(); await flush();
  assert.equal(expired.calls.filter(call => call[0] === 'assign').length, 0);
});

test('iOS keeps the two source tabs and guarded QR scanner completion', async () => {
  const h = setup(), first = h.render();
  assert.deepEqual(nodes(first, node => node.type === 'Picker')[0].props.children.map(node => node.props.children), ['Ro‘yxatdan', 'QR orqali']);
  nodes(first, node => node.type === 'Picker')[0].props.onSelectionChange('qr');
  h.button(h.render(), 'raw_material.qr_scan').props.onPress();
  let scanner = nodes(h.render(), node => node.type === 'RawSplitScanner')[0]; assert.equal(scanner.props.visible, true);
  scanner.props.onComplete('QR-NEXT'); await flush(); assert.deepEqual(h.calls.at(-1), ['scan', 'QR-NEXT']);
  h.setCurrent(false); assert.equal(h.render(), null);
});

function sequenceSetup() {
  const calls = [], raw = { barcode: 'RM' }, state = { scannerVisible: true, scannerStatus: 'prompt', selectedApparatus: 'a',
    selectedKeys: new Set(['RM']), loading: false, loadError: '', actionMessage: '', actionSucceeded: false, bulkAssigning: false };
  let current = true;
  const model = { state, apparatusOptions: ['a'], apparatusLabel: () => 'Printer', headerSubtitle: 'Order', widthRequirement: '500–520 mm', busy: false,
    p: key => key, t: (key, values) => values?.count === undefined ? key : `${key}:${values.count}`,
    candidates: [{ raw, key: 'RM', rank: 1, title: 'Film', subtitle: 'QR RM', details: ['Warehouse'], matchLabel: 'Exact', groupApparatus: '',
      selected: true, busy: false, selectionMode: true, actionLabel: 'selected' }], assignments: [],
    controller: { current: () => current, toggleScanner: () => calls.push('toggle'), selectApparatus: id => calls.push(['machine', id]),
      candidateAction: row => calls.push(['candidate', row]), toggleSelection: row => calls.push(['select', row]),
      assignSelected: async () => calls.push('bulk'), handleScan: async value => calls.push(['scan', value]), load: async () => calls.push('load') } };
  const mocks = { 'react/jsx-runtime': jsx,
    '@expo/ui/swift-ui': Object.fromEntries(['Button', 'Host', 'HStack', 'Image', 'List', 'Picker', 'ProgressView', 'RNHostView', 'Section', 'Text', 'VStack'].map(key => [key, key])),
    '@expo/ui/swift-ui/modifiers': { ...Object.fromEntries(['buttonStyle', 'disabled', 'font', 'foregroundStyle', 'frame', 'padding', 'pickerStyle', 'tag', 'contentShape'].map(key => [key, value => ({ key, value })])),
      shapes: { rectangle: () => 'rectangle' }, onTapGesture: onTap => ({ onTap }), onLongPressGesture: onLongPress => ({ onLongPress }) },
    'react-native': { PlatformColor: value => value }, './MaterialQuickScanner.ios': { MaterialQuickScanner: 'MaterialQuickScanner' },
    './useMaterialSequenceAssignment': { useMaterialSequenceAssignment: () => model } };
  const component = load('material/MaterialSequenceAssignment.ios.tsx', mocks).MaterialSequenceAssignment;
  return { model, calls, raw, render: () => component({ onClose: () => calls.push('close') }), retire: () => { current = false; } };
}

test('native sequence sheet wires selection, card action, bulk action and its embedded scanner', async () => {
  const h = sequenceSetup(), tree = h.render();
  const metadata = nodes(tree, node => node.type === 'VStack' && node.props.modifiers?.some(value => value.onTap))[0];
  metadata.props.modifiers.find(value => value.onTap).onTap(); metadata.props.modifiers.find(value => value.onLongPress).onLongPress();
  const buttons = nodes(tree, node => node.type === 'Button');
  buttons.find(node => node.props.label === 'selected').props.onPress();
  buttons.find(node => node.props.label === 'production.assignment.link_count:1').props.onPress();
  buttons.find(node => node.props.label === 'action.close').props.onPress();
  const camera = nodes(tree, node => node.type === 'MaterialQuickScanner')[0]; await camera.props.detect('RM-NEXT');
  assert.deepEqual(h.calls, [['candidate', h.raw], ['select', h.raw], ['candidate', h.raw], 'bulk', 'close', ['scan', 'RM-NEXT']]);
  h.retire(); assert.equal(h.render(), null);
});
