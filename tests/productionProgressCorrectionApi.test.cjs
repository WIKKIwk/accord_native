const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
function load(name, mocks = {}) {
  const filename = path.resolve(__dirname, `../src/${name}.ts`), loaded = new Module(filename, module);
  loaded.filename = filename; loaded.paths = module.paths;
  loaded.require = id => Object.hasOwn(mocks, id) ? mocks[id] : id.startsWith('./') ? load(id.slice(2), mocks) : require(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return loaded.exports;
}
const base = { batch_id: '  batch-1 ', expected_revision: 3, produced_qty: 4, uom: ' kg ', reason: ' fix ' };
function api(post) { return load('productionProgressCorrectionApi', { './workerControlsApi': { postWorkerApiRequest: post, WorkerControlException: class extends Error { constructor(code, message) { super(message); this.code = code; } } }, './workerProgressBatch': { progressBatchFromJson: value => value } }); }
test('correction sends trimmed fields and explicit null metrics', async () => {
  let args;
  const result = await api(async (...a) => { args = a; return { batch: { batch_id: 'batch-1', revision: 4 } }; }).adminProgressBatchCorrect({}, { ...base, bobina_kg: 1, description: '  desc ' });
  assert.equal(args[1], '/v1/mobile/admin/production-maps/progress-qr/correct');
  assert.deepEqual(args[2], { batch_id: 'batch-1', expected_revision: 3, produced_qty: 4, uom: 'kg', return_ink_kg: null,
    lamination_print_leftover_rolls: null, lamination_film_leftover_rolls: null, rezka_bosma_waste: null,
    rezka_lamination_waste: null, rezka_edge_waste: null, total_waste: null, finished_goods_kg: null, bobina_kg: 1,
    finished_goods_meter: null, diameter: null, description: 'desc', reason: 'fix' });
  assert.equal(result.revision, 4);
});
test('invalid correction is rejected before transport', async () => {
  const client = api(async () => { throw Error('unexpected'); });
  for (const change of [{ batch_id: ' ' }, { expected_revision: 0 }, { produced_qty: 0 }, { produced_qty: NaN }, { uom: '' }, { reason: ' ' }])
    await assert.rejects(client.adminProgressBatchCorrect({}, { ...base, ...change }), e => e.code === 'progress_input_invalid');
});
test('correction refuses a response without a batch', async () => {
  await assert.rejects(api(async () => ({})).adminProgressBatchCorrect({}, base), e => e.code === 'progress_batch_correction_failed');
});
