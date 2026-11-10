const assert = require('node:assert/strict'), fs = require('node:fs'), Module = require('node:module'), path = require('node:path'), test = require('node:test'), ts = require('typescript');
function load(name, mocks = {}, cache = new Map()) {
  if (cache.has(name)) return cache.get(name);
  const filename = path.resolve(__dirname, '../src', `${name}.ts`), mod = new Module(filename, module); mod.filename = filename; mod.paths = module.paths;
  mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : id.startsWith('.') ? load(path.posix.join(path.posix.dirname(name), id), mocks, cache) : require(id);
  cache.set(name, mod.exports);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename); return mod.exports;
}
const mocks = { './auth': {}, './authorizedFetch': {}, './sessionReadScope': { sessionReadScope: () => 'scope' } };
const { prepareWorkerFabQr, workerFabControl, workerFabTemporaryPause, workerFabConsumers, workerFabExistingText, workerFabErrorText, workerFabVisibleCurrent, workerFabLoadedText, WorkerFabGuidance } = load('workerFabQr', mocks);
const machine = { id: 'apparatus:default:lamination_1', name: 'Laminatsiya 1', operation: 'laminate' }, station = machine.id;
const p = (key, values) => `${key}${values ? `:${JSON.stringify(values)}` : ''}`;
const session = () => ({ profile: { role: 'aparatchi', ref: 'worker' }, capabilities: ['apparatus.queue.manage'], assigned_apparatus: [station] });
function control(mode = 'fresh_start', actions = ['start']) {
  return { state: ({ fresh_start: 'pending', fresh_start_blocked: 'pending', requeued_ready: 'pending', in_progress: 'in_progress', paused: 'paused', completed: 'completed', frozen: 'frozen' })[mode],
    allowed_actions: actions, previous_stage_ready: true, complete_requires_full_report: false, stage_node_id: 'node', interaction: {
      mode, start_materials_mode: 'hidden', material_scan_required: false, assigned_materials_display_only: false, material_intake_allowed: false,
      previous_wip_mode: 'not_required', opening_wip_mode: 'not_required', qolip_mode: 'not_required', resume_input_required: false,
      ...(mode === 'fresh_start_blocked' ? { blocking_reason_code: 'apparatus_busy' } : {}),
    } };
}
function context(id, ctl, other = {}) {
  const snapshot = { epoch: 'epoch', revision: 10, scope: 'scope', maps: [{ map: { id, title: id, nodes: [], edges: [] } }],
    queue_states: { [station]: { [id]: ctl.state, ...other } }, queue_action_controls: { [station]: { [id]: ctl } }, order_controls: { [id]: { state: ctl.state === 'frozen' ? 'frozen' : 'active' } } };
  return { snapshot, bootstrap: workerFabControl(snapshot, station, id) };
}
function setup({ busy = false, temporary = false, complete = true, currentMode = 'in_progress' } = {}) {
  const target = context('target', control(busy ? 'fresh_start_blocked' : 'fresh_start', busy ? [] : ['start']), busy ? { old: 'in_progress' } : {});
  const old = context('old', control(currentMode, currentMode === 'in_progress' ? ['pause', ...(complete ? ['complete'] : [])] : []));
  if (temporary) old.bootstrap.control_state.control.temporary_pause = { session_id: 'session', token: 'a'.repeat(64) };
  const wip = { batch: { batch_id: 'batch', order_id: 'target', qr_payload: 'QR', wip_status: 'waiting', has_input_route_metadata: true, input_route: { consumer_apparatus_ids: [station] } } };
  const h = { target, old, wip, valid: true, calls: [], live: null, actor: session() };
  h.reads = { current: () => h.valid, snapshot: () => h.live,
    identify: async qr => { h.calls.push(['identify', qr]); return h.wip; },
    context: async (id, qr) => { h.calls.push(['context', id, qr]); return id === 'target' ? h.target : h.old; },
    validate: async () => { h.calls.push(['validate']); return h.wip.batch; } };
  h.run = () => prepareWorkerFabQr(h.actor, machine, 'QR', h.reads, p, id => id); return h;
}
// @v2-test test/admin_production_map_worker_fab_qr_test_part.dart
test('free apparatus opens the scanned order with its QR and no start command', async () => {
  const h = setup(); assert.deepEqual(await h.run(), { orderId: 'target', scannedOrderId: 'target', qr: 'QR', switching: false });
  assert.deepEqual(h.calls, [['identify', 'QR'], ['context', 'target', 'QR'], ['validate']]);
});
test('busy apparatus opens current order only when temporary pause or completion is actually available', async () => {
  for (const options of [{ temporary: true, complete: false }, { temporary: false, complete: true }]) {
    const h = setup({ busy: true, ...options }); assert.deepEqual(await h.run(), { orderId: 'old', scannedOrderId: 'target', qr: 'QR', switching: true });
    assert(h.calls.some(call => call[0] === 'context' && call[1] === 'old'));
  }
  const denied = setup({ busy: true, complete: false }); await assert.rejects(denied.run, /worker.waiting.apparatus_busy_detail/);
});
test('scoped occupancy replaces an older visible in-progress row, while pending reports retain their handoff', async () => {
  const h = setup(); h.live = { ...h.old.snapshot, rev: 10 }; assert.equal((await h.run()).switching, false);
  h.old = context('old', { ...control('completed', []), stage_work: { astatka_available: true, astatka_required: true } });
  h.live.worker_pending_report_ids = { [station]: ['old'] }; assert.equal((await h.run()).orderId, 'old');
});
test('full snapshots keep the newest unfinished Astatka report before opening the scanned order', async () => {
  const h = setup();
  h.old = context('old', { ...control('completed', []), stage_work: { astatka_available: true, astatka_required: true } });
  h.live = { ...h.old.snapshot, completed_orders: [
    { apparatus: station, order_id: 'old', completed_at_unix: 100 },
    { apparatus: 'other', order_id: 'old', completed_at_unix: 200 },
  ] };
  assert.equal(workerFabVisibleCurrent(h.live, station), 'old');
  assert.deepEqual(await h.run(), { orderId: 'old', scannedOrderId: 'target', qr: 'QR', switching: true });
  h.old.bootstrap.control_state.control.stage_work.astatka_required = false;
  assert.equal(workerFabVisibleCurrent(h.live, station), undefined);
  assert.equal((await h.run()).switching, false);
});
test('compact current-order discovery skips frozen rows and never invents a hidden report row', () => {
  const live = { projection: 'worker_list_v1', queue_states: { [station]: { frozen: 'in_progress' } },
    order_controls: { frozen: 'frozen' }, worker_list_rows: { old: { title: 'Old' } },
    worker_pending_report_ids: { [station]: ['hidden', 'old'] } };
  assert.equal(workerFabVisibleCurrent(live, station), undefined);
  live.worker_pending_report_ids[station] = ['old'];
  assert.equal(workerFabVisibleCurrent(live, station), 'old');
  live.order_statuses = { old: { order_status: 'frozen' } };
  assert.equal(workerFabVisibleCurrent(live, station), undefined);
});
test('same target already occupying the apparatus does not start or open a stop flow', async () => {
  const h = setup(); h.target = context('target', control('in_progress', ['pause', 'complete']));
  await assert.rejects(h.run, /worker.qr.active/); assert(!h.calls.some(call => call[1] === 'old'));
});
test('resume that needs an input may open; resume without a new input gives existing-order guidance', async () => {
  const h = setup(), ctl = control('requeued_ready', ['resume']); ctl.interaction.resume_input_required = true; h.target = context('target', ctl);
  assert.equal((await h.run()).orderId, 'target'); ctl.interaction.resume_input_required = false; await assert.rejects(h.run, /worker.qr.requeued_resume/);
});
test('prepared proof suppresses duplicate lookup but must describe the identified waiting batch', async () => {
  const h = setup(); h.target.bootstrap.validated_progress = { batch: { ...h.wip.batch } };
  await h.run(); assert(!h.calls.some(call => call[0] === 'validate'));
  for (const value of [{ batch_id: 'other' }, { order_id: 'other' }, { wip_status: 'in_use' }]) {
    h.target.bootstrap.validated_progress.batch = { ...h.wip.batch, ...value }; await assert.rejects(h.run, error => error.code === 'worker_qr_sync');
  }
});
test('wrong apparatus never retargets the selected tab or reaches scoped validation', async () => {
  const h = setup(); h.wip.batch.input_route.consumer_apparatus_ids = ['apparatus:default:other'];
  await assert.rejects(h.run, /worker.qr.route_destination.*worker.qr.wrong_stage/); assert(!h.calls.some(call => call[0] === 'validate'));
  h.actor.assigned_apparatus = []; await assert.rejects(h.run, /worker.qr.no_assignment/);
});
test('wrong-stage guidance resolves an alternative group label before catalog or node labels', async () => {
  const h = setup(); h.wip.batch.apparatus = 'source'; h.wip.batch.input_route.consumer_apparatus_ids = ['other'];
  h.target.snapshot.maps[0].map.nodes = [{ id: 'node', kind: 'apparatus', apparatus_id: 'other', title: 'Node label',
    alternative_group_id: 'group', alternative_group_label: 'Laminatsiya guruhi' }];
  await assert.rejects(h.run, error => error.message.includes('Laminatsiya guruhi') && error.message.includes(machine.name));
  assert(!h.calls.some(call => call[0] === 'validate'));
});
test('used, void and unknown QR stop before a context read', async () => {
  for (const [status, message] of [['in_use', 'worker.error.wip_in_use'], ['processed', 'worker.error.wip_used'], ['void', 'worker.qr.roll_void']]) {
    const h = setup(); h.wip.batch.wip_status = status; await assert.rejects(h.run, error => error.message === message); assert.equal(h.calls.length, 1);
  }
  const h = setup(); h.wip = null; await assert.rejects(h.run, /worker.qr.not_found/);
});
test('loaded-roll guidance includes the apparatus and active or resumable order only with a consistent full snapshot', () => {
  const h = setup(); const wip = { batch: { order_id: 'old', wip_status: 'in_use', used_by_apparatus: station } };
  const labels = id => id === station ? machine.name : id;
  assert.match(workerFabLoadedText(wip, h.old.snapshot, h.actor, p, labels), /worker.qr.roll_in_use.*worker.qr.loaded_active/);
  h.old = context('old', control('paused', ['resume']));
  assert.match(workerFabLoadedText(wip, h.old.snapshot, h.actor, p, labels), /worker.qr.resume_loaded_roll/);
  assert.doesNotMatch(workerFabLoadedText(wip, h.old.snapshot, { ...h.actor, assigned_apparatus: [] }, p, labels), /resume_loaded_roll/);
  assert.equal(workerFabLoadedText(wip, { ...h.old.snapshot, projection: 'worker_list_v1' }, h.actor, p, labels), 'worker.error.wip_in_use');
  assert.equal(workerFabLoadedText(wip, h.old.snapshot, h.actor, p, id => id), 'worker.error.wip_in_use');
});
test('freeze and a newer live cursor cannot enable a start or switch', async () => {
  const h = setup(); h.target = context('target', control('frozen', [])); await assert.rejects(h.run, /worker.freeze.named/);
  const stale = setup(); stale.live = { epoch: 'epoch', rev: 11 }; await assert.rejects(stale.run, error => error.code === 'worker_qr_sync');
});
test('account or tab loss after each await stops every following read and handoff', async () => {
  for (const phase of ['identify', 'context', 'validate']) {
    const h = setup(); const original = h.reads[phase]; h.reads[phase] = async (...args) => { const value = await original(...args); h.valid = false; return value; };
    await assert.rejects(h.run, error => error.code === 'worker_qr_sync'); assert.equal(h.calls.at(-1)[0], phase);
  }
});
test('temporary pause requires assigned operator, capability, non-training identity and consistent active control', () => {
  const h = setup({ busy: true, temporary: true }), data = h.old.bootstrap;
  assert(workerFabTemporaryPause(h.actor, station, 'old', data, true));
  for (const actor of [{ ...h.actor, capabilities: [] }, { ...h.actor, assigned_apparatus: [] }, { ...h.actor, profile: { role: 'admin' } }]) assert.equal(workerFabTemporaryPause(actor, station, 'old', data, true), null);
  assert.equal(workerFabTemporaryPause(h.actor, station, 'old', data, false), null);
  data.control_state.order_id = 'training-old'; assert.equal(workerFabTemporaryPause(h.actor, station, 'training-old', data, true), null);
});
test('opening WIP follows its concrete next work stage, including alternative apparatus occurrences', () => {
  const map = { nodes: [{ id: 'start', kind: 'start' }, { id: 'source', kind: 'apparatus', apparatus_id: 'apparatus:default:print' },
    { id: 'target', kind: 'apparatus', apparatus_id: station, alternative_group_id: 'g' },
    { id: 'alternative', kind: 'apparatus', apparatus_id: 'apparatus:default:other', alternative_group_id: 'g' }], edges: [{ from: 'start', to: 'source' }, { from: 'source', to: 'target' }] };
  const wip = { batch: {}, opening: { intake: { source_apparatus: 'apparatus:default:print', resume_stage_node_id: 'source' } } };
  assert.deepEqual(workerFabConsumers(wip, map), [station, 'apparatus:default:other']);
  wip.opening.intake = { source_apparatus: '', resume_stage_node_id: 'target', resume_apparatus: station }; assert.deepEqual(workerFabConsumers(wip, map), [station, 'apparatus:default:other']);
  wip.opening.intake.resume_stage_node_id = 'missing'; assert.deepEqual(workerFabConsumers(wip, map), []);
});
test('existing-order guidance retains merge, closing roll, report and joined-resume branches', () => {
  for (const [ctl, key] of [
    [control('in_progress', ['pause', 'merge']), 'worker.qr.active_merge'],
    [{ ...control('in_progress', ['pause', 'roll_complete']), rezka_output_report: { frames: [{}] } }, 'worker.qr.finish_roll_first'],
    [{ ...control('paused', ['complete']), closing_output_batch_id: 'roll' }, 'worker.qr.closing_roll'],
    [{ ...control('completed', []), stage_work: { astatka_available: true, astatka_required: true } }, 'worker.qr.completed_report'],
  ]) assert(workerFabExistingText({ control_state: { control: ctl } }, 'machine', 'order', true, p).startsWith(key));
  assert.match(workerFabExistingText({ control_state: { control: control('paused', ['resume']) } }, 'machine', 'order', true, p), /worker.qr.join_after_resume/);
});
test('QR errors retain V2 keyed messages instead of showing raw internal codes', () => {
  for (const [error, key] of [[{ code: 'worker_qr_sync' }, 'worker.error.sync'], [{ code: 'progress_qr_validation_missing' }, 'worker.qr.invalid_response'],
    [{ code: 'forbidden' }, 'worker.qr.forbidden'], [{ statusCode: 500 }, 'worker.qr.server'], [{ name: 'AbortError' }, 'worker.error.network_timeout']]) assert.equal(workerFabErrorText(error, p), key);
  assert.equal(workerFabErrorText(new WorkerFabGuidance('guidance'), p), 'guidance');
});
