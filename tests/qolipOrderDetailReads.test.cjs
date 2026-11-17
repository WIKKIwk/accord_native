const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
function load(name, dependencies) {
  const filename = path.resolve(__dirname, '../src', name), value = new Module(filename, module);
  value.require = target => target in dependencies ? dependencies[target] : require(target);
  value._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return value.exports;
}
class Failure extends Error { constructor(code) { super(code); } }
const controls = { isCanonicalApparatusId: value => value.startsWith('apparatus:'), WorkerControlException: Failure, productionMapResponseError: () => new Failure('read_failed') };
const session = { profile: { role: 'qolipchi', ref: 'one' }, baseUrl: 'https://example.test' };
function readers(fetch) {
  const deps = { './authorizedFetch': { authorizedFetch: fetch }, './workerControlsApi': controls, './auth': { activeSessionToken: () => 'token' } };
  const production = load('productionMapReadApi.ts', { ...deps, './workerProductionMapSaved': { productionMapSavedFromJson: value => value } });
  const raw = load('workerRawMaterials.ts', deps);
  const opening = load('workerOpeningWipRecordsApi.ts', { ...deps, './workerOpeningWip': { openingWipBatch: value => value } });
  const molds = load('qolipCatalogApi.ts', deps);
  return [
    { payload: { map: { id: 'order' } }, suffix: '/production-maps?id=order', run: guard => production.adminProductionMap(session, ' order ', undefined, guard) },
    { payload: [], suffix: '/raw-material-assignments?order_id=order', run: guard => raw.adminRawMaterialAssignments(session, ' order ', '', guard) },
    { payload: { records: [] }, suffix: '/opening-wip?limit=500&order_id=order&status=all', run: guard => opening.adminOpeningWipRecords(session, { order_id: ' order ', status: 'all', limit: 500 }, guard) },
    { payload: { products: [] }, suffix: '/shared-sets?item_code=ITEM', run: guard => molds.qolipProductMolds(session, ' ITEM ', guard) },
  ];
}
test('Qolip full-detail supporting reads carry the exact original witness without changing source query keys', async () => {
  let active, witness;
  const rows = readers(async (_session, path, _init, beforeSend, timeout, options) => {
    assert.equal(options.readWitness, witness); assert.equal(timeout, 10000); assert.ok(path.endsWith(active.suffix)); beforeSend();
    return { status: 200, json: async () => active.payload };
  });
  witness = () => true;
  for (active of rows) await active.run(witness);
});
test('supporting reads discard JSON from a retired original role owner', async () => {
  let active, valid = true;
  const rows = readers(async (_session, _path, _init, beforeSend) => {
    beforeSend(); return { status: 200, json: async () => { valid = false; return active.payload; } };
  });
  for (active of rows) { valid = true; await assert.rejects(active.run(() => valid), /session_scope_changed|qolip_read_expired/); }
});
