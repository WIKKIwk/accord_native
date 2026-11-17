const assert = require('node:assert/strict');
const test = require('node:test');
const { load, deferred, tick } = require('./adminUsersSupport.cjs');
const policy = load('admin/adminShellLayoutPolicy');
function fixture(t, platform = 'android') {
  let cursor = 0, navCalls = 0, hasFooter = true, bottomDockHeight, sourceScope = null, dimensions = { width: 400, height: 800, scale: 2 }, safe = { top: 24, right: 0, bottom: 24, left: 0 };
  let value = { platform, width: 400, height: 800, viewPaddingBottom: 24, systemGestureInsetsBottom: 16, viewInsetsBottom: 0 }, reader = async () => value;
  const slots = [], effects = [], native = new Set(), keyboard = new Map(), foreground = new Set(), reads = [];
  const same = (a, b) => a && b && a.length === b.length && a.every((value, i) => Object.is(value, b[i]));
  const memo = (create, deps) => { const index = cursor++, old = slots[index]; if (!old || !same(old.deps, deps)) slots[index] = { deps, value: create() }; return slots[index].value; };
  const effect = (create, deps) => { const index = cursor++, old = slots[index]; if (!old || !same(old.deps, deps)) effects.push(() => { old?.cleanup?.(); slots[index] = { kind: 'effect', deps, cleanup: create() }; }); };
  const react = { useMemo: memo, useLayoutEffect: effect, useEffect: effect, useSyncExternalStore: (_subscribe, get) => get() };
  const bridge = { readAdminGestureNavigation: async () => { navCalls++; return true; }, readAdminSystemInsets: async () => { reads.push('read'); return reader(); },
    subscribeAdminSystemInsets: callback => { native.add(callback); return () => native.delete(callback); } };
  const rn = { Platform: { OS: platform }, useWindowDimensions: () => dimensions,
    AppState: { addEventListener: (name, callback) => { assert.equal(name, 'change'); foreground.add(callback); return { remove: () => foreground.delete(callback) }; } },
    Keyboard: { addListener: (name, callback) => { const listeners = keyboard.get(name) ?? new Set(); listeners.add(callback); keyboard.set(name, listeners); return { remove: () => listeners.delete(callback) }; } } };
  const runtime = load('admin/adminShellLayoutRuntime', { 'react-native': rn, '../../modules/accord-admin-layout/src/AccordAdminLayoutModule': bridge });
  const hook = load('admin/useAdminShellLayout', { react, 'react-native': rn, 'react-native-safe-area-context': { useSafeAreaInsets: () => safe },
    './AdminShellSourceWindowLayoutContext': { useAdminShellSourceWindowLayout: () => sourceScope },
    '../../modules/accord-admin-layout/src/AccordAdminLayoutModule': bridge, './adminShellLayoutPolicy': policy, './adminShellLayoutRuntime': runtime });
  const render = () => { cursor = 0; effects.length = 0; const view = hook.useAdminShellLayout(hasFooter, bottomDockHeight); for (const commit of [...effects]) commit(); return view; };
  const cleanup = () => { for (const slot of slots) if (slot?.kind === 'effect') { slot.cleanup?.(); slot.cleanup = null; slot.deps = null; } };
  t.after(cleanup);
  return { render, reads, native, keyboard, foreground, cleanup, navCalls: () => navCalls, metrics: next => { value = next; }, setReader: next => { reader = next; },
    dimensions: next => { dimensions = next; }, safe: next => { safe = next; }, scope: next => { sourceScope = next; }, footer: next => { hasFooter = next; }, dockHeight: next => { bottomDockHeight = next; } };
}
test('original-window scope uses only its own metrics/insets and installs no Activity native, keyboard or navigation readers', async t => {
  const f = fixture(t), metrics = { platform: 'android', width: 300, height: 600, viewPaddingBottom: 7, systemGestureInsetsBottom: 9, viewInsetsBottom: 0 }, safeInsets = { top: 13, left: 17, right: 19 };
  f.scope({ metrics, thinGestureBottom: false, safeInsets }); const view = f.render(); await tick();
  assert.equal(view.sourceWindow, true); assert.equal(view.metrics, metrics); assert.equal(view.safeInsets, safeInsets); assert.equal(view.bottomReserve, 69); assert.equal(view.navigationResolved, true);
  assert.equal(f.reads.length, 0); assert.equal(f.navCalls(), 0); assert.equal(f.native.size, 0); assert.equal(f.foreground.size, 0); assert.equal(f.keyboard.size, 0);
  f.safe({ top: 99, left: 98, right: 97, bottom: 96 }); f.dimensions({ width: 999, height: 888, scale: 3 }); const changed = f.render(); await tick(); assert.equal(changed.safeInsets, safeInsets); assert.equal(changed.metrics, metrics); assert.equal(f.reads.length, 0);
});
test('explicit unknown original-window scope never falls back to previously measured Activity facts', async t => {
  const f = fixture(t); f.render(); await tick(); assert.equal(f.render().metricsReady, true); const before = f.reads.length;
  f.scope({ metrics: null, thinGestureBottom: null, safeInsets: null }); const held = f.render(); await tick(); assert.equal(held.sourceWindow, true); assert.equal(held.metricsReady, false); assert.equal(held.metrics, null); assert.equal(held.bottomReserve, null); assert.equal(held.safeInsets, null); assert.equal(held.navigationResolved, false);
  assert.equal(f.reads.length, before); assert.equal(f.native.size, 0); assert.equal(f.foreground.size, 0); assert.equal([...f.keyboard.values()].reduce((sum, values) => sum + values.size, 0), 0);
});
test('leaving an original-window scope creates a fresh legacy measurement lifetime rather than reviving a disposed controller', async t => {
  const f = fixture(t), wait = deferred(); f.setReader(() => wait.promise); f.render();
  f.scope({ metrics: null, thinGestureBottom: null, safeInsets: null }); assert.equal(f.render().metricsReady, false);
  wait.resolve({ platform: 'android', width: 700, height: 500, viewPaddingBottom: 99, systemGestureInsetsBottom: 99, viewInsetsBottom: 0 }); await tick(); assert.equal(f.render().metrics, null);
  f.setReader(async () => ({ platform: 'android', width: 800, height: 900, viewPaddingBottom: 12, systemGestureInsetsBottom: 13, viewInsetsBottom: 1 })); f.scope(null);
  assert.equal(f.render().metricsReady, false); await tick(); const fresh = f.render(); assert.equal(fresh.sourceWindow, false); assert.equal(fresh.metrics.width, 800); assert.equal(fresh.bottomReserve, 0); assert.equal(f.native.size, 1); assert.equal(f.foreground.size, 1); assert.equal(f.navCalls(), 1);
});
test('actual Admin frame hook waits for genuine measurements, then uses cached nav result and original source60 rather than nativebar80', async t => {
  const f = fixture(t); const initial = f.render(); assert.equal(initial.metricsReady, false); assert.equal(initial.bottomReserve, null);
  await tick(); const measured = f.render(); assert.equal(measured.metricsReady, true); assert.equal(measured.bottomReserve, 75); assert.equal(measured.thinGestureBottom, true); assert.equal(f.navCalls(), 1);
  f.footer(false); assert.equal(f.render().bottomReserve, 0); f.footer(true); f.dockHeight(70); assert.equal(f.render().bottomReserve, 85); assert.equal(f.reads.length, 1); assert.equal(f.navCalls(), 1);
});
test('frame exposes its exact original raw snapshot for root Scaffold layout without another native measurement', async t => {
  const f = fixture(t), raw = Object.freeze({ platform: 'android', width: 400, height: 800, viewPaddingBottom: 24, systemGestureInsetsBottom: 16, viewInsetsBottom: 1 });
  f.metrics(raw); assert.equal(f.render().metrics, null); await tick(); const measured = f.render(), before = f.reads.length;
  assert.equal(measured.metrics, raw); assert.equal(measured.bottomReserve, 0); assert.equal(f.render().metrics, raw); assert.equal(f.reads.length, before);
});
test('native/safe-area/dimension changes refresh actual metrics and cannot infer gesture mode from changing inset values', async t => {
  const f = fixture(t); f.render(); await tick(); const before = f.reads.length;
  f.native.forEach(callback => callback()); await tick(); assert.equal(f.reads.length, before + 1);
  f.safe({ top: 24, right: 0, bottom: 40, left: 0 }); f.render(); await tick(); assert.equal(f.reads.length, before + 2);
  f.dimensions({ width: 800, height: 400, scale: 2 }); f.render(); await tick(); assert.equal(f.reads.length, before + 3); assert.equal(f.navCalls(), 1);
});
test('real keyboard events reread native IME; any measuredpositive zeroes reserve and hidden0 restores it', async t => {
  const f = fixture(t); f.render(); await tick(); f.render(); const native = { platform: 'android', width: 400, height: 500, viewPaddingBottom: 24, systemGestureInsetsBottom: 16, viewInsetsBottom: 300 };
  f.metrics(native); f.keyboard.get('keyboardDidShow').forEach(callback => callback({ endCoordinates: { height: 300 } })); await tick(); assert.equal(f.render().bottomReserve, 0);
  f.metrics({ ...native, height: 800, viewInsetsBottom: 0 }); f.keyboard.get('keyboardDidHide').forEach(callback => callback()); await tick(); assert.equal(f.render().bottomReserve, 75); assert.equal(f.navCalls(), 1);
});
test('iOS floating keyboard nativezero does not zero frame even though keyboard show event exists; shortestSide600 uses iPadreal safearea', async t => {
  const f = fixture(t, 'ios'), native = { platform: 'ios', width: 1024, height: 1366, viewPaddingBottom: 20, systemGestureInsetsBottom: 0, viewInsetsBottom: 0 };
  f.metrics(native); f.render(); await tick(); assert.equal(f.render().bottomReserve, 80); assert.equal(f.navCalls(), 0);
  f.keyboard.get('keyboardWillShow').forEach(callback => callback({ endCoordinates: { height: 250 } })); await tick(); assert.equal(f.render().bottomReserve, 80, 'show visibility is not a synthetic docked IME measurement');
  f.metrics({ ...native, viewInsetsBottom: 350 }); f.keyboard.get('keyboardDidChangeFrame').forEach(callback => callback()); await tick(); assert.equal(f.render().bottomReserve, 0);
  f.metrics({ ...native, width: 500 }); f.dimensions({ width: 500, height: 1366, scale: 2 }); f.render(); await tick(); assert.equal(f.render().bottomReserve, 75);
});
test('foreground refreshes metrics without rereading cached nav; background does not issue measurements', async t => {
  const f = fixture(t); f.render(); await tick(); const before = f.reads.length; f.foreground.forEach(callback => callback('background')); assert.equal(f.reads.length, before);
  f.foreground.forEach(callback => callback('active')); await tick(); assert.equal(f.reads.length, before + 1); assert.equal(f.navCalls(), 1);
});
test('StrictMode cleanup/reattach fences old native/keyboard/app callbacks and removes every original listener', async t => {
  const f = fixture(t); f.render(); await tick(); const oldNative = [...f.native], oldKeys = [...f.keyboard.values()].flatMap(values => [...values]), oldForeground = [...f.foreground];
  f.cleanup(); assert.equal(f.native.size, 0); assert.equal([...f.keyboard.values()].reduce((total, values) => total + values.size, 0), 0); assert.equal(f.foreground.size, 0);
  f.render(); await tick(); const before = f.reads.length; oldNative.forEach(callback => callback()); oldKeys.forEach(callback => callback()); oldForeground.forEach(callback => callback('active')); await tick();
  assert.equal(f.reads.length, before); assert.equal(f.render().bottomReserve, 75); assert.equal(f.navCalls(), 1);
});
test('retained old async geometry response cannot install after hook replay or supersede new viewport/IME reading', async t => {
  const f = fixture(t), wait = deferred(); f.setReader(() => wait.promise); f.render(); f.cleanup(); f.setReader(async () => ({ platform: 'android', width: 800, height: 400, viewPaddingBottom: 32, systemGestureInsetsBottom: 40, viewInsetsBottom: 300 }));
  f.render(); await tick(); assert.equal(f.render().bottomReserve, 0); wait.resolve({ platform: 'android', width: 400, height: 800, viewPaddingBottom: 24, systemGestureInsetsBottom: 16, viewInsetsBottom: 0 }); await tick(); assert.equal(f.render().bottomReserve, 0);
});
