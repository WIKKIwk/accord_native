const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
function setup() {
  const calls = [], filename = path.resolve(__dirname, '../src/preparation/usePreparationVariants.ts'), mod = new Module(filename, module);
  let tries = 0;
  mod.require = id => {
    if (id === 'react') return {};
    if (id === '../sessionReadScope') return { sessionReadScope: s => s.scope };
    if (id === '../shared/searchNormalizer') return { searchMatches: (query, values) => values.some(value => value.toLowerCase().includes(query.toLowerCase())) };
    if (id === './preparationCommandApi') return { newPreparationRequestId: async () => 'fixed-request' };
    if (id === './usePreparationFormula') return { preparationFormulaErrorMessage: e => e.message };
    if (id === './usePreparationLibrary') return { preparationVariantName: s => s.trim().replace(/\s+/g, ' '),
      preparationVariantNameCanSave: (s, initial) => !!s.trim() && [...s.trim()].length <= 160 && s.trim().replace(/\s+/g, ' ') !== initial };
    if (id === './preparationFormulaApi') return {
      preparationFormulaVariants: async () => [{ id: 'old', name: 'Old' }],
      preparationFormulaCatalog: async () => [],
      preparationCreateFormulaVariant: async (s, options) => { calls.push(options); if (tries++ === 0) throw Error('offline'); return { id: 'new', name: options.name }; },
      preparationReuseFormulaVariant: async () => ({ id: 'copy', name: 'Copy' }),
      preparationRenameFormulaVariant: async (s, options) => ({ id: options.variantId, name: options.name }),
      preparationRemoveFormulaVariantFromOrder: async () => {},
    };
    return require(id);
  };
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ESNext } }).outputText, filename);
  const session = { scope: 'A' };
  return { state: new mod.exports.PreparationVariantsState(session, { orderId: 'o', productCode: 'P', materialId: 'm' }), session, calls };
}
test('uncertain variant creation retries the same generated request ID', async () => {
  const x = setup(); await x.state.load(); await x.state.beginCreate();
  assert.equal(await x.state.create(' New  recipe '), null); assert.equal(x.state.getSnapshot().nameError, 'offline');
  assert.equal((await x.state.create(' New  recipe ')).id, 'new');
  assert.equal(x.calls[0].requestId, x.calls[1].requestId); assert.equal(x.calls[0].name, 'New recipe');
  assert.deepEqual(x.state.getSnapshot().variants.map(v => v.id), ['old', 'new']);
});
test('variant removal only changes the selected row after server success', async () => {
  const x = setup(); await x.state.load(); assert.equal(await x.state.remove({ id: 'old', name: 'Old' }), true);
  assert.deepEqual(x.state.getSnapshot().variants, []);
  x.session.scope = 'B'; assert.equal(await x.state.beginCreate(), null);
  assert.equal(await x.state.remove({ id: 'old', name: 'Old' }), false);
});

test('variant list and removal text retain the V2 order and wording', () => {
  const filename = path.resolve(__dirname, '../src/preparation/preparationVariantPresentation.ts');
  const mod = new Module(filename, module);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ESNext },
  }).outputText, filename);
  const p = mod.exports;
  assert.equal(p.preparationVariantSubtitle({ formula_code: '', formula_count: 0, shares_complete: false }), 'Tarkib hali kiritilmagan');
  assert.equal(p.preparationVariantSubtitle({ formula_code: 'F1', formula_count: 2, shares_complete: true }), 'F1 • 2 ta ichki formula • jami 100%');
  assert.equal(p.preparationVariantSubtitle({ formula_code: 'F1', formula_count: 1, shares_complete: false }), 'F1 • 1 ta ichki formula • ulushlar belgilanmagan');
  assert.equal(p.preparationVariantRemoveMessage('Asosiy', 'B1'), 'Asosiy shnek formulasi B1 buyurtmasidan olib tashlanadi.');
  assert.equal(p.preparationVariantRemovedMessage('Asosiy'), 'Asosiy buyurtmadan olib tashlandi');
});
