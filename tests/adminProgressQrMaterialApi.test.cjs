const assert = require('node:assert/strict'), test = require('node:test');
const s = require('./adminProgressQrMaterialSupport.cjs');
test('Source raw lookup is a fixed guarded GET with exact Dart query and current052 canonical Material DTO', async t => {
  const f = s.fixture(t); f.handler(async () => new Response(JSON.stringify({ barcode: 'Raw', qty: 2.5, is_metalayzer: true, order: { id: 'order' } })));
  const result = await f.read(' \u0085 A ~*+/?#\ud800 \u0085 '); assert.equal(f.calls[0][0], 'https://erp.example/v1/mobile/admin/raw-material-assignments/lookup?barcode=A+~%2A%2B%2F%3F%23%EF%BF%BD');
  const init = f.calls[0][1]; assert.equal(init.method, 'GET'); assert.equal(init.body, undefined); assert.equal(init.redirect, 'manual'); assert.equal(init.credentials, 'omit'); assert.equal(new Headers(init.headers).get('authorization'), 'Bearer old');
  assert.equal(result.qty, 2.5); assert.equal(result.order.id, 'order'); assert.equal(result.is_metalayzer, true); assert.equal(f.transport.currentQueueSnapshotReadEpoch(), 0);
  await f.read(' \u0085 '); assert.equal(f.calls[1][0], 'https://erp.example/v1/mobile/admin/raw-material-assignments/lookup?barcode=');
});
test('Source exact200 status and full canonical error metadata are retained without rewriting legacy raw APIs', async t => {
  const f = s.fixture(t); f.handler(async () => new Response(JSON.stringify({ error: 'raw_denied', blockers: [{ message: 'Blocker' }], apparatus_options: ['A'], order_title: 'Order' }), { status: 409, headers: { 'x-request-id': 'request' } }));
  await assert.rejects(f.read(), error => error instanceof s.exception.MobileApiException && error.code === 'raw_denied' && error.statusCode === 409 && error.requestId === 'request' && error.details[0] === 'Blocker' && error.apparatusOptions[0] === 'A' && error.orderTitle === 'Order');
  f.handler(async () => new Response('{}', { status: 201 })); await assert.rejects(f.read(), error => error instanceof s.exception.MobileApiException && error.code === 'raw_material_assignments' && error.statusCode === 201);
});
test('original raw account/page guard remains authoritative through JSON parsing and canonical DTO getters', async t => {
  const f = s.fixture(t), pending = s.deferred(); f.handler(async () => ({ status: 200, clone: () => ({ arrayBuffer: async () => new ArrayBuffer(0), text: async () => '{}' }), headers: new Headers({ 'content-type': 'application/json' }), json: () => pending.promise }));
  const reading = assert.rejects(f.read('RAW', () => true), /original raw owner expired/); await s.flush(); f.retire(); pending.resolve({ barcode: 'private' }); await reading;
  assert.equal(f.calls.length, 1); assert.equal(f.joins(), 0);
});
test('strict raw API guards/witnesses cannot authorize a request with asynchronous or value-returning checks', async t => {
  const f = s.fixture(t);
  for (const guard of [null, async () => {}, () => true, () => Promise.reject(Error('async'))]) await assert.rejects(f.client.adminProgressQrMaterialLookup(f.session, 'RAW', guard, f.witness), TypeError);
  for (const witness of [null, () => false, async () => true]) await assert.rejects(f.client.adminProgressQrMaterialLookup(f.session, 'RAW', f.guard, witness));
  assert.equal(f.calls.length, 0);
});
