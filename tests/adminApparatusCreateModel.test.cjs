const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
function load(file, mocks = {}) {
  const filename = path.resolve(__dirname, '../src', file + '.ts'), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths;
  mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return mod.exports;
}
const controls = load('workerControlsApi', { './authorizedFetch': {}, './sessionReadScope': {} }), exception = load('shared/mobileApiException');
const apparatus = load('apparatusApi', { './authorizedFetch': {}, './workerControlsApi': controls }), dart = load('admin/dartJsonString');
const options = load('admin/apparatusOptionsApi', { '../authorizedFetch': {}, '../apparatusApi': apparatus, './dartJsonString': dart });
const draft = load('admin/apparatusCanonicalDraft', { '../apparatusApi': apparatus, './apparatusOptionsApi': options, './dartJsonString': dart });
const model = load('admin/apparatusCreateModel', { '../workerControlsApi': controls, '../shared/mobileApiException': exception,
  './apparatusCanonicalDraft': draft, './dartJsonString': dart });
const profile = (code, level, enabled = true) => ({ code, level, valid_from_unix: 12, valid_to_unix: 34, enabled });
const input = { name: ' Press ', family: ' PECHAT ', kind: ' COLOR_PECHAT ' };
// Direct source-derived checks; the f119 Flutter oracle remains blocked by the SQLite hash failure.
test('validation preserves name, ID and execution-profile error ordering', () => {
  assert.throws(() => model.normalizeApparatusCreate({ name: ' \u0085 ', id: 'bad' }, false), error => error instanceof exception.MobileApiException &&
    error.code === 'apparatus_display_name_required' && error.message === 'Aparat nomi kiritilmadi');
  assert.throws(() => model.normalizeApparatusCreate({ ...input, id: 'bad' }, false), error => error.code === 'apparatus_id_invalid');
  for (const bad of [{ family: 'pechat', kind: 'rezka' }, { family: '', kind: 'flexo' }, { family: 'pechat', kind: '' }])
    assert.throws(() => model.normalizeApparatusCreate({ name: 'Press', ...bad }, false), error =>
      error.code === 'canonical_execution_profile_required' && error.message === 'Aparat turi va texnologiyasi canonical contractga mos emas');
});
test('normalization filters allowed codes, clamps levels, keeps profile order and adds operation/training', () => {
  const result = model.normalizeApparatusCreate({ ...input, id: '\u0085apparatus:default:a\u0085',
    capabilities: [' TOOLING ', 'tooling', 'ignored', ' VIRTUAL_TASK '],
    capability_profiles: [profile(' PRINT ', -4), profile('print', 150), profile('training', 6, false), profile('ignored', 3)],
    color_stations: 5, factory_map_object_id: ' map ', training_enabled: true }, false);
  assert.equal(result.name, 'Press'); assert.equal(result.id, 'apparatus:default:a'); assert.equal(result.family, 'pechat'); assert.equal(result.kind, 'color_pechat');
  assert.equal(result.operation, 'print'); assert.equal(result.technology, 'rotogravure');
  assert.deepEqual(result.capabilities, ['print', 'tooling', 'training', 'virtual_task']);
  assert.deepEqual(result.capability_profiles, [profile('print', 1), profile('print', 100)]);
  assert.equal(result.color_stations, 5); assert.equal(result.factory_map_object_id, 'map'); assert.equal(result.factory_map_object_id_supplied, true);
  const body = draft.canonicalApparatusDraft({ name: result.name, operation: result.operation, technology: result.technology,
    capabilities: result.capability_profiles, capability_codes: result.capabilities, color_stations: result.color_stations,
    factory_map_object_id: result.factory_map_object_id, training_enabled: true, opaque_key: 'k' });
  assert.deepEqual(body.capabilities, [{ code: 'print', level: 100 }, { code: 'tooling', level: 1 }, { code: 'training', level: 1 }, { code: 'virtual_task', level: 1 }]);
});
test('test mode defaults only if both family and kind are unresolved', () => {
  const result = model.normalizeApparatusCreate({ name: 'X', family: 'unknown', kind: 'unknown' }, true);
  assert.equal(result.operation, 'package'); assert.equal(result.technology, 'bag_making'); assert.deepEqual(result.capabilities, ['package']);
  assert.throws(() => model.normalizeApparatusCreate({ name: 'X', family: 'pechat', kind: 'unknown' }, true), error => error.code === 'canonical_execution_profile_required');
  assert.throws(() => model.normalizeApparatusCreate({ name: 'X', family: 'unknown', kind: 'unknown' }, false), error => error.code === 'canonical_execution_profile_required');
});
test('null/empty optional values and Unicode trim/casing remain explicit', () => {
  const result = model.normalizeApparatusCreate({ name: '\u0085X\u0085', family: ' LAMİNATSİYA ', kind: ' LAMİNATSİYA ', training_enabled: null }, false);
  assert.equal(result.name, 'X'); assert.equal(result.family, 'laminatsiya'); assert.equal(result.technology, 'adhesive_lamination');
  assert.equal(result.factory_map_object_id_supplied, false); assert.equal(result.training_enabled, null); assert.equal(result.color_stations, null);
  const empty = model.normalizeApparatusCreate({ ...input, factory_map_object_id: '', training_enabled: false }, false);
  assert.equal(empty.factory_map_object_id_supplied, true); assert.equal(empty.training_enabled, false);
  assert.throws(() => model.normalizeApparatusCreate({ ...input, capability_profiles: [profile('print', 1.5)] }, false), TypeError);
});

test('normalization rejects unsafe color-station numbers rather than silently serializing null', () => {
  for (const value of [NaN, Infinity, -Infinity, 1.5, '2', true, {}, 1n, Number.MAX_SAFE_INTEGER + 1])
    assert.throws(() => model.normalizeApparatusCreate({ ...input, color_stations: value }, false), /Invalid apparatus color stations/);
  for (const value of [null, -1000, -1, 0, 1, Number.MAX_SAFE_INTEGER])
    assert.equal(model.normalizeApparatusCreate({ ...input, color_stations: value }, false).color_stations, value);
});

test('normalization rejects unsafe capability levels while preserving normal V2 clamping', () => {
  for (const value of [NaN, Infinity, -Infinity, 1.5, '2', true, null, 1n, Number.MAX_SAFE_INTEGER + 1])
    assert.throws(() => model.normalizeApparatusCreate({ ...input, capability_profiles: [profile('print', value)] }, false), /Invalid apparatus capability level/);
  for (const [value, expected] of [[-1000, 1], [0, 1], [1, 1], [101, 100], [Number.MAX_SAFE_INTEGER, 100]])
    assert.equal(model.normalizeApparatusCreate({ ...input, capability_profiles: [profile('print', value)] }, false).capability_profiles[0].level, expected);
});
