const assert = require('node:assert/strict'), test = require('node:test');
const { harness, nodes, main, buttons, card, blocking } = require('./support/workerOrderScreen.cjs');

// V2 read_only_helpers:603-706 and start_card:319-377,828-1265.
// Candidate-list permission does not itself make the action area visible.
const cases = [
  ['fresh_start', ['start'], '', true, ['Boshlash', 'Homashyo ulash']],
  ['fresh_start_blocked', [], 'apparatus_busy', true, []],
  ['requeued_waiting', [], 'waiting_sequence', true, ['Homashyo ulash']],
  ['requeued_ready', ['resume'], '', true, ['Davom ettirish', 'Homashyo ulash']],
  ['waiting_previous_stage', [], 'waiting_previous_stage', true, ['Homashyo ulash']],
  ['in_progress', ['pause', 'complete'], '', true, ['Rulonni yechish', 'Tugatish', 'Homashyo ulash']],
  ['paused', [], 'apparatus_busy', true, []],
  ['paused', ['resume'], '', true, ['Davom ettirish', 'Homashyo ulash']],
  ['paused', [], 'waiting_sequence', true, ['Homashyo ulash']],
  ['completed', [], '', false, []],
  ['frozen', [], 'order_frozen', false, []],
];
for (const platform of ['ios', 'android']) for (const [mode, allowed, reason, intake, expected] of cases) {
  test(`${platform}: V2 ${mode}/${reason || 'unblocked'} renders only its permitted actions`, () => {
    const h = harness(platform, { control: { allowed_actions: allowed },
      interaction: { mode, blocking_reason_code: reason, material_intake_allowed: intake,
        previous_wip_mode: mode === 'waiting_previous_stage' ? 'waiting' : 'not_required' },
      controlState: { order_control: mode === 'frozen' ? 'frozen' : 'active' } });
    const tree = h.render();
    assert.deepEqual(buttons(tree).map(button => button.props.label).sort(), expected.slice().sort());
    assert.equal(nodes(main(tree), node => node.type === 'WorkerOutputProgress').length, allowed.some(action => ['pause', 'complete', 'resume'].includes(action)) ? 1 : 0);
    if (reason === 'apparatus_busy') assert.equal(nodes(main(tree), node => node.type === 'WorkerOrderBlockingNotice')[0].props.message,
      h.p('worker.waiting.apparatus_busy_detail', { apparatus: '8 ta rangli bosma apparat', order: 'shashoqcha' }));
  });
}
for (const platform of ['ios', 'android']) test(`${platform}: busy paused 0198 retains both material lists without an intake button or empty action hint`, () => {
  const h = harness(platform), tree = main(h.render());
  const headers = nodes(tree, node => node.type === 'WorkerExpansion');
  assert.deepEqual(headers.map(node => node.props.title), [h.p('worker.materials.pending'), h.p('worker.materials.attached')]);
  assert.equal(buttons(tree).length, 0);
  assert.equal(JSON.stringify(tree).includes('Hozir bajarish mumkin'), false);
  h.bootstrap.control_state.control.allowed_actions = ['resume']; h.bootstrap.control_state.control.interaction.blocking_reason_code = '';
  assert.ok(buttons(h.render()).some(button => button.props.label === h.p('worker.action.resume')));
  h.setFresh(false);
  assert.equal(buttons(h.render()).length, 0);
});
for (const platform of ['ios', 'android']) test(`${platform}: no candidates/cut suppress intake; direct material-use permission does not replace the V2 intake action`, () => {
  for (const extra of [{ states: { intakeCandidatesState: [] } }, { apparatus: { operation: 'cut' } }]) {
    const h = harness(platform, { ...extra, control: { allowed_actions: ['pause', 'complete'] }, interaction: { mode: 'in_progress', blocking_reason_code: '' } });
    assert.ok(!buttons(h.render()).some(button => button.props.label === h.p('worker.action.receive_material')));
  }
  const h = harness(platform, { apparatus: { worker_material_assignment_allowed: true }, control: { allowed_actions: ['pause', 'complete'] }, interaction: { mode: 'in_progress', blocking_reason_code: '' } });
  assert.ok(buttons(h.render()).some(button => button.props.label === h.p('worker.action.receive_material')));
});
for (const platform of ['ios', 'android']) test(`${platform}: blocked manual molds stay hidden; automatic mold details remain available as in V2`, () => {
  const h = harness(platform, { interaction: { mode: 'fresh_start_blocked', qolip_mode: 'scan_required' } });
  assert.ok(!nodes(main(h.render()), node => node.type === 'WorkerExpansion').some(node => node.props.title === 'Qoliplar'));
  h.bootstrap.control_state.control.interaction.qolip_automatic_confirmation = true;
  assert.ok(nodes(main(h.render()), node => node.type === 'WorkerExpansion').some(node => node.props.title === 'Qoliplar'));
});
for (const locale of ['uz', 'en', 'ru', 'ur']) test(`${locale}: opening-WIP/preflight/route blockers retain the V2 reason instead of a no-action fallback`, () => {
  const h = harness('ios', {}, locale);
  for (const [reason, key] of [['waiting_opening_wip', 'worker.waiting.opening_wip'], ['print_preflight_other_order_active', 'worker.waiting.print_preflight_other_order_active'],
    ['wip_route_ambiguous', 'worker.error.wip_route_ambiguous']]) {
    h.bootstrap.control_state.control.interaction.blocking_reason_code = reason;
    assert.equal(nodes(main(h.render()), node => node.type === 'WorkerOrderBlockingNotice')[0].props.message, h.p(key));
  }
  assert.equal(blocking.workerOrderBlockingText('unknown', '', '', h.p), h.p('worker.queue.action_unavailable'));
});
test('start-material status preserves all/mixed delivery, old-server fallback and unavailable suppression', () => {
  const status = rows => card.workerStartMaterialStatus(rows, '', 'not-at-machine', 'none');
  assert.equal(status([{ execution_status: 'awaiting_delivery' }]).allAwaiting, true);
  const mixed = status([{ execution_status: 'ready' }, { execution_status: 'awaiting_delivery' }]);
  assert.deepEqual([mixed.waiting, mixed.present, mixed.deliveryKey], [1, 1, 'worker.materials.delivery_progress']);
  assert.equal(card.workerStartMaterialStatus([{ execution_status: 'compatible' }, {}], 'not-at-machine', 'not-at-machine', 'none').allAwaiting, true);
  assert.equal(card.workerStartMaterialStatus([{ execution_status: 'needs_cutting' }], 'cutting', 'not-at-machine', 'none').showBlockingReason, true);
  assert.equal(card.workerStartMaterialStatus([], 'none', 'not-at-machine', 'none').showBlockingReason, false);
});

