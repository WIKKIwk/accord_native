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
  loaded.require = id => Object.hasOwn(mocks, id) ? mocks[id] : id.startsWith('./') ? load(id.slice(2), mocks) : require(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText, filename);
  return loaded.exports;
}
const station = 'apparatus:default:bosma_7', order = 'zakaz-scan-bootstrap', qr = '400118DF489A8D297E68163A';
const stem = 'order_scan_bootstrap_api_test';
function setup(name) {
  const replay = contractFetch(stem, name);
  const session = recordedSession(stem, name);
  const auth = { authorizedFetch: (s, p, init) => replay(new URL(p, s.baseUrl), {
    ...init, headers: { Authorization: `Bearer ${s.token}` },
  }) };
  const controls = load('workerControlsApi', { './authorizedFetch': auth, './sessionReadScope': load('sessionReadScope') });
  const materials = load('workerRawMaterials', { './authorizedFetch': auth, './workerControlsApi': controls });
  const logic = load('workerOrderLogic', { './workerControlsApi': controls });
  const batch = load('workerProgressBatch', { './workerControlsApi': controls, './workerProgressModel': load('workerProgressModel') });
  return { session, replay, api: load('workerScanBootstrap', {
    './authorizedFetch': auth, './workerControlsApi': controls, './workerRawMaterials': materials, './workerOrderLogic': logic, './workerProgressBatch': batch,
  }) };
}
function fixture(name = 'bootstrap decodes context and QR proof in one authorized request') {
  return JSON.parse(loadContract(stem).find(record => record.test === name).responseBody.text);
}

test('scan bootstrap binds reclose authority when it decodes the response', () => {
  const { api, session } = setup('bootstrap sends one scoped GET and passes scanned barcodes');
  session.profile = { role: 'aparatchi', ref: 'worker' };
  session.assigned_apparatus = [station];
  const value = fixture();
  delete value.queue_context;
  value.control_state.control.reclose = { session_id: 'run', stage_node_id: 'stage', token: 'a'.repeat(64),
    worker_role: 'aparatchi', worker_ref: 'worker', readScope: 'server supplied' };
  const result = api.parseWorkerScanBootstrap(value, station, order, qr, session);
  assert.equal(result.control_state.control.reclose.readScope, load('sessionReadScope').sessionReadScope(session));
});

test('scan bootstrap returns decoded queue context and normalized control fields', () => {
  const { api, session } = setup('bootstrap sends one scoped GET and passes scanned barcodes');
  const value = fixture();
  value.control_state.control.allowed_actions = [' start ', 'start'];
  value.queue_context.queue_action_controls[station][order].allowed_actions = [' start ', 'start'];
  const result = api.parseWorkerScanBootstrap(value, station, order, qr, session);
  assert.deepEqual(result.control_state.control.allowed_actions, ['start']);
  assert.equal(result.control_state.control.interaction.resume_input_requirement_known, false);
  assert.equal(result.queue_context.queue_action_controls[station][order].state, 'pending');
  assert.equal(result.queue_context.order_controls[order], 'active');
});

for (const [name, options] of [
  ['bootstrap sends one scoped GET and passes scanned barcodes', { materialBarcodes: ['ROLL1', 'ROLL2'] }],
  ['bootstrap context and QR flags remain additive for older servers', { includeSections: false, includeContext: true, qrPayload: qr }],
  ['bootstrap decodes context and QR proof in one authorized request', { includeContext: true, qrPayload: qr }],
]) {
  test(`scan bootstrap replays V2: ${name}`, async () => {
    const { api, replay, session } = setup(name);
    const result = await api.adminOrderScanBootstrap(session, { apparatus: station, orderId: order, ...options });
    assert.equal(result.control_state.order_id, order);
    assert.equal(result.sections.materials.status, 'ready');
    assert.equal(result.sections.qolips.status, 'ready');
    replay.assertDone();
  });
}

for (const code of [404, 405]) {
  test(`scan bootstrap permits legacy fallback only for an empty ${code}`, async () => {
    const { api, replay, session } = setup(`bootstrap empty route ${code} allows legacy reader`);
    assert.equal(await api.adminOrderScanBootstrap(session, { apparatus: station, orderId: order }), null);
    replay.assertDone();
  });
}
for (const code of [400, 403, 404, 409, 503]) {
  test(`scan bootstrap propagates domain ${code} without fallback`, async () => {
    const { api, replay, session } = setup(`bootstrap domain ${code} remains failure without legacy fallback`);
    await assert.rejects(api.adminOrderScanBootstrap(session, { apparatus: station, orderId: order }), error => error.code === 'order_not_available');
    replay.assertDone();
  });
}

