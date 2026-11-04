const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

function load(authorizedFetch) {
  const filename = path.resolve(__dirname, '../src/workerWip.ts');
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = module.paths;
  loaded.require = id => id === './authorizedFetch' ? { authorizedFetch } : require(id);
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
  const batch = (batch_id, order_id = 'order', apparatus = 'press') => ({ batch_id, order_id, apparatus });
  const { loadWorkerWipBatches } = load(async (_session, path) => {
    const query = new URL(path, 'https://example.test').searchParams;
    assert.equal(query.get('order_id'), 'order');
    assert.equal(query.get('producer_apparatus'), 'press');
    const cursor = query.get('before_batch_id');
    ids.push(cursor);
    return { ok: true, json: async () => cursor
      ? { batches: [batch('older'), batch('foreign', 'other')] }
      : { batches: [batch('newer'), batch('other-machine', 'order', 'other')], next_before_batch_id: 'newer' } };
  });
  const results = await loadWorkerWipBatches({}, 'order', 'press', new AbortController().signal);
  assert.deepEqual(ids, [null, 'newer']);
  assert.deepEqual(results.map(item => item.batch_id), ['newer', 'older']);
});
