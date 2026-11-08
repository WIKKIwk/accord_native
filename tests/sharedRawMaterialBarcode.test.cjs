// Pinned f119 Dart barcode corpus; no scanner, server, credentials or device is used.
const assert = require('node:assert/strict'); const crypto = require('node:crypto'); const fs = require('node:fs');
const Module = require('node:module'); const path = require('node:path'); const test = require('node:test'); const ts = require('typescript');
const fixture = require('./contracts/f11910bb/raw_material_barcode_shared_oracle.json');
const { generators } = require('./oracles/generateRawMaterialBarcodeCorpus.cjs');
const file = path.resolve(__dirname, '../src/shared/barcode/rawMaterialBarcode.ts'), m = new Module(file, module);
m.filename = file; m.paths = module.paths;
m._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, file);
const { rawMaterialBarcodeFromQr } = m.exports;
const observed = raw => {
  try { return { raw, value: rawMaterialBarcodeFromQr(raw) }; }
  catch (error) { assert.ok(error instanceof URIError, `Unexpected error for ${JSON.stringify(raw)}`); return { raw, error: 'FormatException' }; }
};

test('curated f119 samples include opaque schemes, malformed hosts, URI errors and source dot behavior', () => {
  assert.equal(fixture.source_sha, 'f11910bb2c8c7081ce26770e69811b03fd0739ed');
  for (const row of fixture.samples) assert.deepEqual(observed(row.raw), row);
  assert.equal(rawMaterialBarcodeFromQr('https:30/40'), 'https:30/40');
  assert.equal(rawMaterialBarcodeFromQr('https://%FF/a'), 'a');
  assert.equal(rawMaterialBarcodeFromQr('data://host/a?barcode=A'), 'data://host/a?barcode=A');
});

for (const [name, spec] of Object.entries(fixture.datasets)) test(`${name}: deterministic source oracle digest (${spec.count} cases)`, () => {
  const inputs = generators[name](); assert.equal(inputs.length, spec.count);
  const rows = inputs.map(observed), digest = crypto.createHash('sha256').update(JSON.stringify(rows)).digest('hex');
  assert.equal(digest, spec.sha256, `${name} differs from the saved Dart source oracle`);
});
