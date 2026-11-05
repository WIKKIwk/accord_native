const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

function load(name, mocks = {}) {
  const filename = path.resolve(__dirname, `../src/${name}.ts`);
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = module.paths;
  loaded.require = id => Object.hasOwn(mocks, id) ? mocks[id] : id.startsWith('./') ? load(id.slice(2), mocks) : require(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return loaded.exports;
}
const station = 'apparatus:default:asset-005';
function api(fetch) { return load('workerClosedOrders', { './authorizedFetch': { authorizedFetch: fetch } }); }

// V2 has no recorded HTTP test for this method; these cases follow the baseline source.
test('closed orders request parses logs, early closure and progress batches', async () => {
  let requested;
  const client = api(async (session, url) => {
    requested = { session, url };
    return new Response(JSON.stringify({ closed_orders: [{ order_id: 'o1', order_number: 17,
      history_version: 'v2', completed_at_unix: 123.9, closed_by_role: 'admin', closed_by_ref: 'a1',
      logs: [{ event_id: 'ev1', apparatus: station, action: 'stop', created_at_unix: 22.9,
        zero_output_waste: { total_waste: 3, rezka_bosma_waste: -1, rezka_edge_waste: '5' },
        transfer: { from_apparatus: station, to_apparatus: station, material_barcodes: [1, 'code'] },
        freeze: { scope: 'order', target_worker_ref: '', target_session_id: '' } }],
      progress_batches: [null, { batch_id: 'b1', apparatus: station }],
      early_close: { closed_at_unix: 125, comment: 'finished early' } }] }), { status: 200 });
  });
  const session = { token: 'token' };
  const [order] = await client.adminClosedProductionMapOrders(session);
  assert.deepEqual(requested, { session, url: '/v1/mobile/admin/production-maps/closed-orders' });
  assert.equal(order.order_number, '17');
  assert.equal(order.completed_at_unix, 123);
  assert.equal(order.progress_batches.length, 1);
  assert.equal(order.progress_batches[0].batch_id, 'b1');
  assert.equal(order.logs.length, 2);
  assert.equal(order.logs[0].created_at_unix, 22);
  assert.deepEqual(order.logs[0].zero_output_waste, { total_waste: 3 });
  assert.deepEqual(order.logs[0].transfer.material_barcodes, ['1', 'code']);
  assert.equal(client.productionOrderFreezeIsGlobalWildcard(order.logs[0].freeze), true);
  assert.equal(order.logs[1].event_id, 'early-close:o1');
  assert.equal(order.logs[1].action, 'close_early');
  assert.equal(order.logs[1].to_state, 'cancelled');
  assert.equal(order.logs[1].issue_note, 'finished early');
});

test('closed orders honor empty lists and reject malformed model values', async () => {
  const client = api(async () => new Response('{"closed_orders":null}', { status: 200 }));
  assert.deepEqual(await client.adminClosedProductionMapOrders({}), []);
  assert.throws(() => client.closedProductionOrderFromJson({ logs: [null] }), /Invalid production-order log/);
  assert.throws(() => client.closedProductionOrderFromJson({ progress_batches: {} }), /Invalid progress batches/);
  assert.throws(() => client.productionOrderTransferFromJson({ from_apparatus: 'old label', to_apparatus: station }), /Canonical apparatus/);
  assert.equal(client.productionOrderFreezeIsGlobalWildcard(client.productionOrderFreezeFromJson({ stage_node_id: 'stage' })), false);
});

test('closed orders preserves server errors', async () => {
  const client = api(async () => new Response('{"error":"closed_orders"}', { status: 403 }));
  await assert.rejects(client.adminClosedProductionMapOrders({}), error => error.code === 'closed_orders');
});