test('scan bootstrap rejects mismatched control, queue context and QR proof', () => {
  const { api } = setup('bootstrap sends one scoped GET and passes scanned barcodes');
  for (const edit of [
    value => delete value.control_state.stage_states,
    value => { value.control_state.order_id = 'other'; },
    value => { value.queue_context.epoch = 'old'; },
    value => { value.queue_context.queue_states[station][order] = 'paused'; },
    value => { value.queue_context.maps.push(structuredClone(value.queue_context.maps[0])); },
    value => { value.validated_progress.batch.qr_payload = 'other'; },
    value => { value.validated_progress.batch.wip_status = 'in_use'; },
    value => { value.validated_progress.input_route.consumer_apparatus_ids = ['apparatus:default:other']; },
    value => { delete value.validated_progress.input_route.map_fingerprint; },
  ]) {
    const value = fixture(); edit(value);
    assert.throws(() => api.parseWorkerScanBootstrap(value, station, order, qr), error =>
      ['production_map_snapshot_contract_invalid', 'wip_route_destination_unresolved'].includes(error.code));
  }
});

test('scan bootstrap accepts reordered control keys and treats incomplete sections independently', () => {
  const { api } = setup('bootstrap sends one scoped GET and passes scanned barcodes');
  const value = fixture();
  const control = value.queue_context.queue_action_controls[station][order];
  value.queue_context.queue_action_controls[station][order] = Object.fromEntries(Object.entries(control).reverse());
  value.sections.materials.data.assignments[0].order_id = 'other';
  value.sections.qolips.data.qolip.required_qolip_count = 2;
  const parsed = api.parseWorkerScanBootstrap(value, station, order, ` ${qr.toLowerCase()} `);
  assert.equal(parsed.sections.materials.status, 'incomplete');
  assert.equal(parsed.sections.qolips.status, 'incomplete');
  assert.equal(parsed.validated_progress.batch.qr_payload, qr);
});

test('scoped candidate pages require matching scope, unique identities and valid typed values', () => {
  const { api } = setup('bootstrap sends one scoped GET and passes scanned barcodes');
  const value = fixture();
  const assignment = { order_id: order, apparatus: station, barcode: 'ROLL1', item_code: 'FILM', item_name: 'Film', item_group: 'film' };
  const batch = structuredClone(value.validated_progress.batch);
  value.sections.material_assignments = { status: 'ready', apparatus: station, order_id: order, stage_node_id: 'apparatus', data: [assignment] };
  value.sections.input_progress = { status: 'ready', apparatus: station, order_id: order, stage_node_id: 'apparatus', limit: 500,
    status_filter: 'waiting', data: { batches: [batch] } };
  let parsed = api.parseWorkerScanBootstrap(value, station, order, qr);
  assert.equal(parsed.sections.material_assignments.status, 'ready');
  assert.equal(parsed.sections.input_progress.status, 'ready');
  value.sections.material_assignments.data.push({ ...assignment, barcode: ' roll1 ' });
  value.sections.input_progress.data.batches[0].produced_qty = '484';
  parsed = api.parseWorkerScanBootstrap(value, station, order, qr);
  assert.equal(parsed.sections.material_assignments.status, 'incomplete');
  assert.equal(parsed.sections.input_progress.status, 'incomplete');
  assert.equal(parsed.sections.materials.status, 'ready');
});

test('scan bootstrap rejects malformed global context even outside the selected order', () => {
  const { api } = setup('bootstrap sends one scoped GET and passes scanned barcodes');
  for (const edit of [
    value => { delete value.queue_context.sequences; },
    value => { delete value.queue_context.visible_order_ids; },
    value => { value.queue_context.queue_policies = {}; },
    value => { value.queue_context.order_controls.other = { state: 'unknown' }; },
    value => { value.queue_context.queue_states['apparatus:default:other'] = { other: 'unknown' }; },
    value => { value.queue_context.sequences['bad apparatus'] = ['other']; },
    value => { value.queue_context.queue_action_controls['bad apparatus'] = {}; },
    value => { value.queue_context.stage_states.other = { stage: 'unknown' }; },
    value => { value.queue_context.queue_action_controls[station].other = { ...value.control_state.control, state: 'unknown' }; },
    value => { value.queue_context.queue_action_controls[station].other = { ...value.control_state.control, allowed_actions: ['unexpected'] }; },
    value => { value.queue_context.queue_states[station].other = 'paused';
      value.queue_context.queue_action_controls[station].other = { ...value.control_state.control }; },
  ]) {
    const value = fixture(); edit(value);
    assert.throws(() => api.parseWorkerScanBootstrap(value, station, order, qr), error =>
      ['production_map_snapshot_contract_invalid', 'production_map_visible_order_ids_missing'].includes(error.code));
  }
});

test('scan bootstrap returns a typed validated batch with the proven input route', () => {
  const { api } = setup('bootstrap sends one scoped GET and passes scanned barcodes');
  const value = fixture();
  const result = api.parseWorkerScanBootstrap(value, station, order, qr);
  assert.equal(result.validated_progress.batch.has_input_route_metadata, true);
  assert.deepEqual(result.validated_progress.batch.input_route, result.validated_progress.input_route);
  assert.ok(result.validated_progress.batch.input_route.consumer_apparatus_ids.includes(station));
});

test('scan context accepts a numeric-string snapshot revision like V2', () => {
  const { api } = setup('bootstrap sends one scoped GET and passes scanned barcodes');
  const value = fixture();
  value.queue_context.rev = '7';
  assert.equal(api.parseWorkerScanBootstrap(value, station, order, qr).control_state.rev, 7);
});
