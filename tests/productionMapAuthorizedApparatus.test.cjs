const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const { gunzipSync } = require('node:zlib');
function compile(relative, mocks = {}) {
  const filename = path.resolve(__dirname, `../src/${relative}.ts`), loaded = new Module(filename, module);
  loaded.filename = filename; loaded.paths = module.paths;
  loaded.require = name => Object.hasOwn(mocks, name) ? mocks[name] : require(name);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return loaded.exports;
}
const controls = compile('workerControlsApi', { './authorizedFetch': {}, './sessionReadScope': {} });
const dartApparatus = compile('shared/dartApparatus', { '../workerControlsApi': controls });
const { productionMapAuthorizedOrderApparatus: authorized } = compile('shared/productionMapAuthorizedApparatus', { './dartApparatus': dartApparatus });
const golden = require('./contracts/f11910bb/material_assignment_apparatus.json');
const unicode = require('./contracts/f11910bb/material_unicode_trim.json');

// @v2-test test/production_map_chain_test.dart
// Goldens were emitted by the adjacent Dart oracle, on an isolated f119 export.
for (const [name, value] of Object.entries(golden.cases)) {
  if (name === 'non_ascii_dart_canonical_id') continue; // Explicit fail-closed gap is tested below.
  test(`f119 assignment apparatus: ${name}`, () => {
    const map = { nodes: value.nodes, edges: value.edges }, before = JSON.stringify(map), assigned = [...value.assigned];
    const result = authorized(map, assigned);
    assert.deepEqual(result, value.expected); assert.equal(Object.isFrozen(result), true);
    assert.equal(JSON.stringify(map), before, 'helper must not mutate the shared production map');
    assert.deepEqual(assigned, value.assigned, 'helper must not mutate account assignments');
  });
}

test('assignment apparatus never treats display names, uppercase, or unassigned ids as authorization', () => {
  const source = golden.cases.canonical_topology;
  assert.deepEqual(authorized(source, ['Flexo pechat', 'Rezka', 'APPARATUS:DEFAULT:ASSET-005']), []);
  assert.deepEqual(authorized(source, []), []);
});

test('all Dart-trimmed Unicode scalars behave correctly in group, branch, and assigned ID', () => {
  const a = 'apparatus:default:asset-007', b = 'apparatus:default:asset-008';
  const node = (id, kind, apparatus = '', group = '') => ({ id, kind, apparatus_id: apparatus,
    alternative_group_id: group, alternative_assigned_apparatus_id: '' });
  const edge = (from, to, branch = '') => ({ from, to, branch });
  for (const codepoint of unicode.trim) {
    const whitespace = String.fromCodePoint(codepoint);
    const group = { nodes: [node('start', 'start'), node('a', 'apparatus', a, whitespace), node('b', 'apparatus', b, whitespace)],
      edges: [edge('start', 'a')] };
    const branch = { nodes: [node('start', 'start'), node('c', 'condition'), node('a', 'apparatus', a)],
      edges: [edge('start', 'c'), edge('c', 'a', `yes${whitespace}`)] };
    assert.deepEqual(authorized(group, [a, b]), [a], `group U+${codepoint.toString(16)}`);
    assert.deepEqual(authorized(branch, [a]), [a], `branch U+${codepoint.toString(16)}`);
    assert.deepEqual(authorized(group, [`${a}${whitespace}`]), [a], `assigned U+${codepoint.toString(16)}`);
  }
});

test('non-ASCII canonical IDs fail closed until Dart and Hermes Unicode case mappings are verified', () => {
  const value = golden.cases.non_ascii_dart_canonical_id;
  assert.deepEqual(value.expected, ['apparatus:default:\u037f']); // Actual f119 Dart result, not parity in this limited port.
  assert.deepEqual(authorized({ nodes: value.nodes, edges: value.edges }, value.assigned), []);
});

test('characters outside Dart whitespace are not silently stripped from groups or branches', () => {
  const a = 'apparatus:default:asset-007', b = 'apparatus:default:asset-008';
  const node = (id, kind, apparatus = '', group = '') => ({ id, kind, apparatus_id: apparatus,
    alternative_group_id: group, alternative_assigned_apparatus_id: '' });
  const edge = (from, to, branch = '') => ({ from, to, branch });
  for (const cp of [0x180e, 0x200b, 0x2060, 0x037f]) {
    assert.equal(unicode.trim.includes(cp), false);
    const character = String.fromCodePoint(cp);
    const group = { nodes: [node('start', 'start'), node('a', 'apparatus', a, character), node('b', 'apparatus', b, character)],
      edges: [edge('start', 'a')] };
    const branch = { nodes: [node('start', 'start'), node('c', 'condition'), node('a', 'apparatus', a)],
      edges: [edge('start', 'c'), edge('c', 'a', `yes${character}`)] };
    assert.deepEqual(authorized(group, [a, b]), [a, b]);
    assert.deepEqual(authorized(branch, [a]), []);
  }
});

test('results, including an empty result, cannot be mutated like V2 unmodifiable lists', () => {
  for (const value of [golden.cases.no_start, golden.cases.canonical_topology]) {
    const result = authorized({ nodes: value.nodes, edges: value.edges }, value.assigned);
    assert.equal(Object.isFrozen(result), true); assert.throws(() => result.push('extra'), TypeError);
  }
});

test('3,500 seeded ASCII topologies match the independent f119 Dart oracle', () => {
  const file = path.join(__dirname, 'contracts/f11910bb/material_assignment_topology_fuzz.json.gz');
  const metadata = require('./contracts/f11910bb/material_assignment_topology_fuzz.meta.json');
  const compressed = fs.readFileSync(file), uncompressed = gunzipSync(compressed);
  const sha256 = value => createHash('sha256').update(value).digest('hex');
  assert.equal(metadata.baseline, 'f11910bb2c8c7081ce26770e69811b03fd0739ed');
  assert.equal(sha256(compressed), metadata.gzip_sha256); assert.equal(sha256(uncompressed), metadata.uncompressed_sha256);
  const cases = JSON.parse(uncompressed.toString('utf8'));
  assert.equal(cases.length, metadata.cases); assert.equal(cases.length, 3500);
  for (const [index, value] of cases.entries()) {
    assert.deepEqual(authorized({ nodes: value.nodes, edges: value.edges }, value.assigned), value.expected, `case ${index}`);
  }
});
