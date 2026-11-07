const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const items = [{ item_code: 'A', name: 'Kley', warehouses: ['Own'] }, { item_code: 'B', name: 'Un', warehouses: ['Other'] }];
function setup(overrides = {}) {
  const calls = [], filename = path.resolve(__dirname, '../src/preparation/usePreparationMaterials.ts'), mod = new Module(filename, module);
  mod.require = id => {
    if (id === 'react') return {};
    if (id === '../workerControlsApi') return { WorkerControlException: class extends Error {} };
    if (id === '../preparationReadApi') return { preparationSnapshot: overrides.snapshot ?? (async () => ({ material_warehouses: ['Own', 'Second'] })) };
    if (id === './preparationLogic') return { preparationWarehouseChoices: (editable, selected) => [...new Set([...editable, ...selected])].sort().map(name => ({ name, editable: editable.includes(name), selected: selected.includes(name) })) };
    if (id === './preparationManagementApi') return { preparationOwnedMaterials: async () => items,
      preparationMaterialWarehouseOptions: overrides.options ?? (async (_s, code) => ({ editable: ['Own', 'Second'], assigned: items.find(item => item.item_code === code).warehouses })),
      preparationRenameMaterial: async (s, code, name) => { calls.push(['rename', code, name]); return overrides.rename ? overrides.rename() : name; },
      preparationDeleteMaterial: async (s, code) => calls.push(['delete', code]),
      preparationSetMaterialWarehouses: async (s, code, warehouses) => ({ ...items.find(item => item.item_code === code), warehouses }) };
    return require(id);
  };
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ESNext } }).outputText, filename);
  return { state: new mod.exports.PreparationMaterialsState({}), calls, api: mod.exports };
}
test('materials search, rename, delete and exclusive warehouse choices follow V2', async () => {
  const { state, calls } = setup(); await state.load(); state.setQuery(' other '); assert.equal(state.filtered[0].item_code, 'B');
  const choices = await state.warehouseChoices(items[1]); assert.equal(choices.find(x => x.name === 'Other').editable, false);
  await state.rename(items[0], 'Zey'); assert.deepEqual(state.getSnapshot().items.map(x => x.name), ['Un', 'Zey']);
  await state.setWarehouses(items[1], ['Second']); assert.deepEqual(state.getSnapshot().items[0].warehouses, ['Second']);
  await state.remove(items[0]); assert.equal(state.getSnapshot().items.length, 1); assert.equal(calls[1][0], 'delete');
});

test('material delete confirmation and empty-search labels match V2', () => {
  const { api } = setup();
  assert.equal(api.preparationMaterialDeleteMessage('Kley'),
    '«Kley» o‘chirilsinmi? Faqat ishlatilmagan homashyo o‘chiriladi. Qoldiq, kirim yoki formula bo‘lsa, o‘chirish rad etiladi.');
  assert.equal(api.preparationMaterialsEmptyMessage('  '), 'Hali homashyo yaratmagansiz.');
  assert.equal(api.preparationMaterialsEmptyMessage('Kley'), 'Homashyo topilmadi.');
});

test('a rename completed after the account scope is invalidated cannot update the new view', async () => {
  let finish;
  const pending = new Promise(resolve => { finish = resolve; });
  const { state } = setup({ rename: () => pending });
  await state.load();
  const result = state.rename(items[0], 'Yangi');
  state.invalidate();
  state.activate();
  finish('Yangi');
  assert.equal(await result, false);
  assert.deepEqual(state.getSnapshot().items, []);
});

test('background warehouse validation leaves the material list state unchanged', async () => {
  let finish, calls = 0; const pending = new Promise(resolve => { finish = resolve; });
  const { state } = setup({ options: () => { calls++; return pending; } });
  await state.load();
  const initial = state.getSnapshot(), changes = [];
  state.subscribe(() => changes.push(state.getSnapshot()));
  const result = state.warehouseChoices(items[1], { silent: true });
  const duplicate = state.warehouseChoices(items[1], { silent: true });
  assert.equal(calls, 1);
  assert.equal(state.getSnapshot(), initial);
  finish({ editable: ['Own', 'Second'], assigned: ['Other'] });
  const choices = await result;
  assert.deepEqual(await duplicate, choices);
  assert.equal(choices.find(choice => choice.name === 'Other').editable, false);
  assert.equal(state.getSnapshot(), initial);
  assert.deepEqual(changes, []);
});

test('a late warehouse validation is discarded after account invalidation', async () => {
  let finish; const pending = new Promise(resolve => { finish = resolve; });
  const { state } = setup({ options: () => pending });
  await state.load();
  const result = state.warehouseChoices(items[0], { silent: true });
  state.invalidate();
  finish({ editable: ['Own'], assigned: ['Own'] });
  assert.equal(await result, null);
});

test('old server fallback fetches fresh material bindings before allowing changes', async () => {
  const { state } = setup({ options: async () => null });
  await state.load();
  const stale = { ...items[1], warehouses: [] };
  const choices = await state.warehouseChoices(stale, { silent: true });
  assert.deepEqual(choices.find(choice => choice.name === 'Other'), { name: 'Other', editable: false, selected: true });
});
