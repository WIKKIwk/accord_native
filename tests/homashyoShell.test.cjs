// Source-derived shell behaviors with mocked navigation, focus and printer errors. No device is used.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const jsx = { Fragment: 'Fragment', jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
function load(name, mocks = {}, withJsx = false) {
  const filename = path.resolve(__dirname, `../src/homashyo/${name}`), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths;
  mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS,
    ...(withJsx ? { jsx: ts.JsxEmit.ReactJSX } : {}) } }).outputText, filename);
  return mod.exports;
}
const flush = () => new Promise(resolve => setImmediate(resolve));
function headerHarness() {
  let effect, active = true, reject, selections = 0; const alerts = [];
  const mocks = { react: { useCallback: fn => fn, useRef: value => ({ current: value }) },
    'expo-router': { useFocusEffect: fn => { effect = fn; } }, 'react-native': { Alert: { alert: (...v) => alerts.push(v) } },
    './rawSplitApi': { rawSplitSessionIsCurrent: () => active }, './RawSplitContext': { useRawSplitContext: () => ({ ticket: {} }) } };
  const controller = { selectPrinter: () => { selections++; return new Promise((_, fail) => { reject = fail; }); } };
  const action = load('useRawSplitHeaderPrinter.ts', mocks).useRawSplitHeaderPrinter(controller);
  return { action, focus: () => effect(), invalidate: () => { active = false; }, reject: error => reject(error), alerts, selections: () => selections };
}
test('printer header reports errors only for its current focus and session', async () => {
  const h = headerHarness(); h.action(); assert.equal(h.selections(), 0);
  const blur = h.focus(); h.action(); h.reject(new Error('printer')); await flush();
  assert.equal(h.selections(), 1); assert.match(h.alerts[0][1], /printer/);
  h.action(); blur(); const blurAgain = h.focus(); h.reject(new Error('old focus')); await flush();
  assert.equal(h.alerts.length, 1); h.action(); h.invalidate(); h.reject(new Error('old session')); await flush();
  assert.equal(h.alerts.length, 1); h.action(); assert.equal(h.selections(), 3); blurAgain();
});
test('every role home/history header uses the guarded picker action', () => {
  for (const name of ['RawSplitHomeScreen.ios.tsx', 'RawSplitHomeScreen.android.tsx', 'RawSplitHistoryScreen.ios.tsx', 'RawSplitHistoryScreen.android.tsx']) {
    const source = fs.readFileSync(path.resolve(__dirname, `../src/homashyo/${name}`), 'utf8');
    assert.match(source, /useRawSplitHeaderPrinter\(flow\.controller\)/);
    assert.match(source, /on(?:Press|Printer)=\{selectPrinter\}/);
  }
});
test('iOS history Back pops when possible and otherwise replaces the role home', () => {
  let canBack = true; const calls = [];
  const toolbar = Object.assign(() => {}, { Button: 'ToolbarButton' });
  const controller = { subscribe() {}, getSnapshot: () => ({ busy: false }) };
  const mocks = { 'react/jsx-runtime': jsx, react: { useSyncExternalStore: (_subscribe, get) => get() },
    'expo-router': { Stack: { Screen: 'StackScreen', Toolbar: toolbar }, router: { canGoBack: () => canBack,
      back: () => calls.push('back'), replace: route => calls.push(['replace', route]) } },
    'expo-symbols': { SymbolView: 'SymbolView' }, 'react-native': { Pressable: 'Pressable', View: 'View' },
    '../preparation/PreparationUI': { usePreparationText: () => value => value },
    './RawSplitHistory': { RawSplitHistory: 'History' }, './useRawSplitHistoryActions': { useRawSplitHistoryActions: () => ({ controller }) },
    './useRawSplitHeaderPrinter': { useRawSplitHeaderPrinter: () => () => {} } };
  const tree = load('RawSplitHistoryScreen.ios.tsx', mocks, true).RawSplitHistoryScreen();
  const options = tree.props.children[0].props.options; assert.equal(options.headerBackVisible, false);
  const backButton = options.headerLeft(); assert.equal(backButton.props.accessibilityLabel, 'Orqaga');
  backButton.props.onPress(); canBack = false; backButton.props.onPress();
  assert.deepEqual(calls, ['back', ['replace', '/ios-homashyo']]);
});
test('role drawer reuses shared drawer with the V2 Rezka heading and selected page', () => {
  const mocks = { 'react/jsx-runtime': jsx, 'expo-router': { router: {}, usePathname: () => '/ios-homashyo/history' },
    'react-native': { Platform: { OS: 'ios' } }, '../preparation/PreparationUI': { usePreparationText: () => value => value },
    '../shared/navigation/RoleDrawer': { RoleDrawer: 'SharedDrawer' }, '../shared/navigation/roleDrawerContext': { useRoleDrawerState: () => ({ visible: false }) },
    '../shared/navigation/roleDrawerLogout': {}, './RawSplitContext': { useRawSplitContext: () => ({ onLogout() {} }) },
    './rawSplitNavigationModel': { rawSplitDrawerItems: () => [{ id: 'home' }, { id: 'history' }, { id: 'profile' }] } };
  const tree = load('RawSplitDrawer.tsx', mocks, true).RawSplitDrawer({ children: 'screen' });
  assert.equal(tree.type, 'SharedDrawer'); assert.equal(tree.props.title, 'Rezka'); assert.equal(tree.props.active, 'history');
});
