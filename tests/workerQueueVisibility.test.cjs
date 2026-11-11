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

const appearance = load('workerOrderAppearance');
const scope = load('sessionReadScope');
const controls = load('workerControlsApi', { './authorizedFetch': {}, './sessionReadScope': scope });
const models = load('workerQueueModels', { './workerControlsApi': controls });
const decisions = load('productionCompletionApi', { './workerControlsApi': controls, './workerQueueModels': models, './authorizedFetch': {} });
const snapshotDecoder = load('workerSnapshot', { './workerControlsApi': controls, './workerQueueModels': models, './productionCompletionApi': decisions });
const { workerMachinesFromSnapshot, queueFromSnapshot, canWorkOnApparatus, workerOrderDetailFromSnapshot, workerOrderIsFrozen } = load('workerApi', {
  './workerOrderAppearance': appearance, './workerQueueLimit': { DEFAULT_QUEUE_LIMIT: 10 }, './authorizedFetch': {}, './workerQueueReadApi': {}, './workerQueueReadError': {}, './workerSnapshot': snapshotDecoder,
  './workerDetailApi': {}, './sessionReadScope': scope, './apparatusApi': {},
});

const machine = (id, name, operation) => ({ runtime_projection: { apparatus_id: id, display: { display_name: name }, execution_profile: { operation } } });
const catalog = [machine('cut', 'Kesish', 'cut'), machine('press', 'Bosma', 'print'), machine('press2', 'Bosma 2', 'print')];
const assigned = ['press'];

test('machine visibility follows the server flag and starts with an assigned machine', () => {
  assert.deepEqual(workerMachinesFromSnapshot(catalog, {}, assigned).map(item => item.id), ['press']);
  assert.deepEqual(workerMachinesFromSnapshot(catalog, { worker_show_all_apparatus_tabs: false }, assigned).map(item => item.id), ['press']);
  assert.deepEqual(workerMachinesFromSnapshot(catalog, { worker_show_all_apparatus_tabs: true }, assigned).map(item => item.id), ['press', 'cut', 'press2']);
  assert.deepEqual(workerMachinesFromSnapshot(catalog, { worker_show_all_apparatus_tabs: 'true' }, assigned).map(item => item.id), ['press']);
  assert.equal(workerMachinesFromSnapshot(catalog, {}, ['press2', 'cut'])[0].id, 'press2');
});

test('the current account profile refreshes stale login assignments for the queue', async () => {
  const profile = { role: 'aparatchi', ref: 'worker', assigned_apparatus: ['press', 'press2', 'cut'], assigned_apparatus_labels: ['Bosma', 'Bosma 2', 'Kesish'] };
  const api = load('workerApi', {
    './workerOrderAppearance': appearance,
    './workerQueueLimit': { DEFAULT_QUEUE_LIMIT: 10 },
    './workerQueueReadApi': {}, './workerQueueReadError': {}, './workerSnapshot': snapshotDecoder,
    './workerDetailApi': {}, './sessionReadScope': scope, './apparatusApi': { adminApparatus: async () => catalog },
    './authorizedFetch': { authorizedFetch: async (_session, url) => ({ ok: true, json: async () =>
      url === '/v1/mobile/profile' ? profile : url.includes('/apparatus?') ? catalog : {
        projection: 'worker_list_v1', epoch: 'e', scope: 's', rev: 1, worker_show_all_apparatus_tabs: false,
        worker_list_rows: {}, worker_display_states: {}, worker_report_prompts: {}, sequences: {}, visible_order_ids: {},
        queue_states: {}, queue_policies: [], order_controls: {}, completed_orders: [], completion_requests: [], completion_request_decisions: [],
      },
    }) },
  });
  const session = { profile: { role: 'aparatchi', ref: 'worker' }, assigned_apparatus: ['press'], assigned_apparatus_labels: ['Bosma'] };
  const fresh = await api.loadWorkerQueue(session);
  assert.deepEqual(fresh.catalog.map(item => item.id), ['cut', 'press', 'press2']);
  assert.deepEqual(fresh.machines.map(item => item.id), ['press', 'cut', 'press2']);
  assert.deepEqual(fresh.assignedIds, ['press', 'press2', 'cut']);
  assert.deepEqual(fresh.assignedLabels, ['Bosma', 'Bosma 2', 'Kesish']);
  profile.ref = 'different-worker';
  const rejected = await api.loadWorkerQueue(session);
  assert.deepEqual(rejected.machines.map(item => item.id), ['press']);
  assert.deepEqual(rejected.assignedIds, ['press']);
});

// @v2-test test/admin_production_map_test_screen_test.dart
test('work and scan access follows assignments for every apparatus operation', () => {
  const machines = workerMachinesFromSnapshot(catalog, { worker_show_all_apparatus_tabs: true }, assigned);
  assert.equal(canWorkOnApparatus(machines.find(item => item.id === 'press'), assigned), true);
  assert.equal(canWorkOnApparatus(machines.find(item => item.id === 'press2'), assigned), false);
  for (const operation of ['print', 'laminate', 'glue', 'cut', 'package', 'other']) {
    assert.equal(canWorkOnApparatus({ id: 'apparatus', operation }, [' apparatus ']), true, operation);
    assert.equal(canWorkOnApparatus({ id: 'apparatus', operation }, ['another']), false, operation);
  }
  assert.equal(canWorkOnApparatus(machines.find(item => item.id === 'cut'), ['cut']), true);
  assert.equal(canWorkOnApparatus({ id: '   ', operation: 'print' }, [' ']), false);
  assert.equal(canWorkOnApparatus(undefined, assigned), false);
});

