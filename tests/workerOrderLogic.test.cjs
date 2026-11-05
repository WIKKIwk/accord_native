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
  loaded.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return loaded.exports;
}
const scope = load('sessionReadScope');
const controls = load('workerControlsApi', { './authorizedFetch': {}, './sessionReadScope': scope });
const { validOrderControl, matchesMaterialAssignment, materialStartReadiness, returnedPaintItemsFromDraft, automaticQolipConfirmation, preflightFreezeRequest, runningFreezeRequest } = load('workerOrderLogic', { './workerControlsApi': controls });

function interaction(mode) {
  return { mode, start_materials_mode: 'hidden', material_scan_required: false, assigned_materials_display_only: false,
    material_intake_allowed: false, previous_wip_mode: 'not_required', opening_wip_mode: 'not_required',
    qolip_mode: 'not_required', resume_input_required: false };
}
function control(state, allowed, mode) {
  return { state, allowed_actions: allowed, previous_stage_ready: false, complete_requires_full_report: false, interaction: interaction(mode) };
}
function bootstrap() {
  return { ok: true, control_state: { apparatus: 'press', order_id: 'order', epoch: 'epoch', scope: 'scope', rev: 12,
    order_control: 'active', queue_state: 'pending', control: control('pending', ['start'], 'fresh_start') } };
}

test('control is scoped, current and cannot authorize frozen or inconsistent work', () => {
  const current = bootstrap();
  assert.equal(validOrderControl(current, 'press', 'order', { epoch: 'epoch', rev: 12 }), true);
  assert.equal(validOrderControl(current, 'press', 'other', { epoch: 'epoch', rev: 12 }), false);
  assert.equal(validOrderControl(current, 'press', 'order', { epoch: 'epoch', rev: 13 }), false);
  assert.equal(validOrderControl(current, 'press', 'order', { epoch: 'old-epoch', rev: 1 }), false);
  const inconsistent = bootstrap(); inconsistent.control_state.queue_state = 'paused';
  assert.equal(validOrderControl(inconsistent, 'press', 'order', null), false);
  const frozen = bootstrap(); frozen.control_state.order_control = 'frozen';
  assert.equal(validOrderControl(frozen, 'press', 'order', null), false);
  frozen.control_state.queue_state = 'frozen'; frozen.control_state.control.state = 'frozen'; frozen.control_state.control.interaction.mode = 'frozen'; frozen.control_state.control.allowed_actions = [];
  assert.equal(validOrderControl(frozen, 'press', 'order', null), true);
});

test('V2 contract rejects missing resume input requirement and incomplete interaction data', () => {
  const current = bootstrap();
  current.control_state.queue_state = 'paused';
  current.control_state.control = control('paused', ['resume'], 'paused');
  assert.equal(validOrderControl(current, 'press', 'order', null), true);
  delete current.control_state.control.interaction.resume_input_required;
  assert.equal(validOrderControl(current, 'press', 'order', null), false);
  current.control_state.control.interaction.resume_input_required = false;
  delete current.control_state.control.interaction.material_intake_allowed;
  assert.equal(validOrderControl(current, 'press', 'order', null), false);
});

test('V2 material readiness requires delivery and scans before start', () => {
  const mode = { start_materials_mode: 'scan_required' };
  const data = { policy: 'state_all', requires_material: true, assignments_satisfied: true, assigned_barcodes: ['A'], staged_barcodes: [], scan_satisfied: false };
  const section = { status: 'ready', data };
  assert.equal(materialStartReadiness(mode, section).ready, false);
  assert.equal(materialStartReadiness(mode, section).reason, 'Apparat oldiga homashyo olib kelinmagan');
  data.staged_barcodes = ['A'];
  assert.equal(materialStartReadiness(mode, section).ready, false);
  data.scan_satisfied = true;
  assert.equal(materialStartReadiness(mode, section).ready, true);
  data.assignments_satisfied = false;
  data.assignments = [{ barcode: 'A', execution_status: 'width_mismatch', roll_width_mm: 50 }];
  assert.match(materialStartReadiness(mode, section, 60).reason, /50 mm.*60 mm/);
});

test('material assignment uses canonical apparatus and the current order', () => {
  const row = { order_id: 'order', apparatus_id: 'press', apparatus: 'old display name' };
  assert.equal(matchesMaterialAssignment(row, 'order', 'press'), true);
  assert.equal(matchesMaterialAssignment(row, 'other', 'press'), false);
  assert.equal(matchesMaterialAssignment(row, 'order', 'old display name'), false);
  delete row.apparatus_id;
  assert.equal(matchesMaterialAssignment(row, 'order', 'old display name'), true);
});

