const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

function setup(prepared, print = async () => true) {
  const calls = [], deps = {
    '../sessionReadScope': { sessionReadScope: () => 'scope' },
    '../shared/mobileApiException': { MobileApiException: class extends Error { constructor(options) { super(options.message); this.code = options.code; } } },
    '../shared/printApi': { adminPrepareRawMaterialStockReprint: async (session, barcode) => { calls.push(['prepare', barcode]); return prepared; },
      adminConfirmRawMaterialStockReprint: async (session, barcode, id) => { calls.push(['confirm', barcode, id]); } },
    './preparationPrinter': { pickPreparationInventoryPrinter: async () => ({ transport: 'bluetooth' }),
      printPreparationJob: async (...args) => { calls.push(['print', args[0], args[2]]); return print(); } },
    './preparationReprint': { PreparationReprintCancelled: class extends Error {} },
  };
  const filename = path.resolve(__dirname, '../src/preparation/preparationInventoryReprint.ts'), loaded = new Module(filename, module);
  loaded.require = id => id in deps ? deps[id] : require(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return { api: loaded.exports, calls };
}
const prepared = { reprint_id: 'r1', stock: { barcode: 'EPC' }, print_request: { epc: 'EPC' } };
test('inventory reprint prepares, prints and confirms the same barcode', async () => {
  const x = setup(prepared);
  assert.equal(await x.api.reprintPreparationInventoryAsset({}, 'epc', { isCurrent: () => true, selectDevice: async () => null }), null);
  assert.deepEqual(x.calls, [['prepare', 'epc'], ['print', { epc: 'EPC' }, { inventory: true }], ['confirm', 'EPC', 'r1']]);
});
test('inventory reprint never prints or confirms a mismatched barcode', async () => {
  const x = setup({ ...prepared, stock: { barcode: 'OTHER' } });
  await assert.rejects(x.api.reprintPreparationInventoryAsset({}, 'EPC', { isCurrent: () => true, selectDevice: async () => null }), /mos kelmadi/);
  assert.deepEqual(x.calls, [['prepare', 'EPC']]);
});
