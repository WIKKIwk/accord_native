const assert = require('node:assert/strict');
const test = require('node:test');
const { load, nodes } = require('./support/workerOrderScreen.cjs');
const { hooks, tick, defer, jsx } = require('./support/workerPaddonHarness.cjs');

function fixture(platform) {
  const runner = hooks(), events = [], hidden = defer();
  const native = new Proxy({}, { get: (_target, name) => name }), mods = new Proxy({}, { get: (_target, name) => (...args) => ({ name, args }) });
  const { WorkerQrScannerView } = load(`components/WorkerQrScannerView.${platform}.tsx`, {
    react: { ...runner.react, useEffectEvent: fn => fn }, 'react/jsx-runtime': jsx,
    '@expo/ui/swift-ui': native, '@expo/ui/swift-ui/modifiers': mods,
    '@expo/ui/jetpack-compose': { ...Object.fromEntries(['Button', 'CircularProgressIndicator', 'Column', 'FilledTonalButton', 'FilledTonalIconButton', 'Icon', 'ModalBottomSheet', 'RNHostView', 'Row', 'Text'].map(name => [name, name])),
      useMaterialColors: () => ({ surfaceContainerLow: 'surface', onSurface: 'text', onSurfaceVariant: 'muted', onSecondaryContainer: 'icon' }) },
    '@expo/ui/jetpack-compose/modifiers': mods, 'expo-symbols': { SymbolView: 'SymbolView' },
    'react-native': { Platform: { Version: '26' }, PlatformColor: value => value, ScrollView: 'ScrollView', View: 'View', useWindowDimensions: () => ({ width: 390, height: 844 }) },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 44, bottom: 34 }) }, './BaseHost': { BaseHost: 'Host' },
    './WorkerQrScannerPreview': { WorkerQrScannerPreview: 'Preview' }, './WorkerQrScannerDialogs': { WorkerQrScannerDialogs: 'Dialogs' },
    '../../assets/icons/gscale/close.xml': 'close.xml',
  });
  const model = { closing: false, busy: false, labels: { title: 'Scan', close: 'Close', manual: 'Manual QR', retry: 'Retry', flash: 'Flash', status: 'Scan prompt' },
    close: () => events.push('close'), dismissed: () => events.push('dismissed'), openManual: () => events.push('manual'),
    camera: { active: true, ready: true, unavailable: false, torch: false, toggleTorch: () => events.push('torch'), retry: async () => events.push('retry') } };
  return { model, events, hidden, render() { runner.begin(); const tree = WorkerQrScannerView({ model });
    const sheet = nodes(tree, n => n.type === 'ModalBottomSheet')[0];
    if (sheet) sheet.props.ref.current = { hide: () => { events.push('hide'); return hidden.promise; } };
    runner.flush(); return tree; }, dispose: runner.dispose };
}
for (const platform of ['ios', 'android']) test(`${platform}: native scanner sheet contains a bounded preview, native actions and themed content`, async () => {
  const f = fixture(platform), tree = f.render(), sheet = nodes(tree, n => n.type === (platform === 'ios' ? 'BottomSheet' : 'ModalBottomSheet'))[0];
  assert.ok(sheet); assert.equal(nodes(tree, n => n.type === 'Modal').length, 0);
  assert.equal(nodes(tree, n => n.type === 'Preview').length, 1); assert.equal(nodes(tree, n => n.type === 'ScrollView').length, 1);
  assert.equal(nodes(tree, n => n.type === 'Host').some(n => n.props.colorScheme === 'light'), false);
  assert.equal(nodes(tree, n => n.type === 'Dialogs')[0].props.model, f.model);
  if (platform === 'ios') {
    const close = nodes(tree, n => n.type === 'Button' && n.props.systemImage === 'xmark')[0];
    assert.equal(close.props.modifiers.find(m => m.name === 'frame').args[0].minHeight, 44);
    close.props.onPress(); assert.deepEqual(f.events, ['close']);
    f.model.closing = true; const closing = nodes(f.render(), n => n.type === 'BottomSheet')[0];
    assert.equal(closing.props.isPresented, false); assert.equal(f.events.includes('dismissed'), false);
    closing.props.onDismiss(); assert.equal(f.events.at(-1), 'dismissed');
  } else {
    const close = nodes(tree, n => n.type === 'FilledTonalIconButton')[0];
    assert.deepEqual(close.props.modifiers.find(m => m.name === 'size').args, [48, 48]);
    close.props.onClick(); f.model.closing = true; f.render();
    assert.deepEqual(f.events, ['close', 'hide']); f.hidden.resolve(); await tick(); assert.equal(f.events.at(-1), 'dismissed');
    assert.equal(sheet.props.skipPartiallyExpanded, true);
    const manual = nodes(tree, n => n.type === 'FilledTonalButton')[0];
    assert.equal(manual.props.modifiers.find(m => m.name === 'height').args[0], 56); manual.props.onClick(); assert.equal(f.events.at(-1), 'manual');
  }
  f.dispose();
});

test('camera preview keeps its frame square and inside the preview on small phones and tablets', () => {
  for (const [width, height] of [[320, 568], [390, 844], [430, 932], [1024, 1366]]) {
    const render = load('components/WorkerQrScannerPreview.tsx', {
      'react/jsx-runtime': jsx, 'expo-symbols': { SymbolView: 'SymbolView' },
      'react-native': { ActivityIndicator: 'ActivityIndicator', View: 'View', StyleSheet: { create: value => value, absoluteFill: {} }, useWindowDimensions: () => ({ width, height }) },
      '../shared/camera/CameraSurface': { CameraSurface: 'CameraSurface' },
    }).WorkerQrScannerPreview;
    const scanned = [], camera = { active: true, permission: { granted: true }, current: () => true, torch: false, ready: true, generation: 2,
      scan: (value, raw) => scanned.push([value, raw]), onError() {}, onReady() {} };
    const tree = render({ camera, torch: 'Torch' }), previewHeight = tree.props.style[1].height;
    const frame = nodes(tree, n => Array.isArray(n.props?.style) && n.props.style[0]?.borderWidth === 2)[0].props.style[1];
    assert.equal(frame.width, frame.height); assert(frame.height < previewHeight); assert(frame.width < width - 40);
    const surface = nodes(tree, n => n.type === 'CameraSurface')[0]; assert.deepEqual(surface.props.barcodeTypes, ['qr', 'datamatrix']);
    surface.props.onDetection({ data: 'QR', raw: 'RAW' }); assert.deepEqual(scanned, [['QR', 'RAW']]);
    camera.active = false;
    assert.equal(nodes(render({ camera, torch: 'Torch' }), n => n.props?.style?.right === 12).length, 0);
  }
});
