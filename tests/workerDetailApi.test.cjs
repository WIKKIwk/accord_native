const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const { contractFetch, recordedSession } = require('./support/contractFetch.cjs');

function load(name, mocks = {}) {
  const filename = path.resolve(__dirname, `../src/${name}.ts`);
  const loaded = new Module(filename, module);
  loaded.filename = filename; loaded.paths = module.paths;
  loaded.require = id => Object.hasOwn(mocks, id) ? mocks[id] : id.startsWith('./') ? load(id.slice(2), mocks) : require(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return loaded.exports;
}
function setup(name) {
  const stem = 'worker_list_api_test', replay = contractFetch(stem, name), session = recordedSession(stem, name);
  const auth = { authorizedFetch: (s, p, init) => replay(new URL(p, s.baseUrl), { ...init, headers: { Authorization: `Bearer ${s.token}` } }) };
  const scope = load('sessionReadScope');
  const controls = load('workerControlsApi', { './authorizedFetch': auth, './sessionReadScope': scope });
  const logic = load('workerOrderLogic', { './workerControlsApi': controls });
  const models = load('workerQueueModels', { './workerControlsApi': controls });
  const legacy = load('workerLegacyScan', { './authorizedFetch': auth, './sessionReadScope': scope,
    './workerControlsApi': controls, './workerOrderLogic': logic, './workerQueueModels': models });
  const api = load('workerDetailApi', { './authorizedFetch': auth, './workerControlsApi': controls,
    './workerQueueModels': models, './workerLegacyScan': legacy });
  return { api, replay, session };
}
const station = 'apparatus:default:bosma_7', order = 'zakaz-scan-bootstrap';

test('worker detail replays the V2 scoped request and keeps the full order graph', async () => {
  const { api, replay, session } = setup('worker single detail requests one ID and returns full action authority');
  const result = await api.workerProductionOrderDetail(session, ` ${station} `, ` ${order} `);
  assert.equal(result.maps[0].map.id, order);
  assert.equal(result.maps[0].map.title, 'Full graph');
  assert.equal(result.queue_action_controls[station][order].state, 'pending');
  assert.equal(result.rev, 7);
  replay.assertDone();
});

test('worker detail rejects compact lists, wrong order, missing scope and wrong projection', async () => {
  const { api, replay, session } = setup('worker detail rejects list replies, wrong orders and missing scope');
  for (let i = 0; i < 4; i++) {
    await assert.rejects(api.workerProductionOrderDetail(session, station, order), error => error.code === 'production_map_snapshot_contract_invalid');
  }
  replay.assertDone();
});

test('worker overview retries a stale detail and rejects a changed session scope', async () => {
  const scope = load('sessionReadScope');
  let count = 0;
  const session = { baseUrl: 'https://example.test', profile: { role: 'aparatchi', ref: 'worker' } };
  const workerApi = load('workerApi', { './authorizedFetch': {}, './workerOrderAppearance': load('workerOrderAppearance'),
    './workerQueueLimit': { DEFAULT_QUEUE_LIMIT: 10 }, './workerQueueReadApi': {}, './workerQueueReadError': {}, './workerSnapshot': {}, './sessionReadScope': scope, './apparatusApi': {},
    './workerDetailApi': { workerProductionOrderDetail: async () => ({ epoch: 'e', rev: ++count === 1 ? 2 : 4,
      maps: [{ map: { id: order, nodes: [], edges: [] } }], stage_states: {}, queue_states: {} }) } });
  const detail = await workerApi.readWorkerOrderDetail(session, station, order, { epoch: 'e', rev: 3 }, new AbortController().signal);
  assert.equal(count, 2);
  assert.equal(detail.map.id, order);
  const stale = load('workerApi', { './authorizedFetch': {}, './workerOrderAppearance': load('workerOrderAppearance'),
    './workerQueueLimit': { DEFAULT_QUEUE_LIMIT: 10 }, './workerQueueReadApi': {}, './workerQueueReadError': {}, './workerSnapshot': {}, './sessionReadScope': scope, './apparatusApi': {},
    './workerDetailApi': { workerProductionOrderDetail: async () => { session.profile.ref = 'other'; return { epoch: 'e', rev: 4 }; } } });
  await assert.rejects(stale.readWorkerOrderDetail(session, station, order, { epoch: 'e', rev: 3 }, new AbortController().signal), /Sessiya/);
});

test('worker detail rejects inconsistent canonical action authority', async () => {
  const { loadContract } = require('./support/contractFetch.cjs');
  const record = loadContract('worker_list_api_test').find(value => value.test === 'worker single detail requests one ID and returns full action authority');
  const wire = JSON.parse(record.responseBody.text);
  wire.queue_action_controls[station][order].state = 'paused';
  const auth = { authorizedFetch: async () => ({ status: 200, json: async () => wire }) };
  const api = load('workerDetailApi', { './authorizedFetch': auth });
  await assert.rejects(api.workerProductionOrderDetail({}, station, order), error => error.code === 'production_map_snapshot_contract_invalid');
});

test('worker detail rejects a valid compact list with the V2 contract error', async () => {
  const { loadContract } = require('./support/contractFetch.cjs');
  const record = loadContract('worker_list_api_test').find(value => value.test.startsWith('worker HTTP and v2 socket'));
  const wire = JSON.parse(record.responseBody.text);
  const api = load('workerDetailApi', { './authorizedFetch': { authorizedFetch: async () => ({ status: 200, json: async () => wire }) } });
  await assert.rejects(api.workerProductionOrderDetail({}, station, order), error => error.code === 'production_map_snapshot_contract_invalid');
});

test('worker detail returns the decoded snapshot rather than raw wire values', async () => {
  const { loadContract } = require('./support/contractFetch.cjs');
  const record = loadContract('worker_list_api_test').find(value => value.test === 'worker single detail requests one ID and returns full action authority');
  const wire = JSON.parse(record.responseBody.text);
  wire.queue_action_controls[station][order].allowed_actions = [' start ', 'start'];
  wire.queue_states[station][order] = ' PENDING ';
  wire.stage_states[order] = { ' stage ': ' COMPLETED ' };
  wire.order_controls[order] = { state: 'active' };
  const auth = { authorizedFetch: async () => ({ status: 200, json: async () => wire }) };
  const api = load('workerDetailApi', { './authorizedFetch': auth });
  const result = await api.workerProductionOrderDetail({}, station, order);
  assert.deepEqual(result.queue_action_controls[station][order].allowed_actions, ['start']);
  assert.equal(result.queue_states[station][order], 'pending');
  assert.deepEqual(result.stage_states[order], { stage: 'completed' });
  assert.equal(result.order_controls[order], 'active');
});

test('worker overview shares one five-second deadline across a stale response retry', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const scope = load('sessionReadScope');
  let count = 0, retrySignal;
  const session = { baseUrl: 'https://example.test', profile: { role: 'aparatchi', ref: 'worker' } };
  const workerApi = load('workerApi', { './authorizedFetch': {}, './workerOrderAppearance': load('workerOrderAppearance'),
    './workerQueueLimit': { DEFAULT_QUEUE_LIMIT: 10 }, './workerQueueReadApi': {}, './workerQueueReadError': {}, './workerSnapshot': {}, './sessionReadScope': scope, './apparatusApi': {},
    './workerDetailApi': { workerProductionOrderDetail: async (_session, _station, _order, signal) => {
      if (++count === 1) return { epoch: 'e', rev: 2 };
      retrySignal = signal;
      return new Promise((_, reject) => signal.addEventListener('abort', () => reject(new Error('fetch aborted')), { once: true }));
    } } });
  const result = workerApi.readWorkerOrderDetail(session, station, order, { epoch: 'e', rev: 3 }, new AbortController().signal);
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(count, 2);
  t.mock.timers.tick(4999);
  assert.equal(retrySignal.aborted, false);
  t.mock.timers.tick(1);
  await assert.rejects(result, /Scoped order detail timed out/);
  assert.equal(retrySignal.aborted, true);
});
