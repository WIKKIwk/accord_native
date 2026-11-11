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
const { queueFromSnapshot } = load('workerApi', { './workerOrderAppearance': appearance, './workerQueueLimit': { DEFAULT_QUEUE_LIMIT: 0 },
  './authorizedFetch': {}, './workerQueueReadApi': {}, './workerQueueReadError': {}, './workerSnapshot': snapshotDecoder, './workerDetailApi': {}, './sessionReadScope': scope, './apparatusApi': {} });
const { applyWorkerDelta } = load('workerDelta', { './workerQueueReadApi': {}, './workerQueueReadError': {}, './workerSnapshot': snapshotDecoder });

test('queue cards use the selected apparatus and update from live display states', () => {
  const press1 = 'apparatus:default:press1', press2 = 'apparatus:default:press2';
  const snapshot = {
    projection: 'worker_list_v1', epoch: 'e', scope: 's', rev: 1,
    worker_list_rows: { a: { id: 'a', code: '1', title: 'A', customer_name: '', image_id: '' } },
    sequences: { [press1]: ['a'], [press2]: ['a'] }, visible_order_ids: { [press1]: ['a'], [press2]: ['a'] },
    queue_states: { [press1]: { a: 'in_progress' }, [press2]: { a: 'paused' } },
    worker_display_states: { [press1]: { a: 'in_progress' }, [press2]: { a: 'paused' } },
    worker_report_prompts: {}, queue_policies: [], order_controls: {}, completed_orders: [], completion_requests: [], completion_request_decisions: [],
  };
  const machines = [{ id: press1, name: 'Press 1', operation: 'print' }, { id: press2, name: 'Press 2', operation: 'print' }];
  const assigned = [press1, press2];
  const before = queueFromSnapshot(machines, snapshot, assigned);
  assert.equal(before.orders[press1][0].cardTone, 'in_progress');
  assert.equal(before.orders[press2][0].cardTone, 'paused');
  const updated = applyWorkerDelta(snapshot, { ok: true, type: 'state_delta', protocol: 'state_delta_v2', epoch: 'e', scope: 's', base_rev: 1, rev: 2,
    patch: { worker_display_states: { scopes: { [press1]: { upsert: { a: 'print_preflight_passed' }, remove: [] } }, remove: [] } } });
  assert.ok(updated);
  const after = queueFromSnapshot(machines, updated, assigned);
  assert.equal(after.orders[press1][0].cardTone, 'print_preflight_passed');
  assert.equal(after.orders[press2][0].cardTone, 'paused');
  updated.worker_display_states[press2].a = 'in_progress';
  assert.equal(queueFromSnapshot(machines, updated, assigned).orders[press2][0].state, 'paused');
});

test('V2 colors, completed rows and paused-state precedence are preserved', () => {
  assert.equal(appearance.workerOrderTone('in_progress', 'paused', 'active'), 'paused');
  assert.equal(appearance.workerOrderTone('', 'pending', 'freeze_requested'), 'frozen');
  assert.equal(appearance.workerOrderTone('issue', 'in_progress', 'active'), 'issue');
  assert.deepEqual(appearance.orderCardAppearance('neutral', '#FFFFFFFF', false), {});
  assert.equal(appearance.orderCardAppearance('in_progress', '#FFFFFFFF', false).color, '#ddeade');
  assert.equal(appearance.orderCardAppearance('paused', '#FFFFFFFF', false).color, '#fef1dc');
  assert.equal(appearance.orderCardAppearance('frozen', '#FFFFFFFF', false).color, '#f6dcdc');
  assert.match(appearance.orderCardAppearance('print_preflight', '#FFFFFFFF', false).gradient, /#7E86A8.*52%.*#F4FAFC/);
  assert.match(appearance.orderCardAppearance('print_preflight_passed', '#FFFFFFFF', false).gradient, /#4B8F2F.*38%.*70%.*#FFFFFF/);
  assert.equal(appearance.orderCardAppearance(appearance.completedOrderTone('in_progress'), '#FFFFFF', false).color, '#FFECB3');
  assert.equal(appearance.orderCardAppearance(appearance.completedOrderTone('completed'), '#FFFFFF', false).color, '#C8E6C9');
});
