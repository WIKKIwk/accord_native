const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
function setup(overrides = {}) {
  const calls = [], prepared = { reprint_id: 'raw_label_test', stock: { barcode: 'ABC', source_receipt_id: 'receipt' }, print_request: { epc: 'ABC' } };
  const filename = path.resolve(__dirname, '../src/preparation/preparationReprint.ts'), mod = new Module(filename, module);
  mod.require = id => {
    if (id === '../sessionReadScope') return { sessionReadScope: s => s.scope };
    if (id === '../shared/mobileApiException') return { MobileApiException: class extends Error { constructor(x) { super(x.message); this.code = x.code; } } };
    if (id === '../shared/printApi') return {
      adminPrepareRawMaterialStockReprint: async (s, barcode, order) => { calls.push(['prepare', barcode, order]); return overrides.prepared ?? prepared; },
      adminConfirmRawMaterialStockReprint: async (s, barcode, id) => { calls.push(['confirm', barcode, id]); if (overrides.confirmError) throw Error('offline'); },
    };
    return require(id);
  };
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ESNext } }).outputText, filename);
  const context = { isCurrent: () => true, pickPrinter: async () => 'printer', print: async () => { calls.push(['print']); return true; }, ...overrides.context };
  return { api: mod.exports, calls, context, session: { scope: 'A' }, roll: { epc: 'abc', receipt_name: 'receipt' } };
}
// @v2-test test/preparation_production_journal_test.dart
test('reprint prepares, prints, then confirms the same QR', async () => {
  const x = setup(); assert.equal(await x.api.reprintPreparationRoll(x.session, x.roll, 'order', x.context), null);
  assert.deepEqual(x.calls, [['prepare', 'abc', 'order'], ['print'], ['confirm', 'ABC', 'raw_label_test']]);
});
test('identity mismatch and printing failure never confirm a label', async () => {
  let x = setup({ prepared: { reprint_id: 'id', stock: { barcode: 'OTHER', source_receipt_id: 'receipt' }, print_request: { epc: 'ABC' } } });
  await assert.rejects(x.api.reprintPreparationRoll(x.session, x.roll, 'order', x.context), e => e.code === 'raw_material_stock_reprint_identity_mismatch');
  assert.deepEqual(x.calls, [['prepare', 'abc', 'order']]);
  x = setup({ context: { print: async () => false } });
  await assert.rejects(x.api.reprintPreparationRoll(x.session, x.roll, 'order', x.context), /Printer QR/);
  assert.equal(x.calls.some(call => call[0] === 'confirm'), false);
});
test('confirmation failure or account change after printing returns V2 warning', async () => {
  let x = setup({ confirmError: true });
  assert.match(await x.api.reprintPreparationRoll(x.session, x.roll, 'order', x.context), /tasdig‘i saqlanmadi/);
  x = setup(); x.context.print = async () => { x.session.scope = 'B'; return true; };
  assert.match(await x.api.reprintPreparationRoll(x.session, x.roll, 'order', x.context), /tasdig‘i saqlanmadi/);
  assert.equal(x.calls.some(call => call[0] === 'confirm'), false);
});
