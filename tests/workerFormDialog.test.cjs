const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const jsx = { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
const AlertDialog = Object.assign(() => null, { Title: 'Title', Text: 'DialogText', DismissButton: 'DismissButton', ConfirmButton: 'ConfirmButton' });
function load(platform, screenWidth = 400) {
  const filename = path.resolve(__dirname, `../src/components/WorkerFormDialog${platform ? `.${platform}` : ''}.tsx`), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths;
  const native = { AlertDialog, Box: 'Box', Button: 'Button', OutlinedButton: 'OutlinedButton', Row: 'Row', Icon: 'Icon', Host: 'Host', RNHostView: 'RNHostView', Text: 'Text', TextButton: 'TextButton',
    Shape: { RoundedCorner: props => ({ type: 'roundedCorner', ...props }) },
    useMaterialColors: () => ({ primaryContainer: 'primaryContainer', onPrimaryContainer: 'onPrimaryContainer', onSurface: 'onSurface' }) };
  const modifiers = Object.fromEntries(['buttonBorderShape', 'buttonStyle', 'controlSize', 'disabled', 'fixedSize', 'font', 'foregroundStyle', 'frame', 'multilineTextAlignment', 'tint'].map(name => [name, value => ({ [name]: value })]));
  const composeModifiers = new Proxy({}, { get: (_target, name) => (...args) => ({ name, args }) });
  const mocks = { 'react/jsx-runtime': jsx, '@expo/ui': native, '@expo/ui/jetpack-compose': native, '@expo/ui/jetpack-compose/modifiers': composeModifiers, '@expo/ui/swift-ui': native, '@expo/ui/swift-ui/modifiers': modifiers,
    './BaseHost': { BaseHost: 'Host' }, 'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 20, bottom: 20 }) },
    'react-native': { Platform: { Version: '26' }, PlatformColor: value => value, Pressable: 'Pressable', KeyboardAvoidingView: 'KeyboardAvoidingView', Modal: 'Modal', View: 'View', Text: 'Text', ScrollView: 'ScrollView', StyleSheet: { create: value => value, absoluteFill: {} }, useWindowDimensions: () => ({ width: screenWidth, height: 800 }) },
    './useWorkerOrderText': { useWorkerOrderText: () => ({ t: key => key }) }, './useWorkerColors': { useWorkerColors: () => ({ surface: 'white', text: 'black' }) } };
  mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : id.endsWith('.xml') ? id : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, filename);
  return mod.exports.WorkerFormDialog;
}
function nodes(node, pred) { if (!node || typeof node !== 'object') return []; if (Array.isArray(node)) return node.flatMap(value => nodes(value, pred));
  return [...(pred(node) ? [node] : []), ...nodes(node.props?.children, pred)]; }
