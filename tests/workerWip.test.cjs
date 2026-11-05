const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

function load(authorizedFetch) {
  function dependency(name, mocks = {}) {
    const file = path.resolve(__dirname, `../src/${name}.ts`);
    const result = new Module(file, module);
    result.filename = file; result.paths = module.paths;
    result.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
    result._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, file);
    return result.exports;
  }
  const scope = dependency('sessionReadScope');
  const controls = dependency('workerControlsApi', { './authorizedFetch': { authorizedFetch }, './sessionReadScope': scope });
  const progress = dependency('workerProgressModel');
  const batch = dependency('workerProgressBatch', { './workerControlsApi': controls, './workerProgressModel': progress });
  const wipApi = dependency('workerWipApi', { './authorizedFetch': { authorizedFetch }, './sessionReadScope': scope,
    './workerControlsApi': controls, './workerProgressBatch': batch });
  const filename = path.resolve(__dirname, '../src/workerWip.ts');
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = module.paths;
  loaded.require = id => id === './workerControlsApi' ? controls : id === './workerProgressModel' ? progress : id === './workerWipApi' ? wipApi : require(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText, filename);
  return loaded.exports;
}

test('WIP totals preserve unknown bobina and use the V2 net override', () => {
  const { wipBatchWeights, wipMeters } = load();
  assert.deepEqual(wipBatchWeights({ finished_goods_kg: 10, bobina_kg: null }), { gross: 10, bobina: null, net: null });
  assert.deepEqual(wipBatchWeights({ finished_goods_kg: 10, bobina_kg: 3 }), { gross: 10, bobina: 3, net: 7 });
  assert.deepEqual(wipBatchWeights({ finished_goods_kg: 10, bobina_kg: 3, payload_json: { include_bobina_in_net: true } }),
    { gross: 10, bobina: 3, net: 10 });
  assert.equal(wipMeters({ produced_qty: 145, uom: 'metr' }), 145);
  assert.equal(wipMeters({ produced_qty: 145, uom: 'kg' }), null);
});

test('WIP history fetches all pages for one exact order and producer', async () => {
  const ids = [];
  const machine = 'apparatus:default:press';
  const batch = (batch_id, order_id = 'order', apparatus = machine) => ({ batch_id, order_id, apparatus });
  const { loadWorkerWipBatches } = load(async (_session, path) => {
    const query = new URL(path, 'https://example.test').searchParams;
    assert.equal(query.get('order_id'), 'order');
    assert.equal(query.get('producer_apparatus'), machine);
    const cursor = query.get('before_batch_id');
    ids.push(cursor);
    return { ok: true, status: 200, json: async () => cursor
      ? { batches: [batch('older'), batch('foreign', 'other')] }
      : { batches: [batch('newer'), batch('other-machine', 'order', 'apparatus:default:other')], next_before_batch_id: 'newer' } };
  });
  const results = await loadWorkerWipBatches({ profile: {} }, 'order', machine, new AbortController().signal);
  assert.deepEqual(ids, [null, 'newer']);
  assert.deepEqual(results.map(item => item.batch_id), ['newer', 'older']);
});

test('WIP history rejects stale scope and malformed pagination cursors', async () => {
  let complete;
  const pendingApi = load(async () => new Promise(resolve => { complete = resolve; }));
  const session = { baseUrl: 'https://example.test', profile: { role: 'aparatchi', ref: 'worker' },
    capabilities: [], assigned_apparatus: [], assigned_apparatus_labels: [] };
  const action = pendingApi.loadWorkerWipBatches(session, 'order', 'apparatus:default:press', new AbortController().signal);
  await Promise.resolve();
  session.profile.ref = 'other';
  complete({ status: 200, json: async () => ({ batches: [] }) });
  await assert.rejects(action, error => error.code === 'session_scope_changed');
  const malformed = load(async () => ({ status: 200, json: async () => ({ batches: [], next_before_batch_id: 1 }) }));
  await assert.rejects(malformed.loadWorkerWipBatches(session, 'order', 'apparatus:default:press', new AbortController().signal));
});
