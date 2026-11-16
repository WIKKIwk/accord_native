const assert = require('node:assert/strict');
const test = require('node:test');
const s = require('./adminProgressQrReportApiSupport.cjs');
test('Source API Dart-trims the scan once, forwards original witness/checked guard and decodes actual canonical report', async () => {
  const raw = { scanned_batch: s.batch('scanned'), progress_batches: [s.batch('unrelated')], current_batches: [s.batch('current')] };
  const f = s.apiFixture(async () => ({ status: 200, json: async () => raw })), result = await f.read(' \u0085 QR ~* \u0085 ');
  const [session, payload, guard, witness] = f.calls[0]; assert.equal(session, f.session); assert.equal(payload, 'QR ~*'); assert.equal(typeof guard, 'function'); guard(); assert.equal(witness, f.witness);
  assert.equal(result.scanned_batch.batch_id, 'scanned'); assert.equal(result.scanned_batch.produced_qty, 2); assert.equal(s.report.adminProgressQrHistoryBatches(result)[0], result.scanned_batch); assert.equal(s.report.adminProgressQrHistoryCurrentBatch(result), null);
});
test('empty normalized scan still reaches Source report endpoint instead of inventing client validation or test-mode data', async () => {
  const f = s.apiFixture(async () => ({ status: 404, headers: new Headers(), json: async () => ({ error: 'progress_batch_not_found' }) }));
  await assert.rejects(f.read(' \u0085 '), error => error instanceof s.exception.MobileApiException && error.code === 'progress_batch_not_found' && error.message === 'Progress QR topilmadi' && error.statusCode === 404);
  assert.equal(f.calls[0][1], '');
});
test('Source non200 preserves full canonical error fields and header requestId rather than hiding report failures as missing data', async () => {
  const payload = { error: 'order_delete_blocked', apparatus_options: [' A '], blockers: [{ message: ' blocker ' }], active_kadr_count: 4, scanned_kadr_count: 3, order_title: ' Order ', request_id: 'body-request' };
  const f = s.apiFixture(async () => ({ status: 409, headers: new Headers({ 'x-request-id': 'header-request' }), json: async () => payload }));
  await assert.rejects(f.read(), error => error instanceof s.exception.MobileApiException && error.code === 'order_delete_blocked' && error.statusCode === 409 && error.requestId === 'header-request' && error.diagnostics === payload &&
    error.apparatusOptions[0] === 'A' && error.details[0] === 'blocker' && error.activeKadrCount === 4 && error.scannedKadrCount === 3 && error.orderTitle === 'Order');
});
test('exact200 success status and malformed non200 body use Source progress_batch_not_found fallback', async () => {
  for (const status of [201, 500]) {
    const f = s.apiFixture(async () => ({ status, headers: new Headers({ 'x-request-id': 'request' }), json: async () => { throw SyntaxError('bad JSON'); } }));
    await assert.rejects(f.read(), error => error instanceof s.exception.MobileApiException && error.code === 'progress_batch_not_found' && error.statusCode === status && error.requestId === 'request');
  }
  const f = s.apiFixture(async () => ({ status: 200, json: async () => { throw SyntaxError('bad JSON'); } })); await assert.rejects(f.read(), SyntaxError);
});
test('canonical decoder rejects missing/nonmap scan and invalid canonical apparatus instead of returning a raw report', async () => {
  for (const value of [{}, { scanned_batch: null }, { scanned_batch: [] }, { scanned_batch: 'raw' }]) {
    const f = s.apiFixture(async () => ({ status: 200, json: async () => value })); await assert.rejects(f.read(), error => error instanceof s.exception.MobileApiException && error.code === 'progress_batch_not_found');
  }
  const invalid = s.apiFixture(async () => ({ status: 200, json: async () => ({ scanned_batch: s.batch('invalid', { apparatus: 'legacy-name' }) }) })); await assert.rejects(invalid.read());
});
test('required original guard/witness and invalid asynchronous/value-returning guards never dispatch', async () => {
  const f = s.apiFixture(async () => { throw Error('must not dispatch'); });
  for (const guard of [undefined, async () => {}, () => true]) await assert.rejects(f.client.adminProgressQrReport(f.session, 'QR', guard, f.witness), TypeError);
  await assert.rejects(f.client.adminProgressQrReport(f.session, 'QR', f.guard), TypeError); f.retire(); await assert.rejects(f.read(), /original report expired/); assert.equal(f.calls.length, 0);
});
test('original guard wins over delayed success/error body, JSON rejection and transport failure', async () => {
  for (const status of [200, 500]) for (const rejected of [false, true]) {
    let f; f = s.apiFixture(async () => ({ status, json: async () => { f.retire(); if (rejected) throw Error('JSON parse'); return { scanned_batch: s.batch(), error: 'progress_batch_not_found' }; } }));
    await assert.rejects(f.read(), /original report expired/);
  }
  let f; f = s.apiFixture(async () => { f.retire(); throw Error('network error'); }); await assert.rejects(f.read(), /original report expired/);
});
test('post-model and canonical error-mapper side effects cannot leak a retired DTO or mapped error', async () => {
  let f; f = s.apiFixture(async () => ({ status: 200, json: async () => ({ get scanned_batch() { f.retire(); return s.batch('private'); } }) }));
  await assert.rejects(f.read(), /original report expired/);
  let g; g = s.apiFixture(async () => ({ status: 409, headers: { get: () => { g.retire(); return 'request'; } }, json: async () => ({ error: 'progress_batch_not_found' }) }));
  await assert.rejects(g.read(), /original report expired/);
});
