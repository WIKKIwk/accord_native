const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
function setup(settings = {}) {
  let reads = 0;
  const sent = [], formulas = [{ product_code: 'P', formula_code: '', name: 'A', share_percent: '100.000000',
    lines: [{ item_code: 'C1', name: 'Kley', percent: '100.000000' }] }];
  const mocks = {
    react: {},
    '../preparationReadApi': { preparationSnapshot: async () => ({ materials: [{ code: 'C1', name: 'Kley', can_receive: true, balances: {}, visible_warehouses: null }] }),
      preparationOrderMaterials: async () => [{ material_id: 'PE-PR', estimated_kg: '824.964' }] },
    '../sessionReadScope': { sessionReadScope: session => session.ref },
    '../workerControlsApi': { WorkerControlException: class extends Error { constructor(code, message, statusCode) { super(message); this.code = code; this.statusCode = statusCode; } } },
    './preparationFormulaApi': {
      preparationFormulaDetails: async (session, code, opts) => { sent.push({ action: 'read', code, opts }); if (settings.failRefresh && ++reads > 1) throw Error('offline'); return { formulas, variant_name: 'LG', recipe_key: 'rk' }; },
      preparationUpsertFormula: async (session, code, lines, opts) => { sent.push({ action: 'save', code, lines, opts }); },
      preparationDeleteFormula: async (session, code, name, opts) => { sent.push({ action: 'delete', code, name, opts }); },
      preparationUpdateFormulaShares: async (session, opts) => { sent.push({ action: 'shares', opts }); return formulas; },
      preparationSelectFormulaVariant: async (session, opts) => { sent.push({ action: 'select', opts }); return { name: 'LG' }; },
    },
  };
  function load(filename) {
    filename = path.resolve(__dirname, '../src/preparation', filename.endsWith('.ts') ? filename : `${filename}.ts`);
    const mod = new Module(filename, module); mod.filename = filename; mod.paths = module.paths;
    mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : id.startsWith('.') ? load(path.resolve(path.dirname(filename), id)) : require(id);
    mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ESNext } }).outputText, filename);
    return mod.exports;
  }
  const session = { ref: 'prep-1' }, options = { orderId: 'order-1', orderCode: '0278', productCode: 'P', productTitle: 'Product',
    materialId: 'pe-pr', materialName: 'PE PR', variantId: 'v1' };
  const controller = new (load('usePreparationFormula').PreparationFormulaState)(session, options);
  return { controller, session, sent, formulas };
}
test('formula load uses order-specific estimate and scope', async () => {
  const x = setup(); await x.controller.reload();
  assert.equal(x.controller.getSnapshot().estimatedMaterialKg, '824.964000');
  assert.equal(x.controller.getSnapshot().variantName, 'LG');
  assert.equal(x.sent[0].opts.orderId, 'order-1');
  x.controller.openEditor(x.formulas[0]);
  assert.deepEqual(x.controller.getSnapshot().rows[0].percent, '100');
});
test('editor saves a normalized new formula and refreshes it', async () => {
  const x = setup(); await x.controller.reload(); x.controller.openEditor();
  x.controller.setRows([{ material: { code: 'C1', name: 'Kley' }, percent: '100' }]);
  assert.equal(x.controller.canSave, true); await x.controller.save();
  const save = x.sent.find(item => item.action === 'save');
  assert.equal(save.opts.name, 'B'); assert.deepEqual(save.lines, [{ item_code: 'C1', percent: '100.000000' }]);
  assert.equal(x.controller.getSnapshot().editing, false);
});
test('production selects the scoped variant and holds the opening lock through navigation', async () => {
  const x = setup(); await x.controller.reload(); let release, opened;
  const wait = new Promise(resolve => { release = resolve; });
  const running = x.controller.startProduction(true, async args => { opened = args; await wait; });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(x.controller.getSnapshot().openingReceipt, true); assert.equal(opened.formulaVariantId, 'v1');
  assert.equal(x.sent.find(item => item.action === 'select').opts.recipeKey, 'rk');
  release(); await running; assert.equal(x.controller.getSnapshot().openingReceipt, false);
});
test('an account change prevents editing operations from being sent', async () => {
  const x = setup(); await x.controller.reload(); x.controller.openEditor();
  x.controller.setRows([{ material: { code: 'C1', name: 'Kley' }, percent: '100' }]);
  x.session.ref = 'prep-2'; await x.controller.save();
  assert.equal(x.sent.some(item => item.action === 'save'), false);
});

test('a successful save remains closed when its follow-up refresh fails', async () => {
  const x = setup({ failRefresh: true }); await x.controller.reload(); x.controller.openEditor();
  x.controller.setRows([{ material: { code: 'C1', name: 'Kley' }, percent: '100' }]);
  await x.controller.save();
  assert.equal(x.controller.getSnapshot().editing, false);
  assert.match(x.controller.getSnapshot().notice, /Internet aloqasini/);
});
