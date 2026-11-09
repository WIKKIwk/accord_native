const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const { contractFetch, loadContract, recordedSession } = require('./support/contractFetch.cjs');

function load(name, mocks = {}) {
  const filename = path.resolve(__dirname, `../src/${name}.ts`);
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = module.paths;
  loaded.require = id => Object.hasOwn(mocks, id) ? mocks[id] : id === 'expo/fetch' ? require('./support/expoFetch.cjs') : require(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText, filename);
  return loaded.exports;
}

const scope = load('sessionReadScope');
function setup(stem, name, ref = 'worker') {
  const replay = stem === 'work_reactivation_api_test'
    ? contractFetch('work_reactivation_api_test', name) : contractFetch(stem, name);
  const session = Object.assign(recordedSession(stem, name), {
    profile: { role: 'aparatchi', ref }, capabilities: ['apparatus.queue.manage'],
    assigned_apparatus: [], assigned_apparatus_labels: [], imageCacheScope: 'fixture',
  });
  const api = load('workerControlsApi', {
    './sessionReadScope': scope,
    './authorizedFetch': { authorizedFetch: (s, p, init, guard) => {
      guard?.();
      return replay(new URL(p, s.baseUrl), { ...init, headers: { ...init.headers, Authorization: `Bearer ${s.token}` } });
    } },
  });
  const record = loadContract(stem).find(item => item.test === name);
  return { api, session, replay, body: JSON.parse(record.requestBody.text) };
}

// @v2-test test/temporary_pause_api_test.dart
test('temporary pause replays the V2 authority-only command', async () => {
  const f = setup('temporary_pause_api_test', 'temporary pause sends session authority without output or print data');
  await f.api.adminTemporarilyPauseWork(f.session, f.body.apparatus, f.body.order_id, f.body);
  f.replay.assertDone();
});

for (const status of [409, 500, 200]) {
  test(`temporary pause does not replay an unsuccessful V2 response (${status})`, async () => {
    const f = setup('temporary_pause_api_test', `temporary pause uncertain or malformed response is not replayed: ${status}`);
    await assert.rejects(f.api.adminTemporarilyPauseWork(f.session, f.body.apparatus, f.body.order_id, f.body),
      error => error.code === 'queue_action_not_allowed');
    f.replay.assertDone();
  });
}

test('temporary pause does not retry a lost response', async () => {
  const f = setup('temporary_pause_api_test', 'temporary pause lost response never retries the write');
  await assert.rejects(f.api.adminTemporarilyPauseWork(f.session, f.body.apparatus, f.body.order_id, f.body));
  f.replay.assertDone();
});

// @v2-test test/cancel_start_api_test.dart
test('cancel start replays the V2 command and rejects a different worker', async () => {
  const f = setup('cancel_start_api_test', 'cancel sends only scoped session authority, without output data');
  const control = { ...f.body, worker_ref: 'worker', previous_state: 'pending' };
  await assert.rejects(f.api.adminCancelStartedWork(f.session, f.body.apparatus, f.body.order_id,
    { ...control, worker_ref: 'another' }), error => error.code === 'queue_action_not_allowed');
  await f.api.adminCancelStartedWork(f.session, f.body.apparatus, f.body.order_id, control);
  f.replay.assertDone();
});

// @v2-test test/resume_re_pause_api_test.dart
test('re-pause replays the V2 identity and resume ID', async () => {
  const f = setup('resume_re_pause_api_test', 're-pause command sends only identity and the expected resume');
  await f.api.adminRePauseResumedWork(f.session, f.body.apparatus, f.body.order_id, f.body.resume_id);
  f.replay.assertDone();
});

for (const status of [409, 500]) {
  test(`re-pause does not retry a failed V2 write (${status})`, async () => {
    const f = setup('resume_re_pause_api_test', `re-pause failed writes are not replayed or replaced with output: ${status}`);
    await assert.rejects(f.api.adminRePauseResumedWork(f.session, f.body.apparatus, f.body.order_id, f.body.resume_id));
    f.replay.assertDone();
  });
}

