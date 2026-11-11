const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

function load(name, mocks = {}) {
  const filename = path.resolve(__dirname, `../src/${name}.ts`), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths;
  mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return mod.exports;
}
const scope = load('sessionReadScope');
const controls = load('workerControlsApi', { './authorizedFetch': {}, './sessionReadScope': scope });
const logic = load('workerOrderLogic', { './workerControlsApi': controls });
const longPress = load('workerLongPress', { './authorizedFetch': {}, './workerControlsApi': controls,
  './workerOrderLogic': logic, './sessionReadScope': scope, './apparatusApi': { apparatusUsesLaminationWorkflow: operation => ['laminate', 'glue'].includes(operation) },
  './workerPrintPreflight': {}, './workerScanBootstrap': {}, './workerLegacyScan': {} });
const exceptions = load('shared/mobileApiException');
const station = 'apparatus:default:p';
function snapshot(state = 'in_progress', rev = 7) {
  return { epoch: 'e', scope: 's', rev, maps: [{ map: { id: 'o', nodes: [{ id: 'stage', kind: 'apparatus', apparatus_id: station }] } }],
    queue_states: { [station]: { o: state } }, order_controls: { o: 'active' }, stage_states: {},
    queue_action_controls: { [station]: { o: { state, stage_node_id: 'stage', allowed_actions: state === 'pending' ? ['start'] : state === 'paused' ? ['resume'] : ['pause', 'complete'],
      previous_stage_ready: true, complete_requires_full_report: true,
      interaction: { mode: state === 'pending' ? 'fresh_start' : state, start_materials_mode: 'hidden', material_scan_required: false,
        assigned_materials_display_only: true, material_intake_allowed: true, previous_wip_mode: 'not_required', qolip_mode: 'not_required', resume_input_required: false } } } } };
}
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
function setup(overrides = {}) {
  const h = { reads: [], notices: [], previews: [], batches: 0, alive: true, cursor: { epoch: 'e', rev: 7 }, ...overrides };
  const session = { token: 'token', baseUrl: 'https://example.test', profile: { role: 'aparatchi', ref: 'worker' },
    assigned_apparatus: [station], capabilities: ['apparatus.queue.manage'] };
  const review = { target: null, reason: 'unavailable' };
  const { prepareWorkerLongPress } = load('workerLongPressPreparation', {
    './shared/mobileApiException': exceptions, './workerControlsApi': controls, './workerLongPress': longPress,
    './workerDetailApi': { workerProductionOrderDetail: async (...args) => { h.reads.push(args); return h.read ? h.read(...args) : snapshot(); } },
    './workerWipApi': { adminWipBatches: async () => { h.batches++; if (h.batchError) throw h.batchError; return h.batchResult ?? []; } },
    './workerHandoff': { workerHandoffBatch: values => values[0] },
    './workerWipReactivation': { prepareWorkerWipReactivation: async (_s, input) => { h.previews.push(input); return review; } },
  });
  const p = key => key;
  const run = ({ operation = 'print', completed = false, signal = new AbortController().signal } = {}) =>
    prepareWorkerLongPress(session, { id: station, name: 'Bosma', operation }, { id: 'o' }, completed,
      () => h.cursor, () => h.alive, signal, p, value => h.notices.push(value));
  return Object.assign(h, { run, session, review });
}

// V2 _showWatchOrderLongPress checks action authority before presenting a surface.
test('pending print long press with no report produces no sheet, while a prior remainder opens astatka directly', async () => {
  const detail = snapshot('pending'), h = setup({ read: () => detail });
  assert.deepEqual(await h.run(), { kind: 'none' });
  detail.queue_action_controls[station].o.stage_work = { astatka_available: true };
  assert.deepEqual(await h.run(), { kind: 'astatka' });
  assert.equal(h.reads.length, 2, 'each new gesture reads fresh authority, with no completed-read cache');
});

test('a print menu is ready after one scoped detail read and completed history uses that same full graph', async () => {
  const detail = snapshot(), h = setup({ read: () => detail });
  const prepared = await h.run();
  assert.equal(prepared.kind, 'menu'); assert.deepEqual(prepared.menu.actions, ['astatka', 'finish']);
  assert.equal(h.reads.length, 1); assert.equal(h.reads[0][1], station); assert.equal(h.reads[0][2], 'o');
  assert.equal(h.previews.length, 0);
  assert.deepEqual(await h.run({ completed: true }), { kind: 'reactivation', reactivation: h.review });
  assert.equal(h.reads.length, 2); assert.equal(h.previews.length, 1);
  assert.equal(h.previews[0].map, detail.maps[0].map);
});

