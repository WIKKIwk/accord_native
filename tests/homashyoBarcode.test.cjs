// f119 URI oracle replay. These tests use no real scanner, server, credentials or printer.
const assert = require('node:assert/strict'); const fs = require('node:fs'); const Module = require('node:module');
const path = require('node:path'); const test = require('node:test'); const ts = require('typescript');
const fixture = require('./contracts/f11910bb/homashyo_barcode_oracle.json');
const sharedFixture = require('./contracts/f11910bb/raw_material_barcode_shared_oracle.json');
const { generators: originalGenerators } = require('./oracles/generateRawMaterialBarcodeCorpus.cjs');
const { independent } = require('./oracles/generateRawMaterialBarcodeIndependent.cjs');
const generators = { ...originalGenerators, independent };
const crypto = require('node:crypto');
const { generateInputs } = require('./oracles/generateHomashyoBarcodeInputs.cjs');
function load(file, mocks = {}) { const filename = path.resolve(__dirname, `../src/${file}.ts`), m = new Module(filename, module);
  m.filename = filename; m.paths = module.paths; m.require = id => Object.hasOwn(mocks, id) ? mocks[id] : {};
  m._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename); return m.exports; }
const inventory = load('preparation/preparationInventory'), realBarcode = inventory.preparationInventoryBarcode;
const shared = load('shared/barcode/rawMaterialBarcode');
let existingCalls = 0, sourceCalls = 0;
const barcode = load('homashyo/rawSplitBarcode', { '../preparation/preparationInventory': {
  preparationInventoryBarcode: raw => { existingCalls++; return realBarcode(raw); },
}, '../shared/barcode/rawMaterialBarcode': { rawMaterialBarcodeFromQr: raw => { sourceCalls++; return shared.rawMaterialBarcodeFromQr(raw); } } }).rawSplitBarcode;

test('f119 oracle inputs and seeded fuzz cases are reproducible', () => {
  assert.equal(fixture.source_sha, 'f11910bb2c8c7081ce26770e69811b03fd0739ed');
  assert.equal(fixture.fuzz_seed, '0xabcdef'); assert.equal(fixture.cases.length, 645);
  assert.deepEqual(generateInputs(), fixture.cases.map(row => row.raw));
});

test('role adapter matches all 645 historical source oracle results and reuses the existing parser safely', () => {
  let count = 0;
  for (const row of fixture.cases) {
    if (row.error) assert.throws(() => barcode(row.raw), URIError, row.raw);
    else assert.equal(barcode(row.raw), row.value, row.raw);
    count++;
  }
  assert.equal(count, 645); assert.ok(existingCalls > 0); assert.ok(sourceCalls > 0);
});

test('the previously observed percent-encoded host mismatch is resolved without rewriting the historical fixture', () => {
  const row = fixture.cases.find(value => value.raw === 'https://%FF/a');
  assert.ok(fixture.known_mismatches.includes(row.raw)); assert.equal(row.value, 'a'); assert.equal(barcode(row.raw), row.value);
  assert.equal(barcode('https:30/40'), 'https:30/40');
});

test('opaque ASCII takes the existing fast path; schemes, unicode and malformed URLs use the shared source parser only', () => {
  let beforeExisting = existingCalls, beforeSource = sourceCalls;
  assert.equal(barcode('  Milano Premium 30/40  '), 'Milano Premium 30/40');
  assert.equal(existingCalls, beforeExisting + 1); assert.equal(sourceCalls, beforeSource);
  beforeExisting = existingCalls; beforeSource = sourceCalls;
  for (const raw of ['https:30/40', 'https://%FF/a', '\u0085CODE\u0085', 'https://host/?barcode=A&barcode=B']) barcode(raw);
  assert.equal(existingCalls, beforeExisting); assert.equal(sourceCalls, beforeSource + 4);
  assert.throws(() => barcode('https://host/?barcode=%FF'), URIError);
  assert.equal(existingCalls, beforeExisting);
});
for (const [name, spec] of Object.entries(sharedFixture.datasets)) test(`role fast-path matches the ${name} Dart corpus`, () => {
  const rows = generators[name]().map(raw => {
    try { return { raw, value: barcode(raw) }; }
    catch (error) { assert.ok(error instanceof URIError); return { raw, error: 'FormatException' }; }
  });
  assert.equal(rows.length, spec.count);
  assert.equal(crypto.createHash('sha256').update(JSON.stringify(rows)).digest('hex'), spec.sha256);
});
