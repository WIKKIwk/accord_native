const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
function setup(mode) {
  const calls = [], filename = path.resolve(__dirname, '../src/preparation/usePreparationLibrary.ts'), mod = new Module(filename, module);
  const set = { set_id: 'S1', name: 'Set', product_title: 'Product', product_code: 'P', order_codes: ['0278'], formulas: [{ variant_id: '' }] };
  const recipe = { id: 'v1', name: 'LG', formula_code: 'F1', material_name: 'PE', material_id: 'm', set_name: 'Set', product_title: 'Product', product_code: 'P', order_codes: ['0278'] };
  mod.require = id => {
    if (id === 'react') return {};
    if (id === '../auth') return { registerSessionResetHook: () => () => {} };
    if (id === '../sessionReadScope') return { sessionReadScope: s => s.scope };
    if (id === './usePreparationFormula') return { preparationFormulaErrorMessage: e => String(e) };
    if (id === './preparationFormulaApi') return { preparationFormulaSets: async () => { calls.push('sets'); return [set]; },
      preparationFormulaCatalog: async () => { calls.push('catalog'); return [recipe]; },
      preparationRenameFormulaSet: async (s, id, name) => name.trim(), preparationRenameFormulaVariant: async (s, args) => { calls.push(args); } };
    return require(id);
  };
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ESNext } }).outputText, filename);
  const session = { scope: 'a' };
  return { state: new mod.exports.PreparationLibraryState(session, mode), api: mod.exports, session, calls, set, recipe };
}
test('set library reads sets before recipes, searches and preserves set identity on rename', async () => {
  const x = setup('sets'); await x.state.load(); assert.deepEqual(x.calls, ['sets', 'catalog']);
  x.state.setQuery('0278'); assert.equal(x.state.filteredSets.length, 1); assert.equal(x.state.recipeCount(x.set), 2);
  await x.state.renameSet(x.set, ' New '); assert.equal(x.state.getSnapshot().sets[0].name, 'New');
});
test('session reset clears catalog before the session object changes and prevents reload', async () => {
  const x = setup('catalog'); await x.state.load();
  x.state.sessionChanged(true);
  assert.deepEqual(x.state.getSnapshot().recipes, []);
  await x.state.load(); assert.deepEqual(x.calls, ['catalog']);
  assert.match(x.state.getSnapshot().error, /Akkaunt/);
});
test('catalog clears on account change and normalizes variant names', async () => {
  const x = setup('catalog'); await x.state.load(); x.state.setQuery(' f1 '); assert.equal(x.state.filteredRecipes[0].id, 'v1');
  assert.equal(x.api.preparationVariantName('  New   recipe  '), 'New recipe');
  assert.equal(x.api.preparationVariantNameCanSave(' LG ', 'LG'), false);
  x.session.scope = 'b'; x.state.sessionChanged(); assert.equal(x.state.getSnapshot().recipes.length, 0); assert.match(x.state.getSnapshot().error, /Akkaunt/);
});
