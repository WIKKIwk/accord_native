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
const create = load('admin/apparatusCreateModel', { '../workerControlsApi': controls, '../shared/mobileApiException': exception,
  './apparatusCanonicalDraft': draft, './dartJsonString': dart });
const update = load('admin/apparatusUpdateDraft', { './apparatusCanonicalDraft': draft });
const profile = (code, level, enabled = true) => ({ code, level, valid_from_unix: null, valid_to_unix: null, enabled });
const current = { source_revision: 12, description: 'existing description', sort_order: 42, min_web_width_mm: 0, max_web_width_mm: null,
  virtual_tasks: 'enabled', capability_compatible_reroute: false, training_queue_enabled: true, training_material_tracking_enabled: false,
  capability_profiles: [profile('print', 7), profile('tooling', 0, false), profile('training', 4), profile('training', 9)] };
const input = { name: ' New ', family: 'pechat', kind: 'color_pechat', capabilities: ['tooling', 'virtual_task'],
  capability_profiles: [profile('print', 2), profile('print', 9)], color_stations: 5, factory_map_object_id: ' map-1 ', training_enabled: true };
// Source-derived pure model checks; the V2 Flutter oracle remains blocked by the SQLite hash mismatch.
test('update projection preserves source fields and chooses first new/current level in the V2 order', () => {
  const normalized = create.normalizeApparatusCreate(input, false), result = update.canonicalApparatusUpdateDraft(normalized, current);
  assert.deepEqual(result, { expected_revision: 12, patch: { display: { display_name: 'New', description: 'existing description', catalog_order: 42 },
    equipment_class_id: 'equipment-class:mini-rs-erp:print:rotogravure',
    capabilities: [{ code: 'print', level: 2 }, { code: 'tooling', level: 0 }, { code: 'training', level: 4 }, { code: 'virtual_task', level: 1 }],
    execution_profile: { operation: 'print', technology: 'rotogravure', color_station_count: 5, min_web_width_mm: 0,
      virtual_tasks: 'enabled', capability_compatible_reroute: false },
    placement: { factory_map_object_id: 'map-1' }, training: { enabled: true, queue_enabled: true, material_tracking_enabled: false } } });
  // The create draft intentionally uses the last new profile level, while update uses the first.
  assert.equal(draft.canonicalApparatusDraft({ name: normalized.name, operation: normalized.operation, technology: normalized.technology,
    capabilities: normalized.capability_profiles, capability_codes: normalized.capabilities, color_stations: normalized.color_stations,
    factory_map_object_id: normalized.factory_map_object_id, training_enabled: true, opaque_key: 'k' }).capabilities[0].level, 9);
});
test('empty or absent placement is omitted rather than clearing the saved placement', () => {
  for (const value of [undefined, null, '', ' \u0085 ']) {
    const result = update.canonicalApparatusUpdateDraft(create.normalizeApparatusCreate({ ...input, factory_map_object_id: value }, false), current);
    assert.equal(Object.hasOwn(result.patch, 'placement'), false);
  }
  const result = update.canonicalApparatusUpdateDraft(create.normalizeApparatusCreate({ ...input, factory_map_object_id: ' map ' }, false), current);
  assert.deepEqual(result.patch.placement, { factory_map_object_id: 'map' });
});
test('training and optional widths retain explicit V2 presence rules', () => {
  const absent = update.canonicalApparatusUpdateDraft(create.normalizeApparatusCreate({ ...input, training_enabled: null }, false), current);
  assert.equal(Object.hasOwn(absent.patch, 'training'), false); assert.equal(absent.patch.execution_profile.min_web_width_mm, 0);
  assert.equal(Object.hasOwn(absent.patch.execution_profile, 'max_web_width_mm'), false);
  const disabled = update.canonicalApparatusUpdateDraft(create.normalizeApparatusCreate({ ...input, training_enabled: false }, false),
    { ...current, min_web_width_mm: null, max_web_width_mm: 120 });
  assert.deepEqual(disabled.patch.training, { enabled: false, queue_enabled: false, material_tracking_enabled: false });
  assert.equal(Object.hasOwn(disabled.patch.execution_profile, 'min_web_width_mm'), false); assert.equal(disabled.patch.execution_profile.max_web_width_mm, 120);
});

test('independently called update projection rejects unsafe color values without clamping valid negative or zero', () => {
  const normalized = create.normalizeApparatusCreate(input, false);
  for (const value of [NaN, Infinity, -Infinity, 1.5, '2', true, {}, 1n, Number.MAX_SAFE_INTEGER + 1])
    assert.throws(() => update.canonicalApparatusUpdateDraft({ ...normalized, color_stations: value }, current), /Invalid apparatus color stations/);
  for (const value of [null, -1000, -1, 0, 1, Number.MAX_SAFE_INTEGER])
    assert.equal(update.canonicalApparatusUpdateDraft({ ...normalized, color_stations: value }, current).patch.execution_profile.color_station_count, value);
});

test('update rejects unsafe revision, sort, width and selected profile levels before serialization', () => {
  const normalized = create.normalizeApparatusCreate(input, false);
  for (const value of [NaN, Infinity, -Infinity, 1.5, '2', true, 1n, Number.MAX_SAFE_INTEGER + 1]) {
    for (const key of ['source_revision', 'sort_order', 'min_web_width_mm', 'max_web_width_mm'])
      assert.throws(() => update.canonicalApparatusUpdateDraft(normalized, { ...current, [key]: value }), TypeError, key);
    const badProfile = { ...current, capability_profiles: [profile('tooling', value)] };
    assert.throws(() => update.canonicalApparatusUpdateDraft(normalized, badProfile), /Invalid apparatus capability level/);
  }
  for (const value of [-1000, -1, 0, 1, Number.MAX_SAFE_INTEGER]) {
    const result = update.canonicalApparatusUpdateDraft(normalized, { ...current, source_revision: value, sort_order: value,
      min_web_width_mm: value, max_web_width_mm: value });
    assert.equal(result.expected_revision, value); assert.equal(result.patch.display.catalog_order, value);
    assert.equal(result.patch.execution_profile.min_web_width_mm, value); assert.equal(result.patch.execution_profile.max_web_width_mm, value);
  }
});

test('direct update projection rejects an unsafe selected incoming profile before falling back to current data', () => {
  const normalized = create.normalizeApparatusCreate(input, false);
  for (const value of [NaN, Infinity, -Infinity, 1.5, '2', true, null, 1n, Number.MAX_SAFE_INTEGER + 1])
    assert.throws(() => update.canonicalApparatusUpdateDraft({ ...normalized, capability_profiles: [profile('print', value)] }, current),
      /Invalid apparatus capability level/);
});
