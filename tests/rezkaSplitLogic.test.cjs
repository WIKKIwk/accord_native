const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const file = path.resolve(__dirname, '../src/rezka/rezkaSplitLogic.ts');
const loaded = new Module(file, module); loaded.filename = file; loaded.paths = module.paths;
loaded._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, file);
const logic = loaded.exports;
const source = { barcode: 'b', stock_entry_name: 's', line_index: 0, item_code: 'item', item_name: 'Film', qty: 10, uom: 'kg', warehouse: 'WH', company: '' };
test('draft, QR barcode extraction, exact tolerance and remainder flows follow V2', () => {
  const draft = logic.draftFromSource(source);
  assert.deepEqual(draft, { item_code: '', item_name: '', qty: '', uom: 'kg', warehouse: 'WH', reason: '', print_qr: true });
  assert.equal(logic.extractRezkaBarcode(' https://host/x?barcode=EPC%201 '), 'EPC 1');
  assert.equal(logic.extractRezkaBarcode('https://host/A/1'), null);
  assert.equal(logic.extractRezkaBarcode('https://host/x/EPC%201'), 'EPC 1');
  assert.equal(logic.extractRezkaBarcode('https://host/x/%20'), 'x');
  assert.equal(logic.extractRezkaBarcode('https://host//?barcode=first&barcode=last'), 'last');
  assert.equal(logic.extractRezkaBarcode('https://host/?barcode=x'), 'https://host/?barcode=x');
  assert.equal(logic.extractRezkaBarcode('ABC'), 'ABC');
  assert.equal(logic.rezkaOutputTotal(source, [4, 6]).kind, 'equal');
  assert.equal(logic.rezkaOutputTotal(source, [3, 6]).kind, 'remainder');
  assert.equal(logic.rezkaOutputTotal(source, [5, 6]).kind, 'excess');
  assert.deepEqual(logic.remainderDraft(source, 1.25, true), { item_code: 'item', item_name: 'Film', qty: '1.250', uom: 'kg',
    warehouse: 'brak - ombori - A', reason: 'Atxot / brak mahsulot', print_qr: false });
});
test('QR output requires item, quantity and location; scrap may use source item and UOM', () => {
  const draft = logic.draftFromSource(source);
  assert.equal(logic.buildRezkaOutputs(source, [{ ...draft, qty: '2' }]), null);
  assert.equal(logic.buildRezkaOutputs(source, [{ ...draft, item_code: 'i', qty: '0' }]), null);
  assert.equal(logic.buildRezkaOutputs(source, [{ ...draft, item_code: 'i', qty: '2', warehouse: ' ' }]), null);
  assert.deepEqual(logic.buildRezkaOutputs(source, [{ ...draft, qty: '2', uom: '', print_qr: false }]),
    [{ item_code: 'item', item_name: 'Film', qty: 2, uom: 'kg', target_warehouse: 'WH', reason: '', print_qr: false }]);
});
