const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

const filename = path.resolve(__dirname, '../src/printing/printModels.ts');
const loaded = new Module(filename, module);
loaded.filename = filename;
loaded.paths = module.paths;
loaded.require = name => name === '../workerControlsApi' ? {
  isCanonicalApparatusId: value => {
    const parts = value.trim().split(':');
    return value.length <= 128 && value === value.toLowerCase() && !/\s/.test(value) &&
      parts.length >= 3 && parts[0] === 'apparatus' && parts.slice(1).every(Boolean);
  },
} : require(name);
loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText, filename);
const { UsbRpsPrintRequest, UsbRpsPrintResponse, UsbPrinterProfile, qolipColorDisplayName } = loaded.exports;

// Expected values were dumped from V2 baseline 7c87a54e with v2_oracle.sh.
test('printer requests retain V2 defaults, quantities and label fields', () => {
  const cases = [
    [UsbRpsPrintRequest.test(' rps-usb-test '), {
      json: { epc: 'RPS-USB-TEST', item_code: 'USB-TEST', item_name: 'USB printer test',
        warehouse: 'RPS USB TEST', printer: 'godex', print_mode: 'label', gross_qty: 1,
        unit: 'kg', tare_enabled: false, tare_kg: 0, print_count: 1 },
      net: 1, progress: 1, title: 'USB printer test  1 kg', footer: 'USB-TEST', lines: [],
    }],
    [UsbRpsPrintRequest.fromPrintJson({ qr_payload: ' ab-12 ', item_code: ' ABC ', item_name: ' Product ',
      qty: 12.5, gross_qty: 14, tare_kg: 1.5, tare: true, label_kind: ' progress ', unit: 'KG',
      order_code: ' O-5 ', apparatus: 'apparatus:default:bosma_7', apparatus_display_name: ' 7 ta rangli bosma ',
      executor_name: ' Ali ', progress_unit: 'm', completed_at_unix: 1730000000 }), {
      json: { epc: 'AB-12', item_code: 'ABC', item_name: 'Product', order_code: 'O-5',
        apparatus: 'apparatus:default:bosma_7', apparatus_display_name: '7 ta rangli bosma', warehouse: 'Ijrochi: Ali',
        printer: 'godex', print_mode: 'label', gross_qty: 14, unit: 'kg', tare_enabled: true, tare_kg: 1.5,
        print_count: 1, label_kind: 'progress', executor_name: 'Ali', progress_qty: 12.5, progress_unit: 'm',
        completed_at_unix: 1730000000 },
      net: 12.5, progress: 12.5, title: 'Product  B:14 KG N:12.5 KG Metri: 12.5 m', footer: 'ABC', lines: [],
    }],
    [UsbRpsPrintRequest.fromPrintJson({ epc: 'rps-batch:abc', item_name: 'Material', item_code: 'mat',
      label_kind: 'material_product', gross_qty: 23, progress_qty: 125.5, progress_unit: 'm', tare_kg: 2 }), {
      json: { epc: 'RPS-BATCH:ABC', item_code: 'mat', item_name: 'Material', warehouse: 'ACCORD',
        printer: 'godex', print_mode: 'label', gross_qty: 23, unit: 'kg', tare_enabled: true, tare_kg: 2,
        print_count: 1, label_kind: 'material_product', progress_qty: 125.5, progress_unit: 'm' },
      net: 21, progress: 125.5, title: 'Material  B:23 kg N:21 kg Metri: 125.5 m',
      footer: 'EPC: rps-batch:abc', lines: [],
    }],
    [UsbRpsPrintRequest.fromPrintJson({ epc: '00001', item_name: 'paddon', label_kind: 'paddon_code' },
      { paddonLabelLines: ['header'] }), {
      json: { epc: '00001', item_code: 'USB-TEST', item_name: 'paddon', warehouse: 'ACCORD',
        printer: 'godex', print_mode: 'label', gross_qty: 1, unit: 'kg', tare_enabled: false, tare_kg: 0,
        print_count: 1, label_kind: 'paddon_code' },
      net: 0, progress: 0, title: 'paddon  0 kg', footer: '00001', lines: ['header'],
    }],
  ];
  for (const [request, expected] of cases) {
    assert.deepEqual({ json: request.toJson(), net: request.netQty, progress: request.effectiveProgressQty,
      title: request.materialProductLabelTitle, footer: request.largeQrLabelFooter(request.epc),
      lines: request.paddonLabelLines }, expected);
  }
});

// @v2-test test/native_usb_printer_test.dart
test('profiles, responses, canonical apparatus and colors follow V2', () => {
  const profile = UsbPrinterProfile.fromMap({ printer: 'ZPL', productName: ' ZT411R ', vendorId: 1234, productId: 5678 });
  assert.equal(profile.displayName, 'Zebra • ZT411R');
  assert.equal(profile.printMode, 'rfid');
  assert.equal(profile.supportsRfid, true);
  assert.equal(UsbRpsPrintRequest.test('EPC').forPrinter(profile).printer, 'zebra');
  assert.throws(() => UsbPrinterProfile.fromMap({ printer: 'unknown' }), /neither GoDEX nor Zebra/);
  assert.throws(() => UsbRpsPrintRequest.fromPrintJson({ apparatus: 'Bosma' }), /Canonical apparatus/);
  assert.equal(qolipColorDisplayName('#3949AB'), 'To‘q ko‘k');
  assert.equal(qolipColorDisplayName('PANTON 2'), 'PANTON 2');
  const response = UsbRpsPrintResponse.fromMap({ ok: true, status: 'done', epc: 'RPS-USB-TEST',
    item_code: 'USB-TEST', printer_status: 'USB OK', bytes: 256, vendorId: 1234, productId: 5678 });
  assert.equal(response.itemCode, 'USB-TEST');
  assert.equal(response.printerStatus, 'USB OK');
  assert.equal(response.bytes, 256);
  assert.equal(response.vendorId, 1234);
});

test('copies preserve V2 progress and Qolip defaults', () => {
  const request = UsbRpsPrintRequest.fromPrintJson({ epc: 'EP', item_code: 'CODE', item_name: 'N',
    label_kind: 'opening_wip', gross_qty: 10, tare_kg: 2, include_bobina_in_net: true,
    order_code: 'order', customer_name: 'Customer', qolip_color: 'Qizil' });
  assert.equal(request.netQty, 10);
  const cell = request.forQolipCell('  CELL  ');
  assert.equal(cell.itemName, 'CELL');
  assert.equal(cell.orderCode, '');
  assert.equal(cell.includeBobinaInNet, false);
  const code = request.forQolipCode(' N ', ' C ', ' rps-batch:12 ');
  assert.equal(code.largeQrLabelFooter(code.epc), 'BATCH ID: 12');
  assert.equal(code.customerName, 'Customer');
  assert.equal(code.qolipColor, 'Qizil');
});