test('V2 stale-detail retry catches a live revision that advances while the first read is pending', async () => {
  const first = deferred(), h = setup({ read: () => h.reads.length === 1 ? first.promise : snapshot('in_progress', 9) });
  const pending = h.run(); h.cursor.rev = 9; first.resolve(snapshot('in_progress', 7));
  assert.equal((await pending).kind, 'menu'); assert.equal(h.reads.length, 2);
});

test('two stale responses preserve the V2 error and a later gesture can recover', async () => {
  const h = setup({ read: () => snapshot('in_progress', 6) });
  await assert.rejects(h.run(), error => error.code === 'order_page_changed' && error.message === 'Buyurtma yangilandi. Qayta oching.');
  assert.equal(h.reads.length, 2);
  h.read = () => snapshot(); assert.equal((await h.run()).kind, 'menu'); assert.equal(h.reads.length, 3);
});

test('a failed network read is not retried or cached and the next gesture succeeds', async () => {
  const failure = new TypeError('Network request failed'), h = setup({ read: () => { throw failure; } });
  await assert.rejects(h.run(), error => error === failure); assert.equal(h.reads.length, 1);
  h.read = () => snapshot(); assert.equal((await h.run()).kind, 'menu'); assert.equal(h.reads.length, 2);
});

test('window or account retirement drops the delayed result before any menu or preview', async () => {
  const read = deferred(), h = setup({ read: () => read.promise });
  const pending = h.run({ completed: true }); h.alive = false; read.resolve(snapshot());
  assert.deepEqual(await pending, { kind: 'none' }); assert.equal(h.previews.length, 0);
});

test('cancelling a pending gesture aborts its request and cannot keep a new gesture waiting', async () => {
  const read = deferred(), controller = new AbortController(), h = setup({ read: () => read.promise });
  const pending = h.run({ signal: controller.signal });
  const rejected = assert.rejects(pending, /cancelled/); controller.abort(); await rejected;
  assert.equal(h.reads[0][3].aborted, true);
  h.read = () => snapshot(); assert.equal((await h.run()).kind, 'menu'); read.resolve(snapshot());
});

test('both stale attempts share the V2 five-second deadline', async context => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  const never = deferred();
  const h = setup({ read: () => h.reads.length === 1 ? snapshot('in_progress', 6) : never.promise });
  const pending = h.run(), rejected = assert.rejects(pending, /timed out/);
  for (let i = 0; i < 10; i++) await Promise.resolve();
  assert.equal(h.reads.length, 2); context.mock.timers.tick(5000); await rejected;
  assert.ok(h.reads.every(args => args[3].aborted));
});

test('lamination handoff is prepared before display; a failed lookup keeps the source report menu and notice', async () => {
  const h = setup({ read: () => snapshot('paused'), batchResult: [{}] });
  const prepared = await h.run({ operation: 'laminate' });
  assert.equal(prepared.menu.kind, 'handoff'); assert.deepEqual(prepared.menu.actions, ['resume', 'detach_roll', 'astatka']);
  h.batchError = new Error('Network');
  assert.equal((await h.run({ operation: 'laminate' })).menu.kind, 'report');
  assert.deepEqual(h.notices, ['worker.error.machine_roll']);
});

test('the source direct-astatka branch precedes a glue handoff lookup', async () => {
  const detail = snapshot('paused'); detail.queue_action_controls[station].o.stage_work = { astatka_available: true };
  const h = setup({ read: () => detail, batchResult: [{}] });
  assert.deepEqual(await h.run({ operation: 'glue' }), { kind: 'astatka' }); assert.equal(h.batches, 0);
});

test('long press feedback is immediate on both platforms and does not gate the read on haptic availability', async () => {
  for (const platform of ['ios', 'android']) {
    const calls = [], never = deferred();
    const { workerLongPressFeedback } = load('workerLongPressFeedback', {
      'react-native': { Platform: { OS: platform } },
      'expo-haptics': { ImpactFeedbackStyle: { Heavy: 'heavy' }, AndroidHaptics: { Long_Press: 'long-press' },
        impactAsync: value => { calls.push(value); return never.promise; },
        performAndroidHapticsAsync: value => { calls.push(value); return never.promise; } },
    });
    assert.equal(workerLongPressFeedback(), undefined);
    assert.deepEqual(calls, [platform === 'ios' ? 'heavy' : 'long-press']); never.resolve();
  }
});
