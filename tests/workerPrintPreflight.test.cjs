const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

function load(name, mocks = {}) {
  const filename = path.resolve(__dirname, `../src/${name}.ts`);
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = module.paths;
  loaded.require = id => Object.hasOwn(mocks, id) ? mocks[id] : id.startsWith('./') ? load(id.slice(2), mocks) : require(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText, filename);
  return loaded.exports;
}
const scope = load('sessionReadScope');
const controls = load('workerControlsApi', { './authorizedFetch': {}, './sessionReadScope': scope });
const logic = load('workerOrderLogic', { './workerControlsApi': controls });
const hold = { hold_id: 'hold', idempotency_key: 'key', order_id: 'order', apparatus: 'apparatus:default:p', status: 'running', revision: 3 };

test('preflight sends the V2 body including optional identifiers and revision', async () => {
  let sent;
  const api = load('workerPrintPreflight', { './workerOrderLogic': logic, './workerControlsApi': {
    ...controls,
    postWorkerApiRequest: async (...args) => { sent = args; return { hold }; },
  } });
  const session = {};
  const result = await api.adminPrintPreflight(session, { apparatus: hold.apparatus, order_id: 'order', action: 'hold',
    hold_id: ' hold ', idempotency_key: ' key ', expected_revision: 3 });
  assert.equal(sent[1], '/v1/mobile/admin/production-maps/print-preflight');
  assert.deepEqual(sent[2], { apparatus: hold.apparatus, order_id: 'order', action: 'hold', include_control: true,
    hold_id: 'hold', idempotency_key: 'key', expected_revision: 3 });
  assert.equal(sent[5], 'print_preflight_not_ready');
  assert.deepEqual(result, { hold, control_state: null });
});

test('preflight accepts a committed hold but drops malformed optional controls', () => {
  const api = load('workerPrintPreflight', { './workerOrderLogic': logic, './workerControlsApi': controls });
  assert.equal(api.printPreflightResponse({ hold, control_state: { rev: -1 } }).control_state, null);
  assert.throws(() => api.printPreflightResponse({ hold: { ...hold, idempotency_key: '' } }),
    error => error.code === 'print_preflight_invalid_response');
  assert.equal(api.printPreflightHold({ ...hold, status: ' PASSED ', revision: null }).status, 'passed');
  assert.equal(api.printPreflightHold({ ...hold, revision: -1 }), null);
});

function preflightControl() {
  return { apparatus: hold.apparatus, order_id: hold.order_id, rev: 3, epoch: 'epoch', queue_state: 'pending',
    order_control: 'active', stage_states: {}, control: { state: 'pending', allowed_actions: ['start'],
      previous_stage_ready: true, complete_requires_full_report: true, interaction: {
        mode: 'fresh_start', start_materials_mode: 'hidden', material_scan_required: false,
        assigned_materials_display_only: true, material_intake_allowed: true,
        previous_wip_mode: 'not_required', qolip_mode: 'not_required' } } };
}

test('preflight optional authority normalizes the same source control model as bootstrap and queue ACK', () => {
  const api = load('workerPrintPreflight', { './workerControlsApi': controls, './workerOrderLogic': logic });
  const state = preflightControl();
  state.control.allowed_actions = [' start ', 'start'];
  state.control.state = ' PENDING ';
  state.control.previous_stage = ' before ';
  state.stage_states = { ' stage ': ' COMPLETED ', ' ': 'ignored' };
  const result = api.printPreflightResponse({ hold, control_state: state });
  assert.deepEqual(result.control_state.control.allowed_actions, ['start']);
  assert.equal(result.control_state.control.state, 'PENDING');
  assert.equal(result.control_state.control.previous_stage, 'before');
  assert.deepEqual(result.control_state.stage_states, { stage: 'completed' });
  assert.deepEqual(result.hold, hold);
});

test('preflight malformed optional Rezka lineage/report cannot authorize another action or discard the committed hold', () => {
  const api = load('workerPrintPreflight', { './workerControlsApi': controls, './workerOrderLogic': logic });
  for (const patch of [{ rezka_input_lineage: {} }, { rezka_input_lineage: [{ input_batch_id: 'batch', sequence_no: -1, status: 'in_use', source_kind: 'progress_batch' }] },
    { rezka_active_partial_rolls: null }, { rezka_output_kadr_counts: [0] }, { rezka_output_report: {} }]) {
    const state = preflightControl(); Object.assign(state.control, patch);
    const result = api.printPreflightResponse({ hold, control_state: state });
    assert.deepEqual(result.hold, hold); assert.equal(result.control_state, null);
  }
});
