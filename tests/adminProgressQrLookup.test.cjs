const assert = require('node:assert/strict'), test = require('node:test');
const s = require('./adminProgressQrLookupSupport.cjs');
const reads = f => f.calls.filter(([kind]) => ['primary', 'paddon', 'opening', 'material'].includes(kind)).map(([kind]) => kind);
test('construction and start do not activate camera/lookup; only non-scanOnly mounts read the Source10000 catalog and retain subscriptions on replay', async () => {
  const f = s.fixture(); assert.deepEqual(f.calls, []); let updates = 0; f.controller.subscribe(() => { updates++; }); f.start(); await s.flush(); assert.deepEqual(f.calls.map(([kind]) => kind), ['apparatus']); assert.equal(f.state().status, 'prompt');
  f.controller.detach(); f.start(); await s.flush(); assert.deepEqual(f.calls.map(([kind]) => kind), ['apparatus', 'apparatus']); assert.equal(updates > 1, true);
  const only = s.fixture({ scanOnly: true }); only.start(); await s.flush(); assert.deepEqual(only.calls, []);
});
test('Source primary waits for scanner stop, ignores duplicate detection and keeps actual canonical DTO identity until Scan Again', async () => {
  const f = s.fixture(), stop = s.deferred(), dto = s.report('actual'); f.stop(() => stop.promise); f.answers.primary = async () => dto; f.start(); await s.flush();
  const reading = f.controller.detectNormalized(' \u0085 QR \u0085 '); assert.equal(f.state().processing, true); assert.equal(f.state().status, 'loading'); assert.deepEqual(reads(f), []);
  await f.controller.detectNormalized('duplicate'); assert.equal(f.calls.filter(([kind]) => kind === 'stop').length, 1); stop.resolve(); await reading;
  assert.deepEqual(reads(f), ['primary']); assert.equal(f.calls.find(([kind]) => kind === 'primary')[1], 'QR'); assert.equal(f.state().report, dto); assert.equal(f.state().status, 'reportReady'); assert.equal(f.state().processing, false);
  await f.controller.detectNormalized('report visible'); assert.deepEqual(reads(f), ['primary']); assert.equal(f.controller.issueManual(), null);
});
test('Source stop rejection is OUTSIDE lookupcatch and leaves processing/loading/error rather than inventing fallback or retry', async () => {
  const f = s.fixture(), failure = Error('stop failed'); f.stop(async () => { throw failure; }); f.start(); await s.flush(); await assert.rejects(f.controller.detectNormalized('12345'), error => error === failure);
  assert.equal(f.state().processing, true); assert.equal(f.state().status, 'loading'); assert.equal(f.state().scanError, null); assert.deepEqual(reads(f), []); assert.equal(f.calls.some(([kind]) => kind === 'retry'), false);
});
test('five ASCII digits try Paddon after ANY primary error, and a successful Paddon never hands aparatchi to worker queue', async () => {
  const f = s.fixture({ role: 'aparatchi' }), dto = s.paddon('12345'); f.answers.primary = async () => { throw Error('primary network'); }; f.answers.paddon = async () => dto; f.start(); await s.flush();
  await f.controller.detectNormalized('12345'); assert.deepEqual(reads(f), ['primary', 'paddon']); assert.equal(f.state().paddonReport, dto); assert.equal(f.state().status, 'paddonReady'); assert.equal(f.calls.some(([kind]) => kind === 'queue'), false);
});
test('Opening/Raw eligibility reads ORIGINAL primary error while display preference evolves and freezes on noneligible current error', async () => {
  const f = s.fixture(), primary = s.apiError(), forbidden = s.apiError('forbidden', 403); f.answers.primary = async () => { throw primary; }; f.answers.paddon = async () => { throw forbidden; }; f.answers.opening = async () => { throw new TypeError('opening malformed'); }; f.answers.material = async () => { throw s.apiError('server', 500); }; f.start(); await s.flush();
  await f.controller.detectNormalized('12345'); assert.deepEqual(reads(f), ['primary', 'paddon', 'opening', 'material']); assert.equal(f.state().scanError, forbidden); assert.equal(f.state().status, 'error'); assert.equal(f.calls.filter(([kind]) => kind === 'retry').length, 1);
});
test('a later Paddon eligible API error cannot manufacture Opening/Raw eligibility for an originally noneligible primary', async () => {
  const f = s.fixture(), primary = Error('network'); f.answers.primary = async () => { throw primary; }; f.answers.paddon = async () => { throw s.apiError('progress_batch_not_found', 500); }; f.start(); await s.flush(); await f.controller.detectNormalized('00000');
  assert.deepEqual(reads(f), ['primary', 'paddon']); assert.equal(f.state().scanError, primary);
});
test('actual native boundary Error supersedes eligible primary, preserving identity; fake names do not become network failure facts', async t => {
  const f = s.fixture(), failure = await s.nativeFailure(t, Error('fetch failed: native')); f.answers.primary = async () => { throw s.apiError(); }; f.answers.opening = async () => { throw failure; }; f.answers.material = async () => { throw new SyntaxError('later'); }; f.start(); await s.flush(); await f.controller.detectNormalized('QR'); assert.equal(f.state().scanError, failure);
  const g = s.fixture(), primary = s.apiError(); g.answers.primary = async () => { throw primary; }; g.answers.opening = async () => { const fake = Error('network'); fake.name = 'ClientException'; throw fake; }; g.answers.material = async () => { throw s.apiError('raw_not_found', 404); }; g.start(); await s.flush(); await g.controller.detectNormalized('QR'); assert.equal(g.state().scanError, primary);
});
for (const kind of ['primary', 'opening', 'material']) test(`Source ${kind} success installs only its report; exact aparatchi queue handoff applies to primary/opening only`, async () => {
  for (const role of ['aparatchi', 'rezka_master', 'admin']) { const f = s.fixture({ role }); if (kind !== 'primary') f.answers.primary = async () => { throw s.apiError(); }; if (kind === 'material') f.answers.opening = async () => { throw s.apiError('opening_missing', 404); }; f.start(); await s.flush(); await f.controller.detectNormalized('QR');
    const queues = f.calls.filter(([name]) => name === 'queue'), shouldQueue = role === 'aparatchi' && kind !== 'material'; assert.equal(queues.length, shouldQueue ? 1 : 0);
    assert.equal(f.state().processing, shouldQueue); if (shouldQueue) { assert.equal(queues[0][1], 'QR'); queues[0][2](); assert.equal(s.lookupModel.adminProgressQrLookupVisibleReport(f.state()), null); }
    else assert.equal(f.state().status, kind === 'primary' ? 'reportReady' : kind === 'opening' ? 'openingWipReady' : 'materialReady');
  }
});
test('failed automatic scanner retry overrides status to cameraFailed but retains lookup error; explicit retry clears it when not phaseerror', async () => {
  const f = s.fixture(), error = Error('lookup'); f.answers.primary = async () => { throw error; }; f.retry(async () => false); f.phase(() => 'error'); f.start(); await s.flush(); await f.controller.detectNormalized('QR'); assert.equal(f.state().status, 'cameraFailed'); assert.equal(f.state().scanError, error);
  f.phase(() => 'suspended'); await f.controller.retryScanner(); assert.equal(f.state().status, 'prompt'); assert.equal(f.state().scanError, null); assert.equal(f.state().processing, false);
});
test('unsupported scanner does not fabricate stop/retry; Source empty input and scanOnly raw normalized return keep their distinct statuses', async () => {
  const f = s.fixture({ scanOnly: true, supported: false }); f.start(); await f.controller.detectNormalized(' \u0085 '); assert.equal(f.state().status, 'invalidQr'); assert.equal(f.state().processing, false);
  await f.controller.detectNormalized(' \u0085 RETURN \u0085 '); assert.deepEqual(f.calls.map(([kind]) => kind), ['return']); assert.equal(f.calls[0][1], 'RETURN'); assert.equal(f.state().processing, true); assert.equal(f.state().status, 'invalidQr');
});
test('accepted manual ticket survives expected blur, is consumed once and requires original owner/generation, without invented pending-ticket coalescing', async () => {
  const f = s.fixture(); f.start(); await s.flush(); const one = f.controller.issueManual(), two = f.controller.issueManual(); assert.ok(one && two && one !== two); f.focus(() => false); await f.controller.completeManual(one, ' MANUAL '); assert.equal(f.state().status, 'reportReady'); assert.deepEqual(reads(f), ['primary']); await f.controller.completeManual(one, 'replay'); await f.controller.completeManual({ generation: one.generation }, 'forged'); assert.deepEqual(reads(f), ['primary']);
  f.controller.detach(); f.start(); await s.flush(); await f.controller.completeManual(two, 'stale'); assert.deepEqual(reads(f), ['primary']);
});
test('manual Source processing admission differs on supported vs unsupported scanner and scanOnly permits already-issued manual completions', async () => {
  for (const supported of [true, false]) { const f = s.fixture({ scanOnly: true, supported }), stop = s.deferred(); f.stop(() => stop.promise); f.start(); const first = f.controller.issueManual(), second = f.controller.issueManual(); const returning = f.controller.completeManual(first, 'FIRST');
    assert.equal(f.controller.issueManual() !== null, !supported); stop.resolve(); await returning; await f.controller.completeManual(second, 'SECOND'); assert.deepEqual(f.calls.filter(([kind]) => kind === 'return').map(([, value]) => value), ['FIRST', 'SECOND']);
  }
});
test('Source unsupported manual cancellation leaves pending lookup untouched, while empty accepted input changes only status even during processing', async () => {
  const f = s.fixture({ supported: false }), pending = s.deferred(); f.answers.primary = () => pending.promise; f.start(); await s.flush(); const original = f.controller.issueManual(), reading = f.controller.completeManual(original, 'QR'); await s.flush();
  const cancel = f.controller.issueManual(); await f.controller.completeManual(cancel, null); assert.equal(f.state().processing, true); assert.equal(f.state().status, 'loading');
  const empty = f.controller.issueManual(); await f.controller.completeManual(empty, ' \u0085 '); assert.equal(f.state().status, 'invalidQr'); assert.equal(f.state().processing, true); assert.deepEqual(reads(f), ['primary']); pending.resolve(s.report('actual')); await reading; assert.equal(f.state().status, 'reportReady');
});
test('Source concurrent retry may reset processing while lookup remains pending; both original read settlements survive and retain independent report fields', async () => {
  const f = s.fixture(), first = s.deferred(), second = s.deferred(); f.answers.primary = value => value === 'first' ? first.promise : second.promise; f.start(); await s.flush(); const old = f.controller.detectNormalized('first'); await s.flush(); await f.controller.retryScanner(); const newer = f.controller.detectNormalized('second'); await s.flush();
  second.resolve(s.report('second')); await newer; first.resolve(s.report('first')); await old; assert.equal(f.state().report.scanned_batch.batch_id, 'first'); assert.deepEqual(reads(f), ['primary', 'primary']);
});
test('Source overlapping Paddon/Progress responses retain BOTH reports and Paddon renders first even when the later status becomes reportReady', async () => {
  const f = s.fixture(), first = s.deferred(), second = s.deferred(), oldPaddon = s.paddon('12345'), newReport = s.report('new'); f.answers.primary = value => value === '12345' ? first.promise : second.promise; f.answers.paddon = async () => oldPaddon; f.start(); await s.flush();
  const old = f.controller.detectNormalized('12345'); await s.flush(); await f.controller.retryScanner(); const newer = f.controller.detectNormalized('new'); await s.flush(); first.reject(s.apiError()); await old; assert.equal(f.state().paddonReport, oldPaddon); second.resolve(newReport); await newer;
  assert.equal(f.state().status, 'reportReady'); assert.equal(f.state().report, newReport); assert.equal(f.state().paddonReport, oldPaddon); assert.equal(s.lookupModel.adminProgressQrLookupVisibleReport(f.state()), 'paddon');
});
test('Scan Again clears all reports/status/error synchronously and leaves processing until genuine retry settles; late original report may still settle', async () => {
  const f = s.fixture(), pending = s.deferred(), retry = s.deferred(); f.answers.primary = () => pending.promise; f.start(); await s.flush(); const reading = f.controller.detectNormalized('QR'); await s.flush(); f.retry(() => retry.promise); const restarting = f.controller.scanAgain(); assert.equal(f.state().status, 'prompt'); assert.equal(f.state().processing, true); assert.equal(f.state().report, null);
  pending.resolve(s.report('late')); await reading; assert.equal(f.state().report.scanned_batch.batch_id, 'late'); retry.resolve(true); await restarting; assert.equal(f.state().status, 'prompt'); assert.equal(f.state().report.scanned_batch.batch_id, 'late');
});
test('StrictMode cleanup/start and original owner loss fence every pending stop/read/retry and old facade generation without retargeting', async () => {
  for (const boundary of ['stop', 'primary', 'retry']) { const f = s.fixture(), pending = s.deferred(); f.start(); await s.flush(); const generation = f.controller.interactionGeneration;
    if (boundary === 'stop') f.stop(() => pending.promise); if (boundary === 'primary') f.answers.primary = () => pending.promise; if (boundary === 'retry') f.retry(() => pending.promise);
    const running = boundary === 'retry' ? f.controller.retryScanner(generation) : f.controller.detectNormalized('old', generation); await s.flush(); f.controller.detach(); f.start(); await s.flush(); pending.resolve(boundary === 'primary' ? s.report('old') : true); await running;
    assert.equal(f.state().report, null); assert.equal(f.state().status, 'prompt'); const count = f.calls.length; await f.controller.detectNormalized('queued', generation); await f.controller.retryScanner(generation); assert.equal(f.controller.issueManual(generation), null); assert.equal(f.calls.length, count);
  }
});
test('reentrant publication retirement prevents scanner/API/navigation work, and malformed/reentrant focus never retires original reads', async () => {
  const f = s.fixture(); f.start(); await s.flush(); f.controller.subscribe(() => { if (f.state().status === 'loading') f.controller.invalidate(); }); await f.controller.detectNormalized('QR'); assert.equal(f.state().valid, false); assert.equal(f.calls.some(([kind]) => kind === 'stop'), false); assert.deepEqual(reads(f), []);
  const g = s.fixture(); g.start(); await s.flush(); for (const focus of [async () => true, () => { g.controller.canInteract(); return true; }]) { g.focus(focus); await g.controller.detectNormalized('QR'); assert.deepEqual(reads(g), []); assert.equal(g.controller.isCurrent(), true); }
  g.focus(() => true); await g.controller.detectNormalized('fresh'); assert.equal(g.state().status, 'reportReady');
});
test('render observer exceptions cannot manufacture lookup failures or run extra Source fallbacks', async () => {
  const f = s.fixture(); f.start(); await s.flush(); f.controller.subscribe(() => { throw Error('render observer'); }); await f.controller.detectNormalized('12345'); assert.deepEqual(reads(f), ['primary']); assert.equal(f.state().status, 'reportReady'); assert.equal(f.state().processing, false);
});
test('Source synchronous queue dispatch rejection still belongs to the enclosing primary catch, while original navigation guard survives read settlement', async () => {
  const f = s.fixture({ role: 'aparatchi' }); f.replaced(() => { throw Error('route dispatch rejected'); }); f.start(); await s.flush(); await f.controller.detectNormalized('12345'); assert.deepEqual(reads(f), ['primary', 'paddon']); assert.equal(f.state().status, 'paddonReady');
  const g = s.fixture({ role: 'aparatchi' }); g.start(); await s.flush(); await g.controller.detectNormalized('QR'); const guard = g.calls.find(([kind]) => kind === 'queue')[2]; guard(); g.controller.detach(); g.start(); assert.throws(guard, /owner changed/);
});
test('real primary→Paddon→Opening→Raw API chain retains original manual authority through blur and preserves POST epoch vs transient GET retry semantics', async t => {
  const previous = global.fetch; t.after(() => { global.fetch = previous; }); const clock = s.clock(t), calls = [], session = { token: 'token', baseUrl: 'https://erp.example' }; let rawReads = 0, focused = true;
  global.fetch = async (url, init) => { calls.push([String(url), init]);
    if (String(url).includes('/progress-qr/report')) return new Response('{"error":"progress_batch_not_found"}', { status: 404 });
    if (String(url).includes('/paddons/qr/report')) return new Response('{"error":"forbidden"}', { status: 403 });
    if (String(url).includes('/opening-wip/qr/report')) return new Response('{"error":"opening_unavailable"}', { status: 503 });
    rawReads++; return rawReads === 1 ? new Response('{}', { status: 503 }) : new Response('{"barcode":"12345","qty":2.5,"is_metalayzer":true}');
  };
  const primary = require('./adminProgressQrReportApiSupport.cjs').api(s.transport).client, fallback = require('./adminProgressQrFallbackSupport.cjs').api(s.transport), material = s.api(s.transport), before = s.transport.currentQueueSnapshotReadEpoch();
  const controller = new s.controllerModule.AdminProgressQrLookupController({ isCurrent: () => true, canInteract: () => focused, scanner: null,
    primary: (value, guard, witness) => primary.adminProgressQrReport(session, value, guard, witness), paddon: (value, guard, witness) => fallback.adminProgressQrPaddonReport(session, value, guard, witness),
    opening: (value, guard, witness) => fallback.adminProgressQrOpeningWipReport(session, value, guard, witness), material: (value, guard, witness) => material.adminProgressQrMaterialLookup(session, value, guard, witness),
    apparatus: async () => { throw Error('display projection unavailable'); }, returnScan: () => { assert.fail('not a scanOnly route'); }, replaceWorkerQueue: () => { assert.fail('not an aparatchi principal'); } }, false, 'admin');
  controller.start(); const ticket = controller.issueManual(); focused = false; const reading = controller.completeManual(ticket, ' \u0085 12345 \u0085 '); await s.flush(); assert.equal(calls.length, 4); await clock.advance(150); await reading;
  assert.deepEqual(calls.map(([url]) => new URL(url).pathname), ['/v1/mobile/admin/production-maps/progress-qr/report', '/v1/mobile/admin/production-maps/paddons/qr/report', '/v1/mobile/admin/production-maps/opening-wip/qr/report', '/v1/mobile/admin/raw-material-assignments/lookup', '/v1/mobile/admin/raw-material-assignments/lookup']);
  assert.equal(controller.getSnapshot().status, 'materialReady'); assert.equal(controller.getSnapshot().rawMaterialReport.is_metalayzer, true); assert.equal(controller.getSnapshot().rawMaterialReport.qty, 2.5); assert.equal(s.transport.currentQueueSnapshotReadEpoch(), before + 4); assert.equal(controller.isCurrent(), true); assert.equal(controller.canInteract(), false);
});
