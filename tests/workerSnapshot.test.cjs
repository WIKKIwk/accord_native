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
  loaded.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText, filename);
  return loaded.exports;
}
const scope = load('sessionReadScope');
const controls = load('workerControlsApi', { './authorizedFetch': {}, './sessionReadScope': scope });
const decoder = load('workerSnapshot', { './workerControlsApi': controls });
const { applyWorkerDelta } = load('workerDelta', { './workerSnapshot': decoder });
const station = 'apparatus:default:bosma_7';
function fixture() {
  const record = loadContract('worker_list_api_test').find(item => item.test.startsWith('worker HTTP and v2 socket'));
  return JSON.parse(record.responseBody.text);
}
function delta(patch) {
  return { ok: true, type: 'state_delta', protocol: 'state_delta_v2', epoch: 'worker-server',
    scope: 'worker-list-scope', base_rev: 7, rev: 8, patch };
}
const field = (upsert = {}, remove = []) => ({ upsert, remove });
const nested = (scopePatch) => ({ scopes: { [station]: scopePatch }, remove: [] });

test('worker queue sends the compact request recorded from V2', async () => {
  const name = 'worker HTTP and v2 socket opt into same compact projection, admin unaffected';
  const replay = contractFetch('worker_list_api_test', name);
  const session = Object.assign(recordedSession('worker_list_api_test', name), {
    profile: { role: 'aparatchi', ref: 'worker' }, capabilities: [], assigned_apparatus: [station], assigned_apparatus_labels: ['Bosma'],
  });
  const appearance = load('workerOrderAppearance');
  const api = load('workerApi', {
    './workerOrderAppearance': appearance, './workerQueueLimit': { DEFAULT_QUEUE_LIMIT: 10 }, './workerSnapshot': decoder,
    './workerDetailApi': {}, './sessionReadScope': scope, './apparatusApi': { adminApparatus: async () => [
      { runtime_projection: { apparatus_id: station, display: { display_name: 'Bosma' }, execution_profile: { operation: 'print' } } },
    ] },
    './authorizedFetch': { authorizedFetch: async (s, url, init) => {
      if (url.startsWith('/v1/mobile/admin/production-maps/sequence')) {
        return replay(new URL(url, s.baseUrl), { ...init, headers: { ...init.headers, Authorization: `Bearer ${s.token}` } });
      }
      if (url.startsWith('/v1/mobile/admin/apparatus')) return { ok: true, json: async () => [
        { runtime_projection: { apparatus_id: station, display: { display_name: 'Bosma' }, execution_profile: { operation: 'print' } } },
      ] };
      return { ok: true, json: async () => ({ role: 'aparatchi', ref: 'worker', assigned_apparatus: [station] }) };
    } },
  });
  const result = await api.loadWorkerQueue(session, 'old', 10);
  assert.equal(result.orders[station][0].title, 'Mahsulot 😀');
  assert.equal(result.completed[0].id, 'work-history');
  replay.assertDone();
});

test('V2 compact worker snapshot keeps rows, order, prompts and completed history', () => {
  const result = decoder.decodeWorkerListSnapshot(fixture());
  assert.equal(result.worker_list_rows['work-1'].title, 'Mahsulot 😀');
  assert.deepEqual(result.worker_pending_report_ids[station], ['work-history', 'work-2']);
  assert.equal(result.worker_report_prompts[station]['work-2'].report_session_id, 'report-1');
  assert.deepEqual(result.visible_order_ids[station], ['work-1', 'work-2']);
  assert.equal(result.completed_orders[0].order_id, 'work-history');
  assert.equal('queue_action_controls' in result, false);
});

