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
function replayApi(name) {
  const stem = 'production_map_pending_move_test', replay = contractFetch(stem, name), session = recordedSession(stem, name);
  const client = load('workerProductionMapMoveApi', { './authorizedFetch': { authorizedFetch: (s, p, init = {}) => replay(new URL(p, s.baseUrl),
    { ...init, headers: { ...init.headers, Authorization: `Bearer ${s.token}` } }) } });
  return { client, replay, session };
}
const from = 'apparatus:default:bosma_7', to = 'apparatus:default:bosma_8';
// @v2-test test/production_map_pending_move_test.dart
test('pending move: HTTP sends only the selected order and canonical apparatus', async () => {
  const { client, replay, session } = replayApi('pending move: HTTP sends only the selected order and canonical apparatus');
  const saved = await client.adminMoveProductionMapOrdersBatch(session, { map_ids: ['zakaz-waiting-b'], from_apparatus: from, to_apparatus: to });
  assert.equal(saved[0].map.nodes[1].apparatus_id, to);
  replay.assertDone();
});

test('pending move: own active reservation preserves HTTP conflict diagnostics', async () => {
  const { client, replay, session } = replayApi('pending move: own active reservation preserves HTTP conflict diagnostics');
  await assert.rejects(client.adminMoveProductionMapOrdersBatch(session, { map_ids: ['zakaz-colour-a'], from_apparatus: from, to_apparatus: to }),
    error => error.code === 'print_preflight_active' && error.statusCode === 409 && error.requestId === 'own-colour-reservation' &&
      error.message === 'Buyurtmaning rang sinovi rezervi faol. Hozir bu amalni bajarib bo‘lmaydi.');
  replay.assertDone();
});

test('saved maps preserve normalized nested models and reject invalid apparatus nodes', () => {
  const { productionMapSavedFromJson } = load('workerProductionMapSaved', { './authorizedFetch': {} });
  const saved = productionMapSavedFromJson({ map: { id: 'order', products: [{ id: 'p', frame_count: 2, frame_product_size_mm: 5 }],
    nodes: [{ kind: 'apparatus', apparatus_id: to, rezka_frame_groups: [0, 2.5, -1, '3'] }], edges: [{ from: 'a', to: 'b' }] },
    program: { operations: [{ order: 2.9, args: { amount: 2, missing: null } }] }, created_by: { role: ' admin ' } });
  assert.deepEqual(saved.map.nodes[0].rezka_frame_groups, [2]);
  assert.equal(saved.map.products[0].frame_count, 2);
  assert.deepEqual(saved.program.operations[0].args, { amount: '2', missing: '' });
  assert.equal(saved.created_by.role, 'admin');
  assert.throws(() => productionMapSavedFromJson({ map: { nodes: [{ kind: 'apparatus', apparatus_id: 'old label' }] }, program: {} }),
    /canonical apparatus IDs/);
});
