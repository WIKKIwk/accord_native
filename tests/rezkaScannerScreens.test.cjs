// Source-derived scanner UI contracts. Native layout, permission prompts and hardware remain unverified.
const assert = require('node:assert/strict'), fs = require('node:fs'), Module = require('node:module');
const path = require('node:path'), test = require('node:test'), ts = require('typescript');
const jsx = { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
function load(file, mocks = {}) {
  const filename = path.resolve(__dirname, `../src/rezka/${file}`), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths; mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, filename);
  return mod.exports;
}
function nodes(node, predicate) { if (!node || typeof node !== 'object') return []; if (Array.isArray(node)) return node.flatMap(child => nodes(child, predicate));
  return [...(predicate(node) ? [node] : []), ...nodes(node.props?.children, predicate)]; }
const grant = { granted: true, canAskAgain: true, status: 'granted' };
function preview() {
  const slots = [], effects = [], calls = []; let cursor = 0, current = true, props = { active: true, generation: 1 }, dirty = false, finishRefresh;
  const same = (a, b) => a && b && a.length === b.length && a.every((value, index) => value === b[index]);
  const camera = { permission: null, checking: true, error: null,
    canUseCamera: () => camera.permission?.granted === true && !camera.checking && !camera.error,
    requestPermission: async () => { calls.push('request'); }, refreshPermission: () => {
      calls.push('refresh'); camera.permission = null; camera.checking = true; camera.error = null;
      return new Promise(resolve => { finishRefresh = permission => { camera.permission = permission; camera.checking = false; resolve(permission); }; });
    } };
  const react = { useRef: value => { const index = cursor++; return slots[index] ?? (slots[index] = { current: value }); },
    useState: initial => { const index = cursor++; slots[index] ??= { value: initial }; return [slots[index].value, value => {
      if (slots[index].value !== value) { dirty = true; slots[index].value = value; }
    }]; },
    useEffect: (setup, deps) => { const index = cursor++; if (!effects[index] || !same(effects[index].deps, deps)) {
      effects[index]?.cleanup?.(); effects[index] = { deps, setup, pending: true }; } } };
  const { RezkaScannerPreview } = load('RezkaScannerPreview.tsx', { react, 'react/jsx-runtime': jsx,
    'expo-symbols': { SymbolView: 'SymbolView' },
    'react-native': { View: 'View', Text: 'Text', StyleSheet: { create: value => value, absoluteFill: 'absoluteFill' } },
    '../shared/camera/CameraSurface': { CameraSurface: 'CameraSurface' },
    '../shared/camera/useCameraSurfacePermission': { useCameraSurfacePermission: () => ({ ...camera }) } });
  const isCurrent = () => current, accept = value => calls.push(['accept', value]);
  const render = patch => {
    props = { ...props, ...patch }; let tree, retries = 0;
    do { dirty = false; cursor = 0; tree = RezkaScannerPreview({ ...props, isCurrent, accept }); } while (dirty && ++retries < 5);
    effects.forEach(effect => { if (effect?.pending) { effect.pending = false; effect.cleanup = effect.setup(); } }); return tree;
  };
  const refresh = async permission => { finishRefresh(permission); await new Promise(resolve => setImmediate(resolve)); return render(); };
  return { camera, calls, invalidate: () => { current = false; }, render, refresh,
    initialize: async permission => { render(); return refresh(permission); } };
}
test('scanner requests once only while current and askable, then uses the shared back QR/Data Matrix surface', async () => {
  const h = preview(); assert.equal(nodes(h.render(), n => n.type === 'CameraSurface').length, 0); assert.deepEqual(h.calls, ['refresh']);
  await h.refresh({ granted: false, canAskAgain: true, status: 'undetermined' });
  h.render(); assert.deepEqual(h.calls, ['refresh', 'request']);
  h.camera.permission = grant; const surface = nodes(h.render(), n => n.type === 'CameraSurface')[0];
  assert.equal(surface.props.active, true); assert.equal(surface.props.facing, 'back'); assert.equal(surface.props.torch, false);
  assert.deepEqual(surface.props.barcodeTypes, ['qr', 'datamatrix']); assert.equal(surface.props.isCurrent(), true);
  surface.props.onDetection({ raw: ' raw ', data: 'display' }); surface.props.onDetection({ raw: '', data: 'not-a-fallback' }); surface.props.onDetection({ data: 'display' });
  assert.deepEqual(h.calls.slice(-3), [['accept', ' raw '], ['accept', ''], ['accept', 'display']]);
  h.invalidate(); assert.equal(surface.props.isCurrent(), false);
});
test('blocked or stale owners never request a new permission prompt', async () => {
  for (const condition of ['inactive', 'stale', 'denied', 'checking', 'error']) {
    const h = preview(), permission = { granted: false, canAskAgain: true };
    if (condition === 'stale') h.invalidate();
    if (condition === 'denied') permission.canAskAgain = false;
    h.render({ active: condition !== 'inactive' });
    if (condition !== 'inactive' && condition !== 'checking') {
      if (condition === 'error') { h.camera.error = new Error('failed read'); h.render(); }
      else await h.refresh(permission);
    }
    assert.equal(h.calls.includes('request'), false, condition);
  }
});
test('denied permission and native failures keep V2 default error words and native detail', async () => {
  const denied = preview(); assert.ok(JSON.stringify(await denied.initialize({ granted: false, canAskAgain: false })).includes('Camera permission denied.'));
  const h = preview(), surface = nodes(await h.initialize(grant), n => n.type === 'CameraSurface')[0];
  surface.props.onMountError({ message: 'native camera unavailable' });
  assert.equal(surface.props.isCurrent(), false, 'failure blocks queued events before React rerenders');
  const text = JSON.stringify(h.render()); assert.ok(text.includes('An unexpected error occurred.')); assert.ok(text.includes('native camera unavailable'));
  assert.ok(!text.includes('Scanner bu qurilmada ishlamaydi'));
});
test('resume hides an older grant until refresh completes and restarts a failed native camera', async () => {
  const h = preview(), old = nodes(await h.initialize(grant), n => n.type === 'CameraSurface')[0];
  old.props.onMountError({ message: 'failed' }); h.render();
  h.render({ active: false }); const resumed = h.render({ active: true });
  assert.deepEqual(h.calls, ['refresh', 'refresh']); assert.ok(nodes(resumed, n => n.type === 'CameraSurface').every(node => !node.props.active));
  assert.equal(nodes(h.render(), n => n.type === 'CameraSurface').length, 0);
  const next = nodes(await h.refresh(grant), n => n.type === 'CameraSurface')[0];
  assert.equal(next.props.isCurrent(), true); assert.equal(next.props.active, true);
});
test('batched app transitions force a new camera generation and permission refresh even when active stays true', async () => {
  const h = preview(), old = nodes(await h.initialize(grant), n => n.type === 'CameraSurface')[0];
  const next = nodes(h.render({ generation: 3 }), n => n.type === 'CameraSurface')[0];
  assert.equal(next.props.active, false); assert.notEqual(old.props.sessionKey, next.props.sessionKey);
  assert.deepEqual(h.calls, ['refresh', 'refresh']);
  assert.equal(nodes(h.render(), n => n.type === 'CameraSurface').length, 0);
  assert.equal(nodes(await h.refresh(grant), n => n.type === 'CameraSurface')[0].props.active, true);
});
for (const platform of ['ios', 'android']) {
  test(`${platform}: scanner is a native full-screen dialog with V2 title and back cancellation`, () => {
    const calls = [], Toolbar = Object.assign(function Toolbar() {}, { Content: 'Toolbar.Content' });
    const components = new Proxy({ Toolbar, useMaterialColors: () => ({ background: 'native-background' }) }, { get: (obj, key) => obj[key] ?? key });
    const modifiers = new Proxy({}, { get: (_obj, key) => (...args) => ({ name: key, args }) });
    const { RezkaSplitScanner } = load(`RezkaSplitScanner.${platform}.tsx`, { 'react/jsx-runtime': jsx,
      '@expo/ui/swift-ui': components, '@expo/ui/jetpack-compose': components, '@expo/ui/swift-ui/modifiers': modifiers,
      'react-native': { Modal: 'Modal' }, 'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' },
      '../shared/navigation/RoleHeader.android': { RoleHeader: 'RoleHeader' },
      './RezkaScannerPreview': { RezkaScannerPreview: 'Preview' }, './useRezkaSplit': { useRezkaText: () => text => text } });
    const isCurrent = () => true, accept = () => {}, close = () => calls.push('close');
    const page = RezkaSplitScanner({ active: true, generation: 4, isCurrent, accept, close });
    assert.equal(page.type, 'Modal'); assert.equal(page.props.visible, true); assert.equal(page.props.presentationStyle, 'fullScreen');
    assert.ok(JSON.stringify(page).includes('QR scan')); const camera = nodes(page, n => n.type === 'Preview')[0];
    assert.equal(camera.props.active, true); assert.equal(camera.props.generation, 4); assert.equal(camera.props.isCurrent, isCurrent); assert.equal(camera.props.accept, accept);
    page.props.onRequestClose();
    if (platform === 'ios') nodes(page, n => n.type === 'Button')[0].props.onPress();
    else nodes(page, n => n.type === 'RoleHeader')[0].props.navigation.onPress();
    assert.deepEqual(calls, ['close', 'close']);
  });
}
