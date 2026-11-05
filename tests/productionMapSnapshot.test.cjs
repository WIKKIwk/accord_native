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
