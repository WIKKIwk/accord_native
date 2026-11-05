const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
function setup(api) {
  const filename = path.resolve(__dirname, '../src/preparation/usePreparationHome.ts'), mod = new Module(filename, module);
  mod.require = id => {
    if (id === 'react') return {};
    if (id === '../preparationReadApi') return { preparationSnapshot: api.snapshot };
    if (id === './preparationCommandApi') return { preparationPendingCommand: api.pending, preparationSubmit: api.submit };
    return require(id);
  };
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ESNext } }).outputText, filename);
  return new mod.exports.PreparationHomeState({});
}
const snapshot = (orders = []) => ({ assigned_warehouses: ['Own'], material_warehouses: ['Own'], materials: [], orders, history: [], warehouses: [], managed_warehouses: [], responsibilities: [] });
test('home reload selects the sole warehouse and invalidates a saved order', async () => {
  let current = snapshot([{ id: 'o', saved: false }]);
  const state = setup({ snapshot: async () => current, pending: async () => null, submit: async () => ({}) });
  await state.reload(); assert.equal(state.getSnapshot().warehouse, 'Own');
  state.selectOrder('o'); state.setPercent('P1', '20');
  current = snapshot([{ id: 'o', saved: true }]); await state.reload();
  assert.equal(state.getSnapshot().orderId, null); assert.deepEqual(state.getSnapshot().percentages, {});
});
test('home locks uncertain operations and refreshes after a failed submission', async () => {
  let count = 0, pending = null;
  const state = setup({ snapshot: async () => { count++; return snapshot(); }, pending: async () => pending,
    submit: async () => { pending = { kind: 'receipts', payload: {}, request_id: 'id' }; throw Error('offline'); } });
  await state.reload(); await assert.rejects(state.submit('receipts', {}));
  assert.equal(count, 2); assert.equal(state.getSnapshot().pending.kind, 'receipts'); assert.equal(state.locked, true);
});
