const assert = require('node:assert/strict');
const test = require('node:test');
const s = require('./adminProgressQrReportApiSupport.cjs');
const path = '/v1/mobile/admin/production-maps/progress-qr/report';
test('real Source report is one fixed authenticated POST read with exact JSON, no redirects and Source per-attempt queue invalidation', async t => {
  const f = s.transportFixture(t), before = f.transport.currentQueueSnapshotReadEpoch(); const result = await f.read(' \u0085 {"batch":"QR ~*"} \u0085 ');
  assert.equal(result.scanned_batch.batch_id, 'scanned'); assert.equal(f.calls.length, 1); const [url, init] = f.calls[0];
  assert.equal(url, `https://erp.example${path}`); assert.equal(init.method, 'POST'); assert.deepEqual(JSON.parse(init.body), { qr_payload: '{"batch":"QR ~*"}' });
  assert.equal(new Headers(init.headers).get('content-type'), 'application/json'); assert.equal(new Headers(init.headers).get('authorization'), 'Bearer old'); assert.equal(init.redirect, 'manual'); assert.equal(init.credentials, 'omit');
  assert.equal(f.transport.currentQueueSnapshotReadEpoch(), before + 2); assert.equal(f.legacy(), 0); assert.equal(f.joins(), 0);
});
test('independent401 recovery repeats identical fixed body with a new token and Source epoch increments for both attempts', async t => {
  const f = s.transportFixture(t), before = f.transport.currentQueueSnapshotReadEpoch(); f.handler(async () => f.calls.length === 1 ? new Response('{}', { status: 401 }) : new Response(JSON.stringify({ scanned_batch: s.batch() })));
  await f.read(' QR '); assert.equal(f.joins(), 1); assert.equal(f.legacy(), 0); assert.equal(f.calls.length, 2);
  assert.equal(f.calls[0][0], f.calls[1][0]); assert.equal(f.calls[0][1].body, f.calls[1][1].body); assert.equal(f.calls[1][1].method, 'POST');
  assert.deepEqual(f.calls.map(([, init]) => new Headers(init.headers).get('authorization')), ['Bearer old', 'Bearer new']); assert.equal(f.transport.currentQueueSnapshotReadEpoch(), before + 4);
});
test('scope guard narrower than a still-true witness blocks401 recovery before any join or second dispatch', async t => {
  const f = s.transportFixture(t), before = f.transport.currentQueueSnapshotReadEpoch(); f.handler(async () => { f.retire(); return new Response('{}', { status: 401 }); });
  await assert.rejects(f.read('QR', () => true), /original report expired/); assert.equal(f.calls.length, 1); assert.equal(f.joins(), 0); assert.equal(f.legacy(), 0); assert.equal(f.transport.currentQueueSnapshotReadEpoch(), before + 2);
});
test('direct fixed snapshot helper also enforces narrower guard at401 while raw witness remains true', async t => {
  const f = s.transportFixture(t); f.handler(async () => { f.retire(); return new Response('{}', { status: 401 }); });
  await assert.rejects(f.snapshot('QR', () => true), /original report expired/); assert.equal(f.calls.length, 1); assert.equal(f.joins(), 0); assert.equal(f.legacy(), 0);
});
test('original guard loss during independent join blocks retry; unavailable refresh stays an explicit read failure', async t => {
  const f = s.transportFixture(t); f.handler(async () => new Response('{}', { status: 401 })); f.onJoin(f.retire);
  await assert.rejects(f.read(), /original report expired/); assert.equal(f.calls.length, 1); assert.equal(f.joins(), 1); assert.equal(f.legacy(), 0);
});
test('an unaided snapshot401 never starts credential refresh and invalidates exactly its one Source POST attempt', async t => {
  const f = s.transportFixture(t), before = f.transport.currentQueueSnapshotReadEpoch(); f.handler(async () => new Response('{}', { status: 401 })); f.joinAvailable(false);
  await assert.rejects(f.read(), error => error.code === 'guarded_read_refresh_unavailable'); assert.equal(f.calls.length, 1); assert.equal(f.legacy(), 0); assert.equal(f.transport.currentQueueSnapshotReadEpoch(), before + 2);
});
test('all redirect statuses return once without following Location or converting the report POST into another method', async t => {
  const f = s.transportFixture(t), before = f.transport.currentQueueSnapshotReadEpoch();
  for (const status of [301, 302, 303, 307, 308]) {
    const count = f.calls.length; f.handler(async () => new Response('redirect', { status, headers: { location: '/v1/mobile/admin/production-maps/progress-qr/correct' } }));
    assert.equal((await f.snapshot()).status, status); assert.equal(f.calls.length, count + 1); assert.equal(f.calls.at(-1)[0], `https://erp.example${path}`); assert.equal(f.calls.at(-1)[1].method, 'POST');
  }
  assert.equal(f.transport.currentQueueSnapshotReadEpoch(), before + 10);
});
test('public fixed helper cannot take an injected path/init/body/method and generic guardedPOST still denies report and write endpoints', async t => {
  const f = s.transportFixture(t), before = f.transport.currentQueueSnapshotReadEpoch();
  await f.transport.authorizedProgressQrReportSnapshot(f.session, '/v1/mobile/admin/production-maps/progress-qr/correct', f.guard, f.witness,
    { method: 'DELETE', path: '/v1/mobile/admin/production-maps/progress-qr/reprint', body: 'injected' });
  assert.equal(f.calls[0][0], `https://erp.example${path}`); assert.equal(f.calls[0][1].method, 'POST'); assert.deepEqual(JSON.parse(f.calls[0][1].body), { qr_payload: '/v1/mobile/admin/production-maps/progress-qr/correct' });
  for (const target of [path, `${path}?correct=true`, '/v1/mobile/admin/production-maps/progress-qr/correct', '/v1/mobile/admin/production-maps/progress-qr/reprint', '/v1/mobile/anything'])
    await assert.rejects(f.transport.authorizedFetch(f.session, target, { method: 'POST', body: '{}' }, f.guard, 100, { readWitness: f.witness, allowPost: true }), /guarded_reads_only/);
  assert.equal(f.calls.length, 1); assert.equal(f.transport.currentQueueSnapshotReadEpoch(), before + 2);
});
test('fixed snapshot invalid/async/throwing/reentrant original witnesses cannot authorize a first request', async t => {
  const f = s.transportFixture(t), before = f.transport.currentQueueSnapshotReadEpoch();
  await assert.rejects(f.transport.authorizedProgressQrReportSnapshot(f.session, 'QR', f.guard), /read_witness_expired/);
  for (const witness of [null, () => false, async () => true, () => Promise.reject(Error('async')), () => { throw Error('bad witness'); }])
    await assert.rejects(f.snapshot('QR', witness), /read_witness_expired/);
  let nested, entered = false; const witness = () => { if (!entered) { entered = true; nested = f.snapshot('Nested', witness); void nested.catch(() => {}); } return true; };
  await assert.rejects(f.snapshot('QR', witness), /read_witness_expired/); await assert.rejects(nested, /read_witness_expired/); assert.equal(f.calls.length, 0); assert.equal(f.transport.currentQueueSnapshotReadEpoch(), before);
});
for (const status of [200, 500]) test(`original scope lost during transport buffered${status} rejects before JSON parsing or metadata mapping`, async t => {
  const f = s.transportFixture(t), pending = s.deferred(); let parsed = 0;
  f.handler(async () => ({ status, clone: () => ({ arrayBuffer: () => pending.promise }), json: async () => { parsed++; return { scanned_batch: s.batch('private') }; } }));
  const reading = assert.rejects(f.read('QR', () => true), /original report expired/); await s.tick(); f.retire(); pending.resolve(new ArrayBuffer(0)); await reading; assert.equal(parsed, 0);
  assert.equal(f.calls.length, 1); assert.equal(f.joins(), 0); assert.equal(f.legacy(), 0);
});
for (const status of [200, 500]) for (const rejected of [false, true]) test(`post-buffer API${status} JSON${rejected ? ' rejection' : ' success'} checks original guard after transport witness closes`, async t => {
  const f = s.transportFixture(t), pending = s.deferred(); let returned = false; f.handler(async () => ({ status, json: () => pending.promise }));
  const reading = assert.rejects(f.read('QR', () => true).then(value => { returned = true; return value; }), /original report expired/); await s.tick(); f.retire();
  if (rejected) pending.reject(Error('body error')); else pending.resolve({ scanned_batch: s.batch('private'), error: 'progress_batch_not_found' }); await reading;
  assert.equal(returned, false); assert.equal(f.calls.length, 1); assert.equal(f.legacy(), 0); assert.equal(f.joins(), 0);
});
test('legacy ordinaryPOST keeps existing credential refresh and queue invalidation, outside the new report snapshot lane', async t => {
  const f = s.transportFixture(t), before = f.transport.currentQueueSnapshotReadEpoch(); f.handler(async () => new Response('{}', { status: f.calls.length === 1 ? 401 : 200 }));
  await f.transport.authorizedFetch(f.session, '/v1/mobile/ordinary-command', { method: 'POST', body: '{}' }); assert.equal(f.legacy(), 1); assert.equal(f.joins(), 0); assert.equal(f.calls.length, 2); assert.equal(f.transport.currentQueueSnapshotReadEpoch(), before + 2);
});
test('fixed ten-second timeout settles one Source epoch pair and late401 cannot recover or invalidate again', async t => {
  const f = s.transportFixture(t), pending = s.deferred(), previousSet = global.setTimeout, previousClear = global.clearTimeout, timers = new Map(); let serial = 0;
  t.after(() => { global.setTimeout = previousSet; global.clearTimeout = previousClear; });
  global.setTimeout = (callback, delay) => { assert.equal(delay, 10000); const id = ++serial; timers.set(id, callback); return id; }; global.clearTimeout = id => timers.delete(id);
  f.handler(async () => pending.promise); const before = f.transport.currentQueueSnapshotReadEpoch(), reading = f.snapshot(); const rejected = assert.rejects(reading, error => error.name === 'TimeoutError');
  assert.equal(timers.size, 1); assert.equal(f.transport.currentQueueSnapshotReadEpoch(), before + 1); [...timers.values()][0](); await rejected; assert.equal(f.transport.currentQueueSnapshotReadEpoch(), before + 2);
  pending.resolve({ status: 401 }); await s.flush();
  assert.equal(f.calls.length, 1); assert.equal(f.joins(), 0); assert.equal(f.legacy(), 0); assert.equal(f.transport.currentQueueSnapshotReadEpoch(), before + 2);
});
test('pending snapshot keeps the Source start epoch and adds completion exactly once after buffered success', async t => {
  const f = s.transportFixture(t), pending = s.deferred(), before = f.transport.currentQueueSnapshotReadEpoch(); f.handler(async () => pending.promise);
  const reading = f.read(); assert.equal(f.transport.currentQueueSnapshotReadEpoch(), before + 1); pending.resolve(new Response(JSON.stringify({ scanned_batch: s.batch() })));
  await reading; assert.equal(f.transport.currentQueueSnapshotReadEpoch(), before + 2);
});
for (const synchronous of [false, true]) test(`Source report ${synchronous ? 'synchronous dispatch' : 'network promise'} failure settles its epoch pair without refresh`, async t => {
  const f = s.transportFixture(t), before = f.transport.currentQueueSnapshotReadEpoch();
  if (synchronous) global.fetch = () => { throw Error('dispatch failed'); }; else f.handler(async () => { throw Error('network failed'); });
  await assert.rejects(f.read(), /dispatch failed|network failed/); assert.equal(f.transport.currentQueueSnapshotReadEpoch(), before + 2); assert.equal(f.joins(), 0); assert.equal(f.legacy(), 0);
});
