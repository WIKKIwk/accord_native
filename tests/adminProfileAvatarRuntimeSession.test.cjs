const assert = require('node:assert/strict');
const test = require('node:test');
const { load, strings, checked, deferred, tick } = require('./adminUsersSupport.cjs');
const strict = load('shared/camera/synchronousGuard'), profileGuard = load('shared/profileSessionGuard');
const model = load('admin/adminProfileAvatarModel', { './dartJsonString': strings }), cache = load('admin/adminProfileAvatarCache');
const controllers = load('admin/adminProfileAvatarController', { '../shared/camera/synchronousGuard': strict, './adminProfileAvatarModel': model, './dartJsonString': strings });
function runtimeFixture() {
  let reset; const reads = [];
  const runtime = load('admin/adminProfileAvatarRuntime', { '../auth': { registerSessionResetHook: fn => { reset = fn; } }, './adminProfileAvatarCache': cache, './adminProductionRequest': checked,
    './adminProfileAvatarApi': { readAdminProfileAvatar: (url, guard, signal) => { guard(); const wait = deferred(); reads.push({ url, guard, signal, ...wait }); return wait.promise; } } });
  return { runtime, reads, reset: () => reset() };
}
test('Admin completed runtime shares only current completed scoped bytes and never joins two owners private in-flight reads', async () => {
  const f = runtimeFixture(), abortA = new AbortController(), abortB = new AbortController(); let valid = true;
  const guardA = () => { if (!valid) throw Error('owner A retired'); }, guardB = () => {};
  const a = f.runtime.loadAdminProfileAvatar('scope', 'https://images.example/a', guardA, abortA.signal), b = f.runtime.loadAdminProfileAvatar('scope', 'https://images.example/a', guardB, abortB.signal);
  assert.equal(f.reads.length, 2); const rejected = assert.rejects(a, /owner A retired/); valid = false;
  f.reads[0].resolve({ bytes: new Uint8Array([1]), mime: 'image/png' }); f.reads[1].resolve({ bytes: new Uint8Array([2]), mime: 'image/png' }); await rejected; const uri = await b;
  assert.equal(uri, 'data:image/png;base64,Ag=='); assert.equal(f.runtime.cachedAdminProfileAvatar('other', 'https://images.example/a', guardB), null);
  assert.equal(await f.runtime.loadAdminProfileAvatar('scope', 'https://images.example/a', guardB, abortB.signal), uri); assert.equal(f.reads.length, 2);
  f.runtime.forgetAdminProfileAvatar('scope', 'https://images.example/a', 'older uri', guardB); assert.equal(f.runtime.cachedAdminProfileAvatar('scope', 'https://images.example/a', guardB), uri);
});
test('session reset clears completed public cache and prevents older scoped download from repopulating it', async () => {
  const f = runtimeFixture(), guard = () => {}, signal = new AbortController().signal;
  const first = f.runtime.loadAdminProfileAvatar('scope', 'https://images.example/a', guard, signal); f.reads[0].resolve({ bytes: new Uint8Array([1]), mime: 'image/png' }); assert.ok(await first);
  const late = f.runtime.loadAdminProfileAvatar('scope', 'https://images.example/b', guard, signal); await f.reset(); f.reads[1].resolve({ bytes: new Uint8Array([2]), mime: 'image/png' });
  assert.equal(await late, null); assert.equal(f.runtime.cachedAdminProfileAvatar('scope', 'https://images.example/a', guard), null); assert.equal(f.runtime.cachedAdminProfileAvatar('scope', 'https://images.example/b', guard), null);
});
test('runtime before/after cache and write acknowledgement guards reject asynchronous or retired owners', async () => {
  const f = runtimeFixture(), bad = async () => {};
  assert.throws(() => f.runtime.cachedAdminProfileAvatar('scope', 'url', bad), /Invalid admin guard/);
  assert.throws(() => f.runtime.forgetAdminProfileAvatar('scope', 'url', 'uri', bad), /Invalid admin guard/);
  await assert.rejects(f.runtime.loadAdminProfileAvatar('scope', 'url', bad, new AbortController().signal), /Invalid admin guard/); assert.equal(f.reads.length, 0);
  const aborted = new AbortController(); aborted.abort(); await assert.rejects(f.runtime.loadAdminProfileAvatar('scope', 'url', () => {}, aborted.signal), /closed/); assert.equal(f.reads.length, 0);
});
function sessionFixture(external = () => true) {
  const session = { token: 'token', baseUrl: 'https://server.example', profile: { role: 'admin', ref: 'one' }, capabilities: ['admin.access'] }, witness = { session, generation: 4 }; let epoch = 1, issued = true, parent = external;
  const f = runtimeFixture(), { adminProfileAvatarSession } = load('admin/adminProfileAvatarSession', { '../auth': { activeSessionEpoch: () => epoch, activeSessionToken: () => session.token || null, isSessionWitnessCurrent: value => value === witness && issued },
    '../sessionReadScope': load('sessionReadScope'), '../shared/camera/synchronousGuard': strict, './adminProfileAvatarController': controllers, './adminProfileAvatarRuntime': f.runtime });
  const owner = adminProfileAvatarSession(session, witness, () => parent());
  return { ...f, owner, session, witness, epoch: value => { epoch = value; }, retire: () => { issued = false; }, external: value => { parent = value; } };
}
for (const kind of ['scope', 'epoch', 'witness', 'token', 'test token']) test(`public avatar owner retains original ${kind} and cannot resume retired account`, () => {
  const f = sessionFixture(); assert.equal(f.owner.current(), true);
  if (kind === 'scope') f.session.baseUrl = 'https://other.example'; if (kind === 'epoch') f.epoch(2); if (kind === 'witness') f.retire(); if (kind === 'token') f.session.token = ''; if (kind === 'test token') f.session.token = 'test-mode-token';
  assert.equal(f.owner.current(), false); f.epoch(1); f.session.baseUrl = 'https://server.example'; f.session.token = 'fresh'; assert.equal(f.owner.current(), false);
});
test('nested genuine parent profile guard remains valid without global recursive-guard false positives; parent focus is not read authority', () => {
  let focused = true, mounted = true;
  const parentCurrent = () => mounted && profileGuard.isProfileSessionCurrent(() => true);
  const f = sessionFixture(parentCurrent); assert.equal(f.owner.current(), true); focused = false; assert.equal(f.owner.current(), true); assert.equal(focused, false);
  mounted = false; assert.equal(f.owner.current(), false);
  const async = sessionFixture(async () => true); assert.equal(async.owner.current(), false); const recursive = sessionFixture(); recursive.external(() => recursive.owner.current()); assert.equal(recursive.owner.current(), false);
});
test('public avatar owner permits token refresh but pending original bytes cannot survive changed epoch or controller detach', async () => {
  const f = sessionFixture(); f.session.token = 'refreshed'; assert.equal(f.owner.current(), true); f.owner.controller.start(); f.owner.controller.setUrl('https://images.example/a'); const read = f.reads[0];
  f.epoch(2); read.resolve({ bytes: new Uint8Array([1]), mime: 'image/png' }); await tick(); assert.equal(f.owner.controller.getSnapshot().phase, 'invalidated'); assert.equal(read.signal.aborted, true);
  const fresh = sessionFixture(); fresh.owner.controller.start(); fresh.owner.controller.setUrl('https://images.example/a'); fresh.owner.controller.dispose(); assert.equal(fresh.reads[0].signal.aborted, true);
  fresh.reads[0].resolve({ bytes: new Uint8Array([1]), mime: 'image/png' }); await tick(); assert.equal(fresh.runtime.cachedAdminProfileAvatar(fresh.owner.namespace, 'https://images.example/a', () => {}), null);
});
