const assert = require('node:assert/strict'), test = require('node:test');
const s = require('./adminProgressQrFallbackSupport.cjs');
const error = (code, statusCode) => new s.exception.MobileApiException({ code, statusCode, message: code });
test('Paddon eligibility is exactly five ASCII digits after Dart trim, including leading zeroes and N85 edges', () => {
  for (const code of ['12345', '00000', ' \u0085 12345 \u0085 ']) assert.equal(s.policy.adminProgressQrMayTryPaddon(code), true);
  for (const code of ['', '1234', '123456', '12 45', '１２３４５', '١٢٣٤٥', 'https://server/12345', '12345\nX']) assert.equal(s.policy.adminProgressQrMayTryPaddon(code), false);
});
test('Opening and material require exact canonical MobileApiException codes, not aliases/status or duck-typed worker errors', () => {
  for (const code of ['progress_batch_not_found', 'progress_batch_not_accepted']) for (const status of [undefined, 403, 500]) assert.equal(s.policy.adminProgressQrMayTryOpeningOrMaterial(error(code, status)), true);
  for (const value of [Error('network'), { code: 'progress_batch_not_found' }, new s.controls.WorkerControlException('progress_batch_not_found', 'worker'), error('PROGRESS_BATCH_NOT_FOUND', 404), error(' progress_batch_not_found', 404), error('opening_wip_qr_not_found', 404)])
    assert.equal(s.policy.adminProgressQrMayTryOpeningOrMaterial(value), false);
});
test('actual TypeError/JSON SyntaxError are known facts; names/messages alone never invent transport categories', () => {
  assert.equal(s.policy.adminProgressQrKnownFailureKind(new TypeError('shape')), 'type'); assert.equal(s.policy.adminProgressQrKnownFailureKind(new SyntaxError('JSON')), 'format');
  for (const name of ['TimeoutError', 'ClientException', 'FormatException', 'TypeError']) { const unknown = Error('network request failed'); unknown.name = name; assert.equal(s.policy.adminProgressQrKnownFailureKind(unknown), null); }
});
test('fallback preference preserves exact exception identity and only replaces eligible current errors with explicit Source facts/auth/server API errors', () => {
  const original = error('progress_batch_not_found');
  for (const kind of ['timeout', 'http-client', 'format', 'type']) { const fallback = Error(kind); assert.equal(s.policy.adminProgressQrPreferFallbackError(original, fallback, kind), fallback); }
  for (const fallback of [error('other', 401), error('other', 403), error('other', 500), error('other', 600), error('unauthorized'), error('forbidden')]) assert.equal(s.policy.adminProgressQrPreferFallbackError(original, fallback, null), fallback);
  for (const fallback of [error('other', 404), error('UNAUTHORIZED'), error(' forbidden '), Error('network')]) assert.equal(s.policy.adminProgressQrPreferFallbackError(original, fallback, null), original);
  assert.equal(s.policy.adminProgressQrPreferFallbackError(original, Error('unclassified'), 'unknown'), original);
});
test('original-primary eligibility survives evolving lookupError and preference freezes only once CURRENT error ceases eligible', () => {
  const primary = error('progress_batch_not_found'), forbidden = error('forbidden', 403), timeout = Error('actual timeout fact');
  const plan = s.policy.adminProgressQrFallbackState('12345', primary), afterPaddon = s.policy.adminProgressQrFallbackFailed(plan, forbidden, null), afterOpening = s.policy.adminProgressQrFallbackFailed(afterPaddon, timeout, 'timeout');
  assert.equal(afterOpening.primaryError, primary); assert.equal(afterOpening.lookupError, forbidden); assert.equal(afterOpening.tryOpeningWip, true); assert.equal(afterOpening.tryMaterial, true); assert.equal(afterOpening.tryPaddon, true); assert.equal(Object.isFrozen(afterOpening), true);
  const eligibleServer = error('progress_batch_not_accepted', 503), stillEligible = s.policy.adminProgressQrFallbackFailed(plan, eligibleServer, null);
  assert.equal(s.policy.adminProgressQrFallbackFailed(stillEligible, timeout, 'timeout').lookupError, timeout);
});
test('Paddon remains code-eligible after any primary failure, but a fallback cannot manufacture original Opening/Raw eligibility', () => {
  const primary = Error('primary network'), eligibleFallback = error('progress_batch_not_found', 500);
  const plan = s.policy.adminProgressQrFallbackState('12345', primary), failed = s.policy.adminProgressQrFallbackFailed(plan, eligibleFallback, null);
  assert.equal(failed.tryPaddon, true); assert.equal(failed.tryOpeningWip, false); assert.equal(failed.tryMaterial, false); assert.equal(failed.lookupError, primary);
});
test('Admin current052 raw wrapper preserves canonical stock/order/log parser and adds only literal-true Metalayzer data', () => {
  const raw = { barcode: ' Raw ', qty: 2.5, is_metalayzer: true, assignment: null, order: { id: 'order' }, logs: [] }, parsed = s.model.adminProgressQrMaterialReportFromJson(raw);
  assert.equal(parsed.is_metalayzer, true); assert.equal(parsed.barcode, ' Raw '); assert.equal(parsed.qty, 2.5); assert.equal(parsed.order.id, 'order'); assert.equal(Object.isFrozen(parsed), true); assert.equal('is_metalayzer' in s.raw.rawMaterialLookupFromJson(raw), false);
  for (const value of [undefined, null, false, 1, 'true']) assert.equal(s.model.adminProgressQrMaterialReportFromJson({ is_metalayzer: value }).is_metalayzer, false);
  assert.throws(() => s.model.adminProgressQrMaterialReportFromJson({ qty: '2' }), TypeError);
});
test('Source worker replacement is exact aparatchi principal and only Progress/Opening successes', () => {
  for (const role of ['aparatchi', 'rezka_master', 'admin']) for (const kind of ['progress', 'paddon', 'opening-wip', 'material'])
    assert.equal(s.model.adminProgressQrNeedsWorkerQueue(role, kind), role === 'aparatchi' && ['progress', 'opening-wip'].includes(kind));
});
