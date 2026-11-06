const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

function setup() {
  const calls = [];
  const deps = {
    '../apparatusApi': { readApparatus: async (session, url, retry) => { calls.push({ url, retry });
      return { response: { status: 200 }, body: JSON.stringify([{ order: { map: { id: 'o1' } }, apparatus_options: ['apparatus:print:1'] }]) }; } },
    '../authorizedFetch': { authorizedFetch: async (session, url, init) => { calls.push({ url, init }); return { status: 200, json: async () => ({ barcode: 'EPC' }) }; } },
    '../rawMaterialLookupApi': {}, '../rawMaterialUnlinkApi': {},
    '../workerControlsApi': { isCanonicalApparatusId: id => id.startsWith('apparatus:'), productionMapResponseError: () => Error('response') },
    '../workerProductionMapSaved': { productionMapSavedFromJson: value => value },
    '../workerRawMaterials': { rawMaterialAssignment: value => value },
  };
  const filename = path.resolve(__dirname, '../src/preparation/preparationInventoryAssignment.ts'), loaded = new Module(filename, module);
  loaded.require = id => id in deps ? deps[id] : require(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return { api: loaded.exports, calls };
}
test('inventory assignment candidate request preserves barcode and retry semantics', async () => {
  const x = setup(), candidates = await x.api.preparationAssignmentCandidates({}, ' EPC 1 ');
  assert.equal(x.calls[0].url, '/v1/mobile/admin/raw-material-assignments/candidate-orders?barcode=EPC+1');
  assert.equal(x.calls[0].retry, true); assert.equal(candidates[0].order.map.id, 'o1');
  assert.deepEqual(candidates[0].apparatus_options, ['apparatus:print:1']);
});
test('inventory assignment posts the chosen order, barcode and canonical apparatus', async () => {
  const x = setup(); await x.api.preparationAssignMaterial({}, ' o1 ', ' EPC ', ' apparatus:print:1 ');
  assert.equal(x.calls[0].url, '/v1/mobile/admin/raw-material-assignments');
  assert.equal(x.calls[0].init.method, 'POST');
  assert.deepEqual(JSON.parse(x.calls[0].init.body), { order_id: 'o1', barcode: 'EPC', apparatus: 'apparatus:print:1' });
  await assert.rejects(x.api.preparationAssignMaterial({}, 'o1', 'EPC', 'invalid'), /apparatus/);
  assert.equal(x.calls.length, 1);
});
