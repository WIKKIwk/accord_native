const assert = require('node:assert/strict');
const test = require('node:test');
const { load, deferred, tick } = require('./adminUsersSupport.cjs');
const policy = load('admin/adminShellLayoutPolicy');
function fixture(t, platform = 'android') {
  let cursor = 0, navCalls = 0, hasFooter = true, bottomDockHeight, dimensions = { width: 400, height: 800, scale: 2 }, safe = { top: 24, right: 0, bottom: 24, left: 0 };
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
    '../../modules/accord-admin-layout/src/AccordAdminLayoutModule': bridge, './adminShellLayoutPolicy': policy, './adminShellLayoutRuntime': runtime });
  const render = () => { cursor = 0; effects.length = 0; const view = hook.useAdminShellLayout(hasFooter, bottomDockHeight); for (const commit of [...effects]) commit(); return view; };
  const cleanup = () => { for (const slot of slots) if (slot?.kind === 'effect') { slot.cleanup?.(); slot.cleanup = null; slot.deps = null; } };
  t.after(cleanup);
  return { render, reads, native, keyboard, foreground, cleanup, navCalls: () => navCalls, metrics: next => { value = next; }, setReader: next => { reader = next; },
    dimensions: next => { dimensions = next; }, safe: next => { safe = next; }, footer: next => { hasFooter = next; }, dockHeight: next => { bottomDockHeight = next; } };
}
test('actual Admin frame hook waits for genuine measurements, then uses cached nav result and original source60 rather than nativebar80', async t => {
  const f = fixture(t); const initial = f.render(); assert.equal(initial.metricsReady, false); assert.equal(initial.bottomReserve, null);
  await tick(); const measured = f.render(); assert.equal(measured.metricsReady, true); assert.equal(measured.bottomReserve, 75); assert.equal(measured.thinGestureBottom, true); assert.equal(f.navCalls(), 1);
  f.footer(false); assert.equal(f.render().bottomReserve, 0); f.footer(true); f.dockHeight(70); assert.equal(f.render().bottomReserve, 85); assert.equal(f.reads.length, 1); assert.equal(f.navCalls(), 1);
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