test('watchable machine queues do not add other workers completed history', () => {
  const machines = workerMachinesFromSnapshot(catalog, { worker_show_all_apparatus_tabs: true }, assigned);
  const snapshot = {
    worker_list_rows: { one: { title: 'One' }, two: { title: 'Two' } },
    visible_order_ids: { press: ['one'], cut: ['two'] },
    completed_orders: [
      { apparatus: 'press', order_id: 'one', status: 'completed' },
      { apparatus: 'cut', order_id: 'two', status: 'completed' },
    ],
  };
  const queue = queueFromSnapshot(machines, snapshot, assigned);
  assert.deepEqual(queue.orders.cut.map(order => order.id), ['two']);
  assert.deepEqual(queue.completed.map(order => order.id), ['one']);
});

// @v2-test test/admin_production_map_test_screen_test.dart
test('frozen checks and completed history accept raw, decoded and order-status snapshots', () => {
  for (const fields of [{ order_controls: { one: { state: 'frozen' } } }, { order_controls: { one: 'frozen' } },
    { order_controls: { one: 'active' }, order_statuses: { one: { order_status: ' Frozen ' } } }]) {
    const snapshot = { ...fields, worker_list_rows: { one: { title: 'One' } },
      completed_orders: [{ apparatus: 'press', order_id: 'one', status: 'completed' }] };
    assert.equal(workerOrderIsFrozen(snapshot, ' one '), true);
    assert.deepEqual(queueFromSnapshot([{ id: 'press' }], snapshot, ['press']).completed, []);
  }
  assert.equal(workerOrderIsFrozen(undefined, 'one'), false);
  assert.equal(workerOrderIsFrozen({ order_controls: { one: 'freeze_requested' } }, 'one'), false);
  assert.equal(workerOrderIsFrozen({ queue_states: { press: { one: 'frozen' } } }, 'one'), false);
});
test('decoded freeze-requested order control keeps the existing queue-card tone', () => {
  const queue = queueFromSnapshot([{ id: 'press' }], { worker_list_rows: { one: { title: 'One' } },
    visible_order_ids: { press: ['one'] }, queue_states: { press: { one: 'pending' } }, order_controls: { one: 'freeze_requested' } }, ['press']);
  assert.equal(queue.orders.press[0].cardTone, 'frozen');
});

test('temporary-pause row marker follows canonical control or exact paused compact apparatus membership', () => {
  const base = { worker_list_rows: { one: { title: 'One', temporarily_paused_apparatus: ['press'] } },
    visible_order_ids: { press: ['one'], cut: ['one'] }, queue_states: { press: { one: 'paused' }, cut: { one: 'paused' } } };
  const build = snapshot => queueFromSnapshot([{ id: 'press' }, { id: 'cut' }], snapshot, ['press']);
  let rows = build(base).orders;
  assert.equal(rows.press[0].temporarilyPaused, true); assert.equal(rows.cut[0].temporarilyPaused, undefined);
  rows = build({ ...base, queue_states: { press: { one: 'in_progress' } } }).orders;
  assert.equal(rows.press[0].temporarilyPaused, undefined);
  const canonical = { maps: [{ map: { id: 'one', title: 'One' } }], visible_order_ids: { press: ['one'] },
    queue_states: { press: { one: 'paused' } }, queue_action_controls: { press: { one: { temporarily_paused: true } } } };
  assert.equal(build(canonical).orders.press[0].temporarilyPaused, true);
  assert.equal(build({ ...canonical, queue_action_controls: { press: { one: { temporarily_paused: 'true' } } } }).orders.press[0].temporarilyPaused, undefined);
});

test('order detail follows the assigned V2 display path and prefers occurrence status', () => {
  const map = {
    id: 'order', customer_name: 'Fallback',
    nodes: [
      { id: 'end', kind: 'end', title: 'Yakun' },
      { id: 'press-a', kind: 'apparatus', apparatus_id: 'a', alternative_group_id: 'print', alternative_assigned_apparatus_id: 'b' },
      { id: 'start', kind: 'start', title: 'Boshlanish' },
      { id: 'press-b', kind: 'apparatus', apparatus_id: 'b', title: 'Bosma B', alternative_group_id: 'print' },
    ],
    edges: [{ from: 'start', to: 'press-a' }, { from: 'start', to: 'press-b' }, { from: 'press-b', to: 'end' }],
  };
  const detail = workerOrderDetailFromSnapshot({
    maps: [{ map }], order_customers: { order: 'Customer' }, stage_states: { order: { 'press-b': 'paused' } },
    queue_states: { b: { order: 'in_progress' } },
  }, 'order');
  assert.equal(detail.customer, 'Customer');
  assert.deepEqual(detail.stages.map(stage => stage.id), ['start', 'press-b', 'end']);
  assert.deepEqual(detail.stages[1], { id: 'press-b', apparatusId: 'b', title: 'Bosma B', state: 'paused' });
});
