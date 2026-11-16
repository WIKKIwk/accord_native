const assert = require('node:assert/strict');
const test = require('node:test');
const s = require('./adminItemDetailImageSupport.cjs');
const internal = '/v1/mobile/calculate/orders/image/view?id=image';

test('real provider identity and scoped thumbnail load share the exact legacy cache namespace and first-frame bytes', async t => {
  const f = s.fixture(t), provider = f.provider(internal); assert.equal(provider.refreshEpoch, 0); assert.equal(provider.thumbnail, true);
  assert.equal(provider.url, 'https://erp.example/v1/mobile/calculate/orders/image/view?id=image&variant=thumb-v1'); assert.equal(provider.peek(), null);
  const bytes = await f.images.cachedOrderImageBytes(f.session, internal, true); assert.deepEqual(await provider.load(), bytes); assert.deepEqual(provider.peek(), bytes); assert.equal(f.calls.length, 1);
  assert.equal(f.digests[0], JSON.stringify([f.images.orderImageCacheScope(f.session), provider.url])); assert.equal(f.calls[0][1].redirect, 'manual');
  const changing = f.provider('/public/photo.png'); assert.equal(changing.refreshEpoch, 2); f.advance(30_000); assert.equal(f.provider('/public/photo.png').refreshEpoch, 3);
});
test('same-account two consumers genuinely coalesce and page1 retirement cannot poison page2 cache/download', async t => {
  const f = s.fixture(t), pending = s.deferred(); let firstMounted = true;
  f.handler(async () => ({ status: 200, arrayBuffer: () => pending.promise, headers: new Headers() }));
  const first = f.provider(internal, () => firstMounted), second = f.provider(internal), one = first.load(), two = second.load();
  const rejected = assert.rejects(one, /consumer changed/); await s.tick(); assert.equal(f.calls.length, 1); firstMounted = false; pending.resolve(new Uint8Array([7, 8]).buffer);
  await rejected; assert.deepEqual(await two, new Uint8Array([7, 8])); assert.deepEqual(second.peek(), new Uint8Array([7, 8])); assert.equal(f.calls.length, 1); assert.equal(f.writes.length, 1);
  assert.throws(first.peek, /consumer changed/); await assert.rejects(first.load(), /consumer changed/); assert.equal(f.calls.length, 1);
});
test('original account/witness retirement invalidates all coalesced consumers, blocks cache population and never revives after reset', async t => {
  const f = s.fixture(t), pending = s.deferred(); f.handler(async () => ({ status: 200, arrayBuffer: () => pending.promise, headers: new Headers() }));
  const first = f.provider(internal), second = f.provider(internal), one = assert.rejects(first.load(), /account changed|account expired/), two = assert.rejects(second.load(), /account changed|account expired/);
  await s.tick(); f.retire(); await f.reset(); pending.resolve(new Uint8Array([9]).buffer); await Promise.all([one, two]); assert.equal(f.calls.length, 1); assert.equal(f.writes.length, 0); assert.equal(first.accountCurrent(), false);
});
test('scoped internal image path uses image=true policy, guarded independent401 recovery and preserves same-account token refresh', async t => {
  const f = s.fixture(t); f.handler(async () => f.calls.length === 1 ? new Response('', { status: 401 }) : new Response(new Uint8Array([4])));
  const provider = f.provider('/private/image.png'); assert.deepEqual(await provider.load(), new Uint8Array([4])); assert.equal(f.joins(), 1); assert.equal(f.refreshes(), 0);
  assert.deepEqual(f.calls.map(([, init]) => new Headers(init.headers).get('authorization')), ['Bearer original', 'Bearer refreshed']);
  assert.equal(f.calls[0][0], 'https://erp.example/private/image.png'); assert.equal(f.calls[0][1].method, 'GET');
  await assert.rejects(provider.load(), /Image session changed/); const current = f.provider('/private/image.png'); assert.notEqual(provider.cacheScope, current.cacheScope);
});
for (const status of [302, 401]) test(`scoped image original account retirement at${status} blocks every further hop/recovery`, async t => {
  const f = s.fixture(t); f.handler(async () => { f.retire(); return new Response('', { status, headers: status === 302 ? { location: '/next' } : {} }); });
  await assert.rejects(f.provider(internal).load(), /account changed|read_witness_expired/); assert.equal(f.calls.length, 1); assert.equal(f.joins(), 0); assert.equal(f.writes.length, 0);
});
for (const status of [302, 401]) test(`combined account guard blocks${status} continuation even when its narrower witness stays true`, async t => {
  const f = s.fixture(t); let live = true;
  const authority = { accountGuard: () => { if (!live) throw Error('account scope expired'); }, accountWitness: () => true, pageGuard: () => {} };
  f.handler(async () => { live = false; return new Response('redirect or auth failure', { status, headers: status === 302 ? { location: '/second' } : {} }); });
  await assert.rejects(f.api.adminItemDetailImageBytes(f.session, '/private/image.png', authority), /account changed|account scope expired|read_witness_expired/);
  assert.deepEqual(f.calls.map(([url]) => url), ['https://erp.example/private/image.png']); assert.equal(f.joins(), 0); assert.equal(f.refreshes(), 0); assert.equal(f.writes.length, 0);
});
test('retirement during independent image refresh prevents retry and preserves original account over recovery error', async t => {
  const f = s.fixture(t); f.onJoin(f.retire); f.handler(async () => new Response('', { status: 401 }));
  await assert.rejects(f.provider(internal).load(), /account changed|read_witness_expired/); assert.equal(f.calls.length, 1); assert.equal(f.joins(), 1);
});
test('external HTTPS image follows guarded manual redirects with conditional-only headers and no credentials/auth', async t => {
  const f = s.fixture(t); f.handler(async () => f.calls.length === 1 ? new Response('redirect', { status: 302, headers: { location: 'https://other.example/final' } }) : new Response(new Uint8Array([6])));
  assert.deepEqual(await f.provider('https://images.example/photo?id=outside&variant=raw').load(), new Uint8Array([6]));
  assert.deepEqual(f.calls.map(([url]) => url), ['https://images.example/photo?id=outside&variant=raw', 'https://other.example/final']);
  for (const [, init] of f.calls) { assert.equal(init.redirect, 'manual'); assert.equal(init.credentials, 'omit'); assert.equal(new Headers(init.headers).get('authorization'), null); assert.equal(new Headers(init.headers).get('cookie'), null); }
});
test('external account retirement during redirect cannot dispatch another request', async t => {
  const f = s.fixture(t); f.handler(async () => { f.retire(); return new Response('redirect', { status: 302, headers: { location: 'https://next.example' } }); });
  await assert.rejects(f.provider('https://images.example/photo').load(), /account changed/); assert.equal(f.calls.length, 1);
});
test('external pending body cannot populate cache after account retirement and redirects cannot downgrade HTTPS', async t => {
  const f = s.fixture(t), pending = s.deferred(); f.handler(async () => ({ status: 200, arrayBuffer: () => pending.promise, headers: new Headers() }));
  const loading = assert.rejects(f.provider('https://images.example/photo').load(), /account changed/); await s.tick(); f.retire(); pending.resolve(new Uint8Array([8]).buffer); await loading; assert.equal(f.writes.length, 0);
});
test('external HTTPS to HTTP redirect is rejected before its second request', async t => {
  const f = s.fixture(t); f.handler(async () => new Response('redirect', { status: 302, headers: { location: 'http://images.example/insecure' } }));
  await assert.rejects(f.provider('https://images.example/photo').load(), /requires HTTPS/); assert.equal(f.calls.length, 1);
});
test('original witness is checked even for an external read whose separate account guard erroneously remains permissive', async t => {
  const f = s.fixture(t); await assert.rejects(f.api.adminItemDetailImageBytes(f.session, 'https://images.example/photo', { accountGuard: () => {}, accountWitness: () => false, pageGuard: () => {} }), /account changed/); assert.equal(f.calls.length, 0);
});
test('cache keeps actual304/ETag/no-store/404 semantics without an Admin-specific byte namespace', async t => {
  const f = s.fixture(t); f.handler(async () => f.calls.length === 1 ? new Response(new Uint8Array([3, 4]), { headers: { etag: 'tag' } }) : new Response(null, { status: 304 }));
  const provider = f.provider('/public/changing.png'); assert.deepEqual(await provider.load(), new Uint8Array([3, 4])); f.advance(30_000); assert.equal(provider.peek(), null);
  assert.deepEqual(await provider.load(), new Uint8Array([3, 4])); assert.equal(new Headers(f.calls[1][1].headers).get('if-none-match'), 'tag');
  await f.reset(); f.handler(async () => new Response(new Uint8Array([5]), { headers: { 'cache-control': 'no-store' } })); await provider.load(); await provider.load(); assert.equal(f.calls.length, 4); assert.equal(provider.peek(), null);
  await f.reset(); f.handler(async () => new Response('missing', { status: 404 })); assert.equal(await f.api.adminItemDetailImageBytes(f.session, internal, f.authority()), null);
  assert.equal(await f.api.adminItemDetailImageBytes(f.session, internal, f.authority()), null); assert.equal(f.calls.length, 5);
});
test('empty internal404 is the exact source route-missing API exception while empty external404 is cached absence', async t => {
  const f = s.fixture(t); f.handler(async () => new Response(null, { status: 404 }));
  await assert.rejects(f.api.adminItemDetailImageBytes(f.session, internal, f.authority()), error => error instanceof s.exception.MobileApiException && error.code === 'production_map_order_image_route_missing' && error.message === 'Rasm xizmati topilmadi — server yangilanmagan');
  assert.equal(await f.api.adminItemDetailImageBytes(f.session, 'https://images.example/photo', f.authority()), null); assert.equal(await f.api.adminItemDetailImageBytes(f.session, 'https://images.example/photo', f.authority()), null); assert.equal(f.calls.length, 2);
});
test('joining an existing legacy flight shares genuine bytes but cannot retrofit its already-owned legacy recovery policy', async t => {
  const f = s.fixture(t), release = s.deferred(); let page = true;
  f.handler(async () => f.calls.length === 1 ? (await release.promise, new Response('', { status: 401 })) : new Response(new Uint8Array([2])));
  const legacy = f.images.cachedOrderImageBytes(f.session, internal, true); await s.tick(); const scoped = f.provider(internal, () => page).load(); const denied = assert.rejects(scoped, /consumer changed/); page = false; release.resolve();
  assert.deepEqual(await legacy, new Uint8Array([2])); await denied; assert.equal(f.refreshes(), 1); assert.equal(f.joins(), 0); assert.equal(f.calls.length, 2);
});
test('provider rejects a token-scope change before first load and malformed page authority without dispatching', async t => {
  const f = s.fixture(t), provider = f.provider(internal); f.session.token = 'later'; await assert.rejects(provider.load(), /Image session changed/); assert.equal(f.calls.length, 0);
  const invalid = f.provider(internal, async () => true); await assert.rejects(invalid.load(), /consumer changed/); assert.equal(f.calls.length, 0);
});
