const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

function setup() {
  const calls = [];
  const candidate = { order: { map: { id: 'order-1' } }, apparatus_options: ['apparatus:default:one'] };
  const deps = {
    '../apparatusApi': { readApparatus: async (_, url, retry) => { calls.push({ url, retry }); return { response: { status: 200 }, body: JSON.stringify([candidate]) }; } },
    '../authorizedFetch': { authorizedFetch: async (_, url, init) => { calls.push({ url, init }); return { status: 200, json: async () => ({ order_id: 'order-1' }) }; } },
    '../workerControlsApi': { isCanonicalApparatusId: id => id.startsWith('apparatus:'), productionMapResponseError: () => Error('server') },
    '../workerProductionMapSaved': { productionMapSavedFromJson: value => value },
    '../workerRawMaterials': { rawMaterialAssignment: value => value },
  };
  const filename = path.resolve(__dirname, '../src/preparation/preparationInventoryAssignments.ts'), loaded = new Module(filename, module);
  loaded.require = id => id in deps ? deps[id] : require(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return { api: loaded.exports, calls };
}

test('inventory assignment uses V2 candidate and order-link requests', async () => {
  const x = setup();
  const candidates = await x.api.preparationAssignmentCandidates({}, ' QR-1 ');
  assert.equal(x.calls[0].url, '/v1/mobile/admin/raw-material-assignments/candidate-orders?barcode=QR-1');
  assert.equal(x.calls[0].retry, true);
  assert.deepEqual(candidates[0].apparatusOptions, ['apparatus:default:one']);
  await x.api.preparationAssignMaterial({}, ' order-1 ', ' QR-1 ', 'apparatus:default:one');
  assert.equal(x.calls[1].url, '/v1/mobile/admin/raw-material-assignments');
  assert.equal(x.calls[1].init.method, 'POST');
  assert.deepEqual(JSON.parse(x.calls[1].init.body), { order_id: 'order-1', barcode: 'QR-1', apparatus: 'apparatus:default:one' });
  await assert.rejects(x.api.preparationAssignMaterial({}, 'order-1', 'QR-1', 'invalid'), /apparatus/);
});