// @v2-test test/work_reactivation_reclose_api_test.dart
test('reclose replays only the V2 execution identity', async () => {
  const f = setup('work_reactivation_reclose_api_test', 'reclose sends only exact execution identity without production metrics', 'reclose-worker');
  const control = f.api.reactivationRecloseControl({ ...f.body, worker_role: 'aparatchi', worker_ref: 'reclose-worker' }, f.session);
  assert.ok(control);
  await f.api.adminRecloseReactivatedWork(f.session, f.body.apparatus, f.body.order_id, control);
  f.replay.assertDone();
});

for (const status of [409, 500, 200]) {
  test(`reclose does not replay an unsuccessful V2 response (${status})`, async () => {
    const f = setup('work_reactivation_reclose_api_test', `reclose failure is not replayed: ${status}`, 'reclose-worker');
    const control = f.api.reactivationRecloseControl({ ...f.body, worker_role: 'aparatchi', worker_ref: 'reclose-worker' }, f.session);
    await assert.rejects(f.api.adminRecloseReactivatedWork(f.session, f.body.apparatus, f.body.order_id, control));
    f.replay.assertDone();
  });
}

test('reclose does not replay a lost response', async () => {
  const f = setup('work_reactivation_reclose_api_test', 'lost reclose response is not replayed', 'reclose-worker');
  const control = f.api.reactivationRecloseControl({ ...f.body, worker_role: 'aparatchi', worker_ref: 'reclose-worker' }, f.session);
  await assert.rejects(f.api.adminRecloseReactivatedWork(f.session, f.body.apparatus, f.body.order_id, control));
  f.replay.assertDone();
});

test('control parsing preserves V2 authority validation and normalization', () => {
  const api = load('workerControlsApi', { './sessionReadScope': scope, './authorizedFetch': {} });
  const token = 'a'.repeat(64);
  assert.deepEqual(api.temporaryPauseControl({ session_id: 's', token }), { session_id: 's', token });
  for (const raw of [{}, { session_id: ' s ', token }, { session_id: 's', token: 'z'.repeat(64) },
    { session_id: 's'.repeat(513), token }]) assert.equal(api.temporaryPauseControl(raw), null);
  assert.equal(api.cancelStartControl({ session_id: 's', token, worker_ref: ' worker ', previous_state: 'pending' }), null);
  assert.equal(api.cancelStartControl({ session_id: 's', token, worker_ref: 'worker', previous_state: 'in_progress' }), null);
  assert.deepEqual(api.resumePauseControl({ resume_id: ' r ', worker_role: 'aparatchi', worker_ref: ' w ' }),
    { resume_id: 'r', worker_role: 'aparatchi', worker_ref: 'w' });
  assert.equal(api.resumePauseControl({ resume_id: 'r', worker_role: 'admin', worker_ref: 'w' }), null);
  assert.equal(api.isCanonicalApparatusId(' apparatus:default:bosma_7 '), true);
  for (const value of ['Bosma', 'apparatus::x', 'apparatus:default:X', 'apparatus:default:a b']) {
    assert.equal(api.isCanonicalApparatusId(value), false);
  }
});

test('scope changes block a pending pause and an old reclose authority', async () => {
  let resolveResponse, writes = 0;
  const api = load('workerControlsApi', {
    './sessionReadScope': scope,
    './authorizedFetch': { authorizedFetch: async () => { writes++; return new Promise(resolve => { resolveResponse = resolve; }); } },
  });
  const session = { baseUrl: 'https://example.test', profile: { role: 'aparatchi', ref: 'worker' },
    capabilities: ['apparatus.queue.manage'], assigned_apparatus: ['apparatus:default:p'], assigned_apparatus_labels: [] };
  const token = 'a'.repeat(64);
  const authority = api.reactivationRecloseControl({ session_id: 's', stage_node_id: 'stage', token,
    worker_role: 'aparatchi', worker_ref: 'worker' }, session);
  const pending = api.adminTemporarilyPauseWork(session, 'apparatus:default:p', 'order', { session_id: 's', token });
  await Promise.resolve();
  session.assigned_apparatus = ['apparatus:default:other'];
  resolveResponse({ status: 200, json: async () => ({ ok: true }) });
  await assert.rejects(pending, error => error.code === 'session_scope_changed');
  await assert.rejects(api.adminRecloseReactivatedWork(session, 'apparatus:default:p', 'order', authority),
    error => error.code === 'queue_action_not_allowed');
  assert.equal(writes, 1);
});

