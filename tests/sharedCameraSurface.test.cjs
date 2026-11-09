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
  const jsx = { jsx: (type, props, key) => ({ type, props, key }) };
  const { CameraSurface } = load('shared/camera/CameraSurface.tsx', { react, 'react/jsx-runtime': jsx,
    'expo-camera': { CameraView: 'CameraView' }, './CameraSurfaceGate': gate,
    './synchronousGuard': load('shared/camera/synchronousGuard.ts') }, true);
  let props = { active: true, permission: { granted: true, canAskAgain: true }, checking: false, facing: 'back', torch: false,
    barcodeTypes: ['qr', 'datamatrix'], sessionKey: '1', isCurrent: () => true, onDetection: value => events.push(['detected', value]),
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
test('the opt-in native ref is forwarded without changing default camera ownership', () => {
  const h = harness(), cameraRef = { current: null };
  assert.equal(h.render({ cameraRef }).props.ref, cameraRef);
  assert.equal(h.render({ cameraRef: undefined }).props.ref, undefined);
  h.unmount();
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
test('permission regrant starts a new generation and does not deliver the old generation', () => {
  const h = harness(), old = h.render(); assert.equal(h.render({ permission: null }), null);
  const next = h.render({ permission: { granted: true, canAskAgain: true } });
  const event = { type: 'datamatrix', data: 'value', raw: undefined, bounds: {}, cornerPoints: [] };
  old.props.onBarcodeScanned(event); next.props.onBarcodeScanned(event);
  assert.deepEqual(h.events, [['detected', event]]); h.unmount();
});

test('facing and barcode type changes each remount and invalidate prior camera events', () => {
  const h = harness(), back = h.render(), front = h.render({ facing: 'front' });
  assert.notEqual(back.key, front.key);
  const event = { type: 'qr', data: 'old', bounds: {}, cornerPoints: [] };
  back.props.onBarcodeScanned(event); assert.deepEqual(h.events, []); front.props.onBarcodeScanned(event);
  const changedTypes = h.render({ barcodeTypes: ['code128'] }); assert.notEqual(front.key, changedTypes.key); front.props.onBarcodeScanned(event);
  changedTypes.props.onBarcodeScanned(event); assert.deepEqual(h.events, [['detected', event], ['detected', event]]);
  h.unmount();
});
test('equivalent barcode array and torch changes do not invalidate the active generation', () => {
  const h = harness(), old = h.render(), current = h.render({ barcodeTypes: ['qr', 'datamatrix'], torch: true });
  assert.equal(old.key, current.key);
  const event = { type: 'qr', data: 'same-config', bounds: {}, cornerPoints: [] };
  old.props.onBarcodeScanned(event); current.props.onBarcodeScanned(event);
  assert.equal(current.props.enableTorch, true); assert.deepEqual(h.events, [['detected', event], ['detected', event]]); h.unmount();
});

test('role synchronous current guard drops pre-commit callbacks without waiting for a render', () => {
  let current = true; const h = harness(), tree = h.render({ isCurrent: () => current });
  current = false; tree.props.onBarcodeScanned({ type: 'qr', data: 'old' }); tree.props.onCameraReady(); tree.props.onMountError({ message: 'old' });
  assert.deepEqual(h.events, []); h.unmount();
});

test('permission checking unmounts the surface even if a caller still has an older grant', () => {
  const h = harness(), old = h.render(); assert.equal(h.render({ checking: true }), null);
  old.props.onBarcodeScanned({ type: 'qr', data: 'late' }); assert.deepEqual(h.events, []); h.unmount();
});

test('an owner guard exception fails closed for native events', () => {
  const h = harness(), tree = h.render({ isCurrent: () => { throw new Error('logged out'); } });
  assert.doesNotThrow(() => tree.props.onBarcodeScanned({ type: 'qr', data: 'old' }));
  assert.deepEqual(h.events, []); h.unmount();
});
test('starting permission refresh blocks a queued barcode before React can re-render', async () => {
  const { CameraPermissionController } = load('shared/camera/CameraPermissionController.ts'); let nextResolve, reads = 0;
  const refresh = new Promise(resolve => { nextResolve = resolve; }), permission = { granted: true, canAskAgain: true, status: 'granted' };
  const controller = new CameraPermissionController(() => reads++ === 0 ? Promise.resolve(permission) : refresh, async () => permission);
  controller.mount(); await new Promise(resolve => setImmediate(resolve)); assert.equal(controller.canUseCamera(), true);
  const h = harness(), tree = h.render({ isCurrent: controller.canUseCamera }); const pending = controller.refreshPermission();
  tree.props.onBarcodeScanned({ type: 'qr', data: 'old' }); assert.deepEqual(h.events, []); assert.equal(controller.canUseCamera(), false);
  nextResolve(permission); await pending; tree.props.onBarcodeScanned({ type: 'qr', data: 'new' });
  assert.equal(h.events.length, 1); h.unmount(); controller.unmount();
});

test('an accidentally async or rejected current guard never authorizes an event or leaks rejection', async () => {
  for (const guard of [() => Promise.resolve(true), () => Promise.reject(new Error('guard failed')), () => 1, () => 'true']) {
    const h = harness(), tree = h.render({ isCurrent: guard }); tree.props.onBarcodeScanned({ type: 'qr', data: 'old' });
    tree.props.onCameraReady(); tree.props.onMountError({ message: 'old' }); await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(h.events, []); h.unmount();
  }
});

test('a guard that reentrantly commits a new generation cannot deliver old native events to its new callbacks', () => {
  for (const kind of ['detection', 'error', 'ready']) {
    const h = harness(), calls = []; let committed = false;
    const old = h.render({ isCurrent: () => {
      if (!committed) { committed = true; h.render({ sessionKey: '2', isCurrent: () => true,
        onDetection: value => calls.push(['new-detection', value]), onMountError: value => calls.push(['new-error', value]),
        onReady: () => calls.push(['new-ready']) }); }
      return true;
    } });
    if (kind === 'detection') old.props.onBarcodeScanned({ data: 'old-queued' });
    if (kind === 'error') old.props.onMountError({ message: 'old-queued' });
    if (kind === 'ready') old.props.onCameraReady();
    assert.deepEqual(calls, [], kind); assert.deepEqual(h.events, [], kind); h.unmount();
  }
});

test('reentrant change of callbacks or generation during guard invalidates only the in-flight event', () => {
  for (const change of ['handler', 'generation', 'unmount']) {
    const h = harness(), calls = []; let next; let changed = false;
    const guard = () => { if (!changed) { changed = true;
      if (change === 'handler') next = h.render({ onDetection: value => calls.push(['new', value]) });
      else if (change === 'generation') next = h.render({ sessionKey: '2' });
      else h.unmount();
    } return true; };
    const old = h.render({ isCurrent: guard }); old.props.onBarcodeScanned({ data: 'old-queued' });
    assert.deepEqual(calls, [], change); assert.deepEqual(h.events, [], change);
    if (next) { next.props.onBarcodeScanned({ data: 'fresh' });
      if (change === 'handler') assert.deepEqual(calls, [['new', { data: 'fresh' }]]);
      else assert.deepEqual(h.events, [['detected', { data: 'fresh' }]]);
      h.unmount(); }
  }
});
