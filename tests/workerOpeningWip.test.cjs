const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

function load(name, mocks = {}) {
  const filename = path.resolve(__dirname, `../src/${name}.ts`);
  const loaded = new Module(filename, module);
  loaded.filename = filename; loaded.paths = module.paths;
  loaded.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return loaded.exports;
}
function apiWith(authorizedFetch) {
  const controls = load('workerControlsApi', { './authorizedFetch': { authorizedFetch }, './sessionReadScope': load('sessionReadScope') });
  return load('workerOpeningWip', { './workerControlsApi': controls });
}

test('opening WIP lookup sends the V2 body and parses a batch without an ok flag', async () => {
  let sent;
  const api = apiWith(async (_session, url, init) => {
    sent = { url, body: JSON.parse(init.body), headers: init.headers };
    return { status: 200, json: async () => ({ batch: { batch_id: ' b1 ', order_id: ' order ', qr_payload: ' QR ',
      wip_status: ' waiting ', quantity_basis: 'ESTIMATED', sequence_no: 2.9 } }) };
  });
  const result = await api.adminLookupOpeningWip({}, { apparatus: ' station ', orderId: ' order ', qrPayload: ' QR ', batchId: ' b1 ' });
  assert.equal(sent.url, '/v1/mobile/admin/production-maps/opening-wip/lookup');
  assert.deepEqual(sent.body, { apparatus: 'station', order_id: 'order', qr_payload: 'QR', batch_id: 'b1' });
  assert.equal(sent.headers['Content-Type'], 'application/json');
  assert.equal(result.batch_id, 'b1');
  assert.equal(result.sequence_no, 2);
  assert.equal(result.quantity_basis, 'estimated');
});

test('opening WIP lookup rejects a missing batch and invalid numeric values', async () => {
  const api = apiWith(async () => ({ status: 200, json: async () => ({ ok: true }) }));
  await assert.rejects(api.adminLookupOpeningWip({}, { apparatus: 'a', orderId: 'o', qrPayload: 'q' }),
    error => error.code === 'opening_wip_lookup');
  assert.throws(() => api.openingWipBatch({ quantity: '42' }), TypeError);
});
