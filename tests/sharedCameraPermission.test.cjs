// Permission operation timing uses deferred promises only; no OS prompt is opened.
const assert = require('node:assert/strict'); const fs = require('node:fs'); const Module = require('node:module');
const path = require('node:path'); const test = require('node:test'); const ts = require('typescript');
function load(file, mocks = {}) { const filename = path.resolve(__dirname, `../src/${file}`), m = new Module(filename, module);
  m.filename = filename; m.paths = module.paths; m.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  m._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename); return m.exports; }
const { CameraPermissionController } = load('shared/camera/CameraPermissionController.ts');
const defer = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const flush = () => new Promise(resolve => setImmediate(resolve));
const denied = { granted: false, canAskAgain: true, status: 'denied' }, granted = { granted: true, canAskAgain: true, status: 'granted' };
test('initial read, user request and later refresh run sequentially; only the latest result updates state', async () => {
  const first = defer(), request = defer(), refresh = defer(), calls = [], results = [];
  let count = 0; const c = new CameraPermissionController(() => { calls.push('get'); return (count++ === 0 ? first : refresh).promise; },
    () => { calls.push('request'); return request.promise; }); c.subscribe(() => { if (c.getSnapshot().permission) results.push(c.getSnapshot().permission); }); c.mount(); await flush();
  assert.deepEqual(calls, ['get']); const selected = c.requestPermission(), refreshed = c.refreshPermission();
  first.resolve(denied); await flush(); assert.deepEqual(calls, ['get', 'request']); assert.deepEqual(results, []);
  request.resolve(granted); assert.equal(await selected, granted); await flush(); assert.deepEqual(calls, ['get', 'request', 'get']); assert.deepEqual(results, []);
  refresh.resolve(granted); assert.equal(await refreshed, granted); assert.deepEqual(results, [granted]); c.unmount();
});
test('unmount while initial read is pending prevents a queued permission prompt from starting', async () => {
  const get = defer(), calls = []; const c = new CameraPermissionController(() => { calls.push('get'); return get.promise; },
    async () => { calls.push('request'); return granted; }); c.mount(); await flush();
  const request = c.requestPermission(); c.unmount(); get.resolve(denied);
  await assert.rejects(request, /owner inactive/); await flush(); assert.deepEqual(calls, ['get']); assert.equal(c.getSnapshot().permission, null);
});
test('StrictMode unmount/remount suppresses old response and applies the new read', async () => {
  const first = defer(), next = defer(), calls = []; let i = 0;
  const c = new CameraPermissionController(() => { calls.push('get'); return (i++ ? next : first).promise; }, async () => granted);
  c.mount(); await flush(); c.unmount(); c.mount(); first.resolve(denied); await flush();
  assert.deepEqual(calls, ['get', 'get']); assert.equal(c.getSnapshot().permission, null); next.resolve(granted); await flush();
  assert.equal(c.getSnapshot().permission, granted); c.unmount();
});
test('a failed read is surfaced; the serialized queue continues and a later request can succeed', async () => {
  const calls = [], error = new Error('permission check failed'); const c = new CameraPermissionController(async () => { calls.push('get'); throw error; },
    async () => { calls.push('request'); return granted; }); c.mount(); await flush(); assert.equal(c.getSnapshot().error, error);
  assert.equal(await c.requestPermission(), granted); assert.deepEqual(calls, ['get', 'request']);
  assert.equal(c.getSnapshot().error, null); assert.equal(c.getSnapshot().permission, granted); c.unmount();
});
test('hook mounts read-only and gives role-controlled request and refresh functions', async () => {
  const events = [], effects = [], react = { useMemo: fn => fn(), useSyncExternalStore: (_sub, get) => get(), useEffect: fn => effects.push(fn) };
  const { useCameraSurfacePermission } = load('shared/camera/useCameraSurfacePermission.ts', { react,
    'expo-camera': { Camera: { getCameraPermissionsAsync: async () => { events.push('get'); return denied; },
      requestCameraPermissionsAsync: async () => { events.push('request'); return granted; } } },
    './CameraPermissionController': { CameraPermissionController } });
  const h = useCameraSurfacePermission(); const cleanup = effects.map(effect => effect()); await flush(); assert.deepEqual(events, ['get']);
  assert.equal(await h.requestPermission(), granted); assert.deepEqual(events, ['get', 'request']); cleanup.forEach(fn => fn());
});

test('a later instance waits for an old in-flight OS request and reads the post-request permission', async () => {
  const prompt = defer(), calls = []; let current = denied;
  const old = new CameraPermissionController(async () => { calls.push('old-get'); return current; }, () => { calls.push('old-request'); return prompt.promise; });
  old.mount(); await flush(); const oldRequest = old.requestPermission(); await flush(); old.unmount();
  const next = new CameraPermissionController(async () => { calls.push('new-get'); return current; }, async () => { calls.push('new-request'); return current; });
  next.mount(); await flush(); assert.deepEqual(calls, ['old-get', 'old-request']); assert.equal(next.getSnapshot().permission, null);
  current = granted; prompt.resolve(granted); assert.equal(await oldRequest, granted); await flush();
  assert.deepEqual(calls, ['old-get', 'old-request', 'new-get']); assert.equal(old.getSnapshot().permission, null);
  assert.equal(next.getSnapshot().permission, granted); next.unmount();
});
test('an unmounted later owner never opens a prompt queued behind another owner', async () => {
  const prompt = defer(), calls = []; const old = new CameraPermissionController(async () => denied, () => { calls.push('old-request'); return prompt.promise; });
  old.mount(); await flush(); const inFlight = old.requestPermission(); await flush(); old.unmount();
  const next = new CameraPermissionController(async () => { calls.push('new-get'); return denied; }, async () => { calls.push('new-request'); return granted; });
  next.mount(); const queued = next.requestPermission(); next.unmount(); prompt.resolve(granted); await inFlight;
  await assert.rejects(queued, /owner inactive/); await flush(); assert.deepEqual(calls, ['old-request']);
});
test('refresh failure removes an earlier grant instead of leaving a stale permission', async () => {
  let calls = 0; const failure = new Error('read error'); const c = new CameraPermissionController(async () => {
    if (calls++ === 0) return granted; throw failure; }, async () => granted);
  c.mount(); await flush(); assert.equal(c.getSnapshot().permission, granted);
  await assert.rejects(c.refreshPermission(), /read error/); assert.equal(c.getSnapshot().permission, null); assert.equal(c.getSnapshot().error, failure); c.unmount();
});
test('request before mount fails without opening an OS prompt', async () => {
  let prompts = 0; const c = new CameraPermissionController(async () => denied, async () => { prompts++; return granted; });
  await assert.rejects(c.requestPermission(), /owner inactive/); assert.equal(prompts, 0);
});

test('refresh immediately gates camera until the latest permission read finishes', async () => {
  const refresh = defer(); let count = 0; const c = new CameraPermissionController(() => count++ === 0 ? Promise.resolve(granted) : refresh.promise, async () => granted);
  c.mount(); await flush(); assert.equal(c.canUseCamera(), true); const pending = c.refreshPermission();
  assert.equal(c.getSnapshot().checking, true); assert.equal(c.getSnapshot().permission, null); assert.equal(c.canUseCamera(), false);
  refresh.resolve(granted); await pending; assert.equal(c.getSnapshot().checking, false); assert.equal(c.canUseCamera(), true); c.unmount();
  assert.equal(c.canUseCamera(), false);
});