test('an account change before sending blocks re-pause', async () => {
  let writes = 0;
  const api = load('workerControlsApi', {
    './sessionReadScope': scope,
    './authorizedFetch': { authorizedFetch: async () => { writes++; return { status: 200, json: async () => ({ ok: true }) }; } },
  });
  const session = { baseUrl: 'https://example.test', profile: { role: 'aparatchi', ref: 'worker' },
    capabilities: [], assigned_apparatus: [], assigned_apparatus_labels: [] };
  const pending = api.adminRePauseResumedWork(session, 'apparatus:default:p', 'order', 'resume');
  session.profile.ref = 'other';
  await assert.rejects(pending, error => error.code === 'session_scope_changed');
  assert.equal(writes, 0);
});

test('a 401 refresh cannot retry a command after its authorization scope changes', async () => {
  const session = { baseUrl: 'https://example.test', token: 'old', profile: { role: 'aparatchi', ref: 'worker' },
    capabilities: [], assigned_apparatus: ['apparatus:default:p'], assigned_apparatus_labels: [] };
  const before = scope.sessionReadScope(session);
  const client = load('authorizedFetch', { './auth': {
    activeSessionToken: current => current.token,
    refreshSession: async current => { current.token = 'new'; current.assigned_apparatus = []; return true; },
  } });
  const original = global.fetch;
  let calls = 0;
  global.fetch = async () => { calls++; return new Response('', { status: 401 }); };
  try {
    await assert.rejects(client.authorizedFetch(session, '/v1/mobile/admin/production-maps/temporary-pause',
      { method: 'POST' }, () => { if (scope.sessionReadScope(session) !== before) throw new Error('scope changed'); }), /scope changed/);
    assert.equal(calls, 1);
  } finally { global.fetch = original; }
});

// @v2-test test/work_reactivation_api_test.dart
for (const batch of ['', 'batch-exact']) {
  test(`reactivation replays the exact V2 preview and target: ${batch}`, async () => {
    const f = setup('work_reactivation_api_test', `reactivation retains exact preview identity and token: ${batch}`, 'reactivate-worker');
    const preview = await f.api.adminWorkReactivationPreview(f.session, f.body.apparatus, f.body.order_id, batch);
    assert.equal(preview.available, true);
    assert.equal(preview.target.stage_node_id, 'repeat-stage-2');
    await f.api.adminReactivateCompletedWork(f.session, preview.target);
    f.replay.assertDone();
  });
}

for (const reason of ['apparatus_busy', 'source_not_free', 'final_stage_closed', 'resource_unavailable', 'order_closed', 'unsupported_history']) {
  test(`reactivation denial never yields authority: ${reason}`, async () => {
    const f = setup('work_reactivation_api_test', `reactivation denial cannot yield executable target: ${reason}`, 'reactivate-worker');
    const preview = await f.api.adminWorkReactivationPreview(f.session, f.body.apparatus, f.body.order_id);
    assert.deepEqual(preview, { available: false, denial_reason: reason, target: null });
    f.replay.assertDone();
  });
}

for (const name of [...new Set(loadContract('work_reactivation_api_test').map(record => record.test))]
  .filter(name => name.startsWith('reactivation fails closed on malformed or substituted target:'))) {
  test(name, async () => {
    const f = setup('work_reactivation_api_test', name, 'reactivate-worker');
    await assert.rejects(f.api.adminWorkReactivationPreview(f.session, f.body.apparatus, f.body.order_id));
    f.replay.assertDone();
  });
}

for (const status of [409, 500]) {
  test(`reactivation does not replay a failed write (${status})`, async () => {
    const f = setup('work_reactivation_api_test', `reactivation write failure is not replayed: ${status}`, 'reactivate-worker');
    const preview = await f.api.adminWorkReactivationPreview(f.session, f.body.apparatus, f.body.order_id);
    await assert.rejects(f.api.adminReactivateCompletedWork(f.session, preview.target));
    f.replay.assertDone();
  });
}

