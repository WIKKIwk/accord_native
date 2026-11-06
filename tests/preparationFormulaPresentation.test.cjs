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
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ESNext },
  }).outputText, filename);
  return mod.exports;
}

const presentation = load('preparationFormulaPresentation');
test('formula heading uses the V2 order, material, customer and estimate', () => {
  const options = { orderId: 'id', orderCode: '0278', productCode: 'P', productTitle: 'Paket',
    materialId: 'PE', materialName: 'PE PR', customerName: 'Mijoz', variantCode: 'F1' };
  assert.deepEqual(presentation.preparationFormulaHeading(options, '824.964000'), {
    context: 'PE PR • F1 • 0278', code: 'Buyurtma kodi: 0278', subtitle: 'Mijoz • Paket',
    estimate: 'PE PR: ≈ 824.96 kg (taxminiy)',
  });
  assert.equal(presentation.preparationFormulaHeading({ ...options, manageSavedFormula: true }, null).code, 'Formula kodi: F1');
  assert.equal(presentation.preparationFormulaHeading({ ...options, orderCode: '' }, null).estimate, 'Taxminiy kg hisobi hozir mavjud emas');
});

test('formula card calculates shares and line estimates only for a complete set', () => {
  const formula = { name: 'A', product_code: 'P', formula_code: '', share_percent: '40',
    lines: [{ item_code: 'X', name: 'Kley', percent: '25' }, { item_code: 'Y', name: '', percent: '75' }] };
  const other = { ...formula, name: 'B', share_percent: '60', lines: [] };
  assert.deepEqual(presentation.preparationFormulaCard(formula, [formula, other], '100'), {
    count: '2 ta seriyo', share: 'Shnek ulushi: 40% • ≈ 40.00 kg',
    lines: ['Kley • 25% • ≈ 10.00 kg', 'Y • 75% • ≈ 30.00 kg'],
  });
  assert.equal(presentation.preparationFormulaCard({ ...formula, share_percent: null }, [formula], '100').share, 'Shnek ulushi belgilanmagan');
});
