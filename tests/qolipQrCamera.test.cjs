const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const tick = () => new Promise(resolve => setImmediate(resolve));
function load(relative, mocks = {}) {
  const filename = path.resolve(__dirname, '../src', relative), mod = new Module(filename, module);
  mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return mod.exports;
}
function fixture({ granted = true, canAskAgain = true, read, pause } = {}) {
  const slots = [], effects = [], timers = new Map(); let cursor = 0, clock = 0, active = true, valid = true;
  let permission = { granted, canAskAgain }, reads = 0, prompts = 0, pauses = 0;
  const same = (a, b) => a && b && a.length === b.length && a.every((x, i) => x === b[i]);
  const react = {
    useRef: value => { const i = cursor++; return slots[i] ?? (slots[i] = { current: value }); },
    useState: value => { const i = cursor++; if (!(i in slots)) slots[i] = typeof value === 'function' ? value() : value;
      return [slots[i], next => { slots[i] = typeof next === 'function' ? next(slots[i]) : next; }]; },
    useCallback: (fn, deps) => { const i = cursor++; if (!same(slots[i]?.deps, deps)) slots[i] = { fn, deps }; return slots[i].fn; },
    useLayoutEffect: (setup, deps) => { const i = cursor++, previous = slots[i]; if (!same(previous?.deps, deps)) effects.push(() => {
      previous?.cleanup?.(); slots[i] = { deps, cleanup: setup() }; }); },
  };
  const get = async () => { reads++; if (read) permission = await read(); return permission; };
  const request = async () => { prompts++; permission = { granted: true, canAskAgain: true }; return permission; };
  const canUseCamera = () => permission.granted;
  const filename = path.resolve(__dirname, '../src/qolip/useQolipQrCamera.ts'), mod = new Module(filename, module);
  const mocks = { react,
    '../shared/camera/useCameraSurfacePermission': { useCameraSurfacePermission: () => ({ permission, checking: false, error: null,
      refreshPermission: get, requestPermission: request, canUseCamera }) },
    '../shared/camera/synchronousGuard': load('shared/camera/synchronousGuard.ts'),
  };
  mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
    .replaceAll('setTimeout(', 'cameraSetTimeout(').replaceAll('clearTimeout(', 'cameraClearTimeout('), filename);
  // The module resolves these lexical-free timer names only when retry begins.
  global.cameraSetTimeout = (callback, delay) => { const id = ++clock; timers.set(id, { callback, delay }); return id; };
  global.cameraClearTimeout = id => timers.delete(id);
  const current = () => valid;
  const render = () => { cursor = 0; const value = mod.exports.useQolipQrCamera(active, current); while (effects.length) effects.shift()();
    value.cameraRef.current = { pausePreview: async () => { pauses++; await pause?.(); } }; return value; };
  return { render, timers, reads: () => reads, prompts: () => prompts, pauses: () => pauses,
    setActive: value => { active = value; }, expire: () => { valid = false; },
    finishStart: camera => camera.onReady(camera.generation),
    unmount: async () => { for (const slot of slots) slot?.cleanup?.();
      for (const timer of [...timers.values()]) timer.callback();
      await tick(); delete global.cameraSetTimeout; delete global.cameraClearTimeout; } };
}

test('native restart waits for a current camera-ready event and stops before releasing the scanner', async t => {
  const h = fixture(); t.after(h.unmount); let camera = h.render(); const start = camera.restart(); await tick();
  camera = h.render(); assert.equal(camera.requested, true); assert.equal(camera.ready, false);
  assert.deepEqual([...h.timers.values()].map(timer => timer.delay), [8000]);
  h.finishStart(camera); assert.equal(await start, true); camera = h.render(); assert.equal(camera.ready, true);
  camera.toggleTorch(); assert.equal(h.render().torch, true); await camera.stop();
  camera = h.render(); assert.equal(camera.requested, false); assert.equal(camera.torch, false); assert.equal(h.pauses(), 1);
  assert.equal(h.timers.size, 0);
});
test('a denied but requestable camera prompts once as part of the real retry', async t => {
  const h = fixture({ granted: false }); t.after(h.unmount); const start = h.render().restart(); await tick();
  const camera = h.render(); assert.equal(h.reads(), 1); assert.equal(h.prompts(), 1); h.finishStart(camera);
  assert.equal(await start, true);
});
test('permanently denied permission resolves to the source error panel without a second OS prompt', async t => {
  const h = fixture({ granted: false, canAskAgain: false }); t.after(h.unmount);
  assert.equal(await h.render().restart(), false); assert.equal(h.prompts(), 0);
  assert.equal(h.render().failure, true); assert.equal(h.render().requested, false); assert.equal(h.timers.size, 0);
});
test('eight-second native start timeout clears the camera and offers a real retry', async t => {
  const h = fixture(); t.after(h.unmount); const start = h.render().restart(); await tick();
  for (const timer of [...h.timers.values()]) timer.callback(); assert.equal(await start, false);
  const camera = h.render(); assert.equal(camera.failure, true); assert.equal(camera.requested, false);
  const retry = camera.restart(); await tick(); h.finishStart(h.render()); assert.equal(await retry, true);
});
test('backgrounding retires the pending native generation and rejects its late ready event', async t => {
  const h = fixture(); t.after(h.unmount); const start = h.render().restart(); await tick(); const old = h.render();
  h.setActive(false); h.render(); assert.equal(await start, false); old.onReady(old.generation);
  await tick(); assert.equal(h.render().ready, false); assert.equal(h.render().requested, false); assert.equal(h.timers.size, 0);
});
test('a session change during a pending permission read cannot request access or mount the camera', async t => {
  let resolve; const pending = new Promise(done => { resolve = done; });
  const h = fixture({ granted: false, read: () => pending }); t.after(h.unmount);
  const start = h.render().restart(); h.expire(); resolve({ granted: false, canAskAgain: true });
  assert.equal(await start, false); assert.equal(h.prompts(), 0); assert.equal(h.render().requested, false);
});
test('permission waiting is included in the source eight-second start deadline', async t => {
  let resolve; const pending = new Promise(done => { resolve = done; });
  const h = fixture({ granted: false, read: () => pending }); t.after(h.unmount);
  const start = h.render().restart();
  const timer = [...h.timers.values()].find(value => value.delay === 8000); assert.ok(timer); timer.callback();
  assert.equal(await start, false); resolve({ granted: true, canAskAgain: true }); await tick();
  assert.equal(h.render().requested, false); assert.equal(h.render().failure, true);
});
test('a hung native pause has the source four-second release bound', async t => {
  const h = fixture({ pause: () => new Promise(() => {}) }); t.after(h.unmount);
  const stopped = h.render().stop(); const release = [...h.timers.values()].find(value => value.delay === 4000);
  assert.ok(release); release.callback(); await stopped; assert.equal(h.render().requested, false); assert.equal(h.timers.size, 0);
});
