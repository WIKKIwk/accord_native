const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const cache = new Map();
class MobileApiException extends Error { constructor(options) { super(options.message); Object.assign(this, options); } }
function load(file) {
  const filename = path.resolve(__dirname, '../src', file);
  if (cache.has(filename)) return cache.get(filename);
  const m = new Module(filename, module); m.filename = filename; m.paths = module.paths;
  m.require = name => {
    if (name === '../printing/printModels') return load('printing/printModels.ts');
    if (name === '../shared/mobileApiException') return { MobileApiException };
    if (name === '../workerControlsApi') return { isCanonicalApparatusId: () => true };
    if (name === './gscaleControlLogic') return load('gscale/gscaleControlLogic.ts');
    if (name === './gscalePreparation') return { formatCompactKg: value => value.toFixed(3).replace(/\.?0+$/, '') };
    return require(name);
  };
  m._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  cache.set(filename, m.exports); return m.exports;
}
const a = load('gscale/gscaleArchive.ts');
const model = load('gscale/gscaleBatchModel.ts');
const batch = model.batchSessionFromJson({ id: 'batch-1', batch_code: '42ABCDEF0123456789ABCDEF', item_code: 'CPP', item_name: 'CPP', warehouse: 'W',
  prints: [{ epc: 'E1', qty: 9, net_qty: 9, gross_qty: 10 }, { epc: 'E2', qty: 8, net_qty: 8, gross_qty: 9 }] });

// @v2-test test/gscale_material_receipt_print_test_cases_resplit_part_02.dart
test('archive batch QR aggregates gross and net quantities and rejects corrupt stored codes', () => {
  const session = a.archiveSessionFromBatch(batch), plan = a.buildMaterialBatchPrintPlan(session);
  assert.equal(session.net_qty, 17); assert.equal(session.gross_qty, 19); assert.equal(session.print_count, 2);
  assert.equal(plan.qr_payload, 'RPS-BATCH:42ABCDEF0123456789ABCDEF');
  assert.equal(plan.label_title, 'CPP  B:19 N:17 kg');
  assert.equal(a.materialBatchDriverRequest(plan, 'zebra').print_count, 1);
  assert.equal(a.materialBatchUsbRequest(plan, 'zebra').largeQrLabelFooter(plan.qr_payload), 'BATCH ID: 42ABCDEF0123456789ABCDEF');
  assert.throws(() => a.buildMaterialBatchPrintPlan({ ...session, batch_code: 'broken' }), /Partiya kodi/);
  assert.equal(a.buildMaterialBatchPrintPlan({ ...session, batch_code: '' }).qr_payload, 'RPS-BATCH:BATCH-1');
});

test('archive reprint refuses a mismatched EPC before printing or confirming', async () => {
  const entry = a.archiveSessionFromBatch(batch).prints[0];
  const prepared = { reprint_id: 'r1', stock: { barcode: 'OTHER' }, print_request: { epc: 'E1' } };
  await assert.rejects(a.reprintArchiveReceipt(entry, 'zebra', { prepare: async () => prepared,
    print: async () => assert.fail('must not print'), confirm: async () => assert.fail('must not confirm') }),
  error => error.code === 'raw_material_stock_reprint_identity_mismatch');
});

test('archive reprint confirms only after printing and preserves a failed confirmation warning', async () => {
  const entry = a.archiveSessionFromBatch(batch).prints[0], calls = [];
  const prepared = { reprint_id: 'r1', stock: { barcode: 'E1', item_code: 'CPP', item_name: 'CPP', warehouse: 'W',
    qty: 9, length_m: 125, uom: 'kg' }, print_request: { epc: 'E1' } };
  const result = await a.reprintArchiveReceipt(entry, 'zebra', { prepare: async epc => { calls.push(['prepare', epc]); return prepared; },
    print: async request => { calls.push(['print', request.epc, request.printCount]); return { ok: true }; },
    confirm: async (epc, id) => { calls.push(['confirm', epc, id]); throw new Error('offline'); } });
  assert.deepEqual(calls, [['prepare', 'E1'], ['print', 'E1', 1], ['confirm', 'E1', 'r1']]);
  assert.equal(result, 'QR chop etildi, lekin server tasdig‘i saqlanmadi');
});
