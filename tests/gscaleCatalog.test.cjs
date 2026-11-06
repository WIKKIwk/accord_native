const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const filename = path.resolve(__dirname, '../src/gscale/gscaleCatalog.ts');
const loaded = new Module(filename, module);
loaded.filename = filename;
loaded.paths = module.paths;
loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
const c = loaded.exports;
const profile = (role, capabilities = [], assigned_warehouses = []) => ({ profile: { role }, capabilities, assigned_warehouses });
const item = (code, warehouse, order_microns = []) => ({ code, warehouse, order_microns });

// @v2-test test/gscale_catalog_test.dart
test('profile role chooses the same catalog and warehouse scope', () => {
  assert.equal(c.gscaleCatalogItemSourceForProfile(profile('admin', ['catalog.item.read', 'gscale.catalog.read'])), 'adminItems');
  assert.equal(c.gscaleCatalogItemSourceForProfile(profile('material_taminotchi', ['catalog.item.read'])), 'gscaleItems');
  assert.equal(c.gscaleCatalogItemSourceForProfile(profile('tayyorlov_masteri', ['catalog.item.read'])), 'gscaleItems');
  const material = profile('material_taminotchi', ['gscale.catalog.read', 'raw_material.assign']);
  assert.equal(c.gscaleUsesScopedAdminWarehousesForProfile(material), true);
  assert.equal(c.gscaleMergesDefaultWarehousesForProfile(material), true);
});

test('warehouse options filter exact item, case-insensitive duplicates and query', () => {
  assert.deepEqual(c.gscaleWarehousesFromCustomerOptions([
    { item_code: 'ITEM-001', warehouse: 'Stores - A' }, { item_code: 'ITEM-001', warehouse: 'Stores - A' },
    { item_code: 'ITEM-001', warehouse: 'Stores - B' }, { item_code: 'ITEM-002', warehouse: 'Stores - C' },
  ], 'ITEM-001', 'b'), [{ warehouse: 'Stores - B' }]);
  assert.deepEqual(c.gscaleWarehousesFromSupplierItems([item('ITEM-001', 'Stores - CH'), item('ITEM-002', 'Stores - B')], 'ITEM-001'), [{ warehouse: 'Stores - CH' }]);
  assert.deepEqual(c.mergeGScaleCatalogWarehouses([{ warehouse: ' Stores - CH ' }], [{ warehouse: 'stores - ch' }, { warehouse: 'Ombor' }]),
    [{ warehouse: ' Stores - CH ' }, { warehouse: 'Ombor' }]);
});

test('werka sees assigned warehouses only and falls back to assignments after a failed admin read', async () => {
  const session = profile('werka', ['gscale.catalog.read'], ['Kalidor', ' kalidor ', 'Tayyor mahsulot']);
  assert.deepEqual(c.gscaleAssignedWarehousesForProfile(session, 'kal'), [{ warehouse: 'Kalidor' }]);
  assert.deepEqual(c.gscaleScopeWarehousesForProfile([{ warehouse: 'Kalidor' }, { warehouse: 'Boshqa ombor' }], session), [{ warehouse: 'Kalidor' }]);
  assert.deepEqual(c.gscaleScopeWarehousesForProfile([{ warehouse: 'Boshqa ombor' }], profile('werka')), []);
  const api = { adminWarehouses: async () => { throw new Error('offline'); } };
  assert.deepEqual(await c.fetchGScaleDefaultWarehouses(api, session, 'kal'), [{ warehouse: 'Kalidor' }]);
  await assert.rejects(c.fetchGScaleDefaultWarehouses(api, profile('werka', ['gscale.catalog.read'])), /offline/);
});

test('preparation destinations come from the current snapshot and material microns form distinct choices', async () => {
  const api = { preparationSnapshot: async () => ({ assigned_warehouses: ['A', ' a ', 'B'] }) };
  assert.deepEqual(await c.fetchGScaleDefaultWarehouses(api, profile('tayyorlov_masteri')), [{ warehouse: 'A' }, { warehouse: 'B' }]);
  assert.deepEqual(c.materialReceiptChoices([item('PET', 'A', [12, 20.5, 12]), item('INK', 'B')]).map(v => v.micron), [12, 20.5, null]);
});

test('werka item warehouses merge defaults then enforce assigned scope', async () => {
  const api = {
    gscaleItemsPage: async () => [item('ITEM', 'Other'), item('ITEM', 'Kalidor')],
    adminWarehouses: async () => [{ warehouse: 'Kalidor', company: '' }, { warehouse: 'Other', company: '' }],
  };
  const result = await c.fetchGScaleItemWarehouses(api, profile('werka', ['gscale.catalog.read'], ['Kalidor']), 'ITEM');
  assert.deepEqual(result, [{ warehouse: 'Kalidor' }]);
});
