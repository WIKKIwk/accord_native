const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const cache = new Map();
class MobileApiException extends Error {}
function load(file) {
  const filename = path.resolve(__dirname, '../src', file);
  if (cache.has(filename)) return cache.get(filename);
  const m = new Module(filename, module); m.filename = filename; m.paths = module.paths;
  m.require = name => {
    if (name === '../printing/printTransport') return { offlineUsbDriverUrl: 'usb://local' };
    if (name === '../printing/printModels') return load('printing/printModels.ts');
    if (name === '../shared/mobileApiException') return { MobileApiException };
    if (name === '../workerControlsApi') return { isCanonicalApparatusId: () => true };
    if (name === './gscaleControlLogic') return load('gscale/gscaleControlLogic.ts');
    if (name === './gscaleDiscovery') return load('gscale/gscaleDiscovery.ts');
    return require(name);
  };
  m._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  cache.set(filename, m.exports); return m.exports;
}
const { printActiveGScaleBatch } = load('gscale/gscaleBatchPrint.ts');
const model = load('gscale/gscaleBatchModel.ts');
const receipt = epc => model.materialReceiptPrintResponseFromJson({ ok: true, epc, item_code: 'I', item_name: 'Ink',
  warehouse: 'W', gross_qty: 10, net_qty: 9, length_m: 125, unit: 'kg', print_count: 1 });
const batch = model.batchSessionFromJson({ id: 'b', active: true, revision: 4, item_code: 'I', item_name: 'Ink',
  warehouse: 'W', length_m: 125, order_assignment: { order_id: 'order-1' } });
const context = { preparationConflict: '', transport: 'bluetooth', server: null, batchResolved: true, batch,
  linkedOrderId: 'order-1', grossQtyKg: 10, printCount: 2, isMaterialReceipt: true,
  materialSupplier: 'Supplier', offlinePrinter: null, bluetoothPrinter: { address: 'AA', name: 'XP' } };

// @v2-test test/gscale_material_receipt_print_test.dart
test('local duplicate printing prepares, prints and confirms a distinct EPC for each label', async () => {
  const calls = []; let count = 0;
  const api = {
    async prepare(req) { calls.push(['prepare', req.print_count]); return receipt(`EPC-${++count}`); },
    async printLocal(req, options) { calls.push(['print', req.epc, req.manufacturerName, options.transport]); return { ok: true }; },
    async confirm(req, epc) { calls.push(['confirm', epc]); return receipt(epc); },
    async printRemote() { assert.fail('wrong transport'); },
    async refreshBatch() { calls.push(['refresh']); },
  };
  const result = await printActiveGScaleBatch(context, api);
  assert.deepEqual(calls, [['prepare', 1], ['print', 'EPC-1', 'Supplier', 'bluetooth'], ['confirm', 'EPC-1'],
    ['prepare', 1], ['print', 'EPC-2', 'Supplier', 'bluetooth'], ['confirm', 'EPC-2'], ['refresh']]);
  assert.equal(result.epc, 'EPC-2'); assert.equal(result.print_count, 2);
});

test('a failed second label is not confirmed and reports the completed count', async () => {
  const calls = []; let count = 0;
  const api = { async prepare() { return receipt(`EPC-${++count}`); }, async printLocal(req) { calls.push(['print', req.epc]); return { ok: count === 1 }; },
    async confirm(req, epc) { calls.push(['confirm', epc]); return receipt(epc); }, async refreshBatch() { calls.push(['refresh']); } };
  await assert.rejects(printActiveGScaleBatch(context, api), /1\/2 ta mahsulot chop etildi/);
  assert.deepEqual(calls, [['print', 'EPC-1'], ['confirm', 'EPC-1'], ['print', 'EPC-2'], ['refresh']]);
});

test('wrong order and too-small net quantity never issue a print request', async () => {
  const api = { async refreshBatch() { assert.fail('must reject before requests'); } };
  await assert.rejects(printActiveGScaleBatch({ ...context, linkedOrderId: 'other' }, api), /boshqa orderga/);
  await assert.rejects(printActiveGScaleBatch({ ...context, grossQtyKg: 0.05 }, api), /Netto kg juda kichik/);
});

test('Wi-Fi uses the selected server driver and a single remote batch request', async () => {
  const server = { endpoint: { baseUrl: 'http://192.168.1.2:39117', host: '192.168.1.2', port: 39117 },
    handshake: { serverName: 'scale', serverRef: 'lab' }, latencyMs: 1 };
  const calls = [];
  const result = await printActiveGScaleBatch({ ...context, transport: 'wifi', server }, {
    async printRemote(req) { calls.push(req); return receipt('EPC'); }, async refreshBatch() {},
  });
  assert.equal(calls.length, 1); assert.equal(calls[0].print_count, 2);
  assert.equal(calls[0].driver_url, 'http://192.168.1.2:39117'); assert.equal(result.epc, 'EPC');
});
