// @v2-test test/werka_archive_batch_qr_test.dart
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

const filename = path.resolve(__dirname, '../src/werka/werkaArchiveBatchQr.ts');
const loaded = new Module(filename, module); loaded.filename = filename; loaded.paths = module.paths;
loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
const { parseWerkaArchiveBatchQr: parse, resolveExactArchiveBatchItemOption: exact,
  resolveArchiveBatchDefaultCustomer: customer } = loaded.exports;
const url = lines => `https://scan.wspace.sbs/A/${Buffer.from(lines.join('\n')).toString('base64url')}`;
const option = (customerRef, customerName, itemName, itemCode = itemName) => ({ customerRef, customerName,
  customerPhone: '+998', itemCode, itemName, uom: 'Kg', warehouse: 'Stores - A' });

test('parses legacy archive batch QR payload', () => {
  const parsed = parse(url(['ARCHIVE', 'sess-1', 'Akis mega 2-3 kg paket', '3.6', '01 May 2026 15:23']));
  assert.equal(parsed.sessionID, 'sess-1'); assert.equal(parsed.itemName, 'Akis mega 2-3 kg paket');
  assert.equal(parsed.qty, 3.6); assert.equal(parsed.nettoQty, 3.6); assert.equal(parsed.bruttoQty, 3.6);
  assert.equal(parsed.batchTime, '01 May 2026 15:23');
});
test('parses separated brutto and netto archive batch QR payload', () => {
  const parsed = parse(url(['ARCHIVE', 'sess-2', 'Akis mega 2-3 kg paket', '4.1', '3.6', '01 May 2026 15:23']));
  assert.equal(parsed.sessionID, 'sess-2'); assert.equal(parsed.qty, 3.6);
  assert.equal(parsed.nettoQty, 3.6); assert.equal(parsed.bruttoQty, 4.1);
  assert.equal(parsed.batchTime, '01 May 2026 15:23');
});
test('batch QR item resolution requires exact item match', () => {
  const choices = [option('CUST-1', 'Customer', 'Adras aboy 4kg paket'), option('CUST-2', 'Customer 2', 'Adras aboy 3kg paekt')];
  assert.equal(exact('Adras aboy 3kg paekt', choices).itemCode, 'Adras aboy 3kg paekt');
  assert.equal(exact('Adras aboy 2kg paekt', choices), null);
});
test('batch QR default customer prefers primary customer', () => {
  const selected = customer(option('saidamin', 'saidamin', 'item'), [
    { ref: 'saidamin', name: 'saidamin', phone: '' }, { ref: 'umar-oboy', name: 'Umar Oboy', phone: '' },
  ]);
  assert.equal(selected.ref, 'umar-oboy');
});
test('batch QR default customer falls back to item option', () => {
  const selected = customer(option('fallback-customer', 'Fallback Customer', 'item'), []);
  assert.deepEqual(selected, { ref: 'fallback-customer', name: 'Fallback Customer', phone: '+998' });
});
test('rejects malformed and non-positive payloads, accepts trimmed Unicode and decimal commas', () => {
  assert.equal(parse('not a QR'), null); assert.equal(parse('https://example.com/A/%%%'), null);
  assert.equal(parse(url(['ARCHIVE', 's', 'item', '0', 'time'])), null);
  assert.equal(parse(url(['ARCHIVE', 's', 'item', '2.1.2', 'time'])), null);
  const parsed = parse(`  ${url(['archive', 'sess', 'Bo‘yoq', '2,5 kg', 'time'])}  `);
  assert.equal(parsed.itemName, 'Bo‘yoq'); assert.equal(parsed.qty, 2.5);
});
