const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

function fixture() {
  const filename = path.resolve(__dirname, '../src/apparatusApi.ts'), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths;
  mod.require = name => name === './authorizedFetch' ? {} : name === './workerControlsApi'
    ? { isCanonicalApparatusId: () => true, WorkerControlException: class extends Error {} } : require(name);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return mod.exports;
}
function projection(operation, technology) {
  return { apparatus_id: 'apparatus:default:asset-005', source_revision: 1, source_aasx_sha256: 'a'.repeat(64),
    display: { display_name: 'Name' }, execution_profile: { operation, technology } };
}

test('normalized-key helpers use the shared mappings and safe V2 unknown fallback', () => {
  const api = fixture();
  for (const [operation, family] of Object.entries({ print: 'pechat', laminate: 'laminatsiya', cut: 'rezka', package: 'paket', glue: 'kley' }))
    assert.equal(api.apparatusFamilyForNormalizedOperation(operation), family);
  for (const [technology, kind] of Object.entries({ rotogravure: 'color_pechat', flexographic: 'flexo', adhesive_lamination: 'laminatsiya',
    extrusion_lamination: 'extruder_laminatsiya', slitting: 'rezka', bag_making: 'paket', cold_glue: 'holodniy_kley' }))
    assert.equal(api.apparatusKindForNormalizedTechnology(technology), kind);
  for (const key of ['', 'unknown', ' PRINT ', 'constructor', '__proto__', 'toString']) {
    assert.equal(api.apparatusFamilyForNormalizedOperation(key), 'other', key);
    assert.equal(api.apparatusKindForNormalizedTechnology(key), 'other', key);
  }
});

test('existing apparatus projection keeps its original trim, lowercase and fallback behavior', () => {
  const api = fixture();
  const result = api.apparatusFromJson(projection(' PRINT ', ' FLEXOGRAPHIC '));
  assert.equal(result.operation, 'PRINT'); assert.equal(result.technology, 'FLEXOGRAPHIC');
  assert.equal(result.family, 'pechat'); assert.equal(result.kind, 'flexo');
  const unknown = api.apparatusFromJson(projection('UNKNOWN', 'İ'));
  assert.equal(unknown.family, 'other'); assert.equal(unknown.kind, 'other');
  assert.throws(() => api.apparatusFromJson(projection(null, 'slitting')), /execution profile/);
});

test('existing projection retains legacy inherited-property edge behavior', () => {
  const api = fixture();
  const legacy = api.apparatusFromJson(projection('constructor', '__proto__'));
  assert.equal(legacy.family, Object);
  assert.equal(legacy.kind, Object.prototype);
  assert.equal(api.apparatusFamilyForNormalizedOperation('constructor'), 'other');
  assert.equal(api.apparatusKindForNormalizedTechnology('__proto__'), 'other');
});
