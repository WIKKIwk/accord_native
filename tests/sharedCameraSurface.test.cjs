// Role-neutral Expo Camera surface checks. No camera, OS permission or physical device is used.
const assert = require('node:assert/strict'); const fs = require('node:fs'); const Module = require('node:module');
const path = require('node:path'); const test = require('node:test'); const ts = require('typescript');
function load(file, mocks = {}, jsx = false) { const filename = path.resolve(__dirname, `../src/${file}`), m = new Module(filename, module);
  m.filename = filename; m.paths = module.paths; m.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  m._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS,
    ...(jsx ? { jsx: ts.JsxEmit.ReactJSX } : {}) } }).outputText, filename); return m.exports; }
const gate = load('shared/camera/CameraSurfaceGate.ts');
function harness() {
  const refs = [], memos = [], effects = [], events = []; let index = 0;
  const same = (a, b) => a && b && a.length === b.length && a.every((v, i) => v === b[i]);
  const react = {
    useRef: initial => { const i = index++; return refs[i] ?? (refs[i] = { current: initial }); },
    useMemo: (factory, deps) => { const i = index++; if (!memos[i] || !same(memos[i].deps, deps)) memos[i] = { value: factory(), deps }; return memos[i].value; },
    useLayoutEffect: (setup, deps) => { const i = index++; const previous = effects[i]; if (!previous || !same(previous.deps, deps)) {
      previous?.cleanup?.(); effects[i] = { deps, setup, cleanup: null }; } },
  };
  const jsx = { jsx: (type, props) => ({ type, props }) };
  const { CameraSurface } = load('shared/camera/CameraSurface.tsx', { react, 'react/jsx-runtime': jsx,
    'expo-camera': { CameraView: 'CameraView' }, './CameraSurfaceGate': gate }, true);
  let props = { active: true, permission: { granted: true, canAskAgain: true }, facing: 'back', torch: false,
    barcodeTypes: ['qr', 'datamatrix'], sessionKey: '1', onDetection: value => events.push(['detected', value]),
    onMountError: value => events.push(['error', value]), onReady: () => events.push(['ready']) };
  const render = patch => { props = { ...props, ...patch }; index = 0; const tree = CameraSurface(props);
    for (const effect of effects) if (effect && !effect.cleanup) effect.cleanup = effect.setup() ?? (() => {});
    return tree; };
  return { render, events, unmount: () => effects.forEach(effect => effect?.cleanup?.()) };
}
test('surface passes the original complete barcode event and controlled camera options without parsing', () => {
  const h = harness(), tree = h.render({ torch: true }), event = { type: 'qr', raw: '', data: 'https://host/?qr=A',
    bounds: { origin: { x: 1, y: 2 }, size: { width: 3, height: 4 } }, cornerPoints: [{ x: 5, y: 6 }] };
  assert.equal(tree.type, 'CameraView'); assert.equal(tree.props.enableTorch, true); assert.equal(tree.props.facing, 'back');
  assert.deepEqual(tree.props.barcodeScannerSettings.barcodeTypes, ['qr', 'datamatrix']); tree.props.onBarcodeScanned(event);
  assert.equal(h.events[0][1], event); assert.equal(h.events[0][1].raw, ''); assert.equal(h.events[0][1].data, event.data);
  assert.equal(h.events[0][1].bounds, event.bounds); assert.equal(h.events[0][1].cornerPoints, event.cornerPoints);
});
test('inactive or denied camera unmounts and rejects late ready, error and detection events', () => {
  for (const patch of [{ active: false }, { permission: { granted: false, canAskAgain: true } }]) {
    const h = harness(), old = h.render(); assert.equal(h.render(patch), null);
    old.props.onBarcodeScanned({ data: 'late' }); old.props.onMountError({ message: 'late' }); old.props.onCameraReady();
    assert.deepEqual(h.events, []); h.unmount();
  }
});
test('retry generation rejects all old events and accepts new events; no lock or debounce is imposed', () => {
  const h = harness(), old = h.render(), next = h.render({ sessionKey: '2' }), value = { type: 'qr', data: 'same', cornerPoints: [], bounds: {} };
  old.props.onBarcodeScanned(value); old.props.onCameraReady(); next.props.onBarcodeScanned(value); next.props.onBarcodeScanned(value);
  next.props.onCameraReady(); next.props.onMountError({ message: 'camera error' });
  assert.deepEqual(h.events, [['detected', value], ['detected', value], ['ready'], ['error', { message: 'camera error' }]]);
  h.unmount(); next.props.onBarcodeScanned(value); assert.equal(h.events.length, 4);
});
test('a changed handler receives current events without rebuilding the native generation', () => {
  const h = harness(), first = h.render(), calls = [], next = h.render({ onDetection: value => calls.push(value) });
  first.props.onBarcodeScanned({ data: 'from-old-listener' }); next.props.onBarcodeScanned({ data: 'new' });
  assert.deepEqual(calls, [{ data: 'from-old-listener' }, { data: 'new' }]); assert.deepEqual(h.events, []); h.unmount();
});
test('permission hook reads only; request and refresh are passed to the role and never invoked automatically', async () => {
  const calls = [], permission = { granted: false, canAskAgain: false, status: 'denied' };
  const request = async () => { calls.push('request'); return permission; }, refresh = async () => { calls.push('refresh'); return permission; };
  const { useCameraSurfacePermission } = load('shared/camera/useCameraSurfacePermission.ts', {
    'expo-camera': { useCameraPermissions: options => { assert.deepEqual(options, { get: true, request: false }); return [permission, request, refresh]; } } });
  const state = useCameraSurfacePermission(); assert.equal(state.permission, permission); assert.deepEqual(calls, []);
  assert.equal(await state.refreshPermission(), permission); assert.equal(await state.requestPermission(), permission); assert.deepEqual(calls, ['refresh', 'request']);
});

test('permission regrant starts a new generation and does not deliver the old generation', () => {
  const h = harness(), old = h.render(); assert.equal(h.render({ permission: null }), null);
  const next = h.render({ permission: { granted: true, canAskAgain: true } });
  const event = { type: 'datamatrix', data: 'value', raw: undefined, bounds: {}, cornerPoints: [] };
  old.props.onBarcodeScanned(event); next.props.onBarcodeScanned(event);
  assert.deepEqual(h.events, [['detected', event]]); h.unmount();
});
