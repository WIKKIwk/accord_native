const assert = require('node:assert/strict'), test = require('node:test');
const s = require('./adminProgressQrMaterialSupport.cjs');
const path = 'https://erp.example/v1/mobile/admin/raw-material-assignments/lookup?barcode=RAW';
for (const status of [502, 503, 504]) test(`Source transient${status} retries one raw GET after150ms, final status remains canonical Mobile error`, async t => {
  const f = s.fixture(t), clock = s.clock(t); f.handler(async () => new Response('{}', { status })); const reading = assert.rejects(f.read(), error => error instanceof s.exception.MobileApiException && error.statusCode === status && error.code === 'raw_material_assignments');
  await s.flush(); assert.equal(f.calls.length, 1); assert.deepEqual(clock.pending(), [{ delay: 150, remaining: 150 }]); await clock.advance(149); assert.equal(f.calls.length, 1); await clock.advance(1); await reading;
  assert.equal(f.calls.length, 2); assert.deepEqual(f.calls.map(([url]) => url), [path, path]); assert.equal(f.transport.currentQueueSnapshotReadEpoch(), 0);
});
test('raw independent401 wraps the entire transient GET loop and resets a fresh monotonic15s budget for the new token', async t => {
  const f = s.fixture(t), clock = s.clock(t), first = s.deferred(), second = s.deferred(); f.handler(async () => f.calls.length === 1 ? first.promise : f.calls.length === 2 ? second.promise : new Response('{}'));
  f.onJoin(() => { clock.jump(50000); }); const reading = f.read(); await clock.advance(9000); first.resolve(new Response('{}', { status: 401 })); await s.flush();
  assert.equal(f.joins(), 1); assert.equal(f.calls.length, 2); assert.deepEqual(clock.pending(), [{ delay: 10000, remaining: 10000 }]); await clock.advance(9000); second.resolve(new Response('{}', { status: 503 })); await s.flush(); await clock.advance(150); await reading;
  assert.equal(f.calls.length, 3); assert.deepEqual(f.calls.map(([, init]) => new Headers(init.headers).get('authorization')), ['Bearer old', 'Bearer new', 'Bearer new']); assert.equal(f.legacy(), 0); assert.equal(f.transport.currentQueueSnapshotReadEpoch(), 0);
});
test('real10s attempt abort and total15s deadline leave4850ms for the second request, with genuine private timeout facts', async t => {
  const f = s.fixture(t), clock = s.clock(t), pending = s.deferred(); f.handler(async () => pending.promise);
  let failure; const reading = assert.rejects(f.direct(), error => { failure = error; return f.transport.isAuthorizedReadTimeout(error); });
  await clock.advance(10000); assert.equal(f.calls[0][1].signal.aborted, true); assert.deepEqual(clock.pending(), [{ delay: 150, remaining: 150 }]); await clock.advance(150);
  assert.equal(f.calls.length, 2); assert.equal(f.calls[1][1].signal.aborted, false); assert.deepEqual(clock.pending(), [{ delay: 4850, remaining: 4850 }]); await clock.advance(4850); await reading;
  assert.equal(clock.now(), 15000); assert.equal(f.calls[1][1].signal.aborted, true); assert.equal(failure.name, 'TimeoutError'); assert.equal(f.transport.isAuthorizedReadClientFailure(failure), false); assert.equal(f.transport.currentQueueSnapshotReadEpoch(), 0);
  pending.resolve(new Response('{}', { status: 302, headers: { location: '/late' } })); await s.flush(); assert.equal(f.calls.length, 2); assert.equal(f.joins(), 0);
});
test('raw body buffering belongs to attempt timeout and actual abort fences late redirect/recovery work', async t => {
  const f = s.fixture(t), clock = s.clock(t), body = s.deferred(); f.handler(async () => ({ status: 200, headers: new Headers({ 'content-type': 'application/json' }), clone: () => ({ arrayBuffer: () => body.promise }) }));
  const reading = assert.rejects(f.direct(), error => f.transport.isAuthorizedReadTimeout(error)); await clock.advance(10000); assert.equal(f.calls[0][1].signal.aborted, true); await clock.advance(150); await clock.advance(4850); await reading;
  body.resolve(new ArrayBuffer(0)); await s.flush(); assert.equal(f.calls.length, 2); assert.equal(f.joins(), 0); assert.equal(f.transport.currentQueueSnapshotReadEpoch(), 0);
});
test('raw delay deadline uses <=150ms boundary and avoids dispatching a request outside the original total budget', async t => {
  const f = s.fixture(t), clock = s.clock(t); f.handler(async () => { clock.jump(14850); return new Response('{}', { status: 503 }); });
  await assert.rejects(f.direct(), error => f.transport.isAuthorizedReadTimeout(error)); assert.equal(clock.now(), 14850); assert.equal(f.calls.length, 1); assert.deepEqual(clock.pending(), []);
});
for (const message of ['certificate verify failed', 'TLS handshake failed', 'API connections require HTTPS', 'Too many API redirects']) test(`actual client boundary ${message} is not retried`, async t => {
  const f = s.fixture(t), clock = s.clock(t), failure = Error(message); f.handler(async () => { throw failure; }); await assert.rejects(f.direct(), error => error === failure);
  assert.equal(f.calls.length, 1); assert.equal(f.transport.isAuthorizedReadClientFailure(failure), true); assert.equal(f.transport.isAuthorizedReadTimeout(failure), false); assert.equal(clock.pending().length, 0);
});
test('only actual fetch/body rejection is a client fact; guard/model errors and forged names cannot become network errors', async t => {
  const f = s.fixture(t), clock = s.clock(t), network = Error('connection reset'), guardFailure = new TypeError('connection reset'); f.handler(async () => { throw network; });
  const reading = assert.rejects(f.direct(), error => error === network); await s.flush(); assert.equal(f.calls.length, 1); await clock.advance(150); await reading; assert.equal(f.calls.length, 2); assert.equal(f.transport.isAuthorizedReadClientFailure(network), true);
  for (const error of [guardFailure, Error('certificate'), Object.assign(Error('fake'), { name: 'TimeoutError' }), new SyntaxError('JSON')]) { assert.equal(f.transport.isAuthorizedReadClientFailure(error), false); assert.equal(f.transport.isAuthorizedReadTimeout(error), false); }
  const count = f.calls.length; await assert.rejects(f.direct('RAW', () => { throw guardFailure; }, () => true), error => error === guardFailure); assert.equal(f.calls.length, count); assert.equal(f.transport.isAuthorizedReadClientFailure(guardFailure), false);
});
test('actual body stream failure retries inside the same token budget and retains the original error identity as a client fact', async t => {
  const f = s.fixture(t), clock = s.clock(t), failure = Error('connection closed'); f.handler(async () => f.calls.length === 1
    ? { status: 200, headers: new Headers(), clone: () => ({ arrayBuffer: async () => { throw failure; } }) } : new Response('{}'));
  const reading = f.direct(); await s.flush(); assert.equal(f.transport.isAuthorizedReadClientFailure(failure), true); assert.equal(f.calls.length, 1); await clock.advance(150); await reading;
  assert.equal(f.calls.length, 2); assert.equal(f.joins(), 0); assert.deepEqual(f.calls.map(([, init]) => new Headers(init.headers).get('authorization')), ['Bearer old', 'Bearer old']);
});
test('Source nontransient404/429/500/501 return once without a second raw GET', async t => {
  const f = s.fixture(t), clock = s.clock(t);
  for (const status of [404, 429, 500, 501]) { const count = f.calls.length; f.handler(async () => new Response('{}', { status })); assert.equal((await f.direct()).status, status); assert.equal(f.calls.length, count + 1); assert.deepEqual(clock.pending(), []); }
});
for (const html of [{ body: '<!DOCTYPE html><html>portal', headers: { 'content-type': '' } }, { body: 'portal', headers: { 'content-type': 'TEXT/HTML; charset=utf-8' } }]) test('unexpected successful HTML retries once then becomes an actual Source client failure', async t => {
  const f = s.fixture(t), clock = s.clock(t); f.handler(async () => new Response(html.body, { headers: html.headers })); const reading = assert.rejects(f.direct(), error => f.transport.isAuthorizedReadClientFailure(error) && /HTML instead of data/.test(error.message));
  await s.flush(); assert.equal(f.calls.length, 1); await clock.advance(150); await reading; assert.equal(f.calls.length, 2); assert.equal(f.transport.currentQueueSnapshotReadEpoch(), 0);
});
test('scope loss during transient retry delay never dispatches a retry or joins recovery', async t => {
  const f = s.fixture(t), clock = s.clock(t); f.handler(async () => new Response('{}', { status: 503 })); const reading = assert.rejects(f.read('RAW', () => true), /original raw owner expired/); await s.flush(); f.retire(); await clock.advance(150); await reading; assert.equal(f.calls.length, 1); assert.equal(f.joins(), 0);
});
test('original scope loss while raw response body buffers overrides even a subsequent stream failure', async t => {
  const f = s.fixture(t), body = s.deferred(); f.handler(async () => ({ status: 503, headers: new Headers(), clone: () => ({ arrayBuffer: () => body.promise }) }));
  const reading = assert.rejects(f.read('RAW', () => true), /original raw owner expired/); await s.flush(); f.retire(); body.reject(Error('connection closed')); await reading; assert.equal(f.calls.length, 1); assert.equal(f.joins(), 0);
});
for (const status of [302, 401]) test(`narrow original scope lost at${status} overrides a still-true witness without another hop/join`, async t => {
  const f = s.fixture(t); f.handler(async () => { f.retire(); return new Response('{}', { status, headers: { location: '/next' } }); });
  await assert.rejects(f.read('RAW', () => true), /original raw owner expired/); assert.equal(f.calls.length, 1); assert.equal(f.joins(), 0); assert.equal(f.legacy(), 0);
});
test('raw fixed capability cannot accept injected path/method/body/options or make a generic guarded write valid', async t => {
  const f = s.fixture(t); await f.transport.authorizedRawMaterialLookupRead(f.session, '/v1/mobile/writes?x=1', f.guard, f.witness, { path: '/write', method: 'DELETE', body: '{}' });
  assert.equal(f.calls[0][0], 'https://erp.example/v1/mobile/admin/raw-material-assignments/lookup?barcode=%2Fv1%2Fmobile%2Fwrites%3Fx%3D1'); assert.equal(f.calls[0][1].method, 'GET'); assert.equal(f.calls[0][1].body, undefined);
  await assert.rejects(f.transport.authorizedFetch(f.session, '/v1/mobile/admin/raw-material-assignments/lookup', { method: 'POST' }, f.guard, 100, { readWitness: f.witness }), /guarded_reads_only/); assert.equal(f.calls.length, 1); assert.equal(f.transport.currentQueueSnapshotReadEpoch(), 0);
});
test('raw redirect flow drains every hop, permanently strips credentials across origins and has one genuine timeout signal per attempt', async t => {
  const f = s.fixture(t); f.handler(async () => f.calls.length < 3 ? new Response('{}', { status: 302, headers: { location: f.calls.length === 1 ? 'https://cdn.example/private' : 'https://erp.example/final' } }) : new Response('{}'));
  await f.direct(); assert.deepEqual(f.calls.map(([url]) => url), [path, 'https://cdn.example/private', 'https://erp.example/final']);
  assert.deepEqual(f.calls.map(([, init]) => new Headers(init.headers).get('authorization')), ['Bearer old', null, null]); assert.equal(f.calls[0][1].signal, f.calls[2][1].signal); assert.equal(f.calls.every(([, init]) => init.credentials === 'omit' && init.redirect === 'manual'), true);
});
test('too many real redirects is a tagged Source policy failure and does not start a second transient attempt', async t => {
  const f = s.fixture(t), clock = s.clock(t); f.handler(async () => new Response('{}', { status: 302, headers: { location: '/again' } }));
  await assert.rejects(f.direct(), error => f.transport.isAuthorizedReadClientFailure(error) && error.message === 'Too many API redirects'); assert.equal(f.calls.length, 6); assert.deepEqual(clock.pending(), []);
});
test('Source redirect requiresHTTPS wording misses its requireHTTPS classifier, retries only the original secure URL and never sends downgrade target', async t => {
  const f = s.fixture(t), clock = s.clock(t); f.handler(async () => new Response('{}', { status: 302, headers: { location: 'http://insecure.example/raw' } }));
  const reading = assert.rejects(f.direct(), error => f.transport.isAuthorizedReadClientFailure(error) && error.message === 'API redirect requires HTTPS'); await s.flush(); assert.equal(f.calls.length, 1); await clock.advance(150); await reading;
  assert.deepEqual(f.calls.map(([url]) => url), [path, path]); assert.equal(f.transport.currentQueueSnapshotReadEpoch(), 0);
});
test('raw canonical query codec handles all RFC3986 punctuation, valid surrogate pairs and isolated low surrogates', async t => {
  const f = s.fixture(t); for (const value of ["AZaz09-._~ !'()*+/%&#?", '😀\udfff\ud800A']) {
    await f.direct(value); assert.equal(f.calls.at(-1)[0], `https://erp.example/v1/mobile/admin/raw-material-assignments/lookup?barcode=${s.load('admin/dartUri').dartQueryComponent(value)}`);
  }
});
test('primary/Paddon/Opening genuine guarded fetch failures retain identity and gain a fact without retry or legacy changes', async t => {
  const f = s.fixture(t);
  for (const purpose of ['primary', 'paddon', 'opening']) {
    const failure = Error('fetch failed: native connection closed'); f.handler(async () => { throw failure; }); const count = f.calls.length;
    const reading = purpose === 'primary' ? f.transport.authorizedProgressQrReportSnapshot(f.session, 'QR', f.guard, f.witness)
      : purpose === 'opening' ? f.transport.authorizedOpeningWipQrReportSnapshot(f.session, 'QR', f.guard, f.witness)
        : f.transport.authorizedFetch(f.session, '/v1/mobile/admin/production-maps/paddons/qr/report?code=12345', undefined, f.guard, 10000, { readWitness: f.witness });
    await assert.rejects(reading, error => error === failure); assert.equal(f.calls.length, count + 1); assert.equal(f.transport.isAuthorizedReadClientFailure(failure), true); assert.equal(f.transport.isAuthorizedReadTimeout(failure), false);
  }
  const ordinaryFailure = Error('legacy network'); f.handler(async () => { throw ordinaryFailure; }); await assert.rejects(f.transport.authorizedFetch(f.session, '/v1/mobile/legacy'), error => error === ordinaryFailure); assert.equal(f.transport.isAuthorizedReadClientFailure(ordinaryFailure), false);
});
test('guarded body-stream failures are transport facts but guard and API JSON/model failures are never branded by names or prototypes', async t => {
  const f = s.fixture(t), failure = Error('native stream failed'); f.handler(async () => ({ status: 200, clone: () => ({ arrayBuffer: async () => { throw failure; } }) }));
  await assert.rejects(f.transport.authorizedProgressQrReportSnapshot(f.session, 'QR', f.guard, f.witness), error => error === failure); assert.equal(f.transport.isAuthorizedReadClientFailure(failure), true);
  const jsonFailure = new SyntaxError('body JSON'), modelFailure = new TypeError('model shape'), guardFailure = new TypeError('fetch failed: native connection closed');
  f.handler(async () => ({ status: 200, json: async () => { throw jsonFailure; } }));
  const response = await f.transport.authorizedOpeningWipQrReportSnapshot(f.session, 'QR', f.guard, f.witness); await assert.rejects(response.json(), error => error === jsonFailure);
  for (const error of [jsonFailure, modelFailure, guardFailure]) assert.equal(f.transport.isAuthorizedReadClientFailure(error), false);
  const count = f.calls.length; await assert.rejects(f.transport.authorizedProgressQrReportSnapshot(f.session, 'QR', () => { throw guardFailure; }, () => true), error => error === guardFailure); assert.equal(f.calls.length, count); assert.equal(f.transport.isAuthorizedReadClientFailure(guardFailure), false);
});
test('actual primary/Paddon/Opening guarded timeout creation is a private fact while legacy timeout names remain unbranded', async t => {
  const f = s.fixture(t), clock = s.clock(t), pending = s.deferred(); f.handler(async () => pending.promise);
  for (const purpose of ['primary', 'paddon', 'opening', 'legacy']) {
    const reading = purpose === 'primary' ? f.transport.authorizedProgressQrReportSnapshot(f.session, 'QR', f.guard, f.witness)
      : purpose === 'opening' ? f.transport.authorizedOpeningWipQrReportSnapshot(f.session, 'QR', f.guard, f.witness)
        : f.transport.authorizedFetch(f.session, '/v1/mobile/paddon', undefined, f.guard, 10000, purpose === 'paddon' ? { readWitness: f.witness } : undefined);
    const rejected = assert.rejects(reading, error => error.name === 'TimeoutError' && f.transport.isAuthorizedReadTimeout(error) === (purpose !== 'legacy') && !f.transport.isAuthorizedReadClientFailure(error)); await clock.advance(10000); await rejected;
  }
  pending.resolve(new Response('{}')); await s.flush(); assert.equal(f.calls.length, 4); assert.equal(f.joins(), 0);
});
test('actual guarded redirect-policy TypeErrors gain Source client facts while the same legacy classes/messages and URL parse failures remain unchanged', async t => {
  const f = s.fixture(t);
  for (const location of ['http://insecure.example/private', '/again']) for (const guarded of [false, true]) {
    f.handler(async () => new Response('{}', { status: 302, headers: { location } })); const count = f.calls.length;
    await assert.rejects(f.transport.authorizedFetch(f.session, '/v1/mobile/paddon', undefined, f.guard, 10000, guarded ? { readWitness: f.witness } : undefined), error =>
      error instanceof TypeError && error.message === (location.startsWith('http:') ? 'API redirect requires HTTPS' : 'Too many API redirects') && f.transport.isAuthorizedReadClientFailure(error) === guarded);
    assert.equal(f.calls.length, count + (location.startsWith('http:') ? 1 : 6));
  }
  f.handler(async () => new Response('{}', { status: 302, headers: { location: 'https://[invalid' } }));
  await assert.rejects(f.transport.authorizedFetch(f.session, '/v1/mobile/paddon', undefined, f.guard, 10000, { readWitness: f.witness }), error => error instanceof TypeError && !f.transport.isAuthorizedReadClientFailure(error));
});
