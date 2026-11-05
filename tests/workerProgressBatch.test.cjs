const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

function load(name, mocks = {}) {
  const filename = path.resolve(__dirname, `../src/${name}.ts`);
  const loaded = new Module(filename, module);
  loaded.filename = filename; loaded.paths = module.paths;
  loaded.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return loaded.exports;
}
const controls = load('workerControlsApi', { './authorizedFetch': {}, './sessionReadScope': {} });
const model = load('workerProgressBatch', { './workerControlsApi': controls, './workerProgressModel': load('workerProgressModel') });
const station = 'apparatus:default:press';

test('progress batch uses V2 defaults, status derivation and legacy fields', () => {
  const result = model.progressBatchFromJson({ apparatus: station, batch_id: 42, revision: 2.8, action: 'pause', status: 'paused',
    wip_status: 'waiting', current_apparatus_key: station, processed_by_apparatus: 'warehouse:stock', babina_kg: 2,
    payload_json: { order_title: 'Test' } });
  assert.equal(result.batch_id, '42');
  assert.equal(result.revision, 2);
  assert.equal(result.current_apparatus, station);
  assert.equal(result.processed_by_apparatus, 'warehouse:stock');
  assert.equal(result.bobina_kg, 2);
  assert.equal(result.produced_qty, 0);
  assert.equal(result.status_detail.flow_status, 'free_wip');
  assert.equal(result.has_input_route_metadata, false);
  assert.deepEqual(result.payload_json, { order_title: 'Test' });
});

test('progress batch rejects invalid identities and nonnumeric quantities', () => {
  assert.throws(() => model.progressBatchFromJson({ apparatus: 'Bosma' }), error => error.code === 'apparatus_id_invalid');
  assert.throws(() => model.progressBatchFromJson({ apparatus: station, current_apparatus: station,
    current_apparatus_key: 'apparatus:default:other' }), error => error.code === 'apparatus_id_mismatch');
  assert.throws(() => model.progressBatchFromJson({ apparatus: station, produced_qty: '10' }), TypeError);
  assert.throws(() => model.progressBatchFromJson({ apparatus: station, processed_by_apparatus: 'warehouse:' }),
    error => error.code === 'apparatus_id_invalid');
});

test('progress input route requires a complete canonical destination and deduplicates consumers', () => {
  const route = model.progressInputRoute({ source_stage_node_id: ' previous ', stage_node_id: ' next ', map_fingerprint: ' hash ',
    consumer_apparatus_ids: [station, station], remapped: true });
  assert.deepEqual(route.consumer_apparatus_ids, [station]);
  assert.equal(route.stage_node_id, 'next');
  assert.throws(() => model.progressInputRoute({ consumer_apparatus_ids: [] }), error => error.code === 'wip_route_destination_unresolved');
});
