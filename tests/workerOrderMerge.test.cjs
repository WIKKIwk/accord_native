const assert = require('node:assert/strict'), test = require('node:test');
const { harness, nodes, buttons, load, merge, rules } = require('./support/workerOrderScreen.cjs');
const station = 'apparatus:default:bosma_8';
const tick = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
function fixture() {
  const text = harness('ios').p, calls = [], notices = [], changes = [];
  const control = { state: 'in_progress', allowed_actions: ['pause', 'merge', 'complete'], stage_node_id: 'stage',
    previous_stage_ready: true, complete_requires_full_report: false,
    rezka_input_lineage: [{ input_batch_id: 'private-current-wip', sequence_no: 1, status: 'in_use', source_kind: 'progress_batch' }],
    interaction: { mode: 'in_progress', start_materials_mode: 'hidden', material_scan_required: false,
      assigned_materials_display_only: false, material_intake_allowed: false, previous_wip_mode: 'not_required',
      opening_wip_mode: 'not_required', qolip_mode: 'not_required', resume_input_required: false } };
  const context = { snapshot: { epoch: 'epoch', rev: 1, maps: [{ map: { id: '0198', order_number: '0198', title: 'mofun keks' } }] },
    bootstrap: { ok: true, control_state: { apparatus: station, order_id: '0198', scope: 'scope', epoch: 'epoch', rev: 1,
      queue_state: 'in_progress', order_control: 'active', stage_states: {}, control } } };
  let current = true, available = true;
  const wip = { batch: { order_id: '0198', batch_id: 'next-wip', qr_payload: 'ROLL-002', wip_status: 'waiting',
    has_input_route_metadata: true, input_route: { consumer_apparatus_ids: [station] } } };
  const reads = { current: () => current, snapshot: () => context.snapshot,
    identify: async qr => { calls.push(['identify', qr]); return structuredClone(wip); },
    context: async (order, qr) => { calls.push(['context', order, qr]); return structuredClone(context); },
    validate: async (_wip, qr, order) => { calls.push(['validate', qr, order]); return structuredClone(wip.batch); } };
  const target = { apparatus: station, order: '0198', orderLabel: 'mofun keks', apparatusLabel: 'Rezka', label: id => id };
  const deps = { current: reads.current, available: () => available && current, target: () => target, reads: () => reads, p: text,
    changed: state => changes.push(state), notice: message => notices.push(message),
    write: async (qr, proof, guard) => { assert.equal(guard(), true); calls.push(['write', qr, proof.stage]); return true; } };
  const flow = new merge.WorkerOrderMergeFlow(deps);
  assert.equal(rules.validOrderControl(context.bootstrap, station, '0198', context.snapshot), true);
  return { flow, deps, context, control, wip, reads, calls, notices, changes, p: text, target,
    setCurrent: value => { current = value; }, setAvailable: value => { available = value; } };
}
test('merge requires an explicit confirmation, revalidates the WIP and sends only once', async () => {
  const h = fixture(); h.flow.toggle();
  await h.flow.scan(' ROLL-002 ');
  assert.equal(h.flow.state.phase, 'confirmation');
  assert.deepEqual(h.flow.state.labels, { current: '1-rulon', next: '2-rulon' });
  assert.ok(!JSON.stringify(h.flow.state).includes('private-current-wip'));
  assert.equal(h.calls.filter(call => call[0] === 'write').length, 0);
  await Promise.all([h.flow.scan('ROLL-002'), h.flow.confirm(), h.flow.confirm()]);
  assert.equal(h.calls.filter(call => call[0] === 'validate').length, 2);
  assert.deepEqual(h.calls.filter(call => call[0] === 'write'), [['write', 'ROLL-002', 'stage']]);
  assert.equal(h.flow.state.phase, 'closed');
  assert.deepEqual(h.notices, ['2-rulon 1-rulonning davomiga ulandi.']);
});
for (const reason of ['cancel', 'back', 'outside']) test(`${reason}: ending confirmation ignores late scans until Merge is explicitly reopened`, async () => {
  const h = fixture(); h.flow.toggle(); await h.flow.scan('ROLL-002'); h.flow.cancel();
  await h.flow.scan('ROLL-002'); await h.flow.confirm();
  assert.equal(h.calls.filter(call => call[0] === 'write').length, 0);
  assert.equal(h.flow.state.phase, 'closed');
  h.flow.toggle(); await h.flow.scan('ROLL-002'); assert.equal(h.flow.state.phase, 'confirmation');
});
test('one camera read is in flight; cancelling it prevents a late confirmation', async () => {
  const h = fixture(), pending = deferred();
  h.reads.identify = async () => { h.calls.push(['identify']); return pending.promise; };
  h.flow.toggle(); const first = h.flow.scan('ROLL-002'); await h.flow.scan('ROLL-002');
  assert.equal(h.calls.length, 1); h.flow.cancel(); pending.resolve(h.wip); await first;
  assert.equal(h.flow.state.phase, 'closed'); assert.equal(h.notices.length, 0);
});
for (const change of ['stage', 'lineage', 'epoch', 'permission', 'frozen', 'session', 'used']) test(`${change} changing while confirmation is open prevents mutation`, async () => {
  const h = fixture(); h.flow.toggle(); await h.flow.scan('ROLL-002');
  if (change === 'stage') h.control.stage_node_id = 'other';
  if (change === 'lineage') h.control.rezka_input_lineage.push({ input_batch_id: 'another', sequence_no: 2, status: 'processed' });
  if (change === 'epoch') h.context.bootstrap.control_state.epoch = h.context.snapshot.epoch = 'other';
  if (change === 'permission') h.control.allowed_actions = ['pause'];
  if (change === 'frozen') h.context.bootstrap.control_state.order_control = 'frozen';
  if (change === 'session') h.setCurrent(false);
  if (change === 'used') h.wip.batch.wip_status = 'processed';
  await h.flow.confirm();
  assert.equal(h.calls.filter(call => call[0] === 'write').length, 0); assert.equal(h.notices.length, 0);
  if (['stage', 'lineage', 'epoch'].includes(change)) assert.equal(h.flow.state.message, h.p('worker.qr.merge_changed'));
});
test('a rejected mutation shows the exact V2 guidance and never reports success or retries', async () => {
  const h = fixture(); h.deps.write = async () => { h.calls.push(['write']); throw { code: 'merge_input_already_used', statusCode: 409 }; };
  h.flow.toggle(); await h.flow.scan('ROLL-002'); await h.flow.confirm(); await h.flow.confirm();
  assert.equal(h.flow.state.phase, 'guidance'); assert.equal(h.flow.state.message, h.p('worker.error.merge_input_already_used'));
  assert.equal(h.notices.length, 0); assert.equal(h.calls.filter(call => call[0] === 'write').length, 1);
});
test('a non-acknowledged write returns to the V2 scan prompt without success or a mutation retry', async () => {
  const h = fixture(); h.deps.write = async () => { h.calls.push(['write']); return false; };
  h.flow.toggle(); await h.flow.scan('ROLL-002'); await h.flow.confirm(); await h.flow.confirm();
  assert.equal(h.flow.state.phase, 'scanning'); assert.equal(h.notices.length, 0); assert.equal(h.calls.filter(call => call[0] === 'write').length, 1);
  const reads = h.calls.filter(call => call[0] === 'identify').length;
  h.setAvailable(false); await h.flow.scan('third-roll');
  assert.equal(h.flow.state.phase, 'scanning'); assert.equal(h.calls.filter(call => call[0] === 'identify').length, reads);
});
for (const advanced of [false, true]) test(`timeout is reconciled by a read, never by replaying the merge (advanced=${advanced})`, async () => {
  const h = fixture();
  h.deps.write = async () => {
    h.calls.push(['write']);
    if (advanced) { h.control.rezka_input_lineage[0].status = 'processed'; h.control.rezka_input_lineage.push({ input_batch_id: 'next-wip', sequence_no: 2, status: 'in_use' }); }
    throw Object.assign(new Error('timeout'), { name: 'TimeoutError' });
  };
  h.flow.toggle(); await h.flow.scan('ROLL-002'); await h.flow.confirm(); await h.flow.scan('third');
  assert.equal(h.flow.state.phase, 'closed'); assert.equal(h.calls.filter(call => call[0] === 'write').length, 1);
  assert.deepEqual(h.notices, [h.p(advanced ? 'worker.notice.merge_complete' : 'worker.notice.action_sent', { current: '1-rulon', next: '2-rulon' })]);
});
test('unknown, used, void, wrong-route and inconsistent WIP proofs never reach confirmation', async () => {
  for (const scenario of ['unknown', 'used', 'void', 'route', 'mismatched-proof', 'changed-route']) {
    const h = fixture();
    if (scenario === 'unknown') h.reads.identify = async () => null;
    if (scenario === 'used') h.wip.batch.wip_status = 'processed';
    if (scenario === 'void') h.wip.batch.wip_status = 'void';
    if (scenario === 'route') h.wip.batch.input_route.consumer_apparatus_ids = ['apparatus:default:other'];
    if (scenario === 'mismatched-proof') h.reads.validate = async () => ({ ...h.wip.batch, batch_id: 'different' });
    if (scenario === 'changed-route') h.reads.validate = async () => ({ ...h.wip.batch, input_route: { consumer_apparatus_ids: ['apparatus:default:other'] } });
    h.flow.toggle(); await h.flow.scan('ROLL-002');
    assert.equal(h.flow.state.phase, 'guidance', scenario); assert.equal(h.calls.filter(call => call[0] === 'write').length, 0);
    if (scenario === 'void') assert.equal(h.flow.state.message, h.p('worker.qr.roll_void'));
  }
});
test('opening WIP uses the same confirmation and never changes the opened order', async () => {
  const h = fixture(); h.wip.opening = { intake: { source_apparatus: '', resume_apparatus: station } };
  h.context.snapshot.maps[0].map.consumers = [station];
  h.flow.toggle(); await h.flow.scan('ROLL-002'); assert.equal(h.flow.state.phase, 'confirmation');
  await h.flow.confirm(); assert.equal(h.calls.filter(call => call[0] === 'write').length, 1);
  const other = fixture(); other.wip.batch.order_id = 'other-order';
  other.context.snapshot.maps[0].map.id = 'other-order'; other.context.bootstrap.control_state.order_id = 'other-order';
  other.flow.toggle(); await other.flow.scan('ROLL-002');
  assert.equal(other.flow.state.phase, 'guidance'); assert.ok(other.flow.state.message.includes(other.p('worker.qr.wrong_order_context', { opened: 'mofun keks', order: 'mofun keks' })));
  assert.equal(other.calls.filter(call => call[0] === 'write').length, 0); assert.equal(other.target.order, '0198');
});
test('frame-count rejection preserves the server counts in the V2 diagnostic', () => {
  const h = fixture(); assert.equal(merge.workerOrderMergeError({ code: 'merge_input_frame_count_mismatch',
    diagnostics: { active_kadr_count: 2, scanned_kadr_count: 3 } }, h.p),
  h.p('worker.error.merge_input_frame_count_mismatch_detail', { active: 2, scanned: 3 }));
});
test('lineage comparison ignores transport ordering; merge labels use only server sequence numbers', () => {
  const h = fixture(), links = [
    { input_batch_id: 'secret-3', sequence_no: 3, status: 'in_use' },
    { input_batch_id: 'secret-1', sequence_no: 1, status: 'processed' },
    { input_batch_id: 'secret-2', sequence_no: 2, status: 'processed' },
  ];
  assert.equal(merge.sameWorkerMergeLineage(links, links.slice().reverse()), true);
  assert.deepEqual(merge.workerMergeStateLines(links, h.p), [h.p('worker.notice.merge_complete', { next: '3-rulon', current: '2-rulon' }),
    h.p('worker.merge_state.current', { batch: '3-rulon' }), h.p('worker.merge_state.count', { count: 3 })]);
  assert.deepEqual(merge.workerMergeStateLines(links.slice(0, 1), h.p), []);
});
for (const platform of ['ios', 'android']) test(`${platform}: the real order sheet wires Merge → camera → confirmation → exact queue body`, async () => {
  const f = fixture(), h = harness(platform, { apparatus: { operation: 'cut' }, control: structuredClone(f.control),
    interaction: structuredClone(f.control.interaction), mergeReads: f.reads });
  const mergeButton = buttons(h.render()).find(button => button.props.label === h.p('worker.action.merge'));
  assert.ok(mergeButton); mergeButton.props.onPress();
  const camera = nodes(h.render(), node => node.type === 'CameraView')[0]; assert.ok(camera);
  camera.props.onBarcodeScanned({ data: 'ROLL-002' }); await tick();
  let tree = h.render();
  const dialog = nodes(tree, node => node.type === 'WorkerOrderMergeDialog')[0];
  assert.equal(dialog.props.state.phase, 'confirmation'); assert.equal(nodes(tree, node => node.type === 'CameraView').length, 0);
  assert.equal(h.actions.length, 0);
  camera.props.onBarcodeScanned({ data: 'ROLL-002' }); dialog.props.onConfirm(); dialog.props.onConfirm(); await tick();
  assert.deepEqual(h.actions, [{ apparatus: station, order_id: '0198', action: 'merge', qr_payload: 'ROLL-002', include_control: true }]);
  assert.deepEqual(h.notices, ['2-rulon 1-rulonning davomiga ulandi.']);
  tree = h.render(); assert.equal(nodes(tree, node => node.type === 'CameraView').length, 0);
  assert.equal(buttons(tree).length, 0, 'an acknowledged mutation retires the old presentation until fresh controls arrive');
});
for (const platform of ['ios', 'android']) test(`${platform}: a missing queue acknowledgement shows no merge success and waits for fresh authority before scanning`, async () => {
  const f = fixture(), h = harness(platform, { apparatus: { operation: 'cut' }, control: structuredClone(f.control),
    interaction: structuredClone(f.control.interaction), mergeReads: f.reads, runMerge: async () => ({ has_states: false }) });
  buttons(h.render()).find(button => button.props.label === h.p('worker.action.merge')).props.onPress();
  nodes(h.render(), node => node.type === 'CameraView')[0].props.onBarcodeScanned({ data: 'ROLL-002' }); await tick();
  nodes(h.render(), node => node.type === 'WorkerOrderMergeDialog')[0].props.onConfirm(); await tick();
  const tree = h.render();
  assert.equal(h.actions.length, 1); assert.deepEqual(h.notices, []);
  assert.equal(nodes(tree, node => node.type === 'WorkerOrderMergeDialog')[0].props.state.phase, 'scanning');
  assert.equal(nodes(tree, node => node.type === 'CameraView').length, 0);
});
for (const locale of ['uz', 'en', 'ru', 'ur']) test(`${locale}: confirmation preserves V2 title, body order, QR and No/Yes labels`, async () => {
  const h = fixture(), p = harness('ios', {}, locale).p;
  h.flow.toggle(); await h.flow.scan('ROLL-002');
  const view = load('components/WorkerOrderMergeDialog.tsx', { 'react-native': { Text: 'Text' },
    './WorkerFormDialog': { WorkerFormDialog: 'WorkerFormDialog' }, './WorkerAlert': { WorkerAlert: 'WorkerAlert' },
    './useWorkerOrderText': { useWorkerOrderText: () => ({ p }) }, './useWorkerColors': { useWorkerColors: () => ({ text: '#fff' }) } });
  let cancelled = 0, confirmed = 0;
  const tree = view.WorkerOrderMergeDialog({ state: h.flow.state, orderNumber: '0198', onCancel: () => cancelled++, onConfirm: () => confirmed++ });
  const dialog = nodes(tree, node => node.type === 'WorkerFormDialog')[0];
  assert.equal(dialog.props.title, p('worker.merge.confirm.title'));
  assert.deepEqual([dialog.props.cancelLabel, dialog.props.confirmLabel], [p('worker.action.no'), p('worker.merge.confirm.yes')]);
  assert.deepEqual(nodes(dialog, node => node.type === 'Text').map(node => node.props.children), [
    p('worker.merge.confirm.message', h.flow.state.labels), p('worker.merge.confirm.order', { order: '0198' }), 'QR: ROLL-002', p('worker.merge.confirm.warning')]);
  assert.equal(dialog.props.dismissOnBackdrop, true); dialog.props.onCancel(); dialog.props.onConfirm();
  assert.equal(cancelled, 1); assert.equal(confirmed, 1);
});
