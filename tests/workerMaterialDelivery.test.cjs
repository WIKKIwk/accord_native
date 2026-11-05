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
  loaded.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText, filename);
  return loaded.exports;
}
function apiWith(handler) {
  const auth = { authorizedFetch: handler };
  const scope = load('sessionReadScope');
  const controls = load('workerControlsApi', { './authorizedFetch': auth, './sessionReadScope': scope });
  return load('workerMaterialDelivery', { './authorizedFetch': auth, './workerControlsApi': controls });
}
const station = 'apparatus:default:bosma_7';
const deliverer = { role: 'werka', ref: 'person', name: 'Name' };

test('material delivery candidates use the V2 scoped query and parse deliverers', async () => {
  let sent;
  const api = apiWith(async (_session, url, init) => {
    sent = { url, init };
    return { status: 200, json: async () => ({ already_at_apparatus: false, deliverers: [deliverer] }) };
  });
  const result = await api.adminMaterialStartDeliveryCandidates({}, ' order ', ` ${station} `, ' roll 1 ');
  assert.equal(new URL(sent.url, 'https://example.test').pathname, '/v1/mobile/admin/raw-material-start-receipt');
  assert.deepEqual(Object.fromEntries(new URL(sent.url, 'https://example.test').searchParams),
    { order_id: 'order', apparatus: station, barcode: 'roll 1' });
  assert.equal(sent.init.method, undefined);
  assert.deepEqual(result, { already_at_apparatus: false, deliverers: [deliverer] });
});

test('material receipt sends the V2 text body and requires matching confirmation', async () => {
  const requests = [];
  let responseBarcode = 'ROLL1';
  const api = apiWith(async (_session, url, init) => {
    requests.push({ url, init });
    return { status: 200, json: async () => ({ ok: true, apparatus: station, barcode: responseBarcode }) };
  });
  const input = { order_id: ' order ', apparatus: ` ${station} `, barcode: ' roll1 ', delivered_by: deliverer, idempotency_key: 'stable-key' };
  await api.adminReceiveMaterialForStart({}, input);
  assert.equal(requests[0].url, '/v1/mobile/admin/raw-material-start-receipt');
  assert.equal(requests[0].init.headers['Content-Type'], 'text/plain; charset=utf-8');
  assert.deepEqual(JSON.parse(requests[0].init.body), { order_id: 'order', apparatus: station, barcode: 'roll1',
    delivered_by_role: 'werka', delivered_by_ref: 'person', idempotency_key: 'stable-key' });
  responseBarcode = ' ROLL1 ';
  await assert.rejects(api.adminReceiveMaterialForStart({}, input), error => error.code === 'material_delivery_receipt_unconfirmed');
  assert.equal(requests.length, 2);
});

test('material receipt validates apparatus and uses the V2 idempotency-key shape', async () => {
  let calls = 0;
  const api = apiWith(async () => { calls++; throw new Error('unexpected request'); });
  await assert.rejects(api.adminReceiveMaterialForStart({}, { order_id: 'order', apparatus: 'Bosma', barcode: 'roll',
    delivered_by: deliverer, idempotency_key: 'key' }), error => error.code === 'apparatus_id_invalid');
  assert.equal(calls, 0);
  assert.equal(api.materialDeliveryIdempotencyKey('order', station, 'roll', 1234), `material-delivery:order:${station}:roll:1234000`);
});