const checkpoint = { session_id: 'reactivated-session', stage_node_id: 'stage', token: 'a'.repeat(64), worker_role: 'aparatchi', worker_ref: 'worker' };
for (const platform of ['ios', 'android']) test(`${platform}: a valid unstarted reactivation closes through reclose without opening production forms`, async () => {
  const h = harness(platform, { control: { state: 'paused', reclose: checkpoint }, interaction: { blocking_reason_code: '', material_intake_allowed: false } });
  const complete = buttons(h.render()).find(button => button.props.label === h.p('worker.action.complete'));
  assert.ok(complete);
  complete.props.onPress(); await new Promise(resolve => setImmediate(resolve));
  assert.equal(h.actions.length, 1); assert.equal(h.actions[0][3], 'reclose');
  assert.equal(h.values.get('selected'), ''); assert.equal(h.closed.length, 1);
  assert.deepEqual(h.notices, [h.p('worker.reclose.success')]);
});
for (const platform of ['ios', 'android']) test(`${platform}: rejected reclose keeps the order open and never falls through to production completion`, async () => {
  const h = harness(platform, { control: { state: 'paused', reclose: checkpoint }, interaction: { blocking_reason_code: '', material_intake_allowed: false },
    runReclose: async () => { throw Error('rejected'); } });
  buttons(h.render()).find(button => button.props.label === h.p('worker.action.complete')).props.onPress();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(h.actions.length, 1); assert.equal(h.closed.length, 0); assert.equal(h.values.get('selected'), '');
  assert.deepEqual(h.notices, [h.p('worker.reclose.failed')]);
});
for (const change of [{ worker_ref: 'other' }, { worker_role: 'rezka_master' }, { stage_node_id: 'other' }, { token: 'invalid' }, { readScope: 'old-account' }]) {
  test(`unowned/invalid reclose cannot add completion: ${Object.keys(change)[0]}`, () => {
    const h = harness('ios', { control: { state: 'paused', reclose: { ...checkpoint, ...change } }, interaction: { blocking_reason_code: '' } });
    assert.ok(!buttons(h.render()).some(button => button.props.label === h.p('worker.action.complete')));
  });
}
for (const platform of ['ios', 'android']) test(`${platform}: preflight hold/outcome/freeze and safe stop retain their separate V2 actions`, () => {
  const hold = { order_id: '0198', apparatus: 'apparatus:default:bosma_8', hold_id: 'hold', revision: 1, status: 'held' };
  const first = harness(platform, { control: { state: 'pending', print_preflight_allowed: true },
    interaction: { mode: 'fresh_start_blocked', blocking_reason_code: '', material_intake_allowed: false } });
  assert.deepEqual(buttons(first.render()).map(button => button.props.label), [first.p('worker.action.print_preflight')]);
  const outcome = harness(platform, { control: { state: 'print_preflight', print_preflight: hold },
    interaction: { mode: 'fresh_start_blocked', blocking_reason_code: 'print_preflight_active', material_intake_allowed: false } });
  assert.deepEqual(buttons(outcome.render()).map(button => button.props.label), ['Rang chiqdi', 'Chiqmadi']);
  assert.equal(nodes(main(outcome.render()), node => node.type === 'WorkerOrderBlockingNotice').length, 0);
  const freezing = harness(platform, { control: { state: 'print_preflight', allowed_actions: ['freeze'], print_preflight: hold,
    freeze_request: { request_id: 'freeze', status: 'pending', target_apparatus: hold.apparatus } }, controlState: { order_control: 'freeze_requested' },
    interaction: { mode: 'freeze_requested', blocking_reason_code: 'order_freeze_requested', material_intake_allowed: false } });
  assert.deepEqual(buttons(freezing.render()).map(button => button.props.label), ['Rang chiqarishni to‘xtatib muzlatish']);
  const stopping = harness(platform, { control: { state: 'in_progress', allowed_actions: ['pause'],
    freeze_request: { request_id: 'freeze', status: 'pending', target_apparatus: hold.apparatus, target_session_id: 'running' } },
    controlState: { order_control: 'freeze_requested' }, interaction: { mode: 'freeze_requested', blocking_reason_code: 'order_freeze_requested', material_intake_allowed: false } });
  assert.deepEqual(buttons(stopping.render()).map(button => button.props.label), ['Rulonni yechib muzlatish']);
});
