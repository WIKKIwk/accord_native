// Pure logic from werka_stock_entry_lookup_test.dart; actual picker, navigation and widgets remain unported.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
function load(file) {
  const filename = path.resolve(__dirname, '../src/werka', file), loaded = new Module(filename);
  loaded.filename = filename; loaded.paths = require.main.paths;
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return loaded.exports;
}
const api = load('werkaStockIssueLogic.ts'), { preferWerkaPrimaryCustomer } = load('werkaArchiveBatchQr.ts');
const entry = { stockEntryName: 'MAT-STE-2026-00572', lineIndex: 3, barcode: 'ENTRY-BARCODE', itemCode: ' Adras ', qty: 6.4 };
const customer = { ref: 'umar-oboy', name: 'Umar Oboy', phone: '' };
test('QR issue preserves stock source metadata and selects the primary customer', () => {
  const selected = preferWerkaPrimaryCustomer([{ ref: 'saidamin', name: 'saidamin', phone: '' }, customer]);
  assert.equal(selected, customer); assert.equal(api.canCreateWerkaStockIssue(entry, selected, false), true);
  assert.deepEqual(api.werkaStockIssueInput(entry, selected, 'SCANNED-QR'), { customerRef: 'umar-oboy', itemCode: 'Adras', qty: 6.4,
    sourceBarcode: 'ENTRY-BARCODE', sourceStockEntryName: 'MAT-STE-2026-00572', sourceLineIndex: 3 });
});
test('missing entry barcode uses scanned barcode; submission separately validates customer ref', () => {
  assert.equal(api.werkaStockIssueInput({ ...entry, barcode: ' ' }, customer, 'SCANNED-FALLBACK').sourceBarcode, 'SCANNED-FALLBACK');
  assert.equal(api.canCreateWerkaStockIssue(entry, { ...customer, ref: '' }, false), true);
  assert.equal(api.werkaStockIssueInput(entry, { ...customer, ref: '' }, 'x'), null);
  assert.equal(api.canCreateWerkaStockIssue(entry, customer, true), false);
  assert.equal(api.werkaStockIssueInput({ ...entry, qty: 0 }, customer, 'x'), null);
});
test('created issue becomes the same pending dispatch record', () => {
  const result = api.werkaStockIssueDispatch({ entryID: 'e1', customerRef: 'c', customerName: 'Customer', itemCode: 'A',
    itemName: 'Item', uom: 'Kg', qty: 6.4, createdLabel: '2026-05-07' });
  assert.equal(result.id, 'e1'); assert.equal(result.supplier_ref, 'c'); assert.equal(result.sent_qty, 6.4);
  assert.equal(result.status, 'pending'); assert.equal(result.event_type, 'customer_issue_pending');
});
test('stock panel text helpers retain V2 defaults', () => {
  assert.equal(api.werkaStockEntryKey(entry), 'MAT-STE-2026-00572|3|ENTRY-BARCODE');
  assert.deepEqual([0, 1, 2, 7].map(api.werkaStockDocStatusLabel), ['Draft', 'Submitted', 'Cancelled', 'Doc 7']);
  assert.equal(api.werkaStockWarehouseText(' ', ' Warehouse '), '— → Warehouse');
  assert.equal(preferWerkaPrimaryCustomer([{ ref: 'x', name: 'saidamin', phone: '' }]).ref, 'x');
});
