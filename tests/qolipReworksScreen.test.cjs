const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
function load(name, dependencies = {}, jsx = false) {
  const filename = path.resolve(__dirname, '../src', name), m = new Module(filename, module);
  m.require = key => key in dependencies ? dependencies[key] : require(key);
  m._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS,
    jsx: jsx ? ts.JsxEmit.ReactJSX : undefined, target: ts.ScriptTarget.ESNext } }).outputText, filename);
  return m.exports;
}
function screen(platform, supplied = {}) {
  const captures = {}, calls = [], sheet = { open: (...args) => calls.push(['sheet', ...args]) }, prepared = { kind: 'confirm', ids: ['id-1'], scope: 's' };
  const controller = { setQuery: value => calls.push(['query', value]), setReturned: value => calls.push(['tab', value]),
    toggle: value => calls.push(['toggle', value]), selectGroup: () => {}, load: async () => calls.push(['load']),
    prepareReturn: () => prepared, confirmReturn: async value => { calls.push(['return', value]); return { kind: 'returned', count: 1 }; } };
  const state = { query: '', loading: false, error: false, saving: false, returned: false, selected: new Set(), groups: [], controller, ...supplied };
  const component = name => function Stub(props) { (captures[name] ??= []).push(props);
    return React.createElement('div', null, props.children ?? props.label ?? null); };
  const names = ['Button', 'Host', 'HStack', 'ProgressView', 'Section', 'Spacer', 'Text', 'Toggle', 'VStack', 'Column', 'TextButton',
    'Checkbox', 'CircularProgressIndicator', 'SegmentedButton', 'SingleChoiceSegmentedButtonRow', 'ActivityIndicator', 'Pressable', 'NativeText',
    'View', 'SymbolView', 'OrdersHeader', 'OrdersList', 'WorkerQueueCard', 'PreparationNotice', 'QolipMileageSheet'];
  const nodes = Object.fromEntries(names.map(name => [name, component(name)])); nodes.SegmentedButton.Label = component('SegmentedButton.Label');
  const Dialog = component('AlertDialog'); for (const key of ['Title', 'Text', 'DismissButton', 'ConfirmButton']) Dialog[key] = component(`AlertDialog.${key}`);
  const ui = { ...nodes, AlertDialog: Dialog, useMaterialColors: () => ({ surface: 'white', surfaceContainerLow: 'white',
    onSurface: 'black', onSurfaceVariant: 'gray' }) };
  const mods = Object.fromEntries(['accessibilityLabel', 'buttonStyle', 'disabled', 'frame', 'labelStyle', 'labelsHidden', 'size', 'testID'].map(key => [key, () => ({})]));
  const words = { title: 'Peredelkadagi qoliplar', open: 'Peredelkada', history: 'Qaytganlar', search: 'Mahsulot, komplekt yoki qolip kodi',
    empty: 'Peredelkada qolip yo‘q', history_empty: 'Qaytgan qoliplar yo‘q', mileage: 'Probeg tarixi', sent_at: 'Berilgan',
    returned_at: 'Qaytgan', return: 'Qaytdi', return_selected: 'Tanlanganlar qaytdi ({count})',
    return_confirm: '{count} ta qolip qaytdi deb belgilansinmi?', returned: '{count} ta qolip qaytdi', session_changed: 'Sessiya o‘zgardi', failed: 'Peredelka amali bajarilmadi' };
  const deps = { '@expo/ui/swift-ui': ui, '@expo/ui/jetpack-compose': ui,
    '@expo/ui/swift-ui/modifiers': mods, '@expo/ui/jetpack-compose/modifiers': mods,
    'expo-symbols': { SymbolView: nodes.SymbolView }, 'react-native': { View: nodes.View, Text: nodes.NativeText, Pressable: nodes.Pressable,
      ActivityIndicator: nodes.ActivityIndicator, useWindowDimensions: () => ({ width: 400, height: 800 }), Alert: { alert: (...args) => calls.push(['alert', ...args]) } },
    'react-native-reanimated': { useSharedValue: value => ({ value }) }, 'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0 }) },
    '../components/WorkerQueueCard.android': { WorkerQueueCard: nodes.WorkerQueueCard }, '../nativeSheet': { useNativeSheet: () => sheet },
    '../preparation/PreparationNotice': { PreparationNotice: nodes.PreparationNotice },
    '../shared/localization': { extensionText: (method, key, _locale, values = {}) => method === 'qolipSharedSetText' ? 'Komplekt ID'
      : (words[key] ?? key).replace('{count}', values.count ?? ''), localizedGetter: key => key === 'retry' ? 'Qayta urinish' : 'Server bilan aloqa uzildi',
      localizedMethod: (_key, _locale, values) => values.raw, productionText: () => 'Bekor qilish' },
    '../shared/orders/OrdersHeader': { OrdersHeader: nodes.OrdersHeader }, '../shared/orders/OrdersList': { OrdersList: nodes.OrdersList },
    './QolipMileageSheet': { QolipMileageSheet: nodes.QolipMileageSheet }, './qolipErrorMessage': { qolipErrorMessage: () => 'Xato' },
    './qolipMileageFormatting': { qolipReworkDate: value => value }, './useQolipNotice': { useQolipNotice: () => ({ message: '', show: value => calls.push(['notice', value]) }) },
    './useQolipReworks': { useQolipReworks: () => state }, './useQolipText': { useQolipText: () => ({ locale: 'uz' }) } };
  const { QolipReworksScreen } = load(`qolip/QolipReworksScreen.${platform}.tsx`, deps, true);
  const render = () => renderToStaticMarkup(React.createElement(QolipReworksScreen, { session: {}, nextRequestId: async () => 'test-only',
    onMenu() {}, onProfile() {}, dock: 'DOCK' }));
  return { captures, calls, state, prepared, render };
}
const entry = { id: 'id-1', qolip_code: 'Q-ONE', qolip_set_id: 'SET', item_name: 'Hot lunch', item_code: 'ITEM', color: '',
  sent_at: '2026-01-01', returned_at: null, is_open: true };
