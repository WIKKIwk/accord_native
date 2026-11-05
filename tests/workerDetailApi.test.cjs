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
  loaded.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
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
    './workerQueueLimit': { DEFAULT_QUEUE_LIMIT: 10 }, './workerSnapshot': {}, './sessionReadScope': scope,
    './workerDetailApi': { workerProductionOrderDetail: async () => ({ epoch: 'e', rev: ++count === 1 ? 2 : 4,
      maps: [{ map: { id: order, nodes: [], edges: [] } }], stage_states: {}, queue_states: {} }) } });
  const detail = await workerApi.readWorkerOrderDetail(session, station, order, { epoch: 'e', rev: 3 }, new AbortController().signal);
  assert.equal(count, 2);
  assert.equal(detail.map.id, order);
  const stale = load('workerApi', { './authorizedFetch': {}, './workerOrderAppearance': load('workerOrderAppearance'),
    './workerQueueLimit': { DEFAULT_QUEUE_LIMIT: 10 }, './workerSnapshot': {}, './sessionReadScope': scope,
    './workerDetailApi': { workerProductionOrderDetail: async () => { session.profile.ref = 'other'; return { epoch: 'e', rev: 4 }; } } });
  await assert.rejects(stale.readWorkerOrderDetail(session, station, order, { epoch: 'e', rev: 3 }, new AbortController().signal), /Sessiya/);
});
