const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
function setup(rename = async () => {}) {
  const calls = [], filename = path.resolve(__dirname, '../src/preparation/usePreparationSetDetail.ts'), mod = new Module(filename, module);
  const entry = (material, variant, name) => ({ material_id: material, variant_id: variant, formula: { name } });
  const formulaSet = { set_id: 'S', product_code: 'P', formulas: [entry('m1', '', 'A'), entry('m2', '', 'A'), entry('m1', 'v', 'A')] };
  const recipes = [{ id: 'v', product_code: 'P' }];
  mod.require = id => {
    if (id === 'react') return {};
    if (id === '../auth') return { registerSessionResetHook: () => () => {} };
    if (id === '../sessionReadScope') return { sessionReadScope: s => s.scope };
    if (id === './usePreparationFormula') return { preparationFormulaErrorMessage: e => e.message };
    if (id === './usePreparationLibrary') return { preparationVariantName: v => v.trim().replace(/\s+/g, ' '),
      preparationVariantNameCanSave: (v, initial) => !!v.trim() && v.trim().replace(/\s+/g, ' ') !== initial };
    if (id === './preparationLogic') return { preparationFormulaShareInputs: (names, values) => names.map((name, i) => ({ name, percent: values[i] })) };
    if (id === './preparationFormulaApi') return { preparationFormulaSets: async () => [formulaSet], preparationFormulaCatalog: async () => recipes,
      preparationDeleteFormula: async (session, product, name, options) => calls.push({ product, name, options }),
      preparationRenameFormulaVariant: async (session, options) => { calls.push(options); await rename(); },
      preparationUpdateFormulaShares: async (session, options) => calls.push(options) };
    return require(id);
  };
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ESNext } }).outputText, filename);
  const session = { scope: 's' };
  return { state: new mod.exports.PreparationSetDetailState(session, formulaSet, recipes), calls, formulaSet, session };
}
test('deleting a formula affects only its exact material and variant scope', async () => {
  const x = setup(); await x.state.remove(x.formulaSet.formulas[0]);
  assert.deepEqual(x.state.getSnapshot().formulas.map(f => [f.material_id, f.variant_id]), [['m2', ''], ['m1', 'v']]);
  assert.equal(x.calls[0].options.savedOnly, true); assert.equal(x.calls[0].options.materialId, 'm1');
});
test('share updates use only formulas in the selected scope', async () => {
  const x = setup(); await x.state.saveShares(x.formulaSet.formulas[0], ['100.000000']);
  assert.deepEqual(x.calls[0].shares, [{ name: 'A', percent: '100.000000' }]); assert.equal(x.calls[0].variantId, '');
});
test('recipe rename normalizes its name and ignores completion after an account change', async () => {
  let release;
  const x = setup(() => new Promise(resolve => { release = resolve; }));
  const recipe = { id: 'v', name: 'Old', product_code: 'P', material_id: 'M' };
  const rename = x.state.renameRecipe(recipe, ' New   name ');
  assert.deepEqual(x.calls[0], { productCode: 'P', materialId: 'M', variantId: 'v', name: 'New name' });
  x.session.scope = 'changed'; x.state.invalidate(); release();
  assert.equal(await rename, false);
  assert.deepEqual(x.state.getSnapshot().recipes, []);
  await assert.rejects(x.state.saveShares(x.formulaSet.formulas[0], ['100']), /Akkaunt/);
});
