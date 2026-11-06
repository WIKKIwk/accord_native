const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const filename = path.resolve(__dirname, '../src/gscale/gscaleCatalogRuntime.ts');
const mod = new Module(filename, module); mod.filename = filename; mod.paths = module.paths;
const calls = [];
mod.require = name => {
  if (name === '../preparationReadApi') return { preparationSnapshot: async () => ({ orders: [{ id: 'p1', code: 'P', title: 'prep', kg: '12', saved: false, width_mm: 300 }] }) };
  if (name === '../shared/catalogApi') return { gscaleItemsPage: async (_s, options) => { calls.push(['gscale', options]); return []; } };
  if (name === './gscaleAdminApi') return {
    adminItemsPage: async (_s, options) => { calls.push(['admin', options]); return []; },
    adminWarehouses: async () => [], adminRawMaterialAssignmentOrders: async () => [
      { map: { id: 'o1', code: '', order_number: 'O-1', title: 'Order', order_kg: 10, width_mm: 500 } }],
  };
  if (name === './gscaleCatalog') return {
    gscaleCatalogItemSourceForProfile: session => session.profile.role === 'admin' ? 'adminItems' : 'gscaleItems',
    fetchGScaleDefaultWarehouses: async () => [{ warehouse: ' One ' }, { warehouse: 'Two' }],
    fetchGScaleItemWarehouses: async () => [{ warehouse: 'Item W' }],
  };
  if (name === './gscaleMaterialPicker') return { GScaleMaterialPicker: class {
    constructor(load) { this.load = load; }
    page(q, o, l, id) { return this.load(q, o, l, id); }
    singleOrderChoice() { return null; }
  } };
  return require(name);
};
mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
const { createGScaleCatalogRuntime } = mod.exports;

test('catalog source, order mapping and warehouse scope follow the role', async () => {
  calls.length = 0;
  const admin = createGScaleCatalogRuntime({ profile: { role: 'admin' } }, async () => new Set());
  await admin.itemPage(' PET ', 20, 10, 'o1');
  assert.deepEqual(calls[0], ['admin', { query: ' PET ', offset: 20, limit: 10 }]);
  assert.deepEqual(await admin.warehouses('', 'x', false), [{ warehouse: 'Item W' }]);
  const material = createGScaleCatalogRuntime({ profile: { role: 'material_taminotchi' } }, async () => new Set(['one']));
  await material.itemPage('', 0, 50, 'o1');
  assert.deepEqual(calls[1], ['gscale', { query: '', offset: 0, limit: 50, orderId: 'o1', useBackend: false }]);
  assert.deepEqual(await material.warehouses('', '', true), [{ warehouse: ' One ' }]);
  assert.deepEqual(await material.orders(), [{ id: 'o1', code: 'O-1', title: 'Order', order_kg: '10', width_mm: 500, saved: false }]);
  const preparation = createGScaleCatalogRuntime({ profile: { role: 'tayyorlov_masteri' } }, async () => new Set());
  assert.deepEqual(await preparation.orders(), [{ id: 'p1', code: 'P', title: 'prep', order_kg: '12', width_mm: 300, saved: false }]);
  await preparation.materialChoices('', 0, 50, 'p1', true);
  assert.equal(calls.at(-1)[1].useBackend, true);
});
