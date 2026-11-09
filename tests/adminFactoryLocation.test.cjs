const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
function load(file, overrides = {}) {
  const filename = path.resolve(__dirname, '../src', file + '.ts');
  const mod = new Module(filename, module); mod.filename = filename; mod.paths = module.paths;
  mod.require = name => Object.hasOwn(overrides, name) ? overrides[name] : require(name);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return mod.exports;
}
const controls = { isCanonicalApparatusId: value => {
  const normalized = value.trim(), parts = normalized.split(':');
  return !!normalized && normalized.length <= 128 && normalized === normalized.toLowerCase() && !/\s/.test(normalized) &&
    parts.length >= 3 && parts[0] === 'apparatus' && parts.slice(1).every(Boolean);
}, WorkerControlException: class extends Error {} };
const apparatus = load('apparatusApi', { './workerControlsApi': controls, './authorizedFetch': {} });
const dart = load('admin/dartJsonString');
const model = load('admin/factoryLocationModel', { '../apparatusApi': apparatus, '../workerControlsApi': controls, './dartJsonString': dart });
const exception = load('shared/mobileApiException');
const errorApi = load('admin/adminApiError', { '../shared/mobileApiException': exception });
function fixture() {
  const requests = []; let status = 200, payload = {};
  const api = load('admin/factoryLocationApi', {
    '../authorizedFetch': { authorizedFetch: async (session, url, init = {}) => {
      requests.push({ session, url, init }); return new Response(JSON.stringify(payload), { status });
    } },
    '../shared/mobileApiException': exception, './adminApiError': errorApi, './factoryLocationModel': model, './dartJsonString': dart,
  });
  return { ...api, requests, setResponse(value, code = 200) { payload = value; status = code; } };
}
const session = { token: 'test' };
const compact = { id: 'apparatus:default:asset-007', name: 'Laminatsiya 1', source_revision: 4,
  equipment_class_id: 'equipment-class:lamination', physical_asset_id: 'physical-asset:lamination-1', active: true };
const location = { id: 'state_lamination_1', name: 'Laminatsiya 1', active: true, apparatus: [compact],
  created_at_unix: 100, updated_at_unix: 200 };
// @v2-test test/admin_factory_locations_test.dart (run independently against f11910bb)
test('factory location accepts compact apparatus snapshots and preserves their identity', () => {
  assert.throws(() => apparatus.apparatusFromJson(compact), TypeError);
  const parsed = model.adminFactoryLocationFromJson(location);
  assert.equal(model.isApparatusState(parsed), true);
  assert.equal(parsed.apparatus[0].id, 'apparatus:default:asset-007');
  assert.equal(parsed.apparatus[0].name, 'Laminatsiya 1');
  assert.equal(parsed.apparatus[0].source_revision, 4);
  assert.equal(parsed.apparatus[0].lifecycle_state, 'active');
  assert.equal(parsed.apparatus[0].equipment_class_id, 'equipment-class:lamination');
  assert.equal(parsed.created_at_unix, 100);
  assert.equal(parsed.updated_at_unix, 200);
  const edge = model.adminFactoryLocationFromJson({ apparatus: [{ ...compact, id: '\u0085' + compact.id + '\u0085', name: { label: 'A' } }] });
  assert.equal(edge.apparatus[0].id, compact.id); assert.equal(edge.apparatus[0].name, '{label: A}');
  const inactive = model.adminFactoryLocationFromJson({ apparatus: [null, 4, { ...compact, active: false }] });
  assert.equal(inactive.active, true);
  assert.equal(inactive.apparatus.length, 1);
  assert.equal(inactive.apparatus[0].lifecycle_state, 'retired');
  assert.equal(model.isApparatusState(model.adminFactoryLocationFromJson({})), false);
  for (const bad of [{ ...compact, id: 'bad' }, { ...compact, name: '' }, { ...compact, source_revision: 0 }]) {
    assert.throws(() => model.adminFactoryLocationFromJson({ apparatus: [bad] }), TypeError);
  }
  assert.throws(() => model.adminFactoryLocationFromJson({ apparatus: {} }), TypeError);
  assert.throws(() => model.adminFactoryLocationFromJson({ id: 1, apparatus: {} }), /Invalid factory location string/);
});

test('factory location reuses the full canonical apparatus parser', () => {
  const projection = { apparatus_id: 'apparatus:default:rezka', source_revision: 3, source_aasx_sha256: 'a'.repeat(64),
    display: { display_name: 'Rezka', catalog_order: 9 }, execution_profile: { operation: 'cut', technology: 'slitting' } };
  const parsed = model.adminFactoryLocationFromJson({ apparatus: [projection] });
  assert.equal(parsed.apparatus[0].id, projection.apparatus_id);
  assert.equal(parsed.apparatus[0].name, 'Rezka');
  assert.equal(parsed.apparatus[0].sort_order, 9);
  assert.equal(parsed.apparatus[0].operation, 'cut');
});

