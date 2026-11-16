const assert = require('node:assert/strict');
const test = require('node:test');
const s = require('./adminUsersSupport.cjs');
const exception = s.load('shared/mobileApiException');
const controls = s.load('workerControlsApi', { './authorizedFetch': {}, './sessionReadScope': {} });
function fixture(response) {
  let current = true; const expired = Error('original response retired');
  const guard = () => { if (!current) throw expired; };
  const request = s.load('admin/adminProductionRequest', { '../authorizedFetch': { authorizedFetch: async (_session, _path, _init, check) => { check?.(); return response; } },
    '../shared/mobileApiException': exception, '../workerControlsApi': controls });
  return { expired, retire: () => { current = false; }, run: () => request.adminProductionRequest({}, '/v1/mobile/admin/production-maps/progress-qr/report', undefined, 'progress_batch_not_found', guard) };
}
test('Admin error projection retains the source named order, apparatus choices, blockers, frame counts and header request ID', async () => {
  const payload = { error: 'order_frozen', order_title: ' Original order ', apparatus_options: [' A ', '', 'B'], blockers: [{ message: ' First ' }, { message: 'Second' }],
    active_kadr_count: 3, scanned_kadr_count: 4, request_id: 'body-id' };
  const response = new Response(JSON.stringify(payload), { status: 409, headers: { 'x-request-id': 'header-id' } });
  await assert.rejects(fixture(response).run(), error => {
    assert.ok(error instanceof exception.MobileApiException); assert.equal(error.code, 'order_frozen'); assert.equal(error.statusCode, 409);
    assert.equal(error.orderTitle, 'Original order'); assert.deepEqual(error.apparatusOptions, ['A', 'B']); assert.deepEqual(error.details, ['First', 'Second']);
    assert.equal(error.activeKadrCount, 3); assert.equal(error.scannedKadrCount, 4); assert.equal(error.requestId, 'header-id'); assert.deepEqual(error.diagnostics, payload); return true;
  });
});
test('source header precedence includes empty header while absent header retains the body request ID', async () => {
  for (const [header, expected] of [[undefined, 'body-id'], ['', ''], ['header', 'header']]) {
    const response = new Response(JSON.stringify({ error: 'unknown', request_id: 'body-id' }), { status: 500, headers: header === undefined ? {} : { 'x-request-id': header } });
    await assert.rejects(fixture(response).run(), error => error.requestId === expected);
  }
});
test('an account retired during genuine error-header evaluation cannot return old named-order diagnostics', async () => {
  let f; const response = { status: 409, json: async () => ({ error: 'order_frozen', order_title: 'Old order' }), headers: { get() { f.retire(); return 'old-request'; } } };
  f = fixture(response); await assert.rejects(f.run(), error => error === f.expired);
});
test('body getter or thrown header failure rechecks the original guard instead of exposing a stale mapper result', async () => {
  for (const boundary of ['body', 'header']) {
    let f; const payload = { order_title: 'Old order' };
    Object.defineProperty(payload, 'error', { get() { if (boundary === 'body') f.retire(); return 'order_frozen'; } });
    const response = { status: 409, json: async () => payload, headers: { get() { if (boundary === 'header') { f.retire(); throw Error('header failed'); } return null; } } };
    f = fixture(response); await assert.rejects(f.run(), error => error === f.expired);
  }
});
