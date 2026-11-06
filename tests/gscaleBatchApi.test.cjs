const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const calls = [];
let status = 200;
let result = { ok: true, batch: { id: 'b1', revision: 3, active: true } };
class MobileApiException extends Error { constructor(options) { super(options.message); Object.assign(this, options); } }
const cache = new Map();
function load(name) {
  const filename = path.resolve(__dirname, '../src/gscale', name);
  if (cache.has(filename)) return cache.get(filename);
  const m = new Module(filename, module);
  m.filename = filename; m.paths = module.paths;
  m.require = name => {
    if (name === '../authorizedFetch') return { authorizedFetch: async (session, url, init) => {
      calls.push({ session, url, init }); return { status, text: async () => JSON.stringify(result) };
    } };
    if (name === '../shared/mobileApiException') return { MobileApiException };
    if (name === './gscaleBatchModel') return load('gscaleBatchModel.ts');
    return require(name);
  };
  m._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  cache.set(filename, m.exports); return m.exports;
}
const api = load('gscaleBatchApi.ts');
const model = load('gscaleBatchModel.ts');
const session = { token: 'test' };
const print = { batch_id: ' b1 ', expected_revision: 3, expected_item_code: ' ITEM ', expected_warehouse: ' W ',
  gross_qty: 10, driver_url: ' http://scale:39117/ ', unit: ' ', print_count: 0 };

test('batch start and update preserve V2 fields, trimming and optional dimensions', async () => {
  calls.length = 0; status = 200; result = { ok: true, batch: { id: ' b1 ', revision: 3, active: true, order_assignment: { order_id: ' o1 ' } } };
  const batch = await api.gscaleRpsBatchStart(session, { client_batch_id: ' c1 ', preparation_formula_material_id: ' m1 ',
    preparation_formula_variant_id: ' v1 ', order_id: ' o1 ', apparatus: ' ', driver_url: ' http://scale:39117/// ',
    item_code: ' ITEM ', item_name: ' Name ', warehouse: ' W ', printer: ' godex ', print_mode: ' label ',
    quantity_source: ' manual ', width_mm: 500 });
  assert.equal(calls[0].url, '/v1/mobile/rps/batch/start');
  assert.deepEqual(JSON.parse(calls[0].init.body), { client_batch_id: 'c1', preparation_formula: { material_id: 'm1', variant_id: 'v1' },
    order_id: 'o1', driver_url: 'http://scale:39117', item_code: 'ITEM', item_name: 'Name', warehouse: 'W',
    printer: 'godex', print_mode: 'label', quantity_source: 'manual', manual_qty_kg: 0, tare_enabled: false, tare_kg: 0, width_mm: 500 });
  assert.equal(batch.batch.id, 'b1'); assert.equal(batch.batch.order_id, 'o1');
  await api.gscaleRpsBatchUpdate(session, { batch_id: ' b1 ', expected_revision: 3, item_code: ' ITEM ', item_name: ' Name ',
    warehouse: ' W ', quantity_source: 'MANUAL', micron: 12 });
  assert.equal(calls[1].url, '/v1/mobile/rps/batch/update');
  assert.deepEqual(JSON.parse(calls[1].init.body), { batch_id: 'b1', expected_revision: 3, item_code: 'ITEM', item_name: 'Name',
    warehouse: 'W', micron: 12, quantity_source: 'manual', tare_enabled: false, tare_kg: 0 });
});

test('batch history clamps limit and response models retain V2 defaults', async () => {
  calls.length = 0; status = 200; result = { batches: [{ id: 'b1', revision: 2, quantity_source: '', manual_qty_kg: '3.5',
    tare: true, width_mm: '0', micron: '12.5', prints: [{ gross_qty: '4', print_count: 2 }] }, 'ignored'] };
  const batches = await api.gscaleRpsBatchHistory(session, 500);
  assert.equal(calls[0].url, '/v1/mobile/rps/batch/history?limit=100');
  assert.equal(batches.length, 1); assert.equal(batches[0].quantity_source, 'scale');
  assert.equal(batches[0].tare_enabled, true); assert.equal(batches[0].width_mm, null); assert.equal(batches[0].micron, 12.5);
  assert.equal(batches[0].prints[0].gross_qty, 4);
});

test('print, client prepare and confirm preserve requests and parse receipt', async () => {
  calls.length = 0; status = 200; result = { ok: true, epc: ' abc ', gross_qty: '10.5', net_qty: 10, micron: -1 };
  const receipt = await api.gscaleRpsBatchPrint(session, print);
  await api.gscaleRpsBatchClientPrintPrepare(session, print);
  await api.gscaleRpsBatchClientPrintConfirm(session, print, ' EPC-1 ');
  assert.deepEqual(calls.map(c => c.url), ['/v1/mobile/rps/batch/print', '/v1/mobile/rps/batch/client-print/prepare', '/v1/mobile/rps/batch/client-print/confirm']);
  assert.deepEqual(JSON.parse(calls[0].init.body), { batch_id: 'b1', expected_revision: 3, expected_item_code: 'ITEM',
    expected_warehouse: 'W', gross_qty: 10, unit: 'kg', driver_url: 'http://scale:39117', print_count: 1 });
  assert.equal(JSON.parse(calls[2].init.body).epc, 'EPC-1');
  assert.equal(receipt.epc, 'abc'); assert.equal(receipt.gross_qty, 10.5); assert.equal(receipt.micron, null);
});

test('batch API propagates backend code and detail, with V2 fallback for invalid bodies', async () => {
  status = 409; result = { error: 'stale_revision', detail: 'Changed' };
  await assert.rejects(api.gscaleRpsBatchState(session), error => error.code === 'stale_revision' && error.message === 'Changed' && error.statusCode === 409);
  result = {};
  await assert.rejects(api.gscaleRpsBatchClientPrintPrepare(session, print), error => error.code === 'rps_batch_client_print_prepare_failed' && error.message === error.code);
  status = 200;
});

test('material task requests skip empty orders and require numeric micron', async () => {
  calls.length = 0; status = 200;
  assert.deepEqual(await api.gscaleMaterialTasks(session, []), {}); assert.equal(calls.length, 0);
  result = { orders: [{ order_id: 'o1', materials: [{ material: 'PET', micron: 12, assigned: true }] }] };
  assert.deepEqual(await api.gscaleMaterialTasks(session, ['o1']), { o1: [{ material: 'PET', micron: 12, assigned: true }] });
  assert.deepEqual(JSON.parse(calls[0].init.body), { order_ids: ['o1'] });
  result = { orders: [{ order_id: 'o1', materials: [{ micron: '12' }] }] };
  await assert.rejects(api.gscaleMaterialTasks(session, ['o1']), /micron/);
});

test('batch stop serialization trims the identity', () => {
  assert.deepEqual(model.batchStopBody(' b1 ', 4), { batch_id: 'b1', expected_revision: 4 });
});
