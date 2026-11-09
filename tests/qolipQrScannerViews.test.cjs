const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const jsx = { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
function load(file, mocks) {
  const filename = path.resolve(__dirname, '../src', file), mod = new Module(filename, module);
  mod.require = id => id === 'react/jsx-runtime' ? jsx : Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, filename);
  return mod.exports;
}
function find(node, predicate) {
  if (!node || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap(child => find(child, predicate));
  return [...(predicate(node) ? [node] : []), ...find(node.props?.children, predicate)];
}
for (const platform of ['ios', 'android']) {
  function fixture() {
    const controls = ['Button', 'Host', 'HStack', 'Image', 'ProgressView', 'Text', 'VStack', 'Column', 'IconButton', 'RNHostView', 'Row'];
    const native = Object.fromEntries(controls.map(name => [name, name])), back = {}, calls = [];
    const scan = { valid: true, title: 'source title', text: key => key, notice: 'source snackbar', status: 'source prompt',
      camera: { torch: false, toggleTorch: () => calls.push('torch') }, state: { processing: false },
      close: () => { calls.push('close'); return true; }, retry: () => calls.push('retry') };
    const modifiers = new Proxy({}, { get: (_target, key) => (...args) => ({ key, args }) });
    const mocks = { react: { useCallback: fn => fn },
      'expo-router': { Stack: Object.assign(() => {}, { Screen: 'Screen' }), useFocusEffect: effect => effect() },
      'react-native': { View: 'View', ActivityIndicator: 'ActivityIndicator', BackHandler: { addEventListener: (_name, callback) => {
        back.press = callback; return { remove() {} }; } } },
      'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 24, bottom: 34 }) },
      'expo-symbols': { SymbolView: 'SymbolView' },
      '@expo/ui/swift-ui': native, '@expo/ui/swift-ui/modifiers': modifiers,
      '@expo/ui/jetpack-compose': native, '@expo/ui/jetpack-compose/modifiers': modifiers,
      '../preparation/PreparationNotice': { PreparationNotice: 'Notice' },
      './QolipQrScannerPreview': { QolipQrScannerPreview: 'Preview' },
      './useQolipQrScanner': { useQolipQrScanner: () => scan },
    };
    return { module: load(`qolip/QolipQrScanner.${platform}.tsx`, mocks), scan, calls, back };
  }
  test(`${platform} exports the three real source scanner modes and no manual-entry substitute`, () => {
    const f = fixture();
    for (const [name, mode] of [['QolipCellQrScanScreen', 'cell'], ['QolipRawQrScanScreen', 'raw'], ['QolipUniversalQrScanScreen', 'universal']]) {
      const page = f.module[name]({ session: 'opening-session' });
      assert.equal(page.type, f.module.QolipQrScannerScreen); assert.equal(page.props.mode, mode); assert.equal(page.props.session, 'opening-session');
    }
    const tree = f.module.QolipQrScannerScreen({}); assert.equal(find(tree, node => /TextField|TextInput/.test(String(node.type))).length, 0);
  });
  test(`${platform} camera error retries, status uses the live key and flashlight toggles the real camera`, () => {
    const f = fixture(), tree = f.module.QolipQrScannerScreen({}), preview = find(tree, node => node.type === 'Preview')[0];
    assert.ok(preview); assert.equal(find(preview.props.status, node => node.type === 'Text')[0].props.children, 'source prompt');
    const retry = find(preview.props.error, node => node.type === 'Button')[0];
    (retry.props.onPress ?? retry.props.onClick)();
    const flash = find(preview.props.torch, node => node.type === 'Button' || node.type === 'IconButton')[0];
    (flash.props.onPress ?? flash.props.onClick)(); assert.deepEqual(f.calls, ['retry', 'torch']);
    assert.equal(find(tree, node => node.type === 'Notice')[0].props.message, 'source snackbar');
    if (platform === 'ios') {
      const options = find(tree, node => node.type === 'Screen')[0].props.options; assert.equal(options.title, 'source title');
      const button = find(options.headerLeft(), node => node.type === 'Button')[0]; button.props.onPress();
    } else { assert.equal(f.back.press(), true); }
    assert.equal(f.calls.at(-1), 'close');
  });
  test(`${platform} expired scanner renders no camera, old data or actionable controls`, () => {
    const f = fixture(); f.scan.valid = false; assert.equal(f.module.QolipQrScannerScreen({}), null); assert.deepEqual(f.calls, []);
  });
}

test('preview preserves source frame bounds, full-frame QR/Data Matrix scan and generation-separated native events', () => {
  const events = [], cameraRef = { current: null }, camera = { permission: { granted: true }, checking: false, requested: true,
    generation: 7, cameraRef, ready: true, failure: false, torch: true, canUseCamera: () => true,
    onReady: value => events.push(['ready', value]), onMountError: value => events.push(['error', value]) };
  const { QolipQrScannerPreview, qolipScannerFrame } = load('qolip/QolipQrScannerPreview.tsx', {
    react: { useState: value => [value, () => {}] },
    'react-native': { View: 'View', ActivityIndicator: 'ActivityIndicator', StyleSheet: { create: value => value, absoluteFill: {} } },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ bottom: 34 }) },
    '../shared/camera/CameraSurface': { CameraSurface: 'CameraSurface' },
  });
  assert.deepEqual(qolipScannerFrame(100, 100), { width: 220, height: 220 });
  assert.deepEqual(qolipScannerFrame(1000, 1000), { width: 320, height: 340 });
  assert.deepEqual(qolipScannerFrame(400, 600), { width: 312, height: 252 });
  const scan = { active: true, camera, state: { generation: 3, processing: false, finished: false }, detect: (...args) => events.push(['detect', ...args]) };
  let tree = QolipQrScannerPreview({ scan }), native = find(tree, node => node.type === 'CameraSurface')[0];
  assert.equal(native.props.cameraRef, cameraRef); assert.equal(native.props.facing, 'back'); assert.equal(native.props.torch, true);
  assert.deepEqual(native.props.barcodeTypes, ['qr', 'datamatrix']); assert.equal(native.props.sessionKey, 'qolip:7');
  native.props.onReady(); native.props.onMountError(); native.props.onDetection({ raw: '', data: 'DISPLAY' });
  assert.deepEqual(events, [['ready', 7], ['error', 7], ['detect', '', 'DISPLAY', 3]]);
  scan.state.finished = true; tree = QolipQrScannerPreview({ scan }); native = find(tree, node => node.type === 'CameraSurface')[0];
  assert.equal(native.props.active, false);
});
