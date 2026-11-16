/* global __dirname */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const test = require('node:test');
const { load, deferred, tick } = require('./adminUsersSupport.cjs');
const policy = load('admin/adminShellLayoutPolicy');
const metrics = fields => ({ platform: 'android', width: 400, height: 800, viewPaddingBottom: 24, systemGestureInsetsBottom: 16, viewInsetsBottom: 0, ...fields });
function bridgeFixture() {
  let native = null; const filename = path.resolve(__dirname, '../modules/accord-admin-layout/src/AccordAdminLayoutModule.ts'), compiled = new Module(filename, module);
  compiled.filename = filename; compiled.paths = module.paths; compiled.require = name => name === 'expo' ? { NativeModule: class {}, requireOptionalNativeModule: () => native } : require(name);
  compiled._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return { api: compiled.exports, native: value => { native = value; } };
}
function runtimeFixture() {
  const f = bridgeFixture(); return load('admin/adminShellLayoutRuntime', { 'react-native': { Platform: { OS: 'android' } }, '../../modules/accord-admin-layout/src/AccordAdminLayoutModule': f.api });
}
test('frame geometry retains source horizontal6/radius18 and directional content4/6 separately from screen list padding', () => {
  assert.deepEqual(policy.adminShellDefaultContentPadding, { start: 4, top: 0, end: 6, bottom: 0 });
  assert.deepEqual(policy.adminShellFrameLayout(metrics(), true, false), { horizontalInset: 6, topRadius: 18, bottomRadius: 18, bottomReserve: 84, dockBottomInset: 24 });
  assert.equal(policy.adminShellFrameLayout(metrics(), false, false).bottomRadius, 0); assert.equal(policy.adminShellBottomReserve(null, false, false), 0);
});
test('only source cached gesture flag uses15; otherwise max is used rather than adding or preferring viewPadding', () => {
  for (const [padding, gesture, expected] of [[24, 16, 24], [16, 48, 48], [0, 0, 0], [0, 30, 30]]) {
    const value = metrics({ viewPaddingBottom: padding, systemGestureInsetsBottom: gesture }); assert.equal(policy.adminDockLayoutBottomInset(value, false), expected);
    assert.equal(policy.adminDockLayoutBottomInset(value, true), 15); assert.equal(policy.adminShellBottomReserve(value, true, false), 60 + expected);
  }
  assert.equal(policy.adminShellBottomReserve(metrics(), true, true), 75); assert.equal(policy.adminShellBottomReserve(metrics(), true, true, 70), 85);
});
test('source iOS rule uses actual viewport shortestSide strictly below600, including compact iPad window, not physical device idiom', () => {
  for (const [width, height, expected] of [[390, 844, 15], [844, 390, 15], [599.99, 1000, 15], [600, 1000, 34], [1024, 1366, 34], [500, 900, 15]]) {
    const value = metrics({ platform: 'ios', width, height, viewPaddingBottom: 34, systemGestureInsetsBottom: 0 }); assert.equal(policy.adminDockLayoutBottomInset(value, false), expected);
  }
});
test('footer absence and any positive IME inset reserve0; floating/hidden native zero preserves60plus dock inset', () => {
  for (const platform of ['android', 'ios']) for (const viewInsetsBottom of [.001, 34, 300]) {
    const value = metrics({ platform, viewInsetsBottom }); assert.equal(policy.adminShellBottomReserve(value, true, true), 0); assert.equal(policy.adminShellBottomReserve(value, false, false), 0);
  }
  assert.equal(policy.adminShellBottomReserve(metrics({ platform: 'ios', width: 1024, viewPaddingBottom: 20, systemGestureInsetsBottom: 0, viewInsetsBottom: 0 }), true, false), 80);
});
test('unavailable real inset reader remains explicit null even when navigation resolved; no synthetic ready frame', () => {
  assert.equal(policy.adminShellBottomReserve(null, true, false), null); assert.equal(policy.adminShellBottomReserve(null, true, true), null);
  assert.deepEqual(policy.adminShellFrameLayout(null, true, false), { horizontalInset: 6, topRadius: 18, bottomRadius: 18, bottomReserve: null, dockBottomInset: null });
});
test('optional native navigation preserves Source true-only and missing/platform/errorfalse without any resource or inset inference', async () => {
  const f = bridgeFixture(); assert.equal(await f.api.readAdminGestureNavigation('android'), false); let calls = 0;
  for (const raw of [true, false, 2, 1, 'true', null]) { f.native({ isGestureNavigation: async () => { calls++; return raw; } }); assert.equal(await f.api.readAdminGestureNavigation('android'), raw === true); }
  const before = calls; assert.equal(await f.api.readAdminGestureNavigation('ios'), false); assert.equal(calls, before);
  f.native({ isGestureNavigation: async () => { throw Error('PlatformException'); } }); assert.equal(await f.api.readAdminGestureNavigation('android'), false);
});
test('native inset bridge validates finite dp fields, attaches actual platform, and never replaces absent native measurements with zero', async () => {
  const f = bridgeFixture(); assert.equal(await f.api.readAdminSystemInsets(), null); f.native({}); assert.equal(await f.api.readAdminSystemInsets(), null);
  f.native({ readInsets: async () => metrics() }); const value = await f.api.readAdminSystemInsets(); assert.deepEqual(value, metrics()); assert.equal(Object.isFrozen(value), true);
  for (const bad of [undefined, {}, { ...metrics(), width: 0 }, { ...metrics(), viewPaddingBottom: -1 }, { ...metrics(), systemGestureInsetsBottom: '24' }, { ...metrics(), height: Infinity }, { ...metrics(), platform: 'web' }]) assert.throws(() => f.api.adminSystemInsetsFromNative(bad), /Invalid Admin layout/);
});
test('native listener cleanup removes only its subscription and unavailable module remains optional', () => {
  const f = bridgeFixture(); f.api.subscribeAdminSystemInsets(() => assert.fail())(); const listeners = new Set();
  f.native({ addListener: (name, listener) => { assert.equal(name, 'onInsetsChange'); listeners.add(listener); return { remove: () => listeners.delete(listener) }; } });
  let notifications = 0; const a = f.api.subscribeAdminSystemInsets(() => notifications++), b = f.api.subscribeAdminSystemInsets(() => notifications++); listeners.forEach(listener => listener({ metrics: metrics() })); assert.equal(notifications, 2);
  a(); assert.equal(listeners.size, 1); b(); assert.equal(listeners.size, 0);
});
test('navigation is queried once across concurrent screen/account lifetimes and keeps original result when OS setting later changes', async () => {
  const { createAdminNavigationModeReader } = runtimeFixture(), wait = deferred(); let calls = 0, raw = true;
  const read = createAdminNavigationModeReader('android', async () => { calls++; await wait.promise; return raw; }); const first = read(), second = read(); assert.equal(first, second);
  wait.resolve(); assert.equal(await first, true); raw = false; assert.equal(await read(), true); assert.equal(calls, 1);
  const unavailable = createAdminNavigationModeReader('android', async () => { calls++; throw Error('PlatformException'); }); assert.equal(await unavailable(), false); assert.equal(await unavailable(), false); assert.equal(calls, 2);
  const ios = createAdminNavigationModeReader('ios', async () => { assert.fail('no Android query on iOS'); }); assert.equal(await ios(), false);
});
test('layout controller accepts newest real geometry only and earlier native response cannot overwrite keyboard/new viewport snapshot', async () => {
  const { AdminShellLayoutController } = runtimeFixture(), first = deferred(), second = deferred(); let calls = 0;
  const controller = new AdminShellLayoutController(() => ++calls === 1 ? first.promise : second.promise, async () => true); controller.start();
  const a = controller.refresh(), b = controller.refresh(); second.resolve(metrics({ width: 800, height: 400, viewInsetsBottom: 300 })); await b;
  first.resolve(metrics()); await a; assert.equal(controller.getSnapshot().metrics.viewInsetsBottom, 300); assert.equal(controller.getSnapshot().metrics.width, 800); await tick(); assert.equal(controller.getSnapshot().thinGestureBottom, true);
});
test('dispose/restart fences older callbacks, geometry and pending nav resolution but reuses source cached navigation query', async () => {
  const { AdminShellLayoutController, createAdminNavigationModeReader } = runtimeFixture(), pending = deferred(), nav = deferred(); let reads = 0, navCalls = 0;
  const controller = new AdminShellLayoutController(async () => { reads++; return pending.promise; }, createAdminNavigationModeReader('android', async () => { navCalls++; return nav.promise; }));
  controller.start(); const oldRefresh = controller.refresher(), read = controller.refresh(); controller.dispose(); controller.start(); oldRefresh(); assert.equal(reads, 1);
  pending.resolve(metrics()); await read; assert.equal(controller.getSnapshot().metrics, null); nav.resolve(true); await tick(); assert.equal(navCalls, 1); assert.equal(controller.getSnapshot().thinGestureBottom, true); assert.equal(controller.getSnapshot().navigationResolved, true);
});
test('failed native reads expose unavailable metrics, and nav failure resolvesfalse without retiring future layout updates', async () => {
  const { AdminShellLayoutController } = runtimeFixture(); let fail = true;
  const controller = new AdminShellLayoutController(async () => { if (fail) throw Error('no window'); return metrics(); }, async () => { throw Error('no module'); }); controller.start(); await controller.refresh(); await tick();
  assert.equal(controller.getSnapshot().metrics, null); assert.equal(controller.getSnapshot().thinGestureBottom, false); assert.equal(controller.getSnapshot().navigationResolved, true);
  fail = false; await controller.refresh(); assert.deepEqual(controller.getSnapshot().metrics, metrics());
});
