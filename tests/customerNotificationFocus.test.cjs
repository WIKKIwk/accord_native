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
function fixture() {
  let finish, focusEffect, focusCleanup;
  const seen = new Promise(resolve => { finish = resolve; }), calls = [], cleanups = [];
  const state = { loaded: true, loading: false, error: null, records: [{ id: 'DN-1' }], highlightedIds: new Set(),
    refresh: async () => {}, markSeen: async id => { calls.push(['seen', id]); await seen; }, clearAll: async () => {} };
  const mocks = { 'react/jsx-runtime': jsx,
    react: { useCallback: fn => fn, useEffect: fn => { const cleanup = fn(); if (cleanup) cleanups.push(cleanup); },
      useRef: value => ({ current: value }), useState: initial => [initial, () => {}] },
    'expo-router': { useFocusEffect: fn => { focusEffect = fn; focusCleanup = fn(); } },
    '@expo/ui': { ListItem: 'ListItem', Text: 'Text' },
    '@expo/ui/swift-ui': { Button: 'Button', Host: 'Host', List: 'List', ProgressView: 'ProgressView', Section: 'Section', VStack: 'VStack' },
    '@expo/ui/swift-ui/modifiers': { listStyle: value => value, refreshable: value => value, listRowBackground: value => value },
    'expo-symbols': { SymbolView: 'SymbolView' }, 'react-native': { PlatformColor: value => value },
    '../components/WorkerAlert': { WorkerAlert: 'WorkerAlert' }, './CustomerContext': { useCustomerText: () => ({ text: key => key }) },
    './CustomerStates': { CustomerEmptyFeedState: 'CustomerEmptyFeedState', CustomerLoadingState: 'CustomerLoadingState', CustomerRetryState: 'CustomerRetryState' },
    './customerPresentation': { customerNotificationRecord: () => ({ icon: 'schedule', name: 'item', code: 'code', body: 'body', created: 'date' }) },
    './useCustomerScreens': { useCustomerNotifications: () => state },
  };
  const filename = path.resolve(__dirname, '../src/customer/CustomerNotificationsView.ios.tsx'), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths;
  mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, filename);
  const tree = mod.exports.CustomerNotificationsScreen({ onOpenDetail: id => calls.push(['open', id]) });
  const row = nodes(tree, node => node.type === 'ListItem')[0];
  return { calls, tap: () => row.props.onPress(), finish, blur: () => { focusCleanup?.(); focusCleanup = undefined; },
    focus: () => { if (!focusCleanup && focusEffect) focusCleanup = focusEffect(); },
    unmount: () => { focusCleanup?.(); cleanups.forEach(cleanup => cleanup()); } };
}
const flush = () => new Promise(resolve => setImmediate(resolve));

test('deferred mark-seen does not reopen detail after the user switches tabs', async () => {
  const f = fixture(); f.tap(); f.blur(); f.finish(); await flush();
  assert.deepEqual(f.calls, [['seen', 'DN-1']]);
});

test('returning to Notifications does not revive an earlier blurred tap', async () => {
  const f = fixture(); f.tap(); f.blur(); f.focus(); f.finish(); await flush();
  assert.deepEqual(f.calls, [['seen', 'DN-1']]);
});

test('the active feed still opens its detail after marking seen', async () => {
  const f = fixture(); f.tap(); f.finish(); await flush();
  assert.deepEqual(f.calls, [['seen', 'DN-1'], ['open', 'DN-1']]);
});

test('a new tap after refocus opens only the new request', async () => {
  const f = fixture(); f.tap(); f.blur(); f.focus(); f.tap(); f.finish(); await flush();
  assert.deepEqual(f.calls, [['seen', 'DN-1'], ['seen', 'DN-1'], ['open', 'DN-1']]);
});

test('an unmounted feed never opens a pending detail', async () => {
  const f = fixture(); f.tap(); f.unmount(); f.finish(); await flush();
  assert.deepEqual(f.calls, [['seen', 'DN-1']]);
});
