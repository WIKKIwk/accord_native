const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const { loadContract } = require('./support/contractFetch.cjs');
function load(name, mocks = {}) {
  const filename = path.resolve(__dirname, `../src/${name}.ts`);
  const loaded = new Module(filename, module);
  loaded.filename = filename; loaded.paths = module.paths;
  loaded.require = id => Object.hasOwn(mocks, id) ? mocks[id] : id.startsWith('./') ? load(id.slice(2), mocks) : require(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return loaded.exports;
}
const decoder = load('productionMapSnapshot', { './authorizedFetch': {} });
const context = () => JSON.parse(loadContract('order_scan_bootstrap_api_test').find(x => x.test === 'bootstrap decodes context and QR proof in one authorized request').responseBody.text).queue_context;

test('canonical snapshot decodes scoped maps and queue authority', () => {
  const value = decoder.decodeCanonicalProductionMapSnapshot(context(), true);
  assert.equal(value.maps[0].map.id, 'zakaz-scan-bootstrap');
  assert.equal(value.queue_action_controls['apparatus:default:bosma_7']['zakaz-scan-bootstrap'].state, 'pending');
  assert.equal(value.revision, 7);
});

test('canonical snapshots default missing projection and reject a non-string projection', () => {
  const value = context();
  delete value.projection;
  assert.equal(decoder.decodeCanonicalProductionMapSnapshot(value).projection, '');
  value.projection = 7;
  assert.throws(() => decoder.decodeCanonicalProductionMapSnapshot(value), TypeError);
});

test('canonical snapshot rejects malformed global queue controls', () => {
  for (const edit of [
    value => { delete value.visible_order_ids; },
    value => { value.queue_states['apparatus:default:bosma_7']['zakaz-scan-bootstrap'] = 'unknown'; },
    value => { value.queue_action_controls['apparatus:default:bosma_7']['zakaz-scan-bootstrap'].allowed_actions = ['unexpected']; },
    value => { value.queue_policies = {}; },
    value => { value.frozen_orders_by_apparatus = null; },
  ]) {
    const value = context(); edit(value);
    assert.throws(() => decoder.decodeCanonicalProductionMapSnapshot(value, true));
  }
});

test('compact canonical snapshots expose V2 empty authority fields and typed order controls', () => {
  const record = loadContract('worker_list_api_test').find(value => value.test.startsWith('worker HTTP and v2 socket'));
  const wire = JSON.parse(record.responseBody.text);
  wire.order_controls['work-1'] = { state: 'frozen' };
  const value = decoder.decodeCanonicalProductionMapSnapshot(wire);
  assert.equal(value.order_controls['work-1'], 'frozen');
  assert.deepEqual(value.maps, []);
  assert.deepEqual(value.queue_action_controls, {});
  assert.deepEqual(value.stage_states, {});
  assert.deepEqual(value.calculation_templates, {});
  assert.equal(value.queue_policies['apparatus:default:bosma_7'].policy, 'strict_sequence');
});

test('snapshot accepts a valid freeze request independently of global consistency', () => {
  const api = load('productionMapSnapshot', { './authorizedFetch': {} });
  const station = 'apparatus:default:press', order = 'order';
  const wire = { maps: [], sequences: {}, visible_order_ids: { [station]: [order] }, queue_states: {}, queue_policies: [], stage_states: {},
    order_controls: { [order]: { state: 'freeze_requested' } }, frozen_orders_by_apparatus: {},
    queue_action_controls: { [station]: { [order]: { state: 'in_progress', allowed_actions: ['pause'], previous_stage_ready: false,
      complete_requires_full_report: false, interaction: { mode: 'freeze_requested', start_materials_mode: 'hidden', material_scan_required: false,
        assigned_materials_display_only: true, material_intake_allowed: false, previous_wip_mode: 'not_required', qolip_mode: 'not_required', blocking_reason_code: 'order_freeze_requested' },
      freeze_request: { request_id: 'freeze-1', status: 'pending', target_session_id: 'session-1', target_apparatus: station } } } } };
  const snapshot = api.decodeCanonicalProductionMapSnapshot(wire);
  assert.equal(snapshot.queue_action_controls[station][order].interaction.mode, 'freeze_requested');
  delete wire.queue_action_controls[station][order].freeze_request.request_id;
  assert.throws(() => api.decodeCanonicalProductionMapSnapshot(wire), e => e.code === 'production_map_snapshot_contract_invalid');
});

test('snapshot accepts a frozen queue control without forcing an active global order', () => {
  const api = load('productionMapSnapshot', { './authorizedFetch': {} });
  const station = 'apparatus:default:press', order = 'order';
  const wire = { maps: [], sequences: {}, visible_order_ids: { [station]: [order] }, queue_states: { [station]: { [order]: 'frozen' } },
    queue_policies: [], stage_states: {}, order_controls: { [order]: { state: 'frozen' } }, frozen_orders_by_apparatus: {},
    queue_action_controls: { [station]: { [order]: { state: 'frozen', allowed_actions: [], previous_stage_ready: false, complete_requires_full_report: false,
      interaction: { mode: 'frozen', start_materials_mode: 'hidden', material_scan_required: false, assigned_materials_display_only: true,
        material_intake_allowed: false, previous_wip_mode: 'not_required', qolip_mode: 'not_required' } } } } };
  assert.equal(api.decodeCanonicalProductionMapSnapshot(wire).queue_action_controls[station][order].state, 'frozen');
});

test('snapshot accepts a global freeze wildcard with whitespace in target fields', () => {
  const api = load('productionMapSnapshot', { './authorizedFetch': {} });
  const station = 'apparatus:default:press', order = 'order';
  const wire = { maps: [], sequences: {}, visible_order_ids: { [station]: [order] }, queue_states: {}, queue_policies: [], stage_states: {},
    order_controls: { [order]: { state: 'freeze_requested' } }, frozen_orders_by_apparatus: {},
    queue_action_controls: { [station]: { [order]: { state: 'in_progress', allowed_actions: ['pause'], previous_stage_ready: false,
      complete_requires_full_report: false, interaction: { mode: 'freeze_requested', start_materials_mode: 'hidden', material_scan_required: false,
        assigned_materials_display_only: true, material_intake_allowed: false, previous_wip_mode: 'not_required', qolip_mode: 'not_required' },
      freeze_request: { request_id: 'freeze-1', status: 'pending', target_session_id: ' ', target_apparatus: ' ', target_worker_ref: ' ' } } } } };
  assert.equal(api.decodeCanonicalProductionMapSnapshot(wire).queue_action_controls[station][order].state, 'in_progress');
});

test('freeze metadata uses V2 string conversion and retains its status text', () => {
  const api = load('productionMapSnapshot', { './authorizedFetch': {} });
  const station = 'apparatus:default:press', order = 'order';
  const wire = { maps: [], sequences: {}, visible_order_ids: { [station]: [order] }, queue_states: {}, queue_policies: [], stage_states: {},
    order_controls: {}, frozen_orders_by_apparatus: {}, queue_action_controls: { [station]: { [order]: { state: 'in_progress', allowed_actions: ['pause'],
      previous_stage_ready: false, complete_requires_full_report: false, interaction: { mode: 'freeze_requested', start_materials_mode: 'hidden',
        material_scan_required: false, assigned_materials_display_only: true, material_intake_allowed: false, previous_wip_mode: 'not_required', qolip_mode: 'not_required' },
      freeze_request: { request_id: 17, status: ' PENDING ', target_session_id: 32, target_apparatus: station } } } } };
  const freeze = api.decodeCanonicalProductionMapSnapshot(wire).queue_action_controls[station][order].freeze_request;
  assert.equal(freeze.request_id, '17'); assert.equal(freeze.target_session_id, '32'); assert.equal(freeze.status, ' PENDING ');
});

test('snapshot control normalizes optional stage work with V2 defaults', () => {
  const api = load('productionMapSnapshot', { './authorizedFetch': {} });
  const station = 'apparatus:default:press', order = 'order';
  const wire = { maps: [], sequences: {}, visible_order_ids: {}, queue_states: {}, queue_policies: [], stage_states: {}, order_controls: {}, frozen_orders_by_apparatus: {},
    queue_action_controls: { [station]: { [order]: { state: 'pending', allowed_actions: ['start'], previous_stage_ready: false, complete_requires_full_report: false,
      interaction: { mode: 'fresh_start', start_materials_mode: 'hidden', material_scan_required: false, assigned_materials_display_only: true,
        material_intake_allowed: false, previous_wip_mode: 'not_required', qolip_mode: 'not_required' }, stage_work: { upstream_closed: true, report_session_id: 42 } } } } };
  const control = api.decodeCanonicalProductionMapSnapshot(wire).queue_action_controls[station][order];
  assert.equal(control.stage_work.upstream_closed, true); assert.equal(control.stage_work.report_session_id, '42');
  assert.equal(control.stage_work.astatka_required, false); assert.equal(control.freeze_request, null); assert.equal(control.last_worked_at_unix, 0);
});

test('queue control drops malformed optional resume data and supplies interaction defaults', () => {
  const api = load('productionMapSnapshot', { './authorizedFetch': {} });
  const station = 'apparatus:default:press', order = 'order';
  const wire = { maps: [], sequences: {}, visible_order_ids: {}, queue_states: {}, queue_policies: [], stage_states: {}, order_controls: {}, frozen_orders_by_apparatus: {},
    queue_action_controls: { [station]: { [order]: { state: 'pending', allowed_actions: ['start'], previous_stage_ready: false, complete_requires_full_report: false,
      interaction: { mode: 'fresh_start', start_materials_mode: 'hidden', material_scan_required: false, assigned_materials_display_only: true,
        material_intake_allowed: false, previous_wip_mode: 'not_required', qolip_mode: 'not_required' }, re_pause: { resume_id: '' } } } } };
  const control = api.decodeCanonicalProductionMapSnapshot(wire).queue_action_controls[station][order];
  assert.equal(control.re_pause, null); assert.equal(control.interaction.resume_input_requirement_known, false);
  assert.equal(control.interaction.qolip_policy_revision, 0);
});

test('snapshot binds reclose authority to the reading account and drops malformed authority', () => {
  const station = 'apparatus:default:bosma_7', order = 'zakaz-scan-bootstrap';
  const session = { baseUrl: 'https://example.test', profile: { role: 'aparatchi', ref: 'worker' },
    capabilities: [], assigned_apparatus: [station] };
  const wire = context();
  wire.queue_action_controls[station][order].reclose = { session_id: 'run', stage_node_id: 'stage', token: 'a'.repeat(64),
    worker_role: 'aparatchi', worker_ref: 'worker', readScope: 'server supplied' };
  const parsed = decoder.decodeCanonicalProductionMapSnapshot(wire, true, session);
  const reclose = parsed.queue_action_controls[station][order].reclose;
  const originalScope = load('sessionReadScope').sessionReadScope(session);
  assert.equal(reclose.readScope, originalScope);
  session.assigned_apparatus = [];
  const controls = load('workerControlsApi', { './authorizedFetch': {} });
  assert.equal(controls.reactivationRecloseControl(reclose, session).readScope, originalScope);
  wire.queue_action_controls[station][order].reclose.token = 'invalid';
  assert.equal(decoder.decodeCanonicalProductionMapSnapshot(wire, true, session).queue_action_controls[station][order].reclose, null);
});

test('snapshot normalizes rezka lineage, partial rolls and the original control signature', () => {
  const station = 'apparatus:default:bosma_7', order = 'zakaz-scan-bootstrap';
  const wire = context(), original = wire.queue_action_controls[station][order];
  original.rezka_input_lineage = [
    { input_batch_id: ' roll-1 ', sequence_no: 1, status: ' IN_USE ', source_kind: 'progress_batch' },
    { input_batch_id: 'roll-2', sequence_no: 2, status: 'processed', source_kind: 'opening_wip' },
  ];
  original.rezka_active_partial_rolls = [{ slot_index: 1, generation: 2, contained_kadr_count: 3,
    source_input_batch_ids: [' roll-1 ', 'roll-2'], status: 'ACTIVE' }];
  original.rezka_output_kadr_counts = [3, 2];
  const parsed = decoder.decodeCanonicalProductionMapSnapshot(wire, true).queue_action_controls[station][order];
  assert.deepEqual(parsed.rezka_input_lineage, [
    { input_batch_id: 'roll-1', sequence_no: 1, status: 'in_use' },
    { input_batch_id: 'roll-2', sequence_no: 2, status: 'processed' },
  ]);
  assert.deepEqual(parsed.rezka_active_partial_rolls, [{ slot_index: 1, generation: 2, contained_kadr_count: 3,
    source_input_batch_ids: ['roll-1', 'roll-2'] }]);
  assert.deepEqual(parsed.rezka_output_kadr_counts, [3, 2]);
  assert.equal(parsed.rezka_output_report, null);
  assert.equal(parsed.server_contract_signature, JSON.stringify(original));
});

test('queue controls normalize optional worker authority and preserve its server signature', () => {
  const station = 'apparatus:default:bosma_7', order = 'zakaz-scan-bootstrap';
  const wire = context(), control = wire.queue_action_controls[station][order];
  control.work_activity = { worker_role: ' aparatchi ', worker_ref: ' worker ', state: ' in_progress ' };
  control.re_pause = { resume_id: ' resume ', worker_role: 'aparatchi', worker_ref: ' worker ' };
  control.last_worked_at_unix = 1.5;
  control.stage_work = { local_completed: true, report_session_id: 42 };
  const parsed = decoder.decodeCanonicalProductionMapSnapshot(wire, true).queue_action_controls[station][order];
  assert.deepEqual(parsed.work_activity, { worker_role: 'aparatchi', worker_ref: 'worker', state: 'in_progress' });
  assert.deepEqual(parsed.re_pause, { resume_id: 'resume', worker_role: 'aparatchi', worker_ref: 'worker' });
  assert.equal(parsed.last_worked_at_unix, 0);
  assert.equal(parsed.stage_work.local_completed, true);
  assert.equal(parsed.stage_work.report_session_id, '42');
  assert.equal(parsed.stage_work.completed, false);
  assert.equal(parsed.server_contract_signature, JSON.stringify(control));
  control.work_activity = { worker_role: 'aparatchi', worker_ref: '', state: 'paused' };
  control.re_pause = { resume_id: '' };
  const malformed = decoder.decodeCanonicalProductionMapSnapshot(wire, true).queue_action_controls[station][order];
  assert.equal(malformed.work_activity, null);
  assert.equal(malformed.re_pause, null);
});

test('queue controls reject malformed optional authority and inconsistent state', () => {
  const station = 'apparatus:default:bosma_7', order = 'zakaz-scan-bootstrap';
  for (const change of [
    control => { control.temporary_pause = { session_id: 's', token: 'bad' }; },
    control => { control.cancel_start = { session_id: 's', token: 'bad' }; },
    control => { control.temporarily_paused = 'false'; },
    control => { control.print_preflight = null; },
    control => { control.interaction.qolip_policy_revision = -1; },
    control => { control.rezka_output_kadr_counts = [0]; },
    control => { control.state = 'paused'; },
  ]) {
    const wire = context(); change(wire.queue_action_controls[station][order]);
    assert.throws(() => decoder.decodeCanonicalProductionMapSnapshot(wire, true), e => e.code === 'production_map_snapshot_contract_invalid');
  }
});

test('queue-control maps retain a literal __proto__ order without prototype mutation', () => {
  const station = 'apparatus:default:bosma_7', wire = context();
  const control = wire.queue_action_controls[station]['zakaz-scan-bootstrap'];
  const orders = JSON.parse('{"__proto__":{}}'); orders.__proto__ = control;
  const parsed = decoder.parseProductionQueueActionControls({ [station]: orders }, {}, {});
  assert.equal(Object.hasOwn(parsed[station], '__proto__'), true);
  assert.equal(parsed[station].__proto__.state, 'pending');
  assert.equal(Object.getPrototypeOf(parsed[station]), Object.prototype);
});
