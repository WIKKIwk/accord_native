const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

function load(relative, dependencies = {}) {
  const filename = path.resolve(__dirname, '../src', relative), loaded = new Module(filename, module);
  loaded.require = name => name in dependencies ? dependencies[name] : require(name);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ESNext },
  }).outputText, filename);
  return loaded.exports;
}
const search = load('shared/searchNormalizer.ts');

test('V2 search normalizes Uzbek Cyrillic, apostrophes and x/h', () => {
  assert.equal(search.normalizeForSearch('  Ғўза  Хомашё  '), 'goza homashyo');
  assert.equal(search.searchMatches("GʻOZA", ['Ғўза']), true);
  assert.equal(search.searchMatches('homashyo', ['Хомашё']), true);
  assert.equal(search.searchMatches('  ', []), true);
});

test('V2 search requires every multiword token and does not fuzzy-match one token alone', () => {
  assert.equal(search.searchMatches('cottn red', ['cotton', 'red']), true);
  assert.equal(search.searchMatches('cottn', ['cotton']), false);
  assert.equal(search.searchMatches('cottn blue', ['cotton', 'red']), false);
  assert.equal(search.searchMatches('a', ['z']), false);
  assert.equal(search.searchMatches('bc', ['abcd']), true);
});

test('reuse picker shares a scoped catalog request and filters its V2 subtitle', async () => {
  const entries = [
    { id: '1', name: 'Formula', formula_code: 'F-01', material_name: 'Paxta', product_title: 'Plyonka', set_name: 'Set', product_code: 'P-1', order_codes: ['ORD-42'] },
    { id: '2', name: 'Other', formula_code: '', material_name: 'Yelim', product_title: 'Qop', set_name: 'Qop', product_code: 'P-2', order_codes: [] },
  ];
  let calls = 0;
  const api = load('preparation/usePreparationVariants.ts', {
    react: {}, '../sessionReadScope': { sessionReadScope: session => session.scope },
    '../shared/searchNormalizer': search, './preparationCommandApi': {},
    './usePreparationFormula': {}, './usePreparationLibrary': {},
    './preparationFormulaApi': { preparationFormulaCatalog: async () => { calls++; return entries; } },
  });
  const session = { scope: 'a' }, state = new api.PreparationVariantsState(session, { orderId: 'o', productCode: 'p', materialId: 'm' });
  assert.equal(state.beginReuse(), true);
  assert.deepEqual((await state.loadReusePage('ord-42', 0, 80)).map(entry => entry.id), ['1']);
  assert.deepEqual((await state.loadReusePage('', 1, 1)).map(entry => entry.id), ['2']);
  assert.equal(calls, 1);
  session.scope = 'b';
  await assert.rejects(state.loadReusePage('', 0, 80), /Akkaunt o‘zgargan/);
});
