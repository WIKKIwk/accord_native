const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const { contractFetch, loadContract, recordedSession, testNames } = require('./support/contractFetch.cjs');

function load(name, mocks = {}) {
  const filename = path.resolve(__dirname, `../src/${name}.ts`);
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = module.paths;
  loaded.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText, filename);
  return loaded.exports;
}
function setup(stem, name) {
  const replay = contractFetch(stem, name), session = recordedSession(stem, name);
  const auth = { authorizedFetch: (s, p, init, guard) => {
    guard?.();
    return replay(new URL(p, s.baseUrl), { ...init, headers: { ...init.headers, Authorization: `Bearer ${s.token}` } });
  } };
  const controls = load('workerControlsApi', { './authorizedFetch': auth, './sessionReadScope': load('sessionReadScope') });
  const logic = load('workerOrderLogic', { './workerControlsApi': controls });
  const batch = load('workerProgressBatch', { './workerControlsApi': controls, './workerProgressModel': load('workerProgressModel') });
  const models = load('workerQueueModels', { './workerControlsApi': controls });
  const print = load('workerPrintJob', { './workerControlsApi': controls });
  const rezka = load('workerRezkaReport');
  return { replay, session, api: load('workerQueueAction', { './workerControlsApi': controls, './workerOrderLogic': logic,
    './workerProgressBatch': batch, './workerQueueModels': models, './workerPrintJob': print, './workerRezkaReport': rezka,
    './workerPrintPreflight': {} }), models, print, rezka, controls };
}
const station = 'apparatus:default:bosma_7', order = 'zakaz-scan-bootstrap';

// @v2-test test/admin_queue_action_cursor_test.dart
for (const name of testNames('admin_queue_action_cursor_test').filter(name => name.startsWith('queue ACK'))) {
  test(`queue action replays V2 ${name}`, async () => {
    const { api, replay, session } = setup('admin_queue_action_cursor_test', name);
    const records = loadContract('admin_queue_action_cursor_test').filter(record => record.test === name);
    for (const record of records) {
      const body = JSON.parse(record.requestBody.text), payload = JSON.parse(record.responseBody.text);
      const result = await api.adminApparatusQueueActionResult(session, body);
      assert.equal(result.states[order], 'in_progress');
      assert.equal(result.has_states, true);
      assert.equal(result.has_snapshot_cursor, Number.isInteger(payload.rev) && payload.rev >= 0 && typeof payload.epoch === 'string' && !!payload.epoch.trim());
      assert.equal(result.has_order_status, false);
      if (name.includes('opt-in')) assert.equal(result.control_state !== null, payload.control_state?.queue_state === 'pending');
    }
    replay.assertDone();
  });
}

test('automatic confirmation replays V2 start and resume without QR fields', async () => {
  const stem = 'qolip_start_settings_api_test', name = 'automatic start and resume send confirmation without inventing QR scans';
  const { api, replay, session } = setup(stem, name);
  const confirmation = { method: 'automatic', set_id: '950100000001', fingerprint: 'a'.repeat(64), policy_revision: 3 };
  for (const action of ['start', 'resume']) {
    await api.adminApparatusQueueActionResult(session, { apparatus: station, order_id: order, action, qolip_confirmation: confirmation });
  }
  replay.assertDone();
});

test('queue action applies V2 field trimming, omissions and transport normalization', () => {
  const { api } = setup('admin_queue_action_cursor_test', 'queue ACK optional cursor {} preserves committed payload');
  const body = api.queueActionBody({ apparatus: ` ${station} `, order_id: ' order ', action: 'start',
    include_control: true, material_barcodes: [' R1 ', '', 'R2'], material_barcode: 'ignored',
    qolip_codes: [' A ', 'a', ' B '], qolip_code: 'ignored', returned_paint_items: [],
    driver_url: ' http://printer/// ', printer: ' label ', print_transport: 'bluetooth', total_waste: 0 });
  assert.deepEqual(body, { apparatus: ` ${station} `, order_id: ' order ', action: 'start', include_control: true,
    material_barcodes: ['R1', 'R2'], qolip_codes: ['A', 'B'], driver_url: 'http://printer', printer: 'label',
    print_transport: 'offline', total_waste: 0 });
});

test('queue action rejects invalid automatic confirmation and freeze without a reason', () => {
  const { api } = setup('admin_queue_action_cursor_test', 'queue ACK optional cursor {} preserves committed payload');
  assert.throws(() => api.queueActionBody({ apparatus: station, order_id: order, action: 'freeze' }),
    error => error.code === 'freeze_action_requires_issue');
  assert.throws(() => api.queueActionBody({ apparatus: station, order_id: order, action: 'start', freeze_with_issue: true, issue_note: 'bad' }),
    error => error.code === 'freeze_with_issue_only_on_freeze');
  assert.throws(() => api.queueActionBody({ apparatus: station, order_id: order, action: 'start', qolip_codes: ['M1'],
    qolip_confirmation: { method: 'automatic', set_id: 'set', fingerprint: 'a'.repeat(64), policy_revision: 1 } }),
  error => error.code === 'qolip_automatic_confirmation_invalid');
});

