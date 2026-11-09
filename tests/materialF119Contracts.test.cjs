const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const { contractFetch, recordedSession } = require('./support/contractFetch.cjs');
const stem = 'f11910bb/order_scan_bootstrap_api_test';
function load(name, mocks = {}) {
  const filename = path.resolve(__dirname, `../src/${name}.ts`), loaded = new Module(filename, module);
  loaded.filename = filename; loaded.paths = module.paths;
  loaded.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return loaded.exports;
}
function apiWith(replay) {
  const auth = { authorizedFetch: (session, route, init) => replay(new URL(route, session.baseUrl), {
    ...init, headers: { Authorization: `Bearer ${session.token}` },
  }) };
  const controls = load('workerControlsApi', { './authorizedFetch': auth, './sessionReadScope': load('sessionReadScope') });
  return load('workerRawMaterials', { './authorizedFetch': auth, './workerControlsApi': controls });
}
test('isolated source fixture is tied to f11910bb', () => {
  const fixture = require('./contracts/f11910bb/order_scan_bootstrap_api_test.json');
  assert.equal(fixture.baseline, 'f11910bb2c8c7081ce26770e69811b03fd0739ed');
  assert.ok(fixture.records.length > 0);
});
// @v2-test test/order_scan_bootstrap_api_test.dart
test('f119 scoped material assignments replay V2 request and projection', async () => {
  const name = 'bootstrap scoped candidate sections match independent decoders';
  const replay = contractFetch(stem, name, { onlyPaths: ['/v1/mobile/admin/raw-material-assignments'] });
  const session = recordedSession(stem, name), api = apiWith(replay);
  const result = await api.adminRawMaterialAssignments(session, 'zakaz-scan-bootstrap', 'apparatus:default:bosma_7');
  assert.equal(result.length, 1); assert.equal(result[0].barcode, 'ROLL1'); assert.equal(result[0].remaining_qty, 10); replay.assertDone();
});
test('f119 material start requirements replay the scoped request', async () => {
  const name = 'scan bootstrap synthetic 250ms RTT aggregate=false';
  const replay = contractFetch(stem, name, { onlyPaths: ['/v1/mobile/admin/raw-material-start-requirements'] });
  const session = recordedSession(stem, name), api = apiWith(replay);
  const result = await api.adminRawMaterialStartRequirements(session, 'zakaz-scan-bootstrap', 'apparatus:default:bosma_7');
  assert.deepEqual(result.assigned_barcodes, ['ROLL1']); assert.equal(result.required_scan_count, 1); replay.assertDone();
});
