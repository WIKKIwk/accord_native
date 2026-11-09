// Exercise the real nativeSheet owner/entry lifecycle with mocked navigation and native controls.
const assert = require('node:assert/strict'); const fs = require('node:fs'); const Module = require('node:module');
const path = require('node:path'); const test = require('node:test'); const ts = require('typescript');
function load(file, mocks = {}, jsx = false) { const filename = path.resolve(__dirname, `../src/${file}`), m = new Module(filename, module);
  m.filename = filename; m.paths = module.paths; m.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  m._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS,
    ...(jsx ? { jsx: ts.JsxEmit.ReactJSX } : {}) } }).outputText, filename); return m.exports; }
const discovery = load('gscale/gscaleDiscovery.ts');
const { createTransientDevicePicker } = load('shared/printing/transientDevicePicker.ts', { '../../gscale/gscaleDiscovery': discovery });
const flush = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
function harness(options = {}) {
  const effects = [], pushes = [], events = []; let scopeCurrent = true, pops = 0;
  const nativeReact = { useContext: () => ({}), useRef: value => ({ current: value }), useMemo: factory => factory(),
    useEffect: setup => effects.push(setup), useLayoutEffect: setup => effects.push(setup) };
  const native = load('nativeSheet.tsx', { react: nativeReact, 'expo-router': { router: { push: value => pushes.push(value) } },
    './components/WorkerSecurity': { SecurityContext: {} } }, true);
  const sheet = native.useNativeSheet(), cleanups = effects.map(setup => setup());
  const request = createTransientDevicePicker({ isCurrent: () => scopeCurrent, scan: async () => ({ servers: [], candidateCount: 0 }),
    probe: async () => null, validateSelection: options.validateSelection, dismissTimeoutMs: options.dismissTimeoutMs });
  sheet.open('picker', { onDismiss: () => { events.push('dismissed'); request.onDismiss(); } });
  // Simulated owner callbacks exercise nativeSheet's real entry lifecycle. Production wiring for
  // dismiss-start is not proven by this harness and remains a blocker for exposing a route.
  const listeners = { blur: request.onLeaving, removePrevented: request.onRemovalPrevented };
  let unmountNativeRoute = null;
  const mountRoute = () => { unmountNativeRoute = native.mountNativeSheet('1', () => {
    events.push('pop'); pops++; if (options.preventPop) listeners.removePrevented(); else listeners.blur();
  }); };
  if (!options.deferMount) mountRoute();
  const unmountRoute = () => unmountNativeRoute?.();
  const pickerReact = { useSyncExternalStore: (_subscribe, get) => get(), useEffect: setup => setup(), useState: value => [value, () => {}] };
  const { useDevicePicker } = load('shared/printing/useDevicePicker.ts', { react: pickerReact, 'react-native': { Platform: { OS: 'ios' } },
    '../../gscale/gscaleBluetoothDevices': { watchGScaleBluetoothDevices: async () => () => {} },
    '../../printing/nativePrinter': { NativeBluetoothPrinter: {} },
    '../../printing/printService': { PrintService: { detectOfflinePrinter: options.detectOfflinePrinter ?? (async () => ({ kind: 'zebra' })) } } });
  const picker = useDevicePicker(request.adapter, () => { events.push('close'); sheet.close(); }, true);
  return { native, sheet, request, picker, pushes, events, unmountRoute, pops: () => pops,
    blur: () => listeners.blur(), mountRoute, replayRouteEffect: () => { unmountNativeRoute?.(); mountRoute(); },
    unmountOwner: () => { request.dispose(); cleanups.forEach(cleanup => cleanup?.()); },
    switchAccount: () => { scopeCurrent = false; request.dispose(); } };
}
test('selected result waits for real entry removal; consumer cleanup can immediately open a new sheet', async () => {
  const h = harness(), selection = { address: 'AA' }; let observed = false;
  const consumer = h.request.result.then(value => { observed = true; h.events.push('result'); h.request.dispose();
    assert.equal(h.sheet.isOpen(), false); h.sheet.open('next'); return value; });
  await h.picker.selectBluetooth(selection); await flush();
  assert.equal(observed, false); assert.equal(h.native.getNativeSheet('1').closing, true); assert.deepEqual(h.events, ['close', 'pop']);
  h.unmountRoute(); const result = await consumer;
  assert.deepEqual(result, { transport: 'bluetooth', bluetoothPrinter: selection }); assert.equal(h.pushes.length, 2);
  assert.equal(h.native.getNativeSheet('2').content, 'next'); assert.equal(h.native.getNativeSheet('2').closing, false);
  assert.deepEqual(h.events, ['close', 'pop', 'dismissed', 'result']); assert.equal(h.pops(), 1);
});
test('native back during async selection invalidates immediately but settles after route removal', async () => {
  const validation = deferred(), h = harness({ validateSelection: () => validation.promise }); let observed = false;
  h.request.result.then(() => { observed = true; }); const pending = h.picker.selectBluetooth({ address: 'AA' });
  // Simulate the supported navigation blur callback; its real-device timing remains unproven.
  h.blur(); validation.resolve(); await pending; await flush(); assert.equal(observed, false);
  assert.deepEqual(h.events, []); h.unmountRoute(); assert.equal(await h.request.result, null); assert.equal(h.pops(), 0);
});
test('dismiss initiation suppresses late USB results and cannot close the next sheet', async () => {
  const detection = deferred(), h = harness({ detectOfflinePrinter: () => detection.promise }); h.picker.choose('usb');
  const pending = h.picker.selectUsb(); h.native.closeNativeSheet('1'); assert.equal(h.pops(), 1);
  detection.resolve({ kind: 'zebra' }); await pending; h.unmountRoute(); assert.equal(await h.request.result, null);
  h.sheet.open('next'); assert.equal(h.native.getNativeSheet('2').closing, false); assert.equal(h.pops(), 1);
});
test('owner unmount resolves null even though nativeSheet deliberately suppresses onDismiss', async () => {
  const h = harness(); h.unmountOwner(); assert.equal(await h.request.result, null); await flush();
  assert.equal(h.native.getNativeSheet('1').content, null); h.unmountRoute(); await flush();
  assert.ok(!h.events.includes('dismissed')); assert.equal(h.sheet.isOpen(), false);
});
test('account switch during an accepted close resolves null and cannot affect a subsequent sheet', async () => {
  const h = harness(); await h.picker.selectBluetooth({ address: 'AA' }); h.switchAccount();
  assert.equal(await h.request.result, null); h.unmountRoute(); await flush(); h.sheet.open('next');
  h.request.onDismiss(); h.request.onLeaving(); assert.equal(h.native.getNativeSheet('2').content, 'next');
  assert.equal(h.native.getNativeSheet('2').closing, false); assert.equal(h.pops(), 1);
});
test('rejected selection keeps the entry open and leaves its result pending until cancellation finishes', async () => {
  const h = harness({ validateSelection: () => { throw new Error('blocked'); } }); let settled = false;
  h.request.result.then(() => { settled = true; }); await h.picker.selectBluetooth({ address: 'AA' }); await flush();
  assert.equal(h.native.getNativeSheet('1').closing, false); assert.equal(settled, false); assert.equal(h.pops(), 0);
  h.native.closeNativeSheet('1'); await flush(); assert.equal(settled, false); h.unmountRoute(); assert.equal(await h.request.result, null);
});