test('a response without states keeps only V2 acknowledged status fields', () => {
  const { api } = setup('admin_queue_action_cursor_test', 'queue ACK optional cursor {} preserves committed payload');
  const result = api.parseQueueActionResponse({ rev: 9, epoch: 'server', progress_batch: { batch_id: 'roll' }, order_control: { state: 'active' } });
  assert.deepEqual(result.states, {});
  assert.equal(result.has_snapshot_cursor, false);
  assert.equal(result.has_states, false);
  assert.equal(result.progress_batch, null);
  assert.equal(result.order_control.state, 'active');
});

test('queue acknowledgement distinguishes an empty states map from absent or invalid states', () => {
  const { api } = setup('admin_queue_action_cursor_test', 'queue ACK optional cursor {} preserves committed payload');
  const acknowledged = api.parseQueueActionResponse({ states: {}, rev: 9, epoch: 'server' });
  assert.equal(acknowledged.has_states, true);
  assert.equal(acknowledged.has_snapshot_cursor, true);
  for (const states of [undefined, null, [], false, 'in_progress']) {
    const result = api.parseQueueActionResponse({ states, rev: 9, epoch: 'server' });
    assert.equal(result.has_states, false);
    assert.equal(result.has_snapshot_cursor, false);
  }
});

test('queue activity and completion models follow the V2 ownership and defaults', () => {
  const { api, models } = setup('admin_queue_action_cursor_test', 'queue ACK optional cursor {} preserves committed payload');
  const result = api.parseQueueActionResponse({ states: {}, work_activity: { worker_role: ' aparatchi ', worker_ref: ' worker ', state: ' paused ' },
    order_status: { work_status: 'working', completed_with_issue_count: 2.8 }, completion_request: { apparatus: station, event_id: 'event' } });
  assert.deepEqual(result.work_activity, { worker_role: 'aparatchi', worker_ref: 'worker', state: 'paused' });
  assert.equal(result.has_work_activity, true);
  assert.equal(result.order_status.completed_with_issue_count, 2);
  assert.equal(result.completion_request.notice_kind, 'completion_request');
  assert.equal(result.completion_request.decision_required, true);
  assert.equal(models.queueWorkActivity({ worker_role: 'aparatchi', worker_ref: '', state: 'paused' }), null);
});

test('queue print jobs retain their own V2 batch completion timestamps', async () => {
  const stem = 'worker_wip_completion_print_test', name = 'queue labels keep each WIP completion time through saved Bluetooth jobs';
  const { api, replay, session, print } = setup(stem, name);
  const result = await api.adminApparatusQueueActionResult(session, { apparatus: station, order_id: order,
    action: 'complete', print_transport: 'bluetooth' });
  assert.deepEqual(result.print_jobs.map(job => job.completed_at_unix), [1792210320, 1792316220]);
  assert.equal(result.print_job.completed_at_unix, 1792316220);
  for (const job of result.print_jobs) {
    const saved = print.printJobToJson(job);
    assert.equal(print.printJobFromJson(saved).completed_at_unix, job.completed_at_unix);
    assert.equal(saved.order_code, 'WORK-42');
  }
  replay.assertDone();
});

for (const name of ['single roll save carries cycle and slot and restores authoritative fields',
  'individual issue sends only note and restores a locked slot without QR']) {
  test(`queue action replays V2 rezka report: ${name}`, async () => {
    const stem = 'rezka_output_report_api_test';
    const { api, replay, session, rezka } = setup(stem, name);
    const record = loadContract(stem).find(item => item.test === name);
    const result = await api.adminApparatusQueueActionResult(session, JSON.parse(record.requestBody.text));
    assert.equal(result.rezka_output_report.cycle_id, 'cycle-1');
    assert.equal(rezka.rezkaFrameAt(result.rezka_output_report, 0), null);
    const frame = rezka.rezkaFrameAt(result.rezka_output_report, 1);
    assert.equal(frame.qr_payload, name.startsWith('single roll') ? 'QR-2' : '');
    assert.equal(rezka.rezkaFrameIssueNote(frame), name.startsWith('single roll') ? '' : 'Kadr yirtilgan');
    assert.deepEqual(result.print_jobs, []);
    replay.assertDone();
  });
}

