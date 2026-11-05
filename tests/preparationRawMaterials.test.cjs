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
  loaded.filename = filename;
  loaded.paths = module.paths;
  loaded.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText, filename);
  return loaded.exports;
}
function apiWith(authorizedFetch) {
  const auth = { authorizedFetch };
  const controls = load('workerControlsApi', { './authorizedFetch': auth, './sessionReadScope': load('sessionReadScope') });
  return load('workerRawMaterials', { './authorizedFetch': auth, './workerControlsApi': controls });
}
// @v2-test test/admin_raw_material_api_test.dart
// V2 uses HttpOverrides rather than MockClient here, so replay the exact source-derived request and response.
test('raw material assignments send only the selected order scope', async () => {
  const calls = [];
  const api = apiWith(async (session, url) => {
    calls.push(url);
    return { status: 200, json: async () => [{ order_id: 'zakaz-1', apparatus: 'apparatus:default:asset-005',
      barcode: 'RM-001', item_code: 'KR-1', item_name: 'Qora kraska', item_group: 'Kraska' }] };
  });
  const assignments = await api.adminRawMaterialAssignments({}, 'zakaz-1');
  assert.deepEqual(calls, ['/v1/mobile/admin/raw-material-assignments?order_id=zakaz-1']);
  assert.deepEqual(assignments.map(item => item.barcode), ['RM-001']);
});
