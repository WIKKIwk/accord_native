const assert = require('node:assert/strict'), test = require('node:test');
const s = require('./adminProgressQrLookupSupport.cjs'), m = s.lookupModel;
const text = (key, values) => values ? `${key}:${JSON.stringify(values)}` : key;
test('all nine Source scanner statuses use exact keys and error status delegates the original exception', () => {
  const keys = { prompt: 'worker.scanner.progress_prompt', cameraFailed: 'worker.scanner.camera_failed', invalidQr: 'worker.scanner.invalid_qr', loading: 'worker.scanner.lookup', reportReady: 'worker.scanner.report_ready', paddonReady: 'worker.scanner.paddon_ready', materialReady: 'worker.scanner.material_ready', openingWipReady: 'worker.opening_wip.confirmed' };
  for (const [status, key] of Object.entries(keys)) assert.equal(m.adminProgressQrLookupStatusText({ ...m.adminProgressQrLookupInitial(), status }, text, () => ''), key);
  assert.equal(m.adminProgressQrLookupStatusText({ ...m.adminProgressQrLookupInitial(), status: 'error', scanError: new SyntaxError() }, text, () => ''), 'worker.qr.invalid_response');
});
test('Source named freeze and explicit code mapping precede HTTP status, with exact trimmed/lowercase API code handling', () => {
  const named = new s.exception.MobileApiException({ code: ' \u0085 ORDER_FROZEN \u0085 ', message: 'ignored', statusCode: 403, orderTitle: ' \u0085 My Order \u0085 ' });
  assert.equal(m.adminProgressQrLookupErrorText(named, text, () => ''), 'worker.freeze.named:{"order":"My Order"}');
  const keys = { unauthorized: 'worker.qr.session_expired', forbidden: 'worker.qr.forbidden', order_freeze_requested: 'worker.qr.freeze_requested', progress_batch_in_use: 'worker.error.wip_in_use', progress_batch_already_used: 'worker.error.wip_used', progress_qr_invalid_response: 'worker.qr.invalid_response', progress_qr_validation_missing: 'worker.qr.invalid_response', progress_input_invalid: 'worker.qr.invalid_response', order_not_found: 'worker.qr.order_unavailable', map_not_found: 'worker.qr.order_unavailable' };
  for (const [code, key] of Object.entries(keys)) assert.equal(m.adminProgressQrLookupErrorText(s.apiError(` ${code.toUpperCase()} `, 500), text, () => ''), key);
});
test('Source status then specific production catalog then generic lookup error precedence preserves exact catalog text', () => {
  for (const [status, key] of [[401, 'worker.qr.session_expired'], [403, 'worker.qr.forbidden'], [500, 'worker.qr.server'], [600, 'worker.qr.server']]) assert.equal(m.adminProgressQrLookupErrorText(s.apiError('unknown', status), text, () => 'specific'), key);
  let received; assert.equal(m.adminProgressQrLookupErrorText(s.apiError(' \u0085 Specific \u0085 ', 404), text, code => { received = code; return ' Exact text '; }), ' Exact text '); assert.equal(received, 'specific');
  assert.equal(m.adminProgressQrLookupErrorText(s.apiError('unknown', 404), text, () => ''), 'worker.qr.lookup_failed'); assert.equal(m.adminProgressQrLookupErrorText(Error('network'), text, () => ''), 'worker.qr.lookup_failed');
  assert.equal(m.adminProgressQrLookupErrorText(Object.assign(Error('fake'), { name: 'TimeoutError' }), text, () => ''), 'worker.qr.lookup_failed'); assert.equal(m.adminProgressQrLookupErrorText(new TypeError('shape'), text, () => ''), 'worker.qr.invalid_response');
});
test('actual guarded timeout/client/policy facts take precedence over mutable names and decoding TypeError prototypes', async t => {
  const original = global.fetch; t.after(() => { global.fetch = original; }); const session = { token: 'token', baseUrl: 'https://erp.example' }, clock = s.clock(t), pending = s.deferred(); global.fetch = () => pending.promise;
  let failure; const reading = assert.rejects(s.transport.authorizedProgressQrReportSnapshot(session, 'QR', () => {}, () => true), error => { failure = error; return true; }); await clock.advance(10000); await reading; failure.name = 'TypeError'; assert.equal(m.adminProgressQrLookupErrorText(failure, text, () => ''), 'worker.error.network_timeout');
  const client = await s.nativeFailure(t, Error('native connection')); client.name = 'TypeError'; assert.equal(m.adminProgressQrLookupErrorText(client, text, () => ''), 'worker.qr.connection');
  global.fetch = async () => new Response('{}', { status: 302, headers: { location: 'http://insecure.example' } });
  await assert.rejects(s.transport.authorizedFetch(session, '/v1/mobile/qr', undefined, () => {}, 10000, { readWitness: () => true }), error => error instanceof TypeError && m.adminProgressQrLookupFailureKind(error) === 'http-client' && m.adminProgressQrLookupErrorText(error, text, () => '') === 'worker.qr.connection');
});
test('Source report presentation precedence remains Paddon, Progress, Material, Opening while all separate report identities are retained', () => {
  const state = { ...m.adminProgressQrLookupInitial(), report: s.report('progress'), paddonReport: s.paddon('12345'), rawMaterialReport: s.material('raw'), openingWipReport: s.opening('opening') };
  assert.equal(m.adminProgressQrLookupVisibleReport(state), 'paddon'); state.paddonReport = null; assert.equal(m.adminProgressQrLookupVisibleReport(state), 'progress'); state.report = null; assert.equal(m.adminProgressQrLookupVisibleReport(state), 'material'); state.rawMaterialReport = null; assert.equal(m.adminProgressQrLookupVisibleReport(state), 'opening-wip');
});
