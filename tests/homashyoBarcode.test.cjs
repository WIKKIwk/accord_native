// f119 URI oracle replay. These tests use no real scanner, server, credentials or printer.
const assert = require('node:assert/strict'); const fs = require('node:fs'); const Module = require('node:module');
const path = require('node:path'); const test = require('node:test'); const ts = require('typescript');
const fixture = require('./contracts/f11910bb/homashyo_barcode_oracle.json');
const { generateInputs } = require('./oracles/generateHomashyoBarcodeInputs.cjs');
function load(file, mocks = {}) { const filename = path.resolve(__dirname, `../src/${file}.ts`), m = new Module(filename, module);
  m.filename = filename; m.paths = module.paths; m.require = id => Object.hasOwn(mocks, id) ? mocks[id] : {};
  m._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename); return m.exports; }
const inventory = load('preparation/preparationInventory'), realBarcode = inventory.preparationInventoryBarcode;
const shared = load('shared/barcode/rawMaterialBarcode');
let sharedCalls = 0;
const barcode = load('homashyo/rawSplitBarcode', { '../preparation/preparationInventory': {
  preparationInventoryBarcode: raw => { sharedCalls++; return realBarcode(raw); },
}, '../shared/barcode/rawMaterialBarcode': shared }).rawSplitBarcode;

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
  assert.equal(count, 645); assert.ok(sharedCalls > 0);
});

test('the previously observed percent-encoded host mismatch is resolved without rewriting the historical fixture', () => {
  const row = fixture.cases.find(value => value.raw === 'https://%FF/a');
  assert.ok(fixture.known_mismatches.includes(row.raw)); assert.equal(row.value, 'a'); assert.equal(barcode(row.raw), row.value);
  assert.equal(barcode('https:30/40'), 'https:30/40');
});