test('nativeSheet StrictMode route remount does not settle an active picker', async () => {
  const h = harness(); h.replayRouteEffect(); await new Promise(resolve => setTimeout(resolve, 5));
  await h.picker.selectBluetooth({ address: 'AA' }); h.unmountRoute();
  assert.equal((await h.request.result).transport, 'bluetooth');
});
test('programmatic success before the native route mounts waits for mount and removal', async () => {
  const h = harness({ deferMount: true }); let settled = false; h.request.result.then(() => { settled = true; });
  await h.picker.selectBluetooth({ address: 'AA' }); await flush(); assert.equal(settled, false);
  assert.equal(h.native.getNativeSheet('1').closing, true); assert.equal(h.pops(), 0);
  h.mountRoute(); assert.equal(h.pops(), 1); h.unmountRoute(); assert.equal((await h.request.result).transport, 'bluetooth');
});
test('owner unmount before native route mounts still resolves and closes that pending route', async () => {
  const h = harness({ deferMount: true }); h.unmountOwner(); assert.equal(await h.request.result, null); await flush();
  h.mountRoute(); assert.equal(h.pops(), 1); h.unmountRoute(); await flush(); assert.equal(h.sheet.isOpen(), false);
});

test('navigation removal prevention cancels the result instead of hanging', async () => {
  const h = harness({ preventPop: true }); await h.picker.selectBluetooth({ address: 'AA' });
  assert.equal(await h.request.result, null); assert.equal(h.native.getNativeSheet('1').closing, true);
  // nativeSheet itself has no recovery for a prevented pop; do not claim that the entry closed.
  h.unmountRoute(); await flush();
});
test('a lost pop or missing route mount times out as cancellation, never as an accepted printer', async () => {
  const h = harness({ deferMount: true, dismissTimeoutMs: 5 });
  await h.picker.selectBluetooth({ address: 'AA' }); assert.equal(await h.request.result, null);
  assert.equal(h.native.getNativeSheet('1').closing, true);
  h.mountRoute(); h.unmountRoute(); await flush(); assert.equal(h.sheet.isOpen(), false);
});
