// Native control callbacks only; no camera, printer or device is used.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

const jsx = { Fragment: 'Fragment', jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
function load(name, mocks) {
  const filename = path.resolve(__dirname, `../src/homashyo/${name}`), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths;
  mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, filename);
  return mod.exports;
}
function find(node, predicate) {
  if (!node || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap(child => find(child, predicate));
  return [...(predicate(node) ? [node] : []), ...find(node.props?.children, predicate)];
}
const colors = { surfaceContainerLow: 'surface', onSurfaceVariant: 'muted' };
const compose = new Proxy({ Shape: { RoundedCorner: props => props }, useMaterialColors: () => colors, useNativeState: initial => {
  let value = initial; return { get: () => value, set: next => { value = next; } };
} }, { get: (target, name) => target[name] ?? name });

// V2 raw_material_split_screen.dart:505–520: native icon actions stay disabled while busy.
test('Android Homashyo header uses native icon actions with source enable conditions', () => {
  const calls = [], router = { push: value => calls.push(['push', value]), canGoBack: () => false,
    replace: value => calls.push(['replace', value]), back: () => calls.push(['back']) };
  const { RawSplitFrame } = load('RawSplitFrame.android.tsx', {
    'react/jsx-runtime': jsx, '@expo/ui/jetpack-compose': compose,
    '@expo/ui/jetpack-compose/modifiers': { semantics: value => ({ semantics: value }), testID: value => ({ testID: value }) },
    'expo-router': { router }, 'expo-symbols': { SymbolView: 'SymbolView' }, 'react-native': { View: 'View' },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 24, bottom: 16 }) },
    '../shared/navigation/RoleHeader.android': { RoleHeader: 'RoleHeader' },
    '../shared/navigation/roleDrawerContext': { useRoleDrawer: () => ({ open: () => calls.push(['drawer']) }) },
    '../preparation/PreparationUI.android': { usePreparationText: () => value => value },
    './RawSplitBusy': { RawSplitBusy: 'Busy' }, './RawSplitDock.android': { RawSplitDock: 'Dock' },
  });
  const render = props => RawSplitFrame({ title: 'Rezka', page: 'home', onPrinter: () => calls.push(['printer']), children: null, ...props });
  let tree = render({ busy: true });
  assert.deepEqual(find(tree, node => node.type === 'IconButton').map(node => node.props.enabled), [false, false]);
  tree = render({ printerDisabled: true });
  let actions = find(tree, node => node.type === 'IconButton');
  assert.deepEqual(actions.map(node => node.props.enabled), [true, false]);
  assert.deepEqual(actions.map(node => node.props.modifiers[0].semantics.contentDescription), ['Rezka tarixi', 'Printer tanlash']);
  actions[0].props.onClick();
  tree = render({}); actions = find(tree, node => node.type === 'IconButton'); actions[1].props.onClick();
  assert.deepEqual(calls, [['push', '/android-homashyo/history'], ['printer']]);
  const history = render({ page: 'history' });
  find(history, node => node.type === 'RoleHeader')[0].props.navigation.onPress();
  assert.deepEqual(calls.at(-1), ['replace', '/android-homashyo']);
  router.canGoBack = () => true;
  find(render({ page: 'history' }), node => node.type === 'RoleHeader')[0].props.navigation.onPress();
  assert.deepEqual(calls.at(-1), ['back']);
});