test('paint report preserves V2 Mix, Pantone, color and usage names', () => {
  const draft = { 'rasxot:Mix:Batch A': '1,5', 'rasxot:Pantone:Blue': '2', 'rasxot:Pantone Mix:Special': '3', 'astatka:Oq:1w Oq': '0,4' };
  const dynamic = { 'rasxot:Mix': ['Batch A'], 'rasxot:Pantone': ['Blue'], 'rasxot:Pantone Mix': ['Special'] };
  assert.deepEqual(returnedPaintItemsFromDraft(draft, dynamic), [
    { usage: 'rasxot', category: 'colors', name: 'Mix', values: { 'Batch A': '1.5' } },
    { usage: 'rasxot', category: 'colors', name: 'Pantone', values: { Blue: '2' } },
    { usage: 'rasxot', category: 'colors', name: 'Mix', values: { Special: '3' } },
    { usage: 'astatka', category: 'colors', name: 'Oq', values: { '1w Oq': '0.4' } },
  ]);
});

function molds() {
  return { qolip_code: '', automatic_confirmation_enabled: true, policy_revision: 3, blocking_reason_code: '',
    required_qolip_count: 2, required_qolip_codes: ['A', 'B'], required_qolips: [
      { qolip_code: 'A', qolip_set_id: 'set-1', color: 'red', is_extension: false, ready: true, blocking_reason_code: '' },
      { qolip_code: 'B', qolip_set_id: 'set-1', color: 'black', is_extension: true, ready: true, blocking_reason_code: '' },
    ], sets: [{ set_id: 'set-1', fingerprint: 'a'.repeat(64), ready: true, blocking_reason_code: '' }] };
}

test('automatic molds require the exact policy, set fingerprint and ready members', () => {
  const data = molds();
  const interaction = { qolip_policy_revision: 3 };
  assert.deepEqual(automaticQolipConfirmation(data, interaction, ''), { method: 'automatic', set_id: 'set-1', fingerprint: 'a'.repeat(64), policy_revision: 3 });
  assert.equal(automaticQolipConfirmation(data, { qolip_policy_revision: 4 }, ''), null);
  data.required_qolips[1].ready = false;
  assert.equal(automaticQolipConfirmation(data, interaction, ''), null);
  data.required_qolips[1].ready = true; data.sets[0].fingerprint = 'bad';
  assert.equal(automaticQolipConfirmation(data, interaction, ''), null);
  data.sets[0].fingerprint = 'a'.repeat(64); data.required_qolip_codes[0] = 'another';
  assert.equal(automaticQolipConfirmation(data, interaction, ''), null);
});

test('preflight freeze requires the pending request and exact apparatus', () => {
  assert.equal(preflightFreezeRequest(bootstrap().control_state, 'press', 'order'), null);
  const state = bootstrap().control_state;
  state.order_control = 'freeze_requested'; state.queue_state = 'print_preflight';
  state.control = { ...control('print_preflight', ['freeze'], 'freeze_requested'),
    print_preflight: { hold_id: 'hold', idempotency_key: 'hold', order_id: 'order', apparatus: 'press', status: 'running', revision: 1 },
    freeze_request: { request_id: 'request', status: 'pending', scope: 'order', target_apparatus: 'press', target_session_id: '' } };
  assert.equal(validOrderControl({ ok: true, control_state: state }, 'press', 'order', null), true);
  assert.equal(preflightFreezeRequest(state, 'press', 'order'), 'request');
  assert.equal(preflightFreezeRequest(state, 'another', 'order'), null);
  state.control.freeze_request.target_session_id = 'old-session';
  assert.equal(preflightFreezeRequest(state, 'press', 'order'), null);
});

test('running freeze requires the matching active session', () => {
  assert.equal(runningFreezeRequest(bootstrap().control_state, 'press'), null);
  const state = bootstrap().control_state;
  state.order_control = 'freeze_requested'; state.queue_state = 'in_progress';
  state.control = { ...control('in_progress', ['pause'], 'freeze_requested'),
    freeze_request: { request_id: 'request', status: 'pending', scope: 'order', target_apparatus: 'press', target_session_id: 'session' } };
  assert.equal(validOrderControl({ ok: true, control_state: state }, 'press', 'order', null), true);
  assert.equal(runningFreezeRequest(state, 'press'), 'request');
  state.control.freeze_request.target_session_id = '';
  assert.equal(runningFreezeRequest(state, 'press'), null);
});
