const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

function screen(platform, supplied = {}) {
  const calls = [], gestures = [], sheet = { opened: null, open(content, options) { this.opened = { content, options }; },
    close() { this.opened.options.onDismiss(); } };
  const controller = { setQuery: value => calls.push(['query', value]), reload: async () => { calls.push(['reload']); },
    edit: async (...value) => { calls.push(['edit', ...value]); }, remove: async (...value) => { calls.push(['remove', ...value]); } };
  const state = { query: '', filtered: [], loading: false, error: false, saving: false, notice: null,
    dismissNotice: () => {}, controller, ...supplied };
  const captures = {};
  const component = name => {
    function Node(props) { (captures[name] ??= []).push(props); return React.createElement('div', null, props.children ?? props.label ?? null); }
    return Node;
  };
  const components = Object.fromEntries(['Host', 'HStack', 'VStack', 'Column', 'Section', 'Text', 'Image', 'ProgressView',
    'TextField', 'Button', 'TextButton', 'OutlinedTextField', 'ActivityIndicator', 'View', 'NativeText', 'Pressable',
    'Modal', 'KeyboardAvoidingView', 'SymbolView', 'OrdersHeader', 'OrdersList', 'WorkerQueueCard', 'PreparationNotice'].map(name => [name, component(name)]));
  components.OutlinedTextField.Label = component('OutlinedTextField.Label');
  const Dialog = component('AlertDialog'); for (const key of ['Title', 'Text', 'DismissButton', 'ConfirmButton']) Dialog[key] = component(`AlertDialog.${key}`);
  const ui = { ...components, AlertDialog: Dialog, useNativeState: value => ({ get: () => value }),
    useMaterialColors: () => ({ surfaceContainerLow: 'white', surface: 'white', onSurface: 'black', onSurfaceVariant: 'gray' }) };
  const mods = { frame: () => ({}), contentShape: () => ({}), shapes: { rectangle: () => ({}) }, onLongPressGesture: fn => { gestures.push(fn); return {}; }, onSubmit: () => ({}), submitLabel: () => ({}),
    textInputAutocapitalization: () => ({}), fillMaxWidth: () => ({}), testID: () => ({}) };
  const translations = { 'blocks.search': 'Blok qidirish', 'blocks.empty': 'Blok topilmadi', 'blocks.load_failed': 'Bloklar yuklanmadi',
    'blocks.delete_title': 'Blokni o‘chirasizmi?', 'blocks.delete_message': '{name} bloki butunlay o‘chiriladi.',
    'action.retry': 'Qayta urinish', 'action.edit': 'Tahrirlash', 'action.delete': 'O‘chirish', 'action.cancel': 'Bekor qilish' };
  const text = (key, values = {}) => (translations[key] ?? key).replace('{name}', values.name ?? '');
  const native = { View: components.View, Text: components.NativeText, Pressable: components.Pressable, Modal: components.Modal,
    KeyboardAvoidingView: components.KeyboardAvoidingView, ActivityIndicator: components.ActivityIndicator,
    StyleSheet: { create: value => value, absoluteFill: {} }, PlatformColor: () => 'white', useWindowDimensions: () => ({ width: 400, height: 800 }),
    Alert: { alert: (...args) => calls.push(['alert', ...args]) } };
  const dependencies = { '@expo/ui/swift-ui': ui, '@expo/ui/jetpack-compose': ui, '@expo/ui/swift-ui/modifiers': mods,
    '@expo/ui/jetpack-compose/modifiers': mods, 'expo-symbols': { SymbolView: components.SymbolView }, 'react-native': native,
    'react-native-reanimated': { useSharedValue: value => ({ value }) }, 'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0 }) },
    '../components/useWorkerColors': { useWorkerColors: () => ({ surface: 'white' }) },
    '../components/WorkerQueueCard.android': { WorkerQueueCard: components.WorkerQueueCard }, '../nativeSheet': { useNativeSheet: () => sheet },
    '../preparation/PreparationNotice': { PreparationNotice: components.PreparationNotice }, '../shared/orders/OrdersHeader': { OrdersHeader: components.OrdersHeader },
    '../shared/orders/OrdersList': { OrdersList: components.OrdersList }, './qolipErrorMessage': { qolipErrorMessage: (_error, _locale, fallback) => fallback },
    './useQolipBlocks': { useQolipBlocks: () => state }, './useQolipText': { useQolipText: () => ({ locale: 'uz', text }) } };
  const filename = path.resolve(__dirname, `../src/qolip/QolipBlocksScreen.${platform}.tsx`), m = new Module(filename, module);
  m.require = key => key in dependencies ? dependencies[key] : require(key);
  m._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS,
    jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ESNext } }).outputText, filename);
  const render = () => renderToStaticMarkup(React.createElement(m.exports.QolipBlocksScreen, { session: {}, onMenu: () => {}, onProfile: () => {}, dock: 'DOCK' }));
  return { calls, gestures, sheet, state, captures, render };
}
for (const platform of ['ios', 'android']) {
  test(`${platform} block screen renders V2 loading, retry and empty states using shared header and list`, () => {
    let h = screen(platform, { loading: true }); h.render();
    assert.equal(h.captures.OrdersHeader[0].searchPlaceholder, 'Blok qidirish');
    assert.equal(h.captures.OrdersHeader[0].showProfile, true);
    assert.equal(typeof h.captures.OrdersHeader[0].onSearchFocus, 'function');
    assert.equal(typeof h.captures.OrdersHeader[0].onSearchBlur, 'function');
    assert.ok(h.captures[platform === 'ios' ? 'ProgressView' : 'ActivityIndicator']);
    h = screen(platform, { error: true }); let html = h.render(); assert.match(html, /Bloklar yuklanmadi/); assert.match(html, /Qayta urinish/);
    h = screen(platform); html = h.render(); assert.match(html, /Blok topilmadi/); assert.ok(h.captures.OrdersList); assert.match(html, /DOCK/);
  });
  test(`${platform} block long press opens actions but does not write on opening`, () => {
    const block = { name: 'A', warehouse: 'Ombor' }, h = screen(platform, { filtered: [block] });
    const html = h.render(); assert.match(html, /Ombor/);
    (platform === 'ios' ? h.gestures[0] : h.captures.WorkerQueueCard[0].onLongPress)();
    assert.ok(h.sheet.opened); assert.deepEqual(h.calls, []);
  });
}
test('iOS delete requires destructive confirmation before issuing a block write', async () => {
  const block = { name: 'A', warehouse: 'Ombor' }, h = screen('ios', { filtered: [block] });
  h.render(); h.gestures[0](); h.sheet.opened.content.props.choose('delete');
  const alert = h.calls.find(call => call[0] === 'alert'); assert.equal(alert[1], 'Blokni o‘chirasizmi?');
  assert.equal(alert[2], 'A bloki butunlay o‘chiriladi.'); assert.equal(h.calls.some(call => call[0] === 'remove'), false);
  alert[3].find(action => action.style === 'destructive').onPress();
  assert.deepEqual(h.calls.find(call => call[0] === 'remove'), ['remove', block]);
});