// @v2-test test/admin_production_map_test_screen_test.dart
test('Android native report dialog blocks Back/outside when preventDismiss is set while explicit Cancel remains available', () => {
  const render = load('android'); let cancels = 0;
  const tree = render({ visible: true, title: 'Report', confirmLabel: 'Save', onConfirm() {}, preventDismiss: true, onCancel: () => cancels++ });
  const dialog = nodes(tree, node => node.type === AlertDialog)[0];
  assert.deepEqual(dialog.props.properties, { dismissOnBackPress: false, dismissOnClickOutside: false });
  dialog.props.onDismissRequest(); assert.equal(cancels, 0);
  const cancel = nodes(tree, node => node.type === 'TextButton')[0]; assert.equal(cancel.props.enabled, true); cancel.props.onClick(); assert.equal(cancels, 1);
});
test('Android save prevents cancellation and default dialogs preserve permitted Back dismissal', () => {
  const render = load('android');
  for (const cancelDisabled of [true, false]) {
    let cancels = 0; const tree = render({ visible: true, title: 'Report', confirmLabel: 'Save', onConfirm() {}, cancelDisabled, onCancel: () => cancels++ });
    const dialog = nodes(tree, node => node.type === AlertDialog)[0]; dialog.props.onDismissRequest();
    assert.equal(dialog.props.properties.dismissOnBackPress, !cancelDisabled); assert.equal(cancels, cancelDisabled ? 0 : 1);
  }
  assert.equal(render({ visible: false }), null);
});
for (const progressAction of ['pause', 'complete']) test(`Android ${progressAction} report has a readable form and preserves its actions`, () => {
  const render = load('android'), calls = [], scrollRef = { current: null };
  const tree = render({ visible: true, title: 'Miqdor', children: 'Fields', progressAction, preventDismiss: true, scrollRef,
    confirmLabel: 'Tasdiqlash', onConfirm: () => calls.push('confirm'), onCancel: () => calls.push('cancel') });
  const dialog = nodes(tree, node => node.type === AlertDialog)[0];
  assert.equal(dialog.props.properties.dismissOnBackPress, false);
  assert.equal(dialog.props.properties.usePlatformDefaultWidth, false);
  assert.equal(dialog.props.modifiers.find(mod => mod.name === 'width').args[0], 368);
  dialog.props.onDismissRequest(); assert.deepEqual(calls, []);
  const icon = nodes(tree, node => node.type === 'Icon')[0];
  assert.match(icon.props.source, progressAction === 'pause' ? /pause_circle\.xml$/ : /check_circle\.xml$/);
  assert.equal(icon.props.tint, 'onPrimaryContainer');
  const content = nodes(tree, node => node.type === 'ScrollView')[0];
  assert.equal(content.props.ref, scrollRef);
  assert.equal(content.props.style.maxHeight, 480);
  assert.deepEqual(nodes(tree, node => node.type === 'RNHostView')[0].props.matchContents, { vertical: true });
  assert.equal(nodes(tree, node => node.type === 'View')[0].props.style.width, '100%');
  const cancel = nodes(tree, node => node.type === 'OutlinedButton')[0], confirm = nodes(tree, node => node.type === 'Button')[0];
  cancel.props.onClick(); confirm.props.onClick(); assert.deepEqual(calls, ['cancel', 'confirm']);
  assert.equal(cancel.props.modifiers.find(mod => mod.name === 'height').args[0], 48);
  assert.equal(confirm.props.modifiers.find(mod => mod.name === 'height').args[0], 48);
  const busy = render({ visible: true, title: 'Miqdor', progressAction, confirmLabel: 'Save', onConfirm() {}, onCancel() {}, confirmDisabled: true, cancelDisabled: true });
  assert.equal(nodes(busy, node => node.type === 'OutlinedButton')[0].props.enabled, false);
  assert.equal(nodes(busy, node => node.type === 'Button')[0].props.enabled, false);
});
for (const [screen, expected] of [[320, 288], [360, 328], [384, 352], [430, 398], [600, 480], [900, 480]]) {
  test(`Android quantity dialog fits ${screen}dp screen while its content follows the native inset`, () => {
    const tree = load('android', screen)({ visible: true, title: 'Miqdor', children: 'Fields', progressAction: 'pause',
      confirmLabel: 'Tasdiqlash', onConfirm() {}, onCancel() {} });
    const dialog = nodes(tree, node => node.type === AlertDialog)[0];
    assert.equal(dialog.props.modifiers.find(mod => mod.name === 'width').args[0], expected);
    assert.equal(dialog.props.properties.usePlatformDefaultWidth, false);
    assert.deepEqual(nodes(tree, node => node.type === 'RNHostView')[0].props.matchContents, { vertical: true });
    assert.equal(nodes(tree, node => node.type === 'View')[0].props.style.width, '100%');
  });
}
test('fallback report also honors preventDismiss and forwards the actual native modal dismissal', () => {
  const render = load(); let cancels = 0, dismissals = 0;
  const tree = render({ visible: true, title: 'Report', preventDismiss: true, onCancel: () => cancels++, onDismiss: () => dismissals++, confirmLabel: 'Save', onConfirm() {} });
  tree.props.onRequestClose(); assert.equal(cancels, 0); tree.props.onDismiss(); assert.equal(dismissals, 1);
});
test('iOS native form forwards presentation/dismissal events and shares its scroll target with correction fields', () => {
  let shown = 0, dismissed = 0, cancelled = 0; const scrollRef = { current: null };
  const tree = load('ios')({ visible: true, title: 'Report', preventDismiss: true, scrollRef,
    onShow: () => shown++, onDismiss: () => dismissed++, onCancel: () => cancelled++, confirmLabel: 'Save', onConfirm() {} });
  tree.props.onRequestClose(); assert.equal(cancelled, 0); tree.props.onShow(); tree.props.onDismiss(); assert.equal(shown, 1); assert.equal(dismissed, 1);
  assert.equal(nodes(tree, node => node.type === 'ScrollView')[0].props.ref, scrollRef);
  assert.equal(nodes(tree, node => node.type === 'Button').length, 2);
});
for (const platform of ['ios', 'android']) test(`${platform}: merge confirmation permits Back/outside cancellation without changing report defaults`, () => {
  let cancelled = 0;
  const tree = load(platform)({ visible: true, title: 'Merge', dismissOnBackdrop: true,
    onCancel: () => cancelled++, confirmLabel: 'Yes', onConfirm() {} });
  if (platform === 'android') {
    const dialog = nodes(tree, node => node.type === AlertDialog)[0];
    assert.deepEqual(dialog.props.properties, { dismissOnBackPress: true, dismissOnClickOutside: true });
    dialog.props.onDismissRequest();
  } else {
    nodes(tree, node => node.type === 'Pressable')[0].props.onPress();
    tree.props.onRequestClose();
  }
  assert.equal(cancelled, platform === 'ios' ? 2 : 1);
});
