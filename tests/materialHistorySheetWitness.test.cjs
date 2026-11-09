const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const jsx = { Fragment: 'Fragment', jsx: (type, props, key) => ({ type, props, key }), jsxs: (type, props, key) => ({ type, props, key }) };
function compile(platform, mocks) {
  const filename = path.resolve(__dirname, `../src/material/MaterialHistory.${platform}.tsx`), loaded = new Module(filename, module);
  loaded.filename = filename; loaded.paths = module.paths;
  loaded.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, filename);
  return loaded.exports.MaterialHistory;
}
function nodes(node, type) {
  if (!node || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap(child => nodes(child, type));
  return [...(node.type === type ? [node] : []), ...nodes(node.props?.children, type)];
}
for (const platform of ['ios', 'android']) test(`${platform} history sheet closes on witness transition and cannot reopen from stale row`, () => {
  const session = {}, witness = { session }, listeners = new Set(), calls = [], presentationCalls = []; let valid = true, content;
  const sheet = { open: value => { content = value; calls.push('open'); }, close: () => calls.push('close') };
  const present = (name, value) => { presentationCalls.push(name); if (!valid) throw new Error('Stale event presentation'); return value; };
  const mocks = { 'react/jsx-runtime': jsx, react: { useEffect: fn => { fn(); }, useSyncExternalStore: (_s, get) => get() },
    '@expo/ui/jetpack-compose': { Column: 'Column', Row: 'Row', Host: 'Host', Text: 'ComposeText', useMaterialColors: () => ({}) },
    '@expo/ui/jetpack-compose/modifiers': { fillMaxWidth: () => ({}), width: value => value, weight: value => value },
    '@expo/ui/swift-ui': { Button: 'Button', Host: 'Host', HStack: 'HStack', Image: 'Image', List: 'List', ProgressView: 'ProgressView',
      Section: 'Section', Text: 'SwiftText', VStack: 'VStack' },
    '@expo/ui/swift-ui/modifiers': { font: value => value, foregroundStyle: value => value, frame: value => value, lineLimit: value => value },
    'expo-router': { Stack: { Screen: 'Stack.Screen' }, router: {} }, 'expo-symbols': { SymbolView: 'SymbolView' },
    'react-native': { ActivityIndicator: 'ActivityIndicator', PlatformColor: () => 'color', Text: 'Text', View: 'View' },
    'react-native-reanimated': { useSharedValue: value => ({ value }) }, 'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0 }) },
    '../auth': { registerSessionResetHook: () => () => {}, sessionWitnessVersion: () => valid ? 1 : 2,
      subscribeSessionWitness: fn => { listeners.add(fn); return () => listeners.delete(fn); } },
    '../components/WorkerQueueCard.android': { WorkerQueueCard: 'WorkerQueueCard' }, '../nativeSheet': { useNativeSheet: () => sheet },
    '../preparation/PreparationUI': { PreparationList: 'PreparationList' }, '../shared/navigation/RoleHeader.android': { RoleHeader: 'RoleHeader' },
    '../shared/orders/OrdersList': { OrdersList: 'OrdersList' }, '../shared/localization': { localizedGetter: () => 'Denied' },
    '../shared/localization/runtime': { localeController: { locale: 'uz' } }, './MaterialContext': { useMaterialContext: () => ({ session, witness }) },
    './useMaterialHistory': { useMaterialHistory: () => ({ allowed: true, loading: false, events: [{ event_id: 'one', event_type: 'receipt' }], apparatus: [],
      refresh() {}, reload() {} }) }, './materialHistoryAccess': { materialHistoryCurrent: () => valid },
    './materialHistoryPresentation': { materialHistoryTitle: () => present('title', 'Receipt'), materialHistorySubtitle: () => present('subtitle', 'Detail'),
      materialHistoryTime: () => present('time', 'now'), materialHistoryDetails: () => present('details', []) },
    './materialHistorySymbols': { materialHistorySymbol: () => ({ ios: 'tray', android: 'inbox' }) } };
  const screen = compile(platform, mocks)(), row = nodes(screen, platform === 'ios' ? 'Button' : 'WorkerQueueCard')[0]; row.props.onPress();
  assert.equal(calls[0], 'open'); assert.ok(content.type(content.props));
  valid = false; listeners.forEach(fn => fn()); assert.ok(calls.includes('close')); presentationCalls.length = 0;
  assert.equal(content.type(content.props), null); assert.deepEqual(presentationCalls, []);
  const count = calls.filter(value => value === 'open').length; row.props.onPress(); assert.equal(calls.filter(value => value === 'open').length, count);
});
