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
function compile(relative, mocks = {}) {
  const filename = path.resolve(__dirname, `../src/${relative}`), loaded = new Module(filename, module);
  loaded.filename = filename; loaded.paths = module.paths;
  loaded.require = id => id === 'react/jsx-runtime' ? jsx : Object.hasOwn(mocks, id) ? mocks[id] : id.startsWith('.') ? {} : require(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, filename); return loaded.exports;
}
const demo = compile('boyoqchi/returnedPaintDemoGuard.ts');
const controls = compile('workerControlsApi.ts', { './authorizedFetch': {}, './sessionReadScope': {} });
const model = compile('boyoqchi/returnedPaintModel.ts', { '../workerControlsApi': controls });
test('fake token sends neither list GET nor complete POST to a real server', async () => {
  const session = { baseUrl: 'https://example.invalid', token: 'test-mode-token' }, originalFetch = global.fetch; let calls = 0;
  const transport = compile('authorizedFetch.ts', { './auth': { activeSessionToken: s => s.token, refreshSession: async () => false } });
  const api = compile('boyoqchi/returnedPaintApi.ts', { '../authorizedFetch': transport, '../workerControlsApi': controls,
    './returnedPaintModel': model, './returnedPaintDemoGuard': demo });
  global.fetch = async () => { calls++; throw new Error('unexpected network'); };
  try {
    await assert.rejects(api.boyoqchiReturnedPaintRequests(session), error => error.name === 'BoyoqchiDemoUnavailableError');
    await assert.rejects(api.completeReturnedPaint(session, { request_id: 'r', items: [] }), error => error.name === 'BoyoqchiDemoUnavailableError');
    assert.equal(calls, 0);
  } finally { global.fetch = originalFetch; }
});
for (const platform of ['ios', 'android']) test(`${platform} Boyoqchi screen clearly displays demo unavailable without a fake retry`, () => {
  const state = { phase: 'loading', items: [], expandedKey: null, apparatus: [] };
  const mocks = { '@expo/ui/swift-ui': { Host: 'Host', RNHostView: 'RNHostView' },
    '@expo/ui/jetpack-compose': { useMaterialColors: () => ({}) }, 'expo-router': { Stack: { Screen: 'Stack.Screen' } },
    'react-native': { ActivityIndicator: 'ActivityIndicator', View: 'View' }, 'react-native-reanimated': { useSharedValue: value => ({ value }) },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0 }) }, '../components/WorkerExpansion': {},
    '../components/WorkerQueueCard.android': {}, '../components/useWorkerColors': { useWorkerColors: () => ({}) }, '../shared/orders/OrdersList': {},
    '../shared/navigation/RoleHeader.android': { RoleHeader: 'RoleHeader' }, '../shared/navigation/roleDrawerContext': { useRoleDrawer: () => ({ open() {} }) },
    './BoyoqchiDock.android': { BoyoqchiDock: 'BoyoqchiDock' }, './BoyoqchiMessage': { BoyoqchiMessage: 'BoyoqchiMessage' },
    './BoyoqchiRequestContent': {}, './returnedPaintDemoGuard': demo, './boyoqchiLogic': {},
    './BoyoqchiContext': { useBoyoqchiContext: () => ({ session: { token: 'test-mode-token' } }) },
    './useBoyoqchiRequests': { useBoyoqchiRequests: () => ({ state, controller: {} }) }, './useBoyoqchiText': { useBoyoqchiText: () => x => x },
    './useReturnedPaintForm': { useReturnedPaintForm: () => () => {} } };
  const { BoyoqchiScreen } = compile(`boyoqchi/BoyoqchiScreen.${platform}.tsx`, mocks);
  const tree = BoyoqchiScreen({ home: true }), notice = nodes(tree, n => n.type === 'BoyoqchiMessage')[0];
  assert.equal(notice.props.title, demo.BOYOQCHI_DEMO_UNAVAILABLE); assert.equal(notice.props.error, true);
  assert.equal(notice.props.onRefresh, undefined); assert.equal(nodes(tree, n => n.type === 'ActivityIndicator').length, 0);
});

test('the role message renders no retry when none is supplied', () => {
  const { BoyoqchiMessage } = compile('boyoqchi/BoyoqchiMessage.tsx', {
    'expo-symbols': { SymbolView: 'SymbolView' }, 'react-native': { StyleSheet: { create: x => x }, Text: 'Text', View: 'View' },
    '../components/WorkerSheetButton': { WorkerSheetButton: 'WorkerSheetButton' },
    '../components/useWorkerColors': { useWorkerColors: () => ({}) }, './useBoyoqchiText': { useBoyoqchiText: () => x => x },
  });
  const tree = BoyoqchiMessage({ title: demo.BOYOQCHI_DEMO_UNAVAILABLE, error: true });
  assert.equal(nodes(tree, n => n.type === 'WorkerSheetButton').length, 0);
  assert.equal(nodes(tree, n => n.type === 'Text')[0].props.children, demo.BOYOQCHI_DEMO_UNAVAILABLE);
});
