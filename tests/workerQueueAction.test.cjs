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
  return { replay, session, api: load('workerQueueAction', { './workerControlsApi': controls, './workerOrderLogic': logic,
    './workerProgressBatch': batch, './workerQueueModels': models }), models };
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
  assert.equal(result.progress_batch, undefined);
  assert.equal(result.order_control.state, 'active');
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
