const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const test = require('node:test');
const ts = require('typescript');
const { contractFetch, recordedSession } = require('./support/contractFetch.cjs');

class ApiError extends Error { constructor(code, message, statusCode) { super(message); this.code = code; this.statusCode = statusCode; } }
function load(file, overrides) {
  const filename = path.resolve(__dirname, '../src', file + '.ts');
  const loaded = new Module(filename, module); loaded.filename = filename; loaded.paths = module.paths;
  loaded.require = name => Object.hasOwn(overrides, name) ? overrides[name] : require(name);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return loaded.exports;
}
function fixture(fetch) {
  const print = load('workerPrintJob', { './workerControlsApi': { isCanonicalApparatusId: () => true } });
  return load('shared/printApi', { '../authorizedFetch': { authorizedFetch: fetch },
    '../workerControlsApi': { WorkerControlException: ApiError }, '../workerPrintJob': print });
}

// @v2-test test/qolip_tasks_test.dart
const name = 'assigned material reprint sends the order and preserves its barcode';
test(name, async () => {
  const replay = contractFetch('qolip_tasks_test', name);
  const session = recordedSession('qolip_tasks_test', name);
  const api = fixture((s, p, init = {}) => replay(new URL(p, s.baseUrl),
    { ...init, headers: { ...init.headers, Authorization: `Bearer ${s.token}` } }));
  const result = await api.adminPrepareRawMaterialStockReprint(session, '30AA', 'zakaz-3');
  replay.assertDone();
  assert.equal(result.stock.barcode, '30AA');
  assert.equal(result.print_request.epc, '30AA');
  assert.equal(result.print_request.gross_qty, 12);
});

test('reprint validates inputs, trims request fields and maps server failures', async () => {
  const calls = [];
  const api = fixture(async (session, route, init) => { calls.push({ route, ...init }); return new Response(JSON.stringify({ error: ' raw_material_stock_locked ' }), { status: 409 }); });
  await assert.rejects(api.adminPrepareRawMaterialStockReprint({}, ' '), error => error.code === 'raw_material_stock_reprint_invalid');
  assert.equal(calls.length, 0);
  await assert.rejects(api.adminPrepareRawMaterialStockReprint({}, ' B ', ' order '), error => error.code === 'raw_material_stock_locked' && error.statusCode === 409);
  assert.deepEqual(JSON.parse(calls[0].body), { barcode: 'B', order_id: 'order' });
  await assert.rejects(api.adminConfirmRawMaterialStockReprint({}, ' B ', ' ID '), error => error.code === 'raw_material_stock_locked');
  assert.deepEqual(JSON.parse(calls[1].body), { barcode: 'B', reprint_id: 'ID' });
});

test('qolip code print builds local transport requests and preserves print defaults', async () => {
  let call;
  const api = fixture(async (s, route, init) => { call = { route, ...init }; return new Response(JSON.stringify({
    qolip_qr: { qolip_code: ' C ', qr_payload: ' P ', item_name: ' Name ', size: 3.5 },
  }), { status: 200 }); });
  const result = await api.qolipPrintCodeQr({}, { qolipCode: ' C ', driverUrl: ' https://driver/// ',
    printer: ' X ', printMode: ' label ', printTransport: 'bluetooth', customerName: ' Customer ' });
  assert.equal(call.route, '/v1/mobile/qolip/code-qr/print');
  assert.deepEqual(JSON.parse(call.body), { qolip_code: 'C', driver_url: 'https://driver', printer: 'X', print_mode: 'label', print_transport: 'offline' });
  assert.equal(result.qolip_qr.size, 3);
  assert.equal(result.print_job.epc, 'P');
  assert.equal(result.print_job.item_code, 'C');
  assert.equal(result.print_job.label_kind, 'qolip_code');
  assert.equal(result.print_job.customer_name, 'Customer');
  assert.equal(result.print_job.unit, 'dona');
});
