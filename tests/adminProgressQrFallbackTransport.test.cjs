const assert = require('node:assert/strict'), test = require('node:test');
const s = require('./adminProgressQrFallbackSupport.cjs');
for (const kind of ['paddon', 'opening']) for (const status of [302, 401]) test(`${kind} combined scope guard blocks${status} continuation while narrower witness stays true`, async t => {
  const f = s.transportFixture(t); f.handler(async () => { f.retire(); return new Response('{}', { status, headers: status === 302 ? { location: '/next' } : {} }); });
  await assert.rejects(f.read(kind, '12345', () => true), /original fallback expired/); assert.equal(f.calls.length, 1); assert.equal(f.joins(), 0); assert.equal(f.legacy(), 0);
});
for (const kind of ['paddon', 'opening']) test(`${kind} genuine independent401 recovery preserves body/path and never uses legacy refresh`, async t => {
  const f = s.transportFixture(t); f.handler(async () => f.calls.length === 1 ? new Response('{}', { status: 401 }) : new Response(JSON.stringify(kind === 'paddon' ? { paddon: { code: '12345' } } : { record: s.record() })));
  await f.read(kind); assert.equal(f.calls[0][0], f.calls[1][0]); assert.equal(f.calls[0][1].body, f.calls[1][1].body); assert.equal(f.joins(), 1); assert.equal(f.legacy(), 0); assert.deepEqual(f.calls.map(([, init]) => new Headers(init.headers).get('authorization')), ['Bearer old', 'Bearer new']); assert.equal(f.transport.currentQueueSnapshotReadEpoch(), kind === 'paddon' ? 0 : 4);
});
test('both fixed report snapshot wrappers stay distinct/injection-proof, plain guarded openingPOST remains rejected', async t => {
  const f = s.transportFixture(t); f.handler(async () => new Response('{}'));
  for (const [method, path] of [['authorizedProgressQrReportSnapshot', '/v1/mobile/admin/production-maps/progress-qr/report'], ['authorizedOpeningWipQrReportSnapshot', '/v1/mobile/admin/production-maps/opening-wip/qr/report']]) {
    await f.transport[method](f.session, '/v1/mobile/admin/production-maps/progress-qr/correct', f.guard, f.witness, { method: 'DELETE', path: '/wrong', body: 'fake' });
    const [url, init] = f.calls.at(-1); assert.equal(url, `https://erp.example${path}`); assert.equal(init.method, 'POST'); assert.deepEqual(JSON.parse(init.body), { qr_payload: '/v1/mobile/admin/production-maps/progress-qr/correct' });
  }
  const before = f.transport.currentQueueSnapshotReadEpoch();
  await assert.rejects(f.transport.authorizedFetch(f.session, '/v1/mobile/admin/production-maps/opening-wip/qr/report', { method: 'POST', body: '{}' }, f.guard, 100, { readWitness: f.witness }), /guarded_reads_only/);
  assert.equal(f.calls.length, 2); assert.equal(f.transport.currentQueueSnapshotReadEpoch(), before);
});
test('OpeningPOST refuses every redirect without following, and Source epoch increases for each actual request', async t => {
  const f = s.transportFixture(t); for (const status of [301, 302, 303, 307, 308]) {
    const before = f.calls.length; f.handler(async () => new Response('redirect', { status, headers: { location: '/next' } }));
    assert.equal((await f.transport.authorizedOpeningWipQrReportSnapshot(f.session, 'QR', f.guard, f.witness)).status, status); assert.equal(f.calls.length, before + 1);
  }
  assert.equal(f.transport.currentQueueSnapshotReadEpoch(), 10);
});
