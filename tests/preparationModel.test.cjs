const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const filename = path.resolve(__dirname, '../src/preparation/preparationModel.ts');
const loaded = new Module(filename, module);
loaded.filename = filename;
loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ESNext } }).outputText, filename);
const m = loaded.exports;

// @v2-test test/preparation_test.dart: exact KG calculation shares ERP precision and rounding
test('required kilograms keep six-decimal rounding and bounds', () => {
  assert.equal(m.preparationRequiredKg('1250.5', '2,5'), '31.262500');
  assert.equal(m.preparationRequiredKg('0.000001', '50'), '0.000001');
  assert.equal(m.preparationRequiredKg('999999999999.999999', '100'), '999999999999.999999');
  for (const value of ['NaN', '-1', '0', '1e3', '1.0000001', '101']) assert.throws(() => m.preparationRequiredKg('100', value));
  assert.throws(() => m.preparationRequiredKg('0.000001', '0.000001'));
});
// @v2-test test/preparation_screw_shares_test.dart: nested shares round once and require both levels to be valid
test('nested shares round once at micro-kilogram precision', () => {
  assert.equal(m.preparationScrewLineKg('1000', '30', '20'), '60.000000');
  assert.equal(m.preparationScrewLineKg('824.964', '30', '10'), '24.748920');
  assert.equal(m.preparationScrewLineKg('0.000005', '50', '50'), '0.000001');
  assert.equal(m.preparationScrewLineKg('999999999999.999999', '100', '100'), '999999999999.999999');
  for (const v of ['0', '-1', '101', 'NaN', '1.0000001']) {
    assert.throws(() => m.preparationScrewLineKg('1000', v, '20'));
    assert.throws(() => m.preparationScrewLineKg('1000', '30', v));
  }
});
test('formula shares, line sorting and displayed estimates follow V2', () => {
  const rows = m.preparationFormulaListFromJson({ product_code: ' P ', formulas: [
    { name: 'b', share_percent: '70', lines: [{ item_code: '2', name: 'A', percent: '1' }, { item_code: '1', name: 'a', percent: '99' }] },
    { name: ' A ', share_percent: '30', lines: [] },
  ] });
  assert.deepEqual(rows.map(v => v.name), ['A', 'b']);
  assert.deepEqual(rows[1].lines.map(v => v.item_code), ['1', '2']);
  assert.equal(m.preparationFormulaSharesComplete(rows), true);
  rows[0].share_percent = null;
  assert.equal(m.preparationFormulaSharesComplete(rows), false);
  assert.equal(m.preparationEstimatedKgDisplay('0.000001'), '< 0.01');
  assert.equal(m.preparationEstimatedKgDisplay('824.964'), '824.96');
});
