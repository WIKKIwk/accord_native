// Rendered native-control contract only; actual VoiceOver and keyboard layout require a phone.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const jsx = { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
function find(node, predicate) {
  if (!node || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap(value => find(value, predicate));
  return [...(predicate(node) ? [node] : []), ...find(node.props?.children, predicate)];
}
test('iOS manual scanner retains its visible accessible label after a code is entered', () => {
  const filename = path.resolve(__dirname, '../src/homashyo/RawSplitScanner.ios.tsx'), mod = new Module(filename, module);
  const calls = [], scan = { manual: 'ROLL-123', manualLabel: 'QR / shtrix-kod', title: 'Skanerlash', permission: { granted: false },
    unavailable: 'Kamera ochilmadi', setManual: value => calls.push(value), complete: (...args) => calls.push(args) };
  const mocks = { 'react/jsx-runtime': jsx, react: { useEffect: effect => effect() },
    '@expo/ui/swift-ui': new Proxy({ useNativeState: initial => { let value = initial; return { get: () => value, set: next => { value = next; } }; } }, { get: (o, key) => o[key] ?? key }),
    '@expo/ui/swift-ui/modifiers': new Proxy({}, { get: (_, key) => (...args) => ({ kind: key, args }) }),
    'react-native': { ActivityIndicator: 'ActivityIndicator', KeyboardAvoidingView: 'KeyboardAvoidingView', Modal: 'Modal', Text: 'NativeText', View: 'View', PlatformColor: name => name, StyleSheet: { create: value => value } },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) },
    '../shared/camera/CameraSurface': { CameraSurface: 'CameraSurface' }, '../shared/camera/synchronousGuard': {},
    '../components/WorkerIconButton': { WorkerIconButton: 'WorkerIconButton' }, '../components/WorkerSheetButton': { WorkerSheetButton: 'WorkerSheetButton' },
    './useRawSplitScanner': { useRawSplitScanner: () => scan } };
  mod.filename = filename; mod.paths = module.paths; mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, filename);
  const session = mod.exports.RawSplitScanner({ visible: true, active: true, isCurrent: () => true, onClose() {}, onComplete() {} });
  const tree = session.type(session.props), field = find(tree, node => node.type === 'TextField')[0];
  assert.equal(find(tree, node => node.type === 'KeyboardAvoidingView')[0].props.behavior, 'padding');
  assert.equal(field.props.text.get(), 'ROLL-123');
  assert.equal(find(tree, node => node.type === 'Text' && node.props.children === scan.manualLabel).length, 1);
  assert.equal(field.props.placeholder, undefined);
  assert.ok(field.props.modifiers.some(modifier => modifier.kind === 'accessibilityLabel' && modifier.args[0] === scan.manualLabel));
  field.props.modifiers.find(modifier => modifier.kind === 'onSubmit').args[0]();
  assert.deepEqual(calls, [['ROLL-123', 'manual']]);
});

test('iOS printer picker reuses the dismissible native sheet and all existing transport choices', () => {
  const filename = path.resolve(__dirname, '../src/homashyo/RawSplitPickerOverlay.ios.tsx'), mod = new Module(filename, module);
  let closed = 0;
  const close = () => { closed++; };
  const mocks = { 'react/jsx-runtime': jsx,
    '../components/WorkerOrderSheet': { WorkerOrderSheet: 'WorkerOrderSheet' },
    '../shared/printing/DeviceSheet': { DeviceSheet: 'DeviceSheet' },
    '../preparation/PreparationUI': { usePreparationText: () => value => value },
    './useRawSplitPickerOverlay': { useRawSplitPickerOverlay: () => close } };
  mod.filename = filename; mod.paths = module.paths; mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, filename);
  const adapter = {}, tree = mod.exports.RawSplitPickerOverlay({ request: { adapter }, owner: {} });
  assert.equal(tree.type, 'WorkerOrderSheet'); assert.equal(tree.props.dismissible, true);
  const picker = find(tree, node => node.type === 'DeviceSheet')[0];
  assert.equal(picker.props.operator, adapter); assert.equal(picker.props.safe, true); assert.equal(picker.props.printerOnly, undefined);
  tree.props.onClose(); picker.props.close(); assert.equal(closed, 2);
});
