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
  const state = { busy: false }, controller = { subscribe() {}, getSnapshot: () => state };
  const toolbar = Object.assign(() => {}, { Button: 'ToolbarButton' });
  const calls = [];
  const flow = { controller, scan() {}, isScannerCurrent: () => true, complete() {}, close() {} };
  const mocks = { 'react/jsx-runtime': jsx, react: { useSyncExternalStore: (_subscribe, get) => get() },
    'expo-router': { Stack: { Screen: 'StackScreen', Toolbar: toolbar }, router: { push: route => calls.push(route) } },
    'expo-symbols': { SymbolView: 'SymbolView' }, 'react-native': { View: 'View' },
    '../preparation/PreparationUI': { usePreparationText: () => value => value },
    './RawSplitBusy': { RawSplitBusy: 'Busy' }, './RawSplitHome': { RawSplitHome: 'Home' },
    './RawSplitHistory': { RawSplitHistory: 'History' }, './RawSplitScanner': { RawSplitScanner: 'Scanner' },
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
    '@expo/ui/jetpack-compose': { useMaterialColors: () => ({ surfaceContainerLow: 'surface', onSurfaceVariant: 'muted' }) },
    'expo-router': { router: { push: route => calls.push(route) } }, 'expo-symbols': { SymbolView: 'SymbolView' },
    'react-native': { Pressable: 'Pressable', View: 'View' },
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
  assert.ok(find(busy, n => n.type === 'Pressable').every(n => n.props.disabled === true));
  const idle = h.render(page, false); assert.equal(find(idle, n => n.type === 'Busy').length, 0);
  const printer = find(idle, n => n.type === 'Pressable' && n.props.accessibilityLabel === 'Printer tanlash')[0];
  assert.equal(printer.props.disabled, false); printer.props.onPress(); assert.deepEqual(h.calls, ['picker']);
});
test('Android profile keeps the existing no-busy default', () => {
  assert.equal(find(androidFrame().render('profile'), n => n.type === 'Busy').length, 0);
});
