const assert = require('node:assert/strict'), test = require('node:test');
const s = require('./adminProgressQrFallbackSupport.cjs');
test('Paddon guarded GET uses Source trim/encoding and actual shared snapshot batch decoder', async t => {
  const f = s.transportFixture(t); f.handler(async () => new Response(JSON.stringify({ paddon: { code: '12345' }, items: [s.batch('assigned')], available_items: [s.batch('assigned'), s.batch('available')], can_manage_items: true })));
  const result = await f.read('paddon', ' \u0085 12~*34 \u0085 '); assert.equal(f.calls[0][0], 'https://erp.example/v1/mobile/admin/production-maps/paddons/qr/report?code=12~%2A34'); assert.equal(f.calls[0][1].method, 'GET');
  assert.equal(result.paddon.code, '12345'); assert.equal(result.items[0].batch_id, 'assigned'); assert.deepEqual(result.available_items.map(item => item.batch_id), ['available']); assert.equal(f.transport.currentQueueSnapshotReadEpoch(), 0);
});
test('Opening WIP distinct fixed POST uses Source body/record decoder and per-attempt epoch quirk', async t => {
  const f = s.transportFixture(t); f.handler(async () => new Response(JSON.stringify({ record: s.record() })));
  const record = await f.read('opening', ' \u0085 QR ~* \u0085 '); assert.equal(f.calls[0][0], 'https://erp.example/v1/mobile/admin/production-maps/opening-wip/qr/report'); assert.equal(f.calls[0][1].method, 'POST'); assert.deepEqual(JSON.parse(f.calls[0][1].body), { qr_payload: 'QR ~*' });
  assert.equal(record.intake.intake_id, 'intake'); assert.equal(record.intake.actor_ref, 'ref'); assert.equal(record.batches[0].batch_id, 'batch'); assert.equal(record.batches[0].quantity, 2.5); assert.equal(f.transport.currentQueueSnapshotReadEpoch(), 2);
});
for (const kind of ['paddon', 'opening']) test(`${kind} empty/code/model errors retain Source MobileApiException and no fake fallback report`, async t => {
  const f = s.transportFixture(t); await assert.rejects(f.read(kind, ' \u0085 '), error => error instanceof s.exception.MobileApiException && error.code === (kind === 'paddon' ? 'paddon_not_found' : 'opening_wip_qr_not_found')); assert.equal(f.calls.length, 0);
  f.handler(async () => new Response(kind === 'paddon' ? '[]' : '{}')); await assert.rejects(f.read(kind), kind === 'paddon' ? TypeError : error => error instanceof s.exception.MobileApiException && error.code === 'opening_wip_qr_not_found');
});
for (const kind of ['paddon', 'opening']) test(`${kind} shared error parser preserves Source status/requestId/blockers and original guard after body/model`, async t => {
  const f = s.transportFixture(t); f.handler(async () => new Response(JSON.stringify({ error: 'order_delete_blocked', blockers: [{ message: 'Blocker' }], apparatus_options: ['A'], active_kadr_count: 4 }), { status: 409, headers: { 'x-request-id': 'request' } }));
  await assert.rejects(f.read(kind), error => error instanceof s.exception.MobileApiException && error.code === 'order_delete_blocked' && error.statusCode === 409 && error.requestId === 'request' && error.details[0] === 'Blocker' && error.apparatusOptions[0] === 'A' && error.activeKadrCount === 4);
  f.handler(async () => ({ status: 200, json: async () => { f.retire(); return kind === 'paddon' ? {} : { record: s.record() }; } })); await assert.rejects(f.read(kind), /original fallback expired/);
});