test('rezka reports reject hybrid, duplicate and unresolved frame authority', () => {
  const { rezka } = setup('admin_queue_action_cursor_test', 'queue ACK optional cursor {} preserves committed payload');
  const issue = { frame_index: 1, batch_id: '', qr_payload: '', input: { issue_note: 'Kadr yirtilgan' } };
  assert.equal(rezka.rezkaReportFromJson({ cycle_id: 'cycle', frames: [issue, { ...issue, frame_index: 2 }] }).frames.length, 2);
  for (const invalid of [
    { ...issue, batch_id: 'roll', qr_payload: 'QR' },
    { ...issue, input: { issue_note: ' ' } },
    { ...issue, input: { issue_note: 7 } },
  ]) assert.equal(rezka.rezkaReportFromJson({ cycle_id: 'cycle', frames: [invalid] }), null);
  assert.equal(rezka.rezkaReportFromJson({ cycle_id: 'cycle', frames: [issue, issue] }), null);
  assert.equal(rezka.rezkaReportFromJson({ cycle_id: 'cycle', frames: [issue], reference_frame_index: 1 }), null);
});

test('queue ACK control decodes V2 normalized actions and rejects malformed rezka authority', () => {
  const stem = 'admin_queue_action_cursor_test';
  const name = 'queue ACK opt-in control tolerates legacy/malformed presentation: 0';
  const { api } = setup(stem, name);
  const control = JSON.parse(loadContract(stem).find(record => record.test === name).responseBody.text).control_state;
  control.control.allowed_actions = ['start', ' start '];
  control.control.state = ' PENDING ';
  control.control.interaction.mode = ' fresh_start ';
  control.stage_states = { ' stage ': ' COMPLETED ' };
  const parsed = api.queueActionControlState(control);
  assert.deepEqual(parsed.control.allowed_actions, ['start']);
  assert.equal(parsed.control.state, 'PENDING');
  assert.deepEqual(parsed.stage_states, { stage: 'completed' });
  for (const patch of [
    { rezka_input_lineage: null },
    { rezka_input_lineage: [{ input_batch_id: 'r1', sequence_no: 1, status: 'in_use', source_kind: 'unknown' }] },
    { rezka_active_partial_rolls: [{ slot_index: 1, generation: 1, contained_kadr_count: 1, status: 'active', source_input_batch_ids: ['missing'] }] },
    { rezka_output_kadr_counts: [0] },
    { rezka_output_report: { cycle_id: 'cycle', frames: [{ frame_index: 1, batch_id: 'r1', qr_payload: 'q', input: {} }] } },
  ]) {
    assert.equal(api.queueActionControlState({ ...control, control: { ...control.control, ...patch } }), null);
  }
});

test('training output prepares a local print job from its batch when none is returned', () => {
  const { api } = setup('admin_queue_action_cursor_test', 'queue ACK optional cursor {} preserves committed payload');
  const result = api.parseQueueActionResponse({ states: { 'training-order': 'completed' }, progress_batches: [{
    batch_id: 'roll', order_id: 'training-order', apparatus: station, qr_payload: 'QR', produced_qty: 90, uom: 'm',
    bobina_kg: 2, finished_goods_kg: 10, executor_name: 'Worker', completed_at_unix: 123,
  }], prints: [] }, { order_id: 'training-order', print_transport: 'bluetooth', printer: '', print_mode: '' });
  assert.equal(result.print_jobs.length, 1);
  assert.equal(result.print_job.epc, 'QR');
  assert.equal(result.print_job.gross_qty, 10);
  assert.equal(result.print_job.tare_kg, 2);
  assert.equal(result.print_job.completed_at_unix, 123);
});

test('queue action binds reclose authority to the session that read it', async () => {
  const stem = 'admin_queue_action_cursor_test';
  const name = 'queue ACK opt-in control tolerates legacy/malformed presentation: 0';
  const { api, session, controls } = setup(stem, name);
  session.profile = { role: 'aparatchi', ref: 'worker' };
  session.assigned_apparatus = [station];
  const controlState = JSON.parse(loadContract(stem).find(record => record.test === name).responseBody.text).control_state;
  controlState.control.reclose = { session_id: 'run', stage_node_id: 'stage', token: 'a'.repeat(64),
    worker_role: 'aparatchi', worker_ref: 'worker', readScope: 'untrusted server value' };
  const result = api.parseQueueActionResponse({ states: {}, control_state: controlState }, {}, session);
  const authority = result.control_state.control.reclose;
  const originalScope = load('sessionReadScope').sessionReadScope(session);
  assert.equal(authority.readScope, originalScope);
  session.assigned_apparatus = [];
  const rechecked = controls.reactivationRecloseControl(authority, session);
  assert.equal(rechecked.readScope, originalScope);
  await assert.rejects(controls.adminRecloseReactivatedWork(session, station, order, rechecked),
    error => error.code === 'queue_action_not_allowed');
});
