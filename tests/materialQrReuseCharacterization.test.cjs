const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const filename = path.resolve(__dirname, '../src/preparation/preparationInventory.ts'), loaded = new Module(filename, module);
loaded.filename = filename; loaded.paths = module.paths;
const mocks = { '../shared/appRoutes': {}, '../shared/inventoryViewRuntime': {}, '../auth': {},
  '../inventoryReadApi': {}, './preparationInventoryTransfers': {} };
loaded.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
const { preparationInventoryBarcode } = loaded.exports;

// Source expectations are copied from f119 test/raw_material_scan_dialog_test.dart.
// These are static comparisons, not a claim that the blocked Flutter oracle ran.
test('existing native barcode helper matches the unambiguous f119 source examples', () => {
  const opaque = ['Milano Premium 30/40', 'Milano Premium 30/40-1', 'Milano Premium 25/35+5',
    'QOLIP:30/40?qr=OTHER#black', '/QOLIP/30/40', '//QOLIP/30/40', 'QOLIP-0007', '400118DA2F17C3617F59DD00'];
  for (const code of opaque) assert.equal(preparationInventoryBarcode(`  ${code}  `), code);
  assert.equal(preparationInventoryBarcode('  '), '');
  for (const key of ['barcode', 'epc', 'qr']) {
    assert.equal(preparationInventoryBarcode(`https://erp.example/scan?${key}=Milano%20Premium%2030%2F40`), 'Milano Premium 30/40');
  }
  assert.equal(preparationInventoryBarcode('https://erp.example/qolip/Milano%20Premium%2030%2F40'), 'Milano Premium 30/40');
  assert.equal(preparationInventoryBarcode('accord://scan?qr=QOLIP%2F30%2F40'), 'QOLIP/30/40');
  assert.equal(preparationInventoryBarcode('https://erp.example/qr/RM-001'), 'RM-001');
  assert.equal(preparationInventoryBarcode('QOLIP%2F30%2F40'), 'QOLIP%2F30%2F40');
});

test('characterization: WHATWG scheme-without-authority differs from f119 and blocks blind reuse', () => {
  // The existing V2 test explicitly expects the unchanged opaque code.
  const sourceExpected = 'https:30/40';
  assert.equal(preparationInventoryBarcode(`  ${sourceExpected}  `), '40');
  assert.notEqual(preparationInventoryBarcode(sourceExpected), sourceExpected);
});

test('characterization: Dart whitespace candidate fallback differs from the existing JS helper', () => {
  // Source tries barcode, epc, qr in order and Dart trim removes U+0085, so
  // barcode U+0085 is empty and the subsequent epc value is selected.
  // The 26-value Dart whitespace table was recorded by an earlier oracle.
  const qr = 'https://erp.example/scan?barcode=%C2%85&epc=OK';
  const sourceExpected = 'OK';
  assert.equal(preparationInventoryBarcode(qr), '\u0085');
  assert.notEqual(preparationInventoryBarcode(qr), sourceExpected);
});
