const assert = require('node:assert/strict');
const test = require('node:test');
const { loader } = require('./support/workerQueueTransport.cjs');
const station = 'apparatus:default:bosma_7', order = 'order';
function snapshot(versioned = false) {
  return { ...(versioned ? { rev: 7, epoch: 'epoch' } : {}),
    sequences: { [station]: [order] }, visible_order_ids: { [station]: [order] },
    queue_states: { [station]: { [order]: 'pending' } }, queue_policies: [], order_controls: { [order]: { state: 'active' } },
    stage_states: { [order]: { ' stage ': ' COMPLETED ' } },
    queue_action_controls: { [station]: { [order]: { state: 'pending', allowed_actions: [' start ', 'start'],
      previous_stage_ready: true, complete_requires_full_report: true, interaction: {
        mode: 'fresh_start', start_materials_mode: 'hidden', material_scan_required: false,
        assigned_materials_display_only: true, material_intake_allowed: true,
        previous_wip_mode: 'not_required', qolip_mode: 'not_required' } } } } };
}
function harness(raw = snapshot()) {
  const session = { baseUrl: 'https://example.test', token: 'fixture', profile: { role: 'aparatchi', ref: 'worker' },
    capabilities: ['apparatus.queue.manage'], assigned_apparatus: [station], assigned_apparatus_labels: [] };
  let requests = 0;
  const load = loader({ './authorizedFetch': { authorizedFetch: async () => {
    requests++; return new Response(JSON.stringify(raw), { status: 200 });
  } } });
  return { session, raw, logic: load('workerOrderLogic'), read: () => load('workerLegacyScan').legacyWorkerScanControl(session, station, order),
    sections: load('workerScanSections'), get requests() { return requests; } };
}

test('unsupported aggregate legacy sequence retains actual absent cursor and independent normalized authority', async () => {
  const x = harness(), data = await x.read();
  assert.equal(data.control_state.rev, null); assert.equal(data.control_state.epoch, '');
  assert.equal(x.logic.validOrderControl(data, station, order, null), false, 'modern envelopes remain strict');
  assert.equal(x.logic.workerControlIsUnversioned(data), true);
  assert.equal(x.logic.validWorkerOrderControl(data, station, order, { epoch: 'live', rev: 99 }), true,
    'V2 legacy scan control can omit a cursor; the caller separately fences a pending write revision');
  assert.deepEqual(data.control_state.control.allowed_actions, ['start']);
  assert.deepEqual(data.control_state.stage_states, { stage: 'completed' });
  assert.equal(x.requests, 1);
});

test('legacy authority cannot be forged in JSON, retargeted, mutated or carried to replaced controls', async () => {
  const x = harness(), data = await x.read();
  assert.equal(x.logic.validWorkerOrderControl({ ...data, legacy: true }, station, order, null), false);
  assert.equal(x.logic.validWorkerOrderControl(data, station, 'other', null), false);
  const replaced = { ...data, control_state: { ...data.control_state } };
  x.logic.preserveWorkerControlProof(data, replaced);
  assert.equal(x.logic.validWorkerOrderControl(replaced, station, order, null), false);
  data.control_state.control.previous_stage_ready = false;
  assert.equal(x.logic.validWorkerOrderControl(data, station, order, null), false);
});

test('legacy section completion preserves the same controls and retires proof when the account scope changes', async () => {
  const x = harness(), data = await x.read();
  const completed = await x.sections.completeWorkerScanSections(x.session, data, []);
  assert.notEqual(completed, data); assert.equal(completed.control_state, data.control_state);
  assert.equal(x.logic.validWorkerOrderControl(completed, station, order, null), true);
  x.session.profile.ref = 'another-worker';
  assert.equal(x.logic.validWorkerOrderControl(data, station, order, null), false);
  assert.equal(x.logic.validWorkerOrderControl(completed, station, order, null), false);
});

test('versioned legacy controls keep live epoch and revision downgrade rejection', async () => {
  const x = harness(snapshot(true)), data = await x.read();
  assert.equal(x.logic.workerControlIsUnversioned(data), false);
  assert.equal(x.logic.validWorkerOrderControl(data, station, order, { epoch: 'epoch', rev: 7 }), true);
  assert.equal(x.logic.validWorkerOrderControl(data, station, order, { epoch: 'epoch', rev: 8 }), false);
  assert.equal(x.logic.validWorkerOrderControl(data, station, order, { epoch: 'other', rev: 1 }), false);
  x.session.profile.ref = 'another-worker';
  assert.equal(x.logic.validWorkerOrderControl(data, station, order, null), false);
});

test('legacy transport does not turn a negative versioned cursor into unversioned authority', async () => {
  const raw = snapshot(true); raw.rev = -1;
  const x = harness(raw), data = await x.read();
  assert.equal(x.logic.workerControlIsUnversioned(data), false);
  assert.equal(x.logic.validWorkerOrderControl(data, station, order, null), false);
});

test('a malformed non-target legacy control invalidates the scoped sequence as in V2', async () => {
  const raw = snapshot(); raw.queue_action_controls[station].other = { state: 'pending', allowed_actions: ['start'] };
  const x = harness(raw);
  await assert.rejects(x.read(), error => error.code === 'production_map_snapshot_contract_invalid');
});

test('a pending write receipt requires its epoch and revision and cannot be acknowledged by legacy reads', async () => {
  const x = harness(), legacy = await x.read(), covers = x.logic.workerControlCoversReceipt;
  assert.equal(covers(legacy, null), true);
  const receipt = { epoch: 'epoch', rev: 7 };
  assert.equal(covers(legacy, receipt), false);
  for (const [epoch, rev, expected] of [['epoch', 6, false], ['epoch', 7, true], ['epoch', 8, true], ['other', 9, false], ['', 9, false], ['epoch', null, false]]) {
    assert.equal(covers({ control_state: { epoch, rev } }, receipt), expected);
  }
  assert.equal(covers(null, receipt), false);
  assert.equal(covers({ control_state: receipt }, { rev: 7 }), false);
});
