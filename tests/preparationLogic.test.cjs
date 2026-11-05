const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
function load(filename) {
  filename = path.resolve(__dirname, '../src/preparation', filename.endsWith('.ts') ? filename : `${filename}.ts`);
  const mod = new Module(filename, module); mod.filename = filename; mod.paths = module.paths;
  mod.require = id => id.startsWith('.') ? load(path.resolve(path.dirname(filename), id)) : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ESNext } }).outputText, filename);
  return mod.exports;
}
const m = load('preparationLogic');
test('formula editor validates material, duplicates and an exact total', () => {
  const a = { code: 'A', name: 'Kley' }, b = { code: 'B', name: 'Un' };
  assert.match(m.preparationFormulaEditorError([{ material: null, percent: '' }]), /tanlanmagan/);
  assert.match(m.preparationFormulaEditorError([{ material: a, percent: '50' }, { material: a, percent: '50' }]), /takrorlangan/);
  assert.match(m.preparationFormulaEditorError([{ material: a, percent: '101' }]), /foizini/);
  assert.match(m.preparationFormulaEditorError([{ material: a, percent: '99' }]), /100% bo‘lishi/);
  assert.match(m.preparationFormulaEditorError([{ material: a, percent: '60' }, { material: b, percent: '50' }]), /oshib ketdi/);
  const rows = [{ material: a, percent: '30' }, { material: b, percent: '70' }];
  assert.equal(m.preparationFormulaEditorError(rows), null);
  assert.deepEqual(m.preparationFormulaEditorLines(rows), [{ item_code: 'A', percent: '30.000000' }, { item_code: 'B', percent: '70.000000' }]);
  assert.equal(m.preparationNextFormulaName(Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i))), 'AA');
});
test('warehouse scope, receipt rounding and share validation match V2', () => {
  const material = { code: 'C', name: 'Kley', can_receive: true, visible_warehouses: ['own'], balances: { Own: '12.5' } };
  assert.equal(m.preparationMaterialVisibleIn(material, ' OWN '), true);
  assert.equal(m.preparationMaterialVisibleIn(material, 'other'), false);
  assert.deepEqual(m.preparationReceiptPayload(material, 'Own', '2,5'), { item_code: 'C', warehouse: 'Own', kg: '2.500000' });
  assert.equal(m.preparationConsumptionLineError('100', '20', '12.5'), 'Omborda yetarli homashyo yo‘q');
  assert.deepEqual(m.preparationFormulaShareInputs(['A', 'B'], ['30', '70']), [{ name: 'A', percent: '30.000000' }, { name: 'B', percent: '70.000000' }]);
  assert.throws(() => m.preparationFormulaShareInputs(['A', 'B'], ['30', '60']));
  assert.deepEqual(m.preparationWarehouseChoices(['Own'], ['Other']), [{ name: 'Other', editable: false, selected: true }, { name: 'Own', editable: true, selected: false }]);
});
