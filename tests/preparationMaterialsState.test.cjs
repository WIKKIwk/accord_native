const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const items = [{ item_code: 'A', name: 'Kley', warehouses: ['Own'] }, { item_code: 'B', name: 'Un', warehouses: ['Other'] }];
function setup() {
  const calls = [], filename = path.resolve(__dirname, '../src/preparation/usePreparationMaterials.ts'), mod = new Module(filename, module);
  mod.require = id => {
    if (id === 'react') return {};
    if (id === '../workerControlsApi') return { WorkerControlException: class extends Error {} };
    if (id === '../preparationReadApi') return { preparationSnapshot: async () => ({ material_warehouses: ['Own', 'Second'] }) };
    if (id === './preparationLogic') return { preparationWarehouseChoices: (editable, selected) => [...new Set([...editable, ...selected])].sort().map(name => ({ name, editable: editable.includes(name), selected: selected.includes(name) })) };
    if (id === './preparationManagementApi') return { preparationOwnedMaterials: async () => items,
      preparationRenameMaterial: async (s, code, name) => { calls.push(['rename', code, name]); return name; },
      preparationDeleteMaterial: async (s, code) => calls.push(['delete', code]),
      preparationSetMaterialWarehouses: async (s, code, warehouses) => ({ ...items.find(item => item.item_code === code), warehouses }) };
    return require(id);
  };
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ESNext } }).outputText, filename);
  return { state: new mod.exports.PreparationMaterialsState({}), calls };
}
test('materials search, rename, delete and exclusive warehouse choices follow V2', async () => {
  const { state, calls } = setup(); await state.load(); state.setQuery(' other '); assert.equal(state.filtered[0].item_code, 'B');
  const choices = await state.warehouseChoices(items[1]); assert.equal(choices.find(x => x.name === 'Other').editable, false);
  await state.rename(items[0], 'Zey'); assert.deepEqual(state.getSnapshot().items.map(x => x.name), ['Un', 'Zey']);
  await state.setWarehouses(items[1], ['Second']); assert.deepEqual(state.getSnapshot().items[0].warehouses, ['Second']);
  await state.remove(items[0]); assert.equal(state.getSnapshot().items.length, 1); assert.equal(calls[1][0], 'delete');
});
