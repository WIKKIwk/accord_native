const assert = require('node:assert/strict');
const test = require('node:test');
const { load, strings, checked, tick, deferred } = require('./adminUsersSupport.cjs');
const strict = load('shared/camera/synchronousGuard');
const model = load('admin/adminProfileAvatarModel', { './dartJsonString': strings });
const { AdminProfileAvatarCache } = load('admin/adminProfileAvatarCache');
const { AdminProfileAvatarController } = load('admin/adminProfileAvatarController', { '../shared/camera/synchronousGuard': strict, './adminProfileAvatarModel': model, './dartJsonString': strings });
function apiFixture() {
  let valid = true, fetch = async () => new Response(new Uint8Array([1, 2, 3]), { headers: { 'content-type': 'image/png; x=y' } }); const calls = [];
  const guard = () => { if (!valid) throw Error('expired'); }, { readAdminProfileAvatar } = load('admin/adminProfileAvatarApi', { 'expo/fetch': { fetch: async (url, init) => { calls.push([url, init]); return fetch(url, init); } }, './adminProductionRequest': checked, './adminProfileAvatarModel': model, './dartJsonString': strings });
  const abort = new AbortController(); return { read: url => readAdminProfileAvatar(url, guard, abort.signal), rawRead: readAdminProfileAvatar, guard, abort, calls, fetch: value => { fetch = value; }, retire: () => { valid = false; } };
}
test('Admin source URL/title/initial/avatar padding and preview geometry retain exact source defaults', () => {
  assert.equal(model.adminProfileAvatarCanLoad(' \u0085 HTTPS://images.example/a '), true); for (const url of ['//host/a', 'file:///a', 'data:image/png;base64,a', '/a', '']) assert.equal(model.adminProfileAvatarCanLoad(url), false);
  assert.equal(model.adminProfileAvatarTitle(' \u0085 ', 'AB'), 'AB'); assert.equal(model.adminProfileAvatarTitle(' Name ', 'AB'), 'Name');
  assert.equal(model.adminProfileAvatarPreviewInitial('ß'), 'SS'); assert.equal(model.adminProfileAvatarPreviewInitial('😀').charCodeAt(0), 0xd83d); assert.equal(model.adminProfileAvatarPreviewInitial(''), 'U');
  assert.deepEqual(model.adminProfileAvatarGeometry(400, 800), { width: 368, height: 460 }); assert.deepEqual(model.adminProfileAvatarGeometry(1200, 1000), { width: 420, height: 525 });
  assert.equal(model.adminProfileAvatarPadding(92), 5); assert.equal(model.adminProfileAvatarPadding(60), 5); assert.equal(model.adminProfileAvatarPadding(59), 2);
});
test('public Admin avatar uses Expo manual GET with omitted credentials, no bearer/app headers, and body-confirmed bytes', async () => {
  const f = apiFixture(), result = await f.read(' \u0085 https://images.example/a.png '); assert.deepEqual([...result.bytes], [1, 2, 3]); assert.equal(result.mime, 'image/png');
  assert.equal(f.calls.length, 1); const [url, init] = f.calls[0]; assert.equal(url, 'https://images.example/a.png'); assert.deepEqual(init, { method: 'GET', headers: {}, credentials: 'omit', redirect: 'manual', signal: f.abort.signal });
});
for (const status of [301, 302, 303, 307, 308]) test(`public avatar follows guarded ${status} redirects across CDN hosts without credentials`, async () => {
  const f = apiFixture(); f.fetch(async url => url.includes('images.example') ? new Response(null, { status, headers: { location: 'https://cdn.example/photo' } }) : new Response(new Uint8Array([4])));
  assert.equal((await f.read('https://images.example/a')).bytes[0], 4); assert.equal(f.calls.length, 2); assert.equal(f.calls[1][0], 'https://cdn.example/photo'); for (const call of f.calls) assert.equal(call[1].credentials, 'omit');
});
test('source five-redirect budget, loops, invalid/missing redirect locations and non200/empty bodies settle fallback', async () => {
  const f = apiFixture(); let count = 0; f.fetch(async () => new Response(null, { status: 302, headers: { location: `/${++count}` } })); assert.equal(await f.read('https://images.example/0'), null); assert.equal(f.calls.length, 6);
  for (const location of ['https://images.example/a', 'file:///private', 'https://user:password@host/a', '']) {
    const g = apiFixture(); g.fetch(async () => new Response(null, { status: 302, headers: { location } })); assert.equal(await g.read('https://images.example/a'), null); assert.equal(g.calls.length, 1);
  }
  for (const response of [new Response(null, { status: 404 }), new Response(new Uint8Array())]) { const g = apiFixture(); g.fetch(async () => response); assert.equal(await g.read('https://images.example/a'), null); }
});
test('malformed/nonHTTP/credentialed initial URLs never dispatch; any nonimage header still lets native codec inspect JPEG fallback bytes', async () => {
  for (const url of ['file:///a', 'data:a', '/relative', 'https://', 'https://user:password@images.example/a']) { const f = apiFixture(); assert.equal(await f.read(url), null); assert.equal(f.calls.length, 0); }
  const f = apiFixture(); f.fetch(async () => new Response(new Uint8Array([1]), { headers: { 'content-type': 'text/plain' } })); assert.equal((await f.read('http://images.example/a')).mime, 'image/jpeg');
});
for (const stage of ['initial', 'response', 'redirect', 'body', 'body rejection']) test(`original avatar guard expires at ${stage}, preventing request/continuation/bytes acknowledgement`, async () => {
  const f = apiFixture();
  if (stage === 'initial') f.retire();
  if (stage === 'response') f.fetch(async () => { f.retire(); return new Response(new Uint8Array([1])); });
  if (stage === 'redirect') f.fetch(async () => { f.retire(); return new Response(null, { status: 302, headers: { location: 'https://other.example/a' } }); });
  if (stage.startsWith('body')) f.fetch(async () => ({ status: 200, redirected: false, headers: new Headers(), arrayBuffer: async () => { f.retire(); if (stage === 'body rejection') throw Error('body'); return new Uint8Array([1]).buffer; } }));
  await assert.rejects(f.read('https://images.example/a'), /expired/); assert.equal(f.calls.length, stage === 'initial' ? 0 : 1);
});
test('public avatar rejects async/reentrant guards and pre-aborted request without any network send', async () => {
  const f = apiFixture(); await assert.rejects(f.rawRead('https://images.example/a', async () => {}, f.abort.signal), /Invalid admin guard/); assert.equal(f.calls.length, 0);
  let wrapped; const recursive = () => { try { wrapped(); } catch {} }; wrapped = checked.checkedAdminGuard(recursive);
  await assert.rejects(f.rawRead('https://images.example/a', wrapped, f.abort.signal), /Invalid admin guard/); f.abort.abort(); await assert.rejects(f.read('https://images.example/a'), /closed/); assert.equal(f.calls.length, 0);
});
test('completed cache isolates original namespace+raw URL, encodes all base64 paddings, and bounded LRU does not retain oversized image', () => {
  const cache = new AdminProfileAvatarCache(2, 150), revision = cache.revision;
  const a = cache.remember('A', 'a', new Uint8Array([1]), 'image/png', revision); assert.equal(a, 'data:image/png;base64,AQ==');
  assert.equal(cache.remember('A', 'b', new Uint8Array([1, 2]), 'not/image format', revision), 'data:image/jpeg;base64,AQI='); assert.equal(cache.get('B', 'a'), null); assert.equal(cache.get('A', 'a'), a);
  cache.remember('A', 'c', new Uint8Array([1, 2, 3]), 'image/png', revision); assert.equal(cache.get('A', 'b'), null); assert.ok(cache.get('A', 'a'));
  const oversized = cache.remember('A', 'large', new Uint8Array(200), 'image/png', revision); assert.ok(oversized); assert.equal(cache.get('A', 'large'), null);
  cache.forget('A', 'a', 'older callback'); assert.equal(cache.get('A', 'a'), a); cache.clear(); assert.equal(cache.get('A', 'a'), null); assert.equal(cache.remember('A', 'a', new Uint8Array([1]), 'image/png', revision), null);
});
function controllerFixture() {
  let valid = true; const jobs = [], forgotten = [], cached = new Map();
  const deps = { isCurrent: () => valid, cached: (url, guard) => { guard(); return cached.get(url) ?? null; }, read: (url, guard, signal) => { guard(); const wait = deferred(); jobs.push({ url, guard, signal, ...wait }); return wait.promise; },
    forget: (url, uri, guard) => { guard(); forgotten.push([url, uri]); cached.delete(url); } };
  const controller = new AdminProfileAvatarController(deps); controller.start(); return { controller, deps, jobs, forgotten, cached, retire: () => { valid = false; } };
}
test('source thumbnail and preview share only their mounted owner job; image/title snapshot survives later parent URL/name changes', async () => {
  const f = controllerFixture(); f.controller.setUrl(' https://images.example/a '); f.controller.open('Original title'); assert.equal(f.jobs.length, 1);
  const preview = f.controller.getSnapshot().preview; f.controller.setUrl('https://images.example/b'); assert.equal(f.jobs.length, 2); assert.equal(f.jobs[0].signal.aborted, false);
  f.jobs[0].resolve('uri-a'); f.jobs[1].resolve('uri-b'); await tick(); assert.equal(f.controller.getSnapshot().uri, 'uri-b'); assert.deepEqual(f.controller.getSnapshot().preview, { ...preview, uri: 'uri-a', loading: false });
  f.controller.close(preview.id); f.controller.open('New title'); assert.equal(f.controller.getSnapshot().preview.displayName, 'New title'); assert.equal(f.controller.getSnapshot().preview.uri, 'uri-b');
});
test('preview always opens fallback for absent/nonHTTP URL, with unique original close tickets and no invented retry/button API', () => {
  const f = controllerFixture(); f.controller.setUrl('file:///a'); f.controller.open(''); const first = f.controller.getSnapshot().preview.id;
  assert.equal(f.jobs.length, 0); f.controller.open('Other'); assert.equal(f.controller.getSnapshot().preview.displayName, ''); f.controller.close(first); f.controller.open('New');
  f.controller.close(first); assert.equal(f.controller.getSnapshot().preview.displayName, 'New'); assert.ok(f.controller.getSnapshot().preview.id > first);
});
test('changing thumbnail without a preview aborts original job and stale guards cannot install/cache its result', async () => {
  const f = controllerFixture(); f.controller.setUrl('https://images.example/a'); f.controller.setUrl('https://images.example/b');
  assert.equal(f.jobs[0].signal.aborted, true); assert.throws(f.jobs[0].guard, /image changed/); f.jobs[0].resolve('old'); f.jobs[1].resolve('new'); await tick();
  assert.equal(f.controller.getSnapshot().uri, 'new'); assert.throws(f.jobs[1].guard, /image changed/);
});
test('cached completed result avoids read; decode failure removes only matching slot/cache and preview retry can read again', async () => {
  const f = controllerFixture(); f.cached.set('https://images.example/a', 'cached'); f.controller.setUrl('https://images.example/a'); assert.equal(f.jobs.length, 0);
  f.controller.imageFailed('thumbnail', 'cached'); assert.deepEqual(f.forgotten, [['https://images.example/a', 'cached']]); assert.equal(f.controller.getSnapshot().uri, null);
  f.controller.open('Title'); assert.equal(f.jobs.length, 1); const id = f.controller.getSnapshot().preview.id; f.jobs[0].resolve('new'); await tick();
  f.controller.imageFailed('thumbnail', 'cached'); assert.equal(f.controller.getSnapshot().preview.uri, 'new'); f.controller.imageFailed(id, 'new'); assert.equal(f.controller.getSnapshot().preview.uri, null);
});
for (const stop of ['dispose', 'invalidate']) test(`avatar ${stop} aborts requests, scrubs image/preview, fences old completion and expires original generation`, async () => {
  const f = controllerFixture(); f.controller.setUrl('https://images.example/a'); f.controller.open('Private title'); const generation = f.controller.interactionGeneration;
  f.controller[stop](); assert.equal(f.jobs[0].signal.aborted, true); assert.equal(f.controller.getSnapshot().preview, null); assert.equal(f.controller.getSnapshot().uri, null); assert.notEqual(f.controller.interactionGeneration, generation);
  f.jobs[0].resolve('old'); await tick(); assert.equal(f.controller.getSnapshot().uri, null); f.controller.start();
  if (stop === 'dispose') { f.controller.setUrl('https://images.example/b'); f.jobs[1].resolve('new'); await tick(); assert.equal(f.controller.getSnapshot().uri, 'new'); } else assert.equal(f.controller.isCurrent(), false);
});
test('original session retirement during private job scrubs and does not install bytes or open preview later', async () => {
  const f = controllerFixture(); f.controller.setUrl('https://images.example/a'); f.retire(); f.jobs[0].resolve('old'); await tick(); assert.equal(f.controller.getSnapshot().phase, 'invalidated'); f.controller.open('Later'); assert.equal(f.controller.getSnapshot().preview, null);
});
test('reentrant publication cannot dispatch superseded URL or reopen a closed preview continuation', async () => {
  const f = controllerFixture(); f.controller.subscribe(() => { if (f.controller.getSnapshot().url.endsWith('/a')) f.controller.setUrl('https://images.example/b'); });
  f.controller.setUrl('https://images.example/a'); assert.deepEqual(f.jobs.map(job => job.url), ['https://images.example/b']);
  const g = controllerFixture(); g.controller.setUrl('https://images.example/a'); g.controller.subscribe(() => { const preview = g.controller.getSnapshot().preview; if (preview) g.controller.close(preview.id); }); g.controller.open('Title');
  assert.equal(g.controller.getSnapshot().preview, null); assert.equal(g.jobs.length, 1); f.controller.dispose(); g.controller.dispose(); await tick();
});