// V2 raw_material_split_screen.dart:399–426 unfocuses before confirming width or appending a roll.
test('Android width Done and add-roll dismiss the keyboard before changing the draft', () => {
  const calls = [], state = { barcode: '', source: { itemName: 'Film', warehouse: 'Raw' }, outputs: [
    { width: '400', gross: '40', bobina: '1', length: '1000' }], waste: '', issueNote: '',
    showIssue: false, issueSaved: false, printer: null, snapshot: { warehouses: [] },
    error: null, snapshotError: null, issueError: null, pending: null, pendingIssue: null, pendingCheck: 'ready' };
  const controller = { getSnapshot: () => state, subscribe: () => () => {}, locked: false, writesHeld: false,
    widthPlan: { errors: [null], canAdd: true }, wasteCheck: null,
    confirmWidth: () => calls.push('confirm'), addRoll: () => calls.push('add') };
  const { RawSplitHome } = load('RawSplitHome.android.tsx', {
    'react/jsx-runtime': jsx, react: { useEffect() {}, useLayoutEffect() {}, useRef: value => ({ current: value }),
      useState: value => [value, () => {}], useSyncExternalStore: (_subscribe, get) => get() },
    '@expo/ui/jetpack-compose': compose,
    '@expo/ui/jetpack-compose/modifiers': { fillMaxWidth() {}, semantics() {}, testID() {} },
    'expo-symbols': { SymbolView: 'SymbolView' },
    'react-native': { ScrollView: 'ScrollView', Text: 'Text', View: 'View' },
    '../components/useBaseTheme': { useBaseTheme: () => ({ mode: 'light' }) },
    '../components/WorkerSheetButton': { WorkerSheetButton: 'WorkerSheetButton' },
    '../preparation/PreparationUI.android': { PreparationText: 'PreparationText', usePreparationText: () => value => value },
    '../shared/filters/DropdownFilter.android': { DropdownFilter: 'DropdownFilter' },
    './rawSplitHomePresentation': { rawSplitBalance: () => '', rawSplitNetLabel: () => '', rawSplitSourceSummary: () => '',
      rawSplitWasteWidthLabel: () => null, rawSplitWidthSummary: () => '' },
    './useRawSplitWriteHoldText': { useRawSplitWriteHoldText: () => '' },
  });
  const tree = RawSplitHome({ controller, onScan() {} });
  const focusField = label => {
    const input = find(tree, node => typeof node.type === 'function' && node.props.label === label)[0];
    const field = find(input.type(input.props), node => node.type === 'OutlinedTextField')[0];
    field.props.ref.current = { blur: () => { calls.push('dismiss'); return Promise.resolve(); } };
    field.props.onFocusChanged(true); return field;
  };
  focusField('Eni (mm)').props.keyboardActions.onDone();
  focusField('Og‘irlik (kg)');
  find(tree, node => node.type === 'WorkerSheetButton' && node.props.label === '+ rulon')[0].props.onPress();
  assert.deepEqual(calls, ['dismiss', 'confirm', 'dismiss', 'add']);
});

// V2 showPrintDevicePicker opens a dismissible showModalBottomSheet, not a page.
test('Android printer picker reuses the native bottom sheet and shared device content', () => {
  const request = { adapter: {} }, owner = {}, closed = [];
  const { RawSplitPickerOverlay } = load('RawSplitPickerOverlay.android.tsx', {
    'react/jsx-runtime': jsx,
    '../components/WorkerOrderSheet': { WorkerOrderSheet: 'WorkerOrderSheet' },
    '../components/useBaseTheme': { useBaseTheme: () => ({ mode: 'light' }) },
    '../components/WorkerSheetButton': { WorkerSheetButton: 'WorkerSheetButton' },
    '../preparation/PreparationUI.android': { PreparationText: 'PreparationText', usePreparationText: () => value => value },
    '../shared/printing/DeviceSheet': { DeviceSheet: 'DeviceSheet' },
    './useRawSplitPickerOverlay': { useRawSplitPickerOverlay: (actualRequest, actualOwner) => {
      assert.equal(actualRequest, request); assert.equal(actualOwner, owner); return () => closed.push(request);
    } },
  });
  const tree = RawSplitPickerOverlay({ request, owner });
  assert.equal(tree.type, 'WorkerOrderSheet'); assert.equal(tree.props.dismissible, true); assert.equal(tree.props.fitContent, true);
  const content = tree.props.children;
  assert.equal(content.type, 'DeviceSheet'); assert.equal(content.props.operator, request.adapter);
  assert.equal(content.props.safe, true); assert.equal(content.props.printerOnly, undefined);
  assert.equal(content.props.Label, 'PreparationText'); assert.equal(typeof content.props.Action, 'function');
  tree.props.onClose(); content.props.close();
  assert.deepEqual(closed, [request, request]);
});
