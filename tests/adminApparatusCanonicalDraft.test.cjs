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
const controls = load('workerControlsApi', { './authorizedFetch': {}, './sessionReadScope': {} });
const apparatus = load('apparatusApi', { './authorizedFetch': {}, './workerControlsApi': controls });
const dart = load('admin/dartJsonString');
const options = load('admin/apparatusOptionsApi', { '../authorizedFetch': {}, '../apparatusApi': apparatus, './dartJsonString': dart });
const model = load('admin/apparatusCanonicalDraft', { '../apparatusApi': apparatus, './apparatusOptionsApi': options, './dartJsonString': dart });
// Source-derived checks only: the f119 Flutter oracle remains blocked by the SQLite hash failure.
test('canonical reverse mappings reuse the existing apparatus maps and normalized technology projection', () => {
  const families = { pechat: 'print', laminatsiya: 'laminate', rezka: 'cut', paket: 'package', kley: 'glue' };
  const kinds = { color_pechat: ['rotogravure', 'print'], flexo: ['flexographic', 'print'], laminatsiya: ['adhesive_lamination', 'laminate'],
    extruder_laminatsiya: ['extrusion_lamination', 'laminate'], rezka: ['slitting', 'cut'], paket: ['bag_making', 'package'], holodniy_kley: ['cold_glue', 'glue'] };
  for (const [family, operation] of Object.entries(families)) assert.equal(model.canonicalOperationForFamily(`\u0085${family.toUpperCase()}\u0085`), operation);
  for (const [kind, [technology, operation]] of Object.entries(kinds)) {
    assert.equal(model.canonicalTechnologyForKind(` ${kind.toUpperCase()} `), technology);
    assert.equal(model.canonicalOperationForTechnology(` ${technology.toUpperCase()} `), operation);
  }
  assert.equal(model.canonicalOperationForFamily('LAMİNATSİYA'), 'laminate');
  for (const value of ['constructor', '__proto__', 'not-known']) {
    assert.equal(model.canonicalOperationForFamily(value), ''); assert.equal(model.canonicalTechnologyForKind(value), '');
    assert.equal(model.canonicalOperationForTechnology(value), '');
  }
});
test('create draft preserves every nested field and last duplicate profile level', () => {
  const input = { name: 'Press', operation: 'print', technology: 'rotogravure',
    capabilities: [{ code: 'print', level: 2 }, { code: 'print', level: 5 }, { code: 'training', level: 7 }],
    capability_codes: ['virtual_task', 'print', 'virtual_task'], color_stations: 8, factory_map_object_id: 'map-1', training_enabled: true, opaque_key: 'opaque' };
  assert.deepEqual(model.canonicalApparatusDraft(input), { display: { display_name: 'Press', description: '', catalog_order: 10000 },
    equipment_class_id: 'equipment-class:mini-rs-erp:print:rotogravure', physical_asset_id: 'physical-asset:mobile:opaque',
    hierarchy: { enterprise_id: 'enterprise:accord', site_id: 'site:main', area_id: 'area:production', work_center_id: 'work-center:print', work_unit_id: 'work-unit:mobile:opaque' },
    capabilities: [{ code: 'print', level: 5 }, { code: 'training', level: 7 }, { code: 'virtual_task', level: 1 }],
    execution_profile: { operation: 'print', technology: 'rotogravure', color_station_count: 8, virtual_tasks: 'disabled', capability_compatible_reroute: true },
    policies: { queue: 'strict_sequence', material: { mode: 'not_required' }, tooling: { mode: 'not_required' } },
    capacity: { capacity_slots: 1, setup_minutes: 0, cleanup_minutes: 0, efficiency_percent: 100, finite_capacity: true, availability: { mode: 'always' } },
    placement: { factory_map_object_id: 'map-1' }, training: { enabled: true, queue_enabled: true, material_tracking_enabled: true },
    lifecycle: { state: 'active', retirement_reason: null } });
});
test('draft keeps empty placement null, excludes implicit training and handles prototype-like codes as data', () => {
  const value = model.canonicalApparatusDraft({ name: '', operation: 'cut', technology: 'slitting',
    capabilities: [{ code: '__proto__', level: 9 }, { code: 'constructor', level: 4 }], capability_codes: ['__proto__', 'constructor'],
    color_stations: null, factory_map_object_id: '', training_enabled: false, opaque_key: '' });
  assert.equal(value.placement, null); assert.deepEqual(value.capabilities, [{ code: '__proto__', level: 9 }, { code: 'constructor', level: 4 }, { code: 'cut', level: 1 }]);
  assert.deepEqual(value.training, { enabled: false, queue_enabled: false, material_tracking_enabled: false });
});

test('draft color stations accept only null or safe integers without a new business range', () => {
  const input = { name: 'Press', operation: 'print', technology: 'rotogravure', capabilities: [], capability_codes: [],
    color_stations: null, factory_map_object_id: '', training_enabled: false, opaque_key: 'k' };
  for (const value of [NaN, Infinity, -Infinity, 1.5, '2', true, {}, 1n, Number.MAX_SAFE_INTEGER + 1])
    assert.throws(() => model.canonicalApparatusDraft({ ...input, color_stations: value }), /Invalid apparatus color stations/);
  for (const value of [null, -1000, -1, 0, 1, Number.MAX_SAFE_INTEGER])
    assert.equal(model.canonicalApparatusDraft({ ...input, color_stations: value }).execution_profile.color_station_count, value);
});

test('direct draft rejects non-integer or unsafe capability levels before JSON can silently change them', () => {
  const input = { name: 'Press', operation: 'print', technology: 'rotogravure', capability_codes: ['print'],
    color_stations: null, factory_map_object_id: '', training_enabled: false, opaque_key: 'k' };
  for (const value of [NaN, Infinity, -Infinity, 1.5, '2', true, null, 1n, Number.MAX_SAFE_INTEGER + 1])
    assert.throws(() => model.canonicalApparatusDraft({ ...input, capabilities: [{ code: 'print', level: value }] }), /Invalid apparatus capability level/);
  for (const value of [-1000, -1, 0, 1, Number.MAX_SAFE_INTEGER])
    assert.equal(model.canonicalApparatusDraft({ ...input, capabilities: [{ code: 'print', level: value }] }).capabilities[0].level, value);
});
