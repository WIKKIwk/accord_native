// Native render trees only. V2 appBarBottomLoading is raw_material_split_screen.dart:494
// and raw_material_split_history_screen.dart:175; no device, backend or printer is used.
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
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS,
    jsx: ts.JsxEmit.ReactJSX } }).outputText, filename);
  return mod.exports;
}
function find(node, predicate) {
  if (!node || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap(n => find(n, predicate));
  return [...(predicate(node) ? [node] : []), ...find(node.props?.children, predicate)];
}
test('both native busy surfaces remain indeterminate without fabricated progress or extra words', () => {
  const ios = load('RawSplitBusy.ios.tsx', { 'react/jsx-runtime': jsx, '@expo/ui/swift-ui': { Host: 'Host', ProgressView: 'ProgressView' } }).RawSplitBusy();
  const android = load('RawSplitBusy.android.tsx', { 'react/jsx-runtime': jsx,
    '@expo/ui/jetpack-compose': { Host: 'Host', LinearProgressIndicator: 'LinearProgressIndicator' },
    '@expo/ui/jetpack-compose/modifiers': { fillMaxWidth: () => ({ type: 'fillMaxWidth' }), height: value => ({ type: 'height', value }) } }).RawSplitBusy();
  assert.equal(ios.type, 'Host'); assert.equal(android.type, 'Host');
  assert.equal(ios.props.style.width, '100%'); assert.equal(android.props.style.width, '100%');
  assert.equal(ios.props.children.type, 'ProgressView'); assert.equal(ios.props.children.props.value, undefined);
  assert.equal(android.props.children.type, 'LinearProgressIndicator'); assert.equal(android.props.children.props.progress, undefined);
  assert.deepEqual(android.props.children.props.modifiers, [{ type: 'fillMaxWidth' }, { type: 'height', value: 3 }]);
  assert.equal(ios.props.children.props.children, undefined); assert.equal(android.props.children.props.children, undefined);
});
function iosScreen(page) {
  const state = { busy: false, pendingCheck: 'ready' }, controller = { writesHeld: false, subscribe() {}, getSnapshot: () => state, capturePrinterLease: () => state.busy || state.pendingCheck !== 'ready' || state.pending || state.pendingIssue ? null : () => true };
  const toolbar = Object.assign(() => {}, { Button: 'ToolbarButton' });
  const calls = [];
  const flow = { controller, pendingController: controller, isCurrent: () => true, scan() {}, isScannerCurrent: () => true, complete() {}, close() {} };
  const mocks = { 'react/jsx-runtime': jsx, react: { useSyncExternalStore: (_subscribe, get) => get(), useLayoutEffect() {} },
    'expo-router': { Stack: { Screen: 'StackScreen', Toolbar: toolbar }, router: { push: route => calls.push(route) } },
    'expo-symbols': { SymbolView: 'SymbolView' }, 'react-native': { View: 'View' },
    '../preparation/PreparationUI': { usePreparationText: () => value => value },
    './RawSplitBusy': { RawSplitBusy: 'Busy' }, './RawSplitHome': { RawSplitHome: 'Home' },
    './RawSplitHistory': { RawSplitHistory: 'History' }, './RawSplitPendingCheck': { RawSplitPendingCheck: 'PendingCheck' }, './RawSplitScanner': { RawSplitScanner: 'Scanner' },
    './useRawSplitHomeScreen': { useRawSplitHomeScreen: () => flow },
    './useRawSplitHistoryActions': { useRawSplitHistoryActions: () => flow },
    './useRawSplitHeaderPrinter': { useRawSplitHeaderPrinter: () => () => calls.push('picker') } };
  const component = load(`RawSplit${page}Screen.ios.tsx`, mocks)[`RawSplit${page}Screen`];
  return { state, calls, render: component };
}
for (const page of ['Home', 'History']) test(`iOS ${page} retains content while its native top busy feedback follows the controller`, () => {
  const h = iosScreen(page), contentType = page;
  assert.equal(find(h.render(), n => n.type === 'Busy').length, 0);
  h.state.busy = true; const busy = h.render();
  assert.equal(find(busy, n => n.type === 'Busy').length, 1);
  assert.equal(find(busy, n => n.type === contentType).length, 1);
  assert.ok(find(busy, n => n.type === 'ToolbarButton').every(n => n.props.disabled === true));
  const children = busy.props.children;
  assert.ok(children.findIndex(n => n && n.type === 'Busy') < children.findIndex(n => n && n.type === contentType));
  h.state.busy = false; const idle = h.render();
  assert.equal(find(idle, n => n.type === 'Busy').length, 0);
  assert.ok(find(idle, n => n.type === 'ToolbarButton').every(n => n.props.disabled === false));
  find(idle, n => n.type === 'ToolbarButton' && n.props.accessibilityLabel === 'Printer tanlash')[0].props.onPress();
  assert.deepEqual(h.calls, ['picker']);
});
function androidFrame() {
  const calls = [], mocks = { 'react/jsx-runtime': jsx,
    '@expo/ui/jetpack-compose': { Host: 'Host', IconButton: 'IconButton', RNHostView: 'RNHostView',
      useMaterialColors: () => ({ surfaceContainerLow: 'surface', onSurfaceVariant: 'muted' }) },
    '@expo/ui/jetpack-compose/modifiers': { semantics: value => ({ semantics: value }), testID: value => ({ testID: value }) },
    'expo-router': { router: { push: route => calls.push(route) } }, 'expo-symbols': { SymbolView: 'SymbolView' },
    'react-native': { View: 'View' },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0 }) },
    '../shared/navigation/RoleHeader.android': { RoleHeader: 'RoleHeader' },
    '../shared/navigation/roleDrawerContext': { useRoleDrawer: () => ({ open() {} }) },
    '../preparation/PreparationUI.android': { usePreparationText: () => value => value },
    './RawSplitBusy': { RawSplitBusy: 'Busy' }, './RawSplitDock.android': { RawSplitDock: 'Dock' } };
  const component = load('RawSplitFrame.android.tsx', mocks).RawSplitFrame;
  return { calls, render: (page, busy) => component({ page, title: page, busy, onPrinter: () => calls.push('picker'), children: jsx.jsx('Content', {}) }) };
}
for (const page of ['home', 'history']) test(`Android ${page} mounts its native busy feedback below the header and retains content and dock`, () => {
  const h = androidFrame(); assert.equal(find(h.render(page, false), n => n.type === 'Busy').length, 0);
  const busy = h.render(page, true), children = busy.props.children;
  assert.equal(children[1].type, 'Busy'); assert.equal(find(children[0], n => n.type === 'RoleHeader').length, 1);
  assert.equal(find(children[2], n => n.type === 'Content').length, 1); assert.equal(children[3].type, 'Dock');
  const busyActions = find(busy, n => n.type === 'IconButton');
  assert.equal(busyActions.length, page === 'home' ? 2 : 1);
  assert.ok(busyActions.every(n => n.props.enabled === false));
  const idle = h.render(page, false); assert.equal(find(idle, n => n.type === 'Busy').length, 0);
  const printer = find(idle, n => n.type === 'IconButton' && n.props.modifiers.some(modifier => modifier.semantics?.contentDescription === 'Printer tanlash'))[0];
  assert.equal(printer.props.enabled, true); printer.props.onClick(); assert.deepEqual(h.calls, ['picker']);
});
test('Android profile keeps the existing no-busy default', () => {
  assert.equal(find(androidFrame().render('profile'), n => n.type === 'Busy').length, 0);
});
for (const page of ['Home', 'History']) test(`iOS ${page} header printer stays disabled for unread and failed status while navigation remains present`, () => {
  const h = iosScreen(page); for (const status of ['unread', 'checking', 'failed']) {
    h.state.pendingCheck = status; h.state.busy = false; const tree = h.render();
    const printer = find(tree, n => n.type === 'ToolbarButton' && n.props.accessibilityLabel === 'Printer tanlash')[0];
    assert.equal(printer.props.disabled, true, status);
    if (page === 'Home') assert.equal(find(tree, n => n.type === 'ToolbarButton' && n.props.accessibilityLabel === 'Rezka tarixi')[0].props.disabled, false);
  }
});
test('History status failure shows the localized status-only retry without a spinner', () => {
  const state = { pendingCheck: 'failed', pendingCheckError: 'storage error', pending: null, pendingIssue: null, busy: false }, calls = [];
  const controller = { writesHeld: false, subscribe() {}, getSnapshot: () => state, recheckPending: async () => calls.push('recheck') };
  const mocks = { 'react/jsx-runtime': jsx, react: { useSyncExternalStore: (_sub, get) => get() },
    'react-native': { Text: 'Text', View: 'View', useColorScheme: () => 'light' }, '../components/WorkerSheetButton': { WorkerSheetButton: 'Button' },
    '../preparation/PreparationUI': { usePreparationText: () => value => `t(${value})` },
    './useRawSplitWriteHoldText': { useRawSplitWriteHoldText: () => 'saving paused' } };
  const tree = load('RawSplitPendingCheck.tsx', mocks).RawSplitPendingCheck({ controller, onOpenHome() {} });
  assert.equal(find(tree, n => n.type === 'Button' && n.props.label === 't(Qayta urinish)').length, 1);
  find(tree, n => n.type === 'Button')[0].props.onPress(); assert.deepEqual(calls, ['recheck']);
  state.pendingCheck = 'ready'; assert.equal(load('RawSplitPendingCheck.tsx', mocks).RawSplitPendingCheck({ controller, onOpenHome() {} }), null);
});
for (const platform of ['ios', 'android']) test(`${platform} deep-linked History starts only an unread shared status check`, () => {
  const effects = [], state = { busy: false }, pending = { pendingCheck: 'unread' }, calls = [];
  const pendingController = { subscribe() {}, getSnapshot: () => pending, reload: async () => calls.push('reload') };
  const controller = { writesHeld: false, subscribe() {}, getSnapshot: () => state, capturePrinterLease: () => null };
  const flow = { controller, pendingController, isCurrent: () => true, onResult() {}, onIssue() {} };
  const toolbar = Object.assign(() => {}, { Button: 'ToolbarButton' });
  const mocks = { 'react/jsx-runtime': jsx, react: { useSyncExternalStore: (_sub, get) => get(), useLayoutEffect: fn => effects.push(fn) },
    'expo-router': { Stack: { Screen: 'StackScreen', Toolbar: toolbar }, router: {} }, 'expo-symbols': { SymbolView: 'SymbolView' },
    'react-native': { View: 'View', Pressable: 'Pressable' }, '../preparation/PreparationUI': { usePreparationText: () => value => value },
    '../preparation/PreparationUI.android': { usePreparationText: () => value => value }, './RawSplitFrame.android': { RawSplitFrame: 'Frame' },
    './RawSplitBusy': { RawSplitBusy: 'Busy' }, './RawSplitHistory': { RawSplitHistory: 'History' }, './RawSplitPendingCheck': { RawSplitPendingCheck: 'PendingCheck' },
    './useRawSplitHistoryActions': { useRawSplitHistoryActions: () => flow }, './useRawSplitHeaderPrinter': { useRawSplitHeaderPrinter: () => () => {} } };
  const render = load(`RawSplitHistoryScreen.${platform}.tsx`, mocks).RawSplitHistoryScreen; render(); effects.shift()(); assert.deepEqual(calls, ['reload']);
  pending.pendingCheck = 'failed'; render(); effects.shift()(); assert.deepEqual(calls, ['reload']);
});
for (const [stock, issue] of [[true, false], [false, true], [true, true]]) test(`History explains ${stock ? 'stock ' : ''}${issue ? 'issue ' : ''}pending commands and offers only an explicit Home route`, () => {
  const state = { pendingCheck: 'ready', pendingCheckError: null, busy: false, pending: stock ? {} : null, pendingIssue: issue ? {} : null }, calls = [];
  const controller = { writesHeld: false, subscribe() {}, getSnapshot: () => state, recheckPending: async () => calls.push('recheck') };
  const mocks = { 'react/jsx-runtime': jsx, react: { useSyncExternalStore: (_sub, get) => get() },
    'react-native': { Text: 'Text', View: 'View', useColorScheme: () => 'light' }, '../components/WorkerSheetButton': { WorkerSheetButton: 'Button' },
    '../preparation/PreparationUI': { usePreparationText: () => value => `t(${value})` },
    './useRawSplitWriteHoldText': { useRawSplitWriteHoldText: () => 'saving paused' } };
  const tree = load('RawSplitPendingCheck.tsx', mocks).RawSplitPendingCheck({ controller, onOpenHome: () => calls.push('home') });
  const labels = find(tree, n => n.type === 'Text').map(n => n.props.children);
  assert.equal(labels.includes('t(Oldingi saqlash natijasini tekshiring.)'), stock);
  assert.equal(labels.includes('t(Oldingi muammo qaydi natijasini tekshiring.)'), issue);
  const buttons = find(tree, n => n.type === 'Button'); assert.equal(buttons.length, 1); assert.equal(buttons[0].props.label, 't(Bosh sahifa)');
  buttons[0].props.onPress(); assert.deepEqual(calls, ['home']);
});
for (const platform of ['ios', 'android']) test(`${platform} History pending notice opens only its Home route`, () => {
  const state = { busy: false }, pending = { pendingCheck: 'ready' }, calls = [];
  const pendingController = { subscribe() {}, getSnapshot: () => pending, reload: async () => {} };
  const controller = { writesHeld: false, subscribe() {}, getSnapshot: () => state, capturePrinterLease: () => null };
  let current = true; const flow = { controller, pendingController, isCurrent: () => current, onResult() {}, onIssue() {} }, toolbar = Object.assign(() => {}, { Button: 'ToolbarButton' });
  const mocks = { 'react/jsx-runtime': jsx, react: { useSyncExternalStore: (_sub, get) => get(), useLayoutEffect() {} },
    'expo-router': { Stack: { Screen: 'StackScreen', Toolbar: toolbar }, router: { replace: route => calls.push(route) } },
    'expo-symbols': { SymbolView: 'SymbolView' }, 'react-native': { View: 'View', Pressable: 'Pressable' },
    '../preparation/PreparationUI': { usePreparationText: () => value => value }, '../preparation/PreparationUI.android': { usePreparationText: () => value => value },
    './RawSplitFrame.android': { RawSplitFrame: 'Frame' }, './RawSplitBusy': { RawSplitBusy: 'Busy' }, './RawSplitHistory': { RawSplitHistory: 'History' },
    './RawSplitPendingCheck': { RawSplitPendingCheck: 'PendingCheck' }, './useRawSplitHistoryActions': { useRawSplitHistoryActions: () => flow },
    './useRawSplitHeaderPrinter': { useRawSplitHeaderPrinter: () => () => {} } };
  const tree = load(`RawSplitHistoryScreen.${platform}.tsx`, mocks).RawSplitHistoryScreen();
  const open = find(tree, n => n.type === 'PendingCheck')[0].props.onOpenHome; open(); current = false; open();
  assert.deepEqual(calls, [`/${platform}-homashyo`]);
});
for (const status of ['unread', 'checking']) test(`History displays a localized pending-status indicator while ${status}`, () => {
  const state = { pendingCheck: status, pending: null, pendingIssue: null, pendingCheckError: null, busy: true }, calls = [];
  const controller = { writesHeld: false, subscribe() {}, getSnapshot: () => state, recheckPending: async () => calls.push('recheck') };
  const mocks = { 'react/jsx-runtime': jsx, react: { useSyncExternalStore: (_sub, get) => get() },
    'react-native': { Text: 'Text', View: 'View', useColorScheme: () => 'light' }, '../components/WorkerSheetButton': { WorkerSheetButton: 'Button' },
    '../preparation/PreparationUI': { usePreparationText: () => value => `t(${value})` },
    './useRawSplitWriteHoldText': { useRawSplitWriteHoldText: () => 'saving paused' } };
  const tree = load('RawSplitPendingCheck.tsx', mocks).RawSplitPendingCheck({ controller, onOpenHome() {} });
  assert.equal(find(tree, n => n.type === 'Text' && n.props.children === 't(Tekshirilmoqda...)').length, 1);
  assert.equal(find(tree, n => n.type === 'Button').length, 0); assert.deepEqual(calls, []);
});
test('History displays the print hold even after both pending statuses are clear', () => {
  const state = { pendingCheck: 'ready', pending: null, pendingIssue: null, pendingCheckError: null, busy: false };
  const controller = { writesHeld: true, subscribe() {}, getSnapshot: () => state, recheckPending: async () => {} };
  const mocks = { 'react/jsx-runtime': jsx, react: { useSyncExternalStore: (_sub, get) => get() },
    'react-native': { Text: 'Text', View: 'View', useColorScheme: () => 'light' }, '../components/WorkerSheetButton': { WorkerSheetButton: 'Button' },
    '../preparation/PreparationUI': { usePreparationText: () => value => value }, './useRawSplitWriteHoldText': { useRawSplitWriteHoldText: () => 'saving and printing paused' } };
  const tree = load('RawSplitPendingCheck.tsx', mocks).RawSplitPendingCheck({ controller, onOpenHome() {} });
  assert.equal(find(tree, n => n.type === 'Text' && n.props.children === 'saving and printing paused').length, 1);
});
