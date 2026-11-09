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
const dart = load('admin/dartJsonString');
const apparatus = load('apparatusApi', { './authorizedFetch': {}, './workerControlsApi': {
  WorkerControlException: class extends Error {}, isCanonicalApparatusId: () => true,
} });
function fixture() {
  const requests = []; let status = 200, payload = {};
  const api = load('admin/apparatusOptionsApi', { '../authorizedFetch': { authorizedFetch: async (session, url) => {
    requests.push({ session, url }); return new Response(JSON.stringify(payload), { status });
  } }, '../apparatusApi': apparatus, './dartJsonString': dart });
  return { ...api, requests, setResponse(value, code = 200) { payload = value; status = code; } };
}
test('canonical apparatus options derive existing shared families and kinds in source order', () => {
  const api = fixture();
  const options = api.adminApparatusMasterOptionsFromJson({ contract: 'canonical_apparatus_revision', vocabulary: {
    execution_operations: ['print', 'laminate', 'cut', 'package', 'glue'],
    process_technologies: ['rotogravure', 'flexographic', 'adhesive_lamination', 'extrusion_lamination', 'slitting', 'bag_making', 'cold_glue'],
    equipment_capabilities: ['print', 'training'],
  } });
  assert.deepEqual(options.families, ['pechat', 'laminatsiya', 'rezka', 'paket', 'kley']);
  assert.deepEqual(api.apparatusKindsForFamily(options, ' PECHAT '), ['color_pechat', 'flexo']);
  assert.deepEqual(api.apparatusKindsForFamily(options, 'constructor'), []);
  assert.equal(api.apparatusSupportsCapability(options, ' PRINT '), true);
  assert.equal(options.color_stations_min, 1); assert.equal(options.color_stations_max, 32);
});
test('options handle f119 dotted I and non-contextual sigma, with remaining Unicode difference explicit', () => {
  const api = fixture();
  const options = api.adminApparatusMasterOptionsFromJson({ contract: 'canonical_apparatus_revision', vocabulary: {
    execution_operations: ['PRİNT', '\u0085CUT\u0085', 'constructor', 'PRİNT'],
    process_technologies: ['FLEXOGRAPHİC', 'SLİTTİNG', '__proto__'],
    equipment_capabilities: [' PRİNT ', 'ΟΣ', 'İ', '\u0524', null, 9, ' '],
  }, color_stations_min: 3.9, color_stations_max: 99 });
  assert.deepEqual(options.families, ['pechat', 'rezka', 'pechat']);
  assert.deepEqual(api.apparatusKindsForFamily(options, 'pechat'), ['flexo']);
  assert.deepEqual(api.apparatusKindsForFamily(options, 'rezka'), ['rezka']);
  assert.deepEqual(options.capabilities.slice(0, 3), ['print', 'οσ', 'i']);
  assert.deepEqual(options.capabilities.slice(4), ['null', '9']); // U+0524 parity remains open below
  assert.equal(api.apparatusSupportsCapability(options, 'PRİNT'), true);
  assert.equal(options.color_stations_min, 3); assert.equal(options.color_stations_max, 32);
});
test('options API checks contract and status', async () => {
  const api = fixture();
  assert.throws(() => api.adminApparatusMasterOptionsFromJson({ contract: 'old' }), /Unsupported apparatus options contract/);
  assert.throws(() => api.adminApparatusMasterOptionsFromJson({ contract: 'canonical_apparatus_revision' }), /vocabulary is missing/);
  api.setResponse({ contract: 'canonical_apparatus_revision', vocabulary: {} });
  assert.deepEqual((await api.adminApparatusMasterOptions({})).families, []);
  assert.equal(api.requests[0].url, '/v1/mobile/admin/apparatus/options');
  api.setResponse({}, 503); await assert.rejects(api.adminApparatusMasterOptions({}), /Admin apparatus options failed/);
});

test.todo('arbitrary Unicode capability lowercase: f119 Dart preserves U+0524 while Node 24 produces U+0525');
