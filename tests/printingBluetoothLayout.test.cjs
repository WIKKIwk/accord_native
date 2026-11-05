const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

const filename = path.resolve(__dirname, '../src/printing/bluetoothLayout.ts');
const loaded = new Module(filename, module);
loaded.filename = filename;
loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText, filename);
const { buildBluetoothProgressLayout, bluetoothPrinterText, bluetoothMaterialProductNameLines,
  bluetoothMaterialSplitNameLines } = loaded.exports;

// Values dumped from V2 baseline 7c87a54e with v2_oracle.sh.
test('progress layout matches V2 with apparatus, tare, timestamp and order', () => {
  const layout = buildBluetoothProgressLayout({
    item_name: 'PEREMOTKA - MAHSULOT, APPARAT: 7 TA RANGLI BOSMA, REZKA HOLATDA',
    customer_name: 'MIJOZ', gross_qty: 14, tare_kg: 1.5, progress_qty: 125, unit: 'KG',
    progress_unit: 'M', order_code: 'ORDER-1', completed_at_label: '2026-11-05 12:00',
  });
  assert.deepEqual(layout, { lines: [
    { text: 'APARAT: 7TALIK BOSMA', y: 12, font: 'large', char_width: 16 },
    { text: 'MAHSULOT NOMI: MIJOZ - MAHSULOT', y: 39, font: 'large', char_width: 16 },
    { text: 'METRAJ: 125.00 M', y: 66, font: 'large', char_width: 16 },
    { text: 'NETTO: 12.50 KG', y: 93, font: 'large', char_width: 16 },
    { text: 'BRUTTO: 14.00 KG', y: 120, font: 'large', char_width: 16 },
    { text: 'HOLAT: PEREMOTKA', y: 147, font: 'medium', char_width: 16 },
    { text: 'TUGATILDI: 2026-11-05 12:00', y: 170, font: 'medium', char_width: 16 },
    { text: 'ISH KODI: ORDER-1', y: 193, font: 'medium', char_width: 16 },
  ], codeY: 236, codeX: 84 });
});

test('long progress labels choose the V2 font and wrap at the same positions', () => {
  const layout = buildBluetoothProgressLayout({ item_name: 'UZUN MAHSULOT NOMI '.padEnd(110, 'A'),
    customer_name: 'BUYURTMACHI', gross_qty: 23.75, include_bobina_in_net: true });
  assert.deepEqual(layout, { lines: [
    { text: 'APARAT: -', y: 12, font: 'medium', char_width: 16 },
    { text: 'MAHSULOT NOMI: BUYURTMACHI - UZUN', y: 35, font: 'medium', char_width: 16 },
    { text: 'MAHSULOT NOMI', y: 55, font: 'medium', char_width: 16 },
    { text: 'A'.repeat(33), y: 75, font: 'medium', char_width: 16 },
    { text: 'A'.repeat(33), y: 95, font: 'medium', char_width: 16 },
    { text: 'A'.repeat(25), y: 115, font: 'medium', char_width: 16 },
    { text: 'METRAJ: 23.75 M', y: 138, font: 'medium', char_width: 16 },
    { text: 'NETTO: 23.75 KG', y: 161, font: 'medium', char_width: 16 },
    { text: 'HOLAT: YARIM TAYYOR', y: 184, font: 'medium', char_width: 16 },
    { text: 'ISH KODI: -', y: 207, font: 'medium', char_width: 16 },
  ], codeY: 239, codeX: 84 });
});

// @v2-test test/native_bluetooth_printer_test.dart
test('Bluetooth text and material label wrapping follow V2', () => {
  assert.equal(bluetoothPrinterText('  Қизил Ғишт “Щ” Ўзбекистон\n'), "QIZIL G'ISHT ?SHCH? O'ZBEKISTON");
  assert.deepEqual(bluetoothMaterialSplitNameLines('жуда узун маҳсулот номи 12345678901234567890123456789'),
    ['HOMASHYO: JUDA UZUN', 'MAHSULOT NOMI', '123456789012345678901234', '56789']);
  assert.deepEqual(bluetoothMaterialProductNameLines(''), ['MAHSULOT: -']);
});
