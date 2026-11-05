const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const { contractFetch, recordedSession } = require('./support/contractFetch.cjs');
function load(filename, mocks) {
  filename = path.resolve(__dirname, '../src/preparation', filename.endsWith('.ts') ? filename : `${filename}.ts`);
  const mod = new Module(filename, module); mod.filename = filename; mod.paths = module.paths;
  mod.require = id => {
    if (Object.hasOwn(mocks, id)) return mocks[id];
    if (id.startsWith('.')) return load(path.resolve(path.dirname(filename), id), mocks);
    return require(id);
  };
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ESNext } }).outputText, filename);
  return mod.exports;
}
function setup(stem, name, options = {}) {
  const replay = contractFetch(stem, name, options), session = recordedSession(stem, name);
  session.profile = { role: 'tayyorlov_masteri', ref: 'worker' }; session.capabilities = ['preparation.access'];
  const api = load('preparationFormulaApi', { '../workerControlsApi': { WorkerControlException: class extends Error { constructor(code, message, statusCode) { super(message); this.code = code; this.statusCode = statusCode; } } }, '../authorizedFetch': { authorizedFetch: (s, p, init = {}, guard) => {
    guard?.(); return replay(new URL(p, s.baseUrl), { ...init, headers: { ...init.headers, Authorization: `Bearer ${s.token}` } });
  } } });
  return { api, session, replay };
}
// @v2-test test/preparation_formula_variants_test.dart
test('formula operations carry variant identity in live and saved scopes', async () => {
  const { api, session, replay } = setup('preparation_formula_variants_test', 'all formula and share operations carry the selected variant in both scopes');
  for (const savedOnly of [false, true]) {
    const scope = { materialId: 'pe-pr', savedOnly, variantId: 'v2' };
    assert.equal((await api.preparationFormulas(session, 'P', scope))[0].name, 'A');
    assert.equal((await api.preparationUpsertFormula(session, 'P', [{ item_code: 'C1', percent: '100.000000' }], { ...scope, name: 'A' })).lines[0].name, '0209');
    assert.equal((await api.preparationUpdateFormulaShares(session, { ...scope, productCode: 'P', shares: [{ name: 'A', percent: '100.000000' }] }))[0].share_percent, '100.000000');
    await api.preparationDeleteFormula(session, 'P', 'A', scope);
  }
  replay.assertDone();
});
// @v2-test test/preparation_formula_catalog_test.dart
test('catalog rename reads the same recipe before and after saving', async () => {
  const { api, session, replay } = setup('preparation_formula_catalog_test', 'catalog rename saves the same recipe without an order scope',
    { onlyPaths: ['/v1/mobile/preparation/formula-catalog', '/v1/mobile/preparation/formula-variants'] });
  assert.equal((await api.preparationFormulaCatalog(session))[0].name, 'LG');
  assert.equal((await api.preparationRenameFormulaVariant(session, { productCode: 'P1', materialId: 'mat-a', variantId: 'v1', name: 'Catalog LG' })).name, 'Catalog LG');
  assert.equal((await api.preparationFormulaCatalog(session))[0].name, 'Catalog LG');
  replay.assertDone();
});
// @v2-test test/preparation_formula_orders_test.dart
test('set rename preserves the saved identity and updated name', async () => {
  const { api, session, replay } = setup('preparation_formula_orders_test', 'long press renames a set and searches by ID, name, product and order',
    { onlyPaths: ['/v1/mobile/preparation/formula-sets'] });
  assert.equal((await api.preparationFormulaSets(session))[0].set_id, '950200000001');
  assert.equal(await api.preparationRenameFormulaSet(session, '950200000001', ' Qurt maxsus '), 'Qurt maxsus');
  assert.equal((await api.preparationFormulaSets(session))[0].name, 'Qurt maxsus');
  replay.assertDone();
});
// @v2-test test/preparation_formula_reuse_test.dart
test('reuse selects a complete recipe into the target order scope', async () => {
  const { api, session, replay } = setup('preparation_formula_reuse_test', 'shared product picker searches complete recipes and reuses one in the target scope', { onlyPaths: ['/v1/mobile/preparation/formula-variants', '/v1/mobile/preparation/formula-catalog', '/v1/mobile/preparation/formula-variants/reuse', '/v1/mobile/preparation/formulas'] });
  const options = { productCode: 'P', materialId: 'pe-pr', orderId: 'order-1' };
  assert.equal((await api.preparationFormulaVariants(session, options))[0].id, 'legacy');
  assert.equal((await api.preparationFormulaCatalog(session, options))[0].id, 'source-lg');
  assert.equal((await api.preparationReuseFormulaVariant(session, { ...options, sourceVariantId: 'source-lg' })).id, 'copied-lg');
  assert.equal((await api.preparationFormulas(session, 'P', { ...options, variantId: 'copied-lg' })).length, 3);
  replay.assertDone();
});
// @v2-test test/preparation_formula_start_test.dart
test('order selection confirms variant and revision', async () => {
  const { api, session, replay } = setup('preparation_formula_start_test', 'variant detail FAB opens receipt with original order and target material',
    { onlyPaths: ['/v1/mobile/preparation/formula-variants/order'] });
  const result = await api.preparationSelectFormulaVariant(session, { productCode: 'P', materialId: 'pe-pr', variantId: 'legacy', orderId: 'order-1' });
  assert.equal(result.id, 'legacy'); replay.assertDone();
});
// @v2-test test/preparation_formula_variants_test.dart
test('variant creation includes the generated request id', async () => {
  const { api, session, replay } = setup('preparation_formula_variants_test', 'named empty variant is saved before composition and survives returning and reopening',
    { onlyPaths: ['/v1/mobile/preparation/formula-variants'], onlyMethods: ['POST'], generated: ['request_id'] });
  const variant = await api.preparationCreateFormulaVariant(session, { productCode: 'P', materialId: 'pe-pr', name: 'Yangi qatlam', requestId: 'prep-generated' });
  assert.equal(variant.id, 'new'); replay.assertDone();
});
// @v2-test test/preparation_formula_variant_actions_test.dart
test('removing a variant is confined to its selected order', async () => {
  const { api, session, replay } = setup('preparation_formula_variant_actions_test', 'deletion persists only for the selected order',
    { onlyPaths: ['/v1/mobile/preparation/formula-variants/order'], onlyMethods: ['DELETE'] });
  await api.preparationRemoveFormulaVariantFromOrder(session, { productCode: 'P', materialId: 'pe-pr', variantId: 'legacy', orderId: 'order-1' });
  replay.assertDone();
});
// Dart Uri.replace(queryParameters: {}) preserves the empty query marker.
test('query serialization keeps V2 empty-query and empty-value syntax', () => {
  const helpers = load('preparationRequest', { '../workerControlsApi': { WorkerControlException: class extends Error {} },
    '../authorizedFetch': { authorizedFetch: async () => { throw Error('unexpected'); } } });
  assert.equal(helpers.withQuery('/v1/mobile/preparation/formula-catalog', {}), '/v1/mobile/preparation/formula-catalog?');
  assert.equal(helpers.withQuery('/v1/mobile/preparation/production/orders', { q: '', status: 'all' }),
    '/v1/mobile/preparation/production/orders?q&status=all');
});