for (const platform of ['ios', 'android']) {
  test(`${platform} rework surface renders loading, retry, empty and the shared search/dock`, () => {
    let h = screen(platform, { loading: true }); h.render();
    assert.ok(h.captures[platform === 'ios' ? 'ProgressView' : 'ActivityIndicator']);
    assert.equal(h.captures.OrdersHeader[0].searchPlaceholder, 'Mahsulot, komplekt yoki qolip kodi');
    h = screen(platform, { error: true }); assert.match(h.render(), /Server bilan aloqa uzildi/);
    h = screen(platform); const html = h.render(); assert.match(html, /Peredelkada qolip yo‘q/); assert.match(html, /DOCK/);
  });
  test(`${platform} rework row opens the real mileage sheet component`, () => {
    const h = screen(platform, { groups: [{ key: 'SET', names: ['Hot lunch'], entries: [entry], selected: false }] });
    h.render(); const open = platform === 'ios' ? h.captures.Button.find(x => x.label === 'Probeg tarixi').onPress
      : h.captures.Pressable.find(x => x.accessibilityLabel === 'Probeg tarixi').onPress;
    open(); assert.equal(h.calls[0][0], 'sheet'); assert.equal(h.calls[0][1].props.code, 'Q-ONE');
    if (platform === 'android') assert.deepEqual(h.calls[0][2], { compact: true, fitContent: true, dismissible: true });
  });
}
test('iOS rework return is sent only after explicit in-app confirmation', async () => {
  const h = screen('ios', { selected: new Set(['id-1']), groups: [{ key: 'SET', names: ['Hot lunch'], entries: [entry], selected: true }] });
  h.render(); h.captures.Button.find(x => x.label === 'Tanlanganlar qaytdi (1)').onPress();
  const alert = h.calls.find(x => x[0] === 'alert'); assert.ok(alert); assert.equal(h.calls.some(x => x[0] === 'return'), false);
  alert[3].find(x => x.text === 'Qaytdi').onPress(); await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(h.calls.find(x => x[0] === 'return'), ['return', h.prepared]); assert.ok(h.calls.find(x => x[0] === 'notice'));
});

test('rework hook uses the existing APIs, shared revision and caller-supplied ID factory', async () => {
  let dependencies; const calls = [], effects = [];
  class FakeState { constructor(value) { dependencies = value; } getSnapshot = () => ({}); subscribe = () => () => {}; groups = [];
    activate() {} dispose() {} async load() {} }
  const session = { profile: { ref: 'a' } }, nextRequestId = async () => 'real-source-at-runtime';
  const { useQolipReworks } = load('qolip/useQolipReworks.ts', {
    react: { useEffect: fn => effects.push(fn), useMemo: fn => fn(), useSyncExternalStore: (_subscribe, get) => get() },
    '../auth': { currentSession: () => session, registerSessionResetHook: () => () => {} },
    '../sessionReadScope': { sessionReadScope: () => 'scope-a' }, '../shared/qolipDataRevision': { qolipDataRevision: { notifyLocationsChanged: () => calls.push('revision') } },
    './qolipReworkApi': { qolipReworks: (s, status) => { calls.push(['list', s, status]); return Promise.resolve([]); },
      qolipReturnFromRework: (s, input) => { calls.push(['return', s, input]); return Promise.resolve([]); } },
    './qolipReworksState': { QolipReworksState: FakeState },
  });
  useQolipReworks(session, nextRequestId); await dependencies.load(); await dependencies.returnFromRework('r', ['id']);
  assert.equal(await dependencies.nextRequestId(), 'real-source-at-runtime'); assert.equal(dependencies.scope(), 'scope-a');
  dependencies.notifyLocationsChanged(); assert.deepEqual(calls, [['list', session, 'all'], ['return', session, { requestId: 'r', reworkIds: ['id'] }], 'revision']);
  effects[0]()();
});
