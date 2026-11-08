const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

function fixture(payload = {}) {
  const filename = path.resolve(__dirname, '../src/shared/printApi.ts');
  const mod = new Module(filename, module); mod.filename = filename; mod.paths = module.paths;
  mod.require = name => name === '../authorizedFetch' ? { authorizedFetch: async () => ({ status: 200, json: async () => payload }) }
    : name === './mobileApiException' ? { MobileApiException: class extends Error {} }
      : name === '../workerPrintJob' ? { printJobFromJson: value => ({ parsed: value }) } : require(name);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return mod.exports;
}

test('stock decoder retains all fields, null defaults and numeric values', () => {
  const { rawMaterialStockFromJson: parse } = fixture();
  assert.deepEqual(parse({}), { id: '', warehouse: '', item_code: '', item_name: '', barcode: '', qty: 0,
    width_mm: null, micron: null, length_m: null, uom: '', status: '', reserved_order_id: '', source_receipt_id: '' });
  const input = { id: 'ID', warehouse: 'W', item_code: 'C', item_name: 'Name', barcode: 'B', qty: 1.25,
    width_mm: 20, micron: 12.5, length_m: 3, uom: 'kg', status: 'open', reserved_order_id: 'O', source_receipt_id: 'R' };
  assert.deepEqual(parse(input), input);
  assert.equal(parse({ qty: null }).qty, 0);
});

test('stock decoder keeps the existing JS coercion and numeric validation', () => {
  const { rawMaterialStockFromJson: parse } = fixture();
  for (const value of [null, [], false, 1, 'x']) assert.throws(() => parse(value), /Invalid response object/);
  assert.equal(parse({ id: 7 }).id, '7');
  assert.equal(parse({ warehouse: ['A', 'B'] }).warehouse, 'A,B');
  assert.equal(parse({ status: { key: 'value' } }).status, '[object Object]');
  for (const field of ['qty', 'width_mm', 'micron', 'length_m']) assert.throws(() => parse({ [field]: '7' }), /Invalid quantity/, field);
});

test('reprint retains null-stock fallback, print parsing and record data', async () => {
  const empty = await fixture({ reprint_id: null, stock: null, print: null }).adminPrepareRawMaterialStockReprint({}, 'B');
  assert.equal(empty.reprint_id, ''); assert.equal(empty.stock.qty, 0); assert.deepEqual(empty.print_request, { parsed: {} });
  const data = { reprint_id: 17, stock: { barcode: 'B', qty: 2.5 }, print: { epc: 'B' } };
  const api = fixture(data), result = await api.adminPrepareRawMaterialStockReprint({}, 'B');
  assert.equal(result.reprint_id, '17'); assert.deepEqual(result.stock, api.rawMaterialStockFromJson(data.stock));
  assert.deepEqual(result.print_request, { parsed: { epc: 'B' } });
});

test('reprint preserves object-validation order before decoding stock fields', async () => {
  await assert.rejects(fixture({ stock: [], print: [] }).adminPrepareRawMaterialStockReprint({}, 'B'), /Invalid response object/);
  await assert.rejects(fixture({ stock: { qty: 'bad' }, print: [] }).adminPrepareRawMaterialStockReprint({}, 'B'), /Invalid response object/);
  await assert.rejects(fixture({ stock: { qty: 'bad' }, print: {} }).adminPrepareRawMaterialStockReprint({}, 'B'), /Invalid quantity/);
});
