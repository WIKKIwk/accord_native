const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
function compile(relative, mocks = {}) {
  const filename = path.resolve(__dirname, `../src/${relative}.ts`), loaded = new Module(filename, module);
  loaded.filename = filename; loaded.paths = module.paths;
  loaded.require = name => Object.hasOwn(mocks, name) ? mocks[name] : require(name);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return loaded.exports;
}
const controls = compile('workerControlsApi', { './authorizedFetch': {}, './sessionReadScope': {} });
const { productionMapAuthorizedOrderApparatus: authorized } = compile('shared/productionMapAuthorizedApparatus', { '../workerControlsApi': controls });
const golden = require('./contracts/f11910bb/material_assignment_apparatus.json');

// @v2-test test/production_map_chain_test.dart
// Goldens were emitted by the adjacent Dart oracle, on an isolated f119 export.
for (const [name, value] of Object.entries(golden.cases)) {
  test(`f119 assignment apparatus: ${name}`, () => {
    const map = { nodes: value.nodes, edges: value.edges }, before = JSON.stringify(map), assigned = [...value.assigned];
    assert.deepEqual(authorized(map, assigned), value.expected);
    assert.equal(JSON.stringify(map), before, 'helper must not mutate the shared production map');
    assert.deepEqual(assigned, value.assigned, 'helper must not mutate account assignments');
  });
}

test('assignment apparatus never treats display names, uppercase, or unassigned ids as authorization', () => {
  const source = golden.cases.canonical_topology;
  assert.deepEqual(authorized(source, ['Flexo pechat', 'Rezka', 'APPARATUS:DEFAULT:ASSET-005']), []);
  assert.deepEqual(authorized(source, []), []);
});
