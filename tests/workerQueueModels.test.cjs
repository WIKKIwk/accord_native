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
const model = load('workerQueueModels', { './workerControlsApi': controls });
const station = 'apparatus:default:press';

test('snapshot revision follows V2 numeric conversion and fallback', () => {
  assert.equal(model.parseProductionMapSnapshotRevision(7.9), 7);
  assert.equal(model.parseProductionMapSnapshotRevision(' 0x10 '), 16);
  assert.equal(model.parseProductionMapSnapshotRevision('7.9'), null);
  assert.equal(model.parseProductionMapSnapshotRevisionFromJson({ rev: null, revision: '8' }), 8);
});

test('queue sequence and state maps normalize ids and reject invalid server data', () => {
  assert.deepEqual(model.parseApparatusSequenceMap({ [` ${station} `]: [' order ', 2] }), { [station]: ['order', '2'] });
  assert.deepEqual(model.parseApparatusQueueStateMap({ [station]: { ' order ': ' IN_PROGRESS ' } }), { [station]: { order: 'in_progress' } });
  assert.throws(() => model.parseApparatusSequenceMap({ invalid: ['order'] }), error => error.code === 'production_map_snapshot_contract_invalid');
  assert.throws(() => model.parseApparatusQueueStateMap({ [station]: { order: 'unexpected' } }), error => error.code === 'production_map_snapshot_contract_invalid');
});

test('queue policy parser supports V2 list/map inputs and defaults', () => {
  const result = model.parseApparatusQueuePolicyMap([{ apparatus_id: station, discipline: 'free_pick', source_revision: 3.8 }]);
  assert.equal(result[station].policy, 'free_pick');
  assert.equal(result[station].source_revision, 3);
  assert.equal(model.parseApparatusQueuePolicyMap({ one: { apparatus_id: station, policy: 'unknown' } })[station].policy, 'strict_sequence');
  assert.deepEqual(model.parseApparatusQueuePolicyMap(null), {});
});