test('reactivation target cannot be used after an account switch', async () => {
  const f = setup('work_reactivation_api_test', 'reactivation target is bound to preview account', 'reactivate-worker');
  const preview = await f.api.adminWorkReactivationPreview(f.session, f.body.apparatus, f.body.order_id);
  f.session.profile.ref = 'other';
  await assert.rejects(f.api.adminReactivateCompletedWork(f.session, preview.target), error => error.code === 'reactivation_unavailable');
  f.replay.assertDone();
});

test('reactivation discards a preview returned after the authorization scope changes', async () => {
  let finish;
  const api = load('workerControlsApi', {
    './sessionReadScope': scope,
    './authorizedFetch': { authorizedFetch: async () => new Promise(resolve => { finish = resolve; }) },
  });
  const session = { baseUrl: 'https://example.test', profile: { role: 'aparatchi', ref: 'worker' },
    capabilities: [], assigned_apparatus: [], assigned_apparatus_labels: [] };
  const pending = api.adminWorkReactivationPreview(session, 'apparatus:default:p', 'order');
  await Promise.resolve();
  session.profile.ref = 'other';
  finish({ status: 200, json: async () => ({ available: false, denial_reason: 'order_closed' }) });
  await assert.rejects(pending, error => error.code === 'session_scope_changed');
});

// @v2-test test/bosma_astatka_api_test.dart
for (const name of [
  'bosma astatka sends only standalone report endpoint and validates response',
  'bosma astatka keeps legacy metrics compatible',
]) {
  test(name, async () => {
    const f = setup('bosma_astatka_api_test', name);
    const report = await f.api.adminBosmaAstatkaReport(f.session, f.body);
    assert.equal(report.report_id, name.includes('legacy') ? 'legacy-1' : 'astatka-1');
    f.replay.assertDone();
  });
}

test('bosma astatka never retries a rejected report or sends invalid waste', async () => {
  const name = 'bosma astatka backend rejection never falls back to complete or pause';
  const f = setup('bosma_astatka_api_test', name);
  await assert.rejects(f.api.adminBosmaAstatkaReport(f.session, { ...f.body, total_waste: -1 }),
    error => error.code === 'progress_input_invalid');
  await assert.rejects(f.api.adminBosmaAstatkaReport(f.session, f.body), error => error.code === 'order_not_started');
  f.replay.assertDone();
});

// @v2-test test/order_alert_button_test.dart
for (const kind of ['rawMaterial', 'qolip']) {
  test(`order alert replays the V2 request: ${kind}`, async () => {
    const f = setup('order_alert_button_test', `order alert OrderAlertKind.${kind} sends directly without resource selection`);
    await f.api.sendOrderAlert(f.session, { ...f.body, kind });
    f.replay.assertDone();
  });
}

test('order alert exposes the no-recipient failure', async () => {
  const f = setup('order_alert_button_test', 'no recipient is displayed as an error');
  await assert.rejects(f.api.sendOrderAlert(f.session, { ...f.body, kind: 'rawMaterial' }),
    error => error.code === 'order_alert_no_recipients' && error.message === 'Xabar yuboriladigan faol xodim topilmadi');
  f.replay.assertDone();
});

test('order alert keeps the request ID when the caller retries', async () => {
  const f = setup('order_alert_button_test', 'failed delivery retries with the same ID and never claims success early');
  const input = { ...f.body, kind: 'qolip' };
  await assert.rejects(f.api.sendOrderAlert(f.session, input), error => error.code === 'order_alert_send_failed');
  await f.api.sendOrderAlert(f.session, input);
  f.replay.assertDone();
});

test('mutations advance the shared snapshot read epoch before and after the request', async () => {
  const session = { baseUrl: 'https://example.test', token: 'token' };
  const client = load('authorizedFetch', { './auth': { activeSessionToken: s => s.token, refreshSession: async () => false } });
  const original = global.fetch;
  let release;
  global.fetch = () => new Promise(resolve => { release = resolve; });
  try {
    const before = client.currentQueueSnapshotReadEpoch();
    const pending = client.authorizedFetch(session, '/v1/mobile/admin/test', { method: 'POST' });
    assert.equal(client.currentQueueSnapshotReadEpoch(), before + 1);
    release(new Response('{}', { status: 200 }));
    await pending;
    assert.equal(client.currentQueueSnapshotReadEpoch(), before + 2);
  } finally { global.fetch = original; }
});
