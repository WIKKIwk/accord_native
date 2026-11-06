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
const p = load('preparationLibraryPresentation');

test('catalog and set rows preserve V2 metadata and missing-order text', () => {
  const recipe = { formula_code: 'F-1', product_title: 'Paket', material_name: 'PE', order_codes: ['O1', 'O2'] };
  assert.equal(p.preparationCatalogSubtitle(recipe), 'F-1 • Paket • PE • Buyurtmalar: O1, O2');
  assert.equal(p.preparationSetRecipeSubtitle(recipe), 'F-1 • PE');
  assert.equal(p.preparationSetSubtitle({ set_id: 'S1', order_codes: [] }, 2), 'S1\nMos buyurtma yo‘q\n2 ta formula');
  assert.equal(p.preparationSetSubtitle({ set_id: 'S2', order_codes: ['O1'] }, 1), 'S2\n1 ta formula');
});

test('legacy rows and delete confirmation retain the shared formula warning', () => {
  const entry = { variant_name: '', material_id: '', material_name: '', formula: { name: 'A', share_percent: null,
    lines: [{ name: 'Kley', percent: '50.000000' }] } };
  assert.equal(p.preparationLegacyFormulaTitle(entry), 'A');
  assert.equal(p.preparationLegacyFormulaSubtitle(entry), 'Shnek ulushi belgilanmagan\nEski formula — homashyo turi belgilanmagan\nKley • 50%');
  assert.equal(p.preparationSavedFormulaDeleteMessage('A'), '«A» formulasi o‘chirilsinmi? Katalogdagi o‘zgarishlar formula keyingi safar buyurtmaga biriktirilganda olinadi.');
});
