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
  const api = load('preparationProductionApi', { '../workerControlsApi': { WorkerControlException: class extends Error { constructor(code, message, statusCode) { super(message); this.code = code; this.statusCode = statusCode; } } }, '../authorizedFetch': { authorizedFetch: (s, p, init = {}, guard) => {
    guard?.(); return replay(new URL(p, s.baseUrl), { ...init, headers: { ...init.headers, Authorization: `Bearer ${s.token}` } });
  } } });
  return { api, session, replay };
}
// @v2-test test/preparation_production_journal_test.dart
test('journal opens the order, captured recipe and its production rolls', async () => {
  const { api, session, replay } = setup('preparation_production_journal_test', 'order opens material, frozen recipe and produced roll QR');
  const orders = await api.preparationProductionOrders(session);
  assert.equal(orders.orders[0].order_code, '0317');
  const order = await api.preparationProductionOrder(session, ' zakaz-0317 ');
  assert.equal(order.batches[0].item_name, 'PE PR');
  const batch = await api.preparationProductionBatch(session, 'batch-lg');
  assert.equal(batch.batch.preparation_formula.variant_name, 'LG');
  assert.equal(batch.rolls[0].epc, '303132333435363738394142'); replay.assertDone();
});
// @v2-test test/preparation_production_journal_test.dart
test('legacy production can have no recorded recipe', async () => {
  const { api, session, replay } = setup('preparation_production_journal_test', 'legacy output has an explicit unknown formula');
  const data = await api.preparationProductionBatch(session, 'batch-lg');
  assert.equal(data.batch.preparation_formula, null); assert.equal(data.rolls[0].preparation_formula, null); replay.assertDone();
});
// @v2-test test/preparation_production_journal_test.dart
test('journal paging and filters send the V2 query and offsets', async () => {
  const { api, session, replay } = setup('preparation_production_journal_test', 'paging appends orders and searching starts a fresh result');
  const first = await api.preparationProductionOrders(session); assert.equal(first.next_offset, 1);
  const second = await api.preparationProductionOrders(session, { offset: 1 }); assert.equal(second.has_more, false);
  await api.preparationProductionOrders(session); await api.preparationProductionOrders(session, { offset: 1 });
  await api.preparationProductionOrders(session, { query: ' 0317 ' });
  await api.preparationProductionOrders(session, { query: '0317', status: 'active' });
  await api.preparationProductionOrders(session, { status: 'active' }); replay.assertDone();
});
test('journal rejects invalid filters and unconfirmed response identities', async () => {
  const session = { baseUrl: 'https://mini-rs-erp-test.wspace.sbs', profile: { role: 'tayyorlov_masteri', ref: 'prep' }, capabilities: ['preparation.access'] };
  const data = { has_more: false, next_offset: null, order: { order_id: 'other', active_batch_count: 0, batch_count: 0, roll_count: 0,
    total_net_kg: '0', total_length_m: '0' }, batches: [] };
  const api = load('preparationProductionApi', { '../workerControlsApi': { WorkerControlException: class extends Error {} },
    '../authorizedFetch': { authorizedFetch: async () => new Response(JSON.stringify(data), { status: 200 }) } });
  await assert.rejects(api.preparationProductionOrders(session, { status: 'invalid' }), /filtri/);
  await assert.rejects(api.preparationProductionOrder(session, 'wanted'), /mos kelmadi/);
});
