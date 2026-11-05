const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const calls = [];
function load(filename) {
  filename = path.resolve(__dirname, '../src/preparation', filename.endsWith('.ts') ? filename : `${filename}.ts`);
  const mod = new Module(filename, module); mod.filename = filename; mod.paths = module.paths;
  mod.require = id => {
    if (id === '../workerControlsApi') return { WorkerControlException: class extends Error {} };
    if (id === '../sessionReadScope') return { sessionReadScope: s => s.scope };
    if (id === './preparationProductionApi') return {
      preparationProductionOrders: async (session, options) => { calls.push(options); return { has_more: false, next_offset: null, orders: [{ order_id: 'o' }] }; },
      preparationProductionOrder: async (session, id, offset) => ({ has_more: false, next_offset: null, order: { order_id: id }, batches: [{ batch_id: 'b' }] }),
      preparationProductionBatch: async (session, id, offset) => ({ has_more: false, next_offset: null, batch: { batch_id: id }, rolls: [{ epc: 'qr' }] }),
    };
    return id.startsWith('.') ? load(path.resolve(path.dirname(filename), id)) : require(id);
  };
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ESNext } }).outputText, filename);
  return mod.exports;
}
test('journal factories map page items, summaries and filters', async () => {
  const api = load('preparationJournalFactory'), session = { scope: 's' };
  const orders = api.createPreparationProductionOrdersJournal(session, () => ({ query: 'x', status: 'active' }), () => {});
  await orders.load(); assert.equal(orders.state.items[0].order_id, 'o'); assert.deepEqual(calls[0], { query: 'x', status: 'active', offset: 0 });
  const order = api.createPreparationProductionOrderJournal(session, 'o', () => {}); await order.load(); assert.equal(order.state.summary.order_id, 'o');
  const batch = api.createPreparationProductionBatchJournal(session, 'b', () => {}); await batch.load(); assert.equal(batch.state.items[0].epc, 'qr');
});