test('V2 compact snapshot rejects malformed identity, membership and authority', () => {
  const changes = [
    w => { w.worker_list_rows['work-1'].id = 'wrong'; },
    w => { delete w.worker_list_rows['work-1'].customer_name; },
    w => { delete w.worker_list_rows['work-1']; },
    w => { delete w.worker_list_rows['work-history']; },
    w => { w.worker_list_rows = []; },
    w => { w.worker_list_rows['work-2'].temporarily_paused_apparatus = station; },
    w => { w.worker_list_rows['work-2'].temporarily_paused_apparatus = ['bad']; },
    w => { w.worker_list_rows['work-2'].temporarily_paused_apparatus = [station, station]; },
    w => { w.worker_list_rows['work-2'].temporarily_paused_apparatus = [station]; },
    w => { w.worker_pending_report_ids = { bad: [] }; },
    w => { w.worker_pending_report_ids[station] = ['work-1', 'work-1']; },
    w => { w.worker_pending_report_ids[station] = ['unknown']; },
    w => { w.worker_pending_report_ids[station] = [1]; },
    w => { w.worker_display_states[station]['work-1'] = 'unknown'; },
    w => { delete w.worker_display_states[station]['work-1']; },
    w => { w.worker_display_states.bad = {}; },
    w => { w.worker_display_states[station].unrelated = 'pending'; },
    w => { w.worker_report_prompts[station]['work-2'].report_session_id = ''; },
    w => { delete w.worker_report_prompts[station]['work-2'].upstream_title; },
    w => { w.worker_report_prompts[station].unrelated = { report_session_id: 'x', upstream_title: 'x' }; },
    w => { w.order_controls['work-1'].actor = 'unwanted'; },
    w => { w.order_controls['work-1'].state = 'bad'; },
    w => { delete w.queue_states[station]['work-1']; },
    w => { w.queue_policies[0].policy = 'bad'; },
    w => { w.epoch = ''; }, w => { w.scope = ''; }, w => { w.rev = 7.5; }, w => { w.completed_orders = null; },
    ...['maps', 'queue_action_controls', 'stage_order_controls', 'stage_states', 'order_statuses',
      'frozen_orders_by_apparatus', 'calculation_templates', 'order_customers'].map(key => w => { w[key] = {}; }),
  ];
  changes.forEach((change, index) => {
    const value = fixture(); change(value);
    assert.throws(() => decoder.decodeWorkerListSnapshot(value), undefined, `mutation ${index}`);
  });
});

test('worker deltas apply atomically and preserve unrelated row identity', () => {
  const before = decoder.decodeWorkerListSnapshot(fixture());
  const after = applyWorkerDelta(before, delta({
    worker_list_rows: field({ 'work-1': { ...before.worker_list_rows['work-1'], title: 'Changed' } }),
    worker_display_states: nested(field({ 'work-1': 'issue' })),
    worker_report_prompts: nested(field({}, ['work-2'])),
  }));
  assert.equal(after.worker_list_rows['work-1'].title, 'Changed');
  assert.equal(before.worker_list_rows['work-1'].title, 'Mahsulot 😀');
  assert.equal(after.worker_list_rows['work-2'], before.worker_list_rows['work-2']);
  assert.equal(after.worker_display_states[station]['work-1'], 'issue');
  assert.deepEqual(after.worker_report_prompts[station], {});
  assert.equal(applyWorkerDelta(before, delta({ worker_list_rows: field({}, ['work-history']) })), null);
  assert.equal(before.worker_list_rows['work-history'].id, 'work-history');
});

test('worker deltas reject invalid controls and update policies by apparatus', () => {
  const before = decoder.decodeWorkerListSnapshot(fixture());
  assert.equal(applyWorkerDelta(before, delta({ order_controls: field({ 'work-1': { state: 'frozen', actor: 'x' } }) })), null);
  assert.equal(applyWorkerDelta(before, delta({ worker_pending_report_ids: field({ [station]: ['work-1', 'work-1'] }) })), null);
  assert.equal(applyWorkerDelta(before, delta({ queue_policies: field({ [station]: { apparatus_id: 'apparatus:default:other', discipline: 'free_pick' } }) })), null);
  const after = applyWorkerDelta(before, delta({ queue_policies: field({ [station]: { apparatus_id: station, discipline: 'free_pick' } }) }));
  assert.equal(after.queue_policies[0].policy, 'free_pick');
  assert.equal(before.queue_policies[0].policy, 'strict_sequence');
});
