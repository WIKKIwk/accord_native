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
function apiWith(authorizedFetch) {
  const auth = { authorizedFetch }, scope = load('sessionReadScope');
  const controls = load('workerControlsApi', { './authorizedFetch': auth, './sessionReadScope': scope });
  const batch = load('workerProgressBatch', { './workerControlsApi': controls, './workerProgressModel': load('workerProgressModel') });
  return load('workerWipApi', { './authorizedFetch': auth, './sessionReadScope': scope,
    './workerControlsApi': controls, './workerProgressBatch': batch });
}

test('WIP candidate reader replays the V2 scoped request and typed batch', async () => {
  const stem = 'order_scan_bootstrap_api_test', name = 'bootstrap scoped candidate sections match independent decoders';
  const replay = contractFetch(stem, name, { onlyPaths: ['/v1/mobile/admin/production-maps/wip-batches'] });
  const session = recordedSession(stem, name);
  const api = apiWith((s, p, init) => replay(new URL(p, s.baseUrl), { ...init, headers: { Authorization: `Bearer ${s.token}` } }));
  const rows = await api.adminWipBatches(session, { orderId: 'zakaz-scan-bootstrap', status: 'waiting', limit: 500 });
  assert.equal(rows[0].batch_id, 'scan-roll');
  assert.equal(rows[0].produced_qty, 484);
  assert.equal(rows[0].has_input_route_metadata, false);
  replay.assertDone();
});

test('WIP cursor pagination applies only to producer-scoped reads and rejects repeated cursors', async () => {
  const queries = [];
  const api = apiWith(async (_session, path) => {
    queries.push(new URL(path, 'https://example.test').searchParams);
    return { status: 200, json: async () => ({ batches: [], next_before_batch_id: 'same' }) };
  });
  assert.deepEqual(await api.adminWipBatches({}, { limit: 0 }), []);
  assert.equal(queries[0].get('limit'), '1');
  await assert.rejects(api.adminWipBatches({}, { producerApparatus: 'apparatus:default:press', limit: 700 }), /cursor did not advance/);
  assert.equal(queries[1].get('limit'), '500');
  assert.equal(queries[2].get('before_batch_id'), 'same');
});

test('peremotka reads use the V2 apparatus/status/limit query with a scoped before-send guard', async () => {
  const requests = []; let current = true;
  const api = apiWith(async (_session, path, _init, guard) => {
    guard(); requests.push(path); return { status: 200, json: async () => ({ batches: [] }) };
  });
  assert.deepEqual(await api.adminWipBatches({}, { apparatus: 'apparatus:default:cut', status: 'peremotka', limit: 500, current: () => current }), []);
  assert.deepEqual(Object.fromEntries(new URL(requests[0], 'https://example.test').searchParams), { apparatus: 'apparatus:default:cut', status: 'peremotka', limit: '500' });
  current = false; await assert.rejects(api.adminWipBatches({}, { current: () => current }), error => error.code === 'session_scope_changed'); assert.equal(requests.length, 1);
});
test('closing a scoped WIP reader during response decoding discards its result', async () => {
  let current = true;
  const api = apiWith(async (_session, _path, _init, guard) => { guard(); return { status: 200, json: async () => { current = false; return { batches: [] }; } }; });
  await assert.rejects(api.adminWipBatches({}, { current: () => current }), error => error.code === 'session_scope_changed');
});