// No V2 live HTTP recording was found. Requests are derived from f119 source and use mocks only.
test('factory location reads filter non-maps and report V2 errors', async () => {
  const api = fixture(); api.setResponse([null, 4, location]);
  assert.deepEqual(await api.adminFactoryLocations(session), [model.adminFactoryLocationFromJson(location)]);
  assert.deepEqual(api.requests.map(call => call.url), ['/v1/mobile/admin/factory-locations']);
  api.setResponse({}, 500);
  await assert.rejects(api.adminFactoryLocations(session), e => e.code === 'factory_locations_load_failed' &&
    e.message === 'State’lar yuklanmadi (HTTP 500)' && e.statusCode === 500);
  api.setResponse({ error: 'apparatus_projection_invalid' }, 409);
  await assert.rejects(api.adminFactoryLocations(session), e => e.code === 'apparatus_projection_invalid' &&
    e.message === 'Aparat ma’lumotlari formati noto‘g‘ri');
  api.setResponse({});
  await assert.rejects(api.adminFactoryLocations(session), TypeError);
});

test('factory create trims name and deduplicates trimmed apparatus IDs without reordering', async () => {
  const api = fixture(); api.setResponse(location);
  await assert.rejects(api.adminCreateFactoryLocation(session, '  '), e => e.code === 'state_name_required' && e.message === 'State nomini kiriting');
  await assert.rejects(api.adminCreateFactoryLocation(session, '\u0085 \u0085'), e => e.code === 'state_name_required');
  assert.equal(api.requests.length, 0);
  assert.equal((await api.adminCreateFactoryLocation(session, ' Bosma oldi ', [' a ', '', 'b', 'a', ' b '])).id, location.id);
  const req = api.requests[0];
  assert.equal(req.url, '/v1/mobile/admin/factory-locations');
  assert.equal(req.init.method, 'POST');
  assert.deepEqual(req.init.headers, { 'Content-Type': 'application/json' });
  assert.deepEqual(JSON.parse(req.init.body), { name: 'Bosma oldi', apparatus_ids: ['a', 'b'] });
  await api.adminCreateFactoryLocation(session, '\u0085Name\u0085', ['\u0085a\u0085', 'a']);
  assert.deepEqual(JSON.parse(api.requests[1].init.body), { name: 'Name', apparatus_ids: ['a'] });
});

test('factory update preserves optional fields, rejects empty changes and encodes the ID', async () => {
  const api = fixture(); api.setResponse(location);
  await assert.rejects(api.adminUpdateFactoryLocation(session, ' ', { active: false }), e => e.code === 'factory_location_update_invalid');
  await assert.rejects(api.adminUpdateFactoryLocation(session, 'id'), e => e.code === 'factory_location_update_invalid');
  await assert.rejects(api.adminUpdateFactoryLocation(session, 'id', { name: '  ' }), e => e.code === 'state_name_required');
  assert.equal(api.requests.length, 0);
  await api.adminUpdateFactoryLocation(session, '  state/A  ', { name: ' new ', active: false });
  await api.adminUpdateFactoryLocation(session, 'state-2', { active: false });
  assert.equal(api.requests[0].url, '/v1/mobile/admin/factory-locations/state%2FA');
  assert.equal(api.requests[0].init.method, 'PUT');
  assert.deepEqual(JSON.parse(api.requests[0].init.body), { name: 'new', active: false });
  assert.deepEqual(JSON.parse(api.requests[1].init.body), { active: false });
});

test('factory apparatus replacement keeps order and V2 failure details', async () => {
  const api = fixture(); api.setResponse(location);
  await assert.rejects(api.adminReplaceFactoryLocationApparatus(session, ' ', ['a']), e => e.code === 'state_not_found');
  await api.adminReplaceFactoryLocationApparatus(session, ' x/y ', [' b ', 'a', 'b']);
  assert.equal(api.requests[0].url, '/v1/mobile/admin/factory-locations/x%2Fy/apparatus');
  assert.deepEqual(JSON.parse(api.requests[0].init.body), { apparatus_ids: ['b', 'a'] });
  api.setResponse({ error: 'rezka_worker_has_open_run', blocked_apparatus_ids: ['a', 3, 'b'] }, 409);
  await assert.rejects(api.adminReplaceFactoryLocationApparatus(session, 'x', []), e => e.code === 'rezka_worker_has_open_run' &&
    e.message === 'rezka_worker_has_open_run' && e.statusCode === 409 && JSON.stringify(e.details) === '["a","b"]');
});
