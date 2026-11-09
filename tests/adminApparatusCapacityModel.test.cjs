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
const exception = load('shared/mobileApiException'), dart = load('admin/dartJsonString');
const model = load('admin/apparatusCapacityModel', { '../workerControlsApi': controls, '../shared/mobileApiException': exception, './dartJsonString': dart });
const id = 'apparatus:default:print_1';
// Source-derived mock cases, not a Flutter oracle or recorded HTTP fixture.
test('working windows preserve source defaults, truncation and JSON field names', () => {
  assert.deepEqual(model.apparatusWorkingWindowFromJson({}), { weekday: 1, start_minute: 0, end_minute: 1440 });
  const window = model.apparatusWorkingWindowFromJson({ weekday: 2.9, start_minute: -5.4, end_minute: 600.8 });
  assert.deepEqual(window, { weekday: 2, start_minute: -5, end_minute: 600 });
  assert.deepEqual(model.apparatusWorkingWindowToJson(window), { weekday: 2, start_minute: -5, end_minute: 600 });
  assert.throws(() => model.apparatusWorkingWindowFromJson({ weekday: '2' }), TypeError);
});
test('capacity profile handles defaults, trimmed canonical ID and invalid number/ID', () => {
  const parsed = model.apparatusCapacityProfileFromJson({ apparatus_id: `\u0085${id}\u0085`, apparatus: ' Machine ', source_revision: 2.9,
    source_aasx_sha256: ' hash ', capacity_slots: null, finite_capacity: false, working_windows: [null, 4, { weekday: 3, start_minute: 60, end_minute: 120 }],
    capabilities: [' PRINT ', 'ΟΣ', '', null], capability_levels: JSON.parse('{" PRINT ":2.9,"print":4,"constructor":8,"__proto__":7," ":55}'), notes: ' notes ' });
  assert.equal(parsed.apparatus_id, id); assert.equal(parsed.apparatus, 'Machine'); assert.equal(parsed.source_revision, 2); assert.equal(parsed.source_aasx_sha256, 'hash');
  assert.equal(parsed.capacity_slots, 1); assert.equal(parsed.setup_minutes, 0); assert.equal(parsed.cleanup_minutes, 0); assert.equal(parsed.efficiency_percent, 100);
  assert.equal(parsed.finite_capacity, false); assert.deepEqual(parsed.working_windows, [{ weekday: 3, start_minute: 60, end_minute: 120 }]);
  assert.deepEqual(parsed.capabilities, ['print', 'οσ', 'null']); assert.deepEqual({ ...parsed.capability_levels }, { print: 4, constructor: 8, ['__proto__']: 7 });
  assert.equal(parsed.notes, ' notes '); assert.equal(parsed.updated_at_unix, 0);
  const defaults = model.apparatusCapacityProfileFromJson({ apparatus_id: id }); assert.equal(defaults.finite_capacity, true);
  assert.deepEqual(defaults.working_windows, []); assert.deepEqual(defaults.capabilities, []); assert.deepEqual({ ...defaults.capability_levels }, {});
  assert.throws(() => model.apparatusCapacityProfileFromJson({ apparatus_id: 'invalid' }), e => e.code === 'apparatus_id_invalid');
  assert.throws(() => model.apparatusCapacityProfileFromJson({ apparatus_id: id, capacity_slots: '2' }), TypeError);
  // The source applies `as num?` before its fallback parse, so a non-null string throws.
  assert.throws(() => model.apparatusCapacityProfileFromJson({ apparatus_id: id, capability_levels: { print: '2' } }), TypeError);
  assert.equal(model.apparatusCapacityProfileFromJson({ apparatus_id: id, capability_levels: { print: null } }).capability_levels.print, 1);
});
test('ambiguous integer-index normalization collisions fail closed in either wire order', () => {
  for (const levels of ['{" 1 ":7,"1":9}', '{"1":9," 1 ":7}',
    '{" 4294967294 ":7,"4294967294":9}', '{"4294967294":9," 4294967294 ":7}']) {
    const input = JSON.parse(`{"apparatus_id":"${id}","capability_levels":${levels}}`);
    assert.throws(() => model.apparatusCapacityProfileFromJson(input), /Ambiguous capability level key order/);
  }
  // Non-index string keys retain JSON insertion order and the source's last-value rule.
  const ordinary = JSON.parse(`{"apparatus_id":"${id}","capability_levels":{" 4294967295 ":7,"4294967295":9,"PRINT":2,"print":4}}`);
  assert.equal(model.apparatusCapacityProfileFromJson(ordinary).capability_levels['4294967295'], 9);
  assert.equal(model.apparatusCapacityProfileFromJson(ordinary).capability_levels.print, 4);
});
test('canonical capacity serializes only capacity and availability, not notes or capability metadata', () => {
  const profile = model.apparatusCapacityProfileFromJson({ apparatus_id: id, apparatus: ' A ', capacity_slots: 3,
    setup_minutes: 4, cleanup_minutes: 5, efficiency_percent: 90, capabilities: ['print'], capability_levels: { print: 3 }, notes: 'secret note',
    working_windows: [{ weekday: 2, start_minute: 60, end_minute: 120 }] });
  assert.deepEqual(model.apparatusCanonicalCapacityToJson(profile), { capacity_slots: 3, setup_minutes: 4, cleanup_minutes: 5,
    efficiency_percent: 90, finite_capacity: true, availability: { mode: 'scheduled', working_windows: [{ weekday: 2, start_minute: 60, end_minute: 120 }] } });
  assert.deepEqual(model.apparatusCanonicalCapacityToJson({ ...profile, working_windows: [] }).availability, { mode: 'always' });
  const full = model.apparatusCapacityProfileToJson(profile);
  assert.equal(full.apparatus, 'A'); assert.equal(full.notes, 'secret note'); assert.deepEqual(full.capabilities, ['print']);
  assert.deepEqual(JSON.parse(JSON.stringify(full.capability_levels)), { print: 3 });
});
test('downtime preserves untrimmed user text and actor fields, while requiring canonical apparatus', () => {
  const parsed = model.apparatusDowntimeFromJson({ id: ' d ', apparatus_id: ` ${id} `, apparatus: ' Machine ', starts_at_unix: 2.7,
    ends_at_unix: -3.7, reason: ' reason ', active: false, actor: { role: 'admin', ref: 12, display_name: ' Name ' }, created_at_unix: 11 });
  assert.deepEqual(parsed, { id: ' d ', apparatus_id: id, apparatus: ' Machine ', starts_at_unix: 2, ends_at_unix: -3,
    reason: ' reason ', active: false, actor: { role: 'admin', ref: '12', display_name: ' Name ' }, created_at_unix: 11 });
  assert.deepEqual(model.apparatusDowntimeToJson(parsed), { id: ' d ', apparatus_id: id, apparatus: ' Machine ', starts_at_unix: 2, ends_at_unix: -3,
    reason: ' reason ', active: false, actor: { role: 'admin', ref: '12', display_name: ' Name ' }, created_at_unix: 11 });
  assert.deepEqual(model.apparatusDowntimeFromJson({ apparatus_id: id, actor: 'invalid' }), { id: '', apparatus_id: id, apparatus: '', starts_at_unix: 0,
    ends_at_unix: 0, reason: '', active: true, actor: { role: '', ref: '', display_name: '' }, created_at_unix: 0 });
});
test('candidate, capability requirement and reservation preserve source defaults and nested maps', () => {
  const candidate = model.apparatusScheduleCandidateFromJson({ apparatus_id: ` ${id} `, apparatus: ' Machine ' });
  assert.deepEqual(candidate, { apparatus_id: id, apparatus: 'Machine' });
  assert.deepEqual(model.apparatusScheduleCandidateToJson({ apparatus_id: ` ${id} `, apparatus: ' Machine ' }), { apparatus_id: id, apparatus: 'Machine' });
  assert.deepEqual(model.apparatusCapabilityRequirementFromJson({ code: ' Print ', min_level: 2.8 }), { code: 'Print', min_level: 2 });
  assert.deepEqual(model.apparatusCapabilityRequirementToJson({ code: ' Print ', min_level: 3 }), { code: 'Print', min_level: 3 });
  const parsed = model.apparatusScheduleReservationFromJson({ apparatus_id: id, reservation_id: 'r', apparatus: ' Machine ',
    capability_requirements: [null, 'bad', { code: ' Print ', min_level: 2.9 }], status: '' });
  assert.equal(parsed.status, ''); assert.equal(parsed.apparatus, ' Machine '); assert.equal(parsed.priority, 0);
  assert.deepEqual(parsed.capability_requirements, [{ code: 'Print', min_level: 2 }]);
  assert.deepEqual(model.apparatusScheduleReservationToJson(parsed).capability_requirements, [{ code: 'Print', min_level: 2 }]);
  assert.equal(model.apparatusScheduleReservationFromJson({ apparatus_id: id }).status, 'planned');
  assert.throws(() => model.apparatusScheduleReservationFromJson({ apparatus_id: id, starts_at_unix: '1' }), TypeError);
});
test('snapshot accepts only object rows and keeps profiles, downtime and reservations distinct', () => {
  const snapshot = model.apparatusCapacitySnapshotFromJson({ profiles: [null, 1, { apparatus_id: id }],
    downtimes: [{ apparatus_id: id }], reservations: [{ apparatus_id: id }] });
  assert.equal(snapshot.profiles.length, 1); assert.equal(snapshot.downtimes.length, 1); assert.equal(snapshot.reservations.length, 1);
  assert.deepEqual(model.apparatusCapacitySnapshotFromJson({ profiles: {}, downtimes: null, reservations: false }), { profiles: [], downtimes: [], reservations: [] });
  assert.throws(() => model.apparatusCapacitySnapshotFromJson({ profiles: [{ apparatus_id: 'bad' }] }), e => e.code === 'apparatus_id_invalid');
});
