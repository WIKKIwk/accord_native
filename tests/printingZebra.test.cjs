const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const cache = new Map();
function load(name) {
  if (cache.has(name)) return cache.get(name);
  const filename = path.resolve(__dirname, '../src/printing', name + '.ts');
  const m = new Module(filename, module);
  m.filename = filename;
  m.require = n => n === './printModels' ? load('printModels') : n === '../workerControlsApi'
    ? { isCanonicalApparatusId: () => true } : require(n);
  m._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  cache.set(name, m.exports);
  return m.exports;
}
const { UsbRpsPrintRequest } = load('printModels');
const { ZebraRpsRenderer } = load('zebraRpsRenderer');
const common = { warehouse: 'ACCORD', printer: 'zebra' };
const inputs = [
  { epc:'0x30313233-34353637', itemCode:'A1', itemName:'Green Tea', printMode:'rfid', grossQty:2.5, tareEnabled:true, tareKg:0.8 },
  { epc:'3031323334353637', itemCode:'C', itemName:'Cell A1', printMode:'label', grossQty:1, labelKind:'qolip_cell' },
  { epc:'RPS-BATCH:123', itemCode:'CODE', itemName:'Qolip nomi', printMode:'label', grossQty:1, labelKind:'qolip_code' },
  { epc:'3031323334353637', itemCode:'MAT', itemName:'CPP 1030/25', printMode:'rfid', grossQty:23, labelKind:'material_product' },
  { epc:'3031323334353637', itemCode:'AA', itemName:'Шоколад ^ 100%', printMode:'label', grossQty:7.25, printCount:2 },
];
// Byte streams dumped by v2_oracle.sh from V2 baseline 7c87a54e.
const expected = [
  "flBTCl5YQQpeTEgwLDAKXlJTOCwsLDEsTgpeUkZXLEgsLCxBXkZEMzAzMTMyMzMzNDM1MzYzN15GUwpeRk84LDUyXkEwTiwzOCwzMl5GQjc2MCwxLDAsTCwwCl5GRE1BSFNVTE9UOiBHcmVlbiBUZWFeRlMKXkZPOCwxMTJeQTBOLDM2LDMyCl5GRE5FVFRPOiAxLjcga2deRlMKXkZPOCwxNTheQTBOLDM2LDMyCl5GREJSVVRUTzogMi41IGtnXkZTCl5GTzgsMjIwXkEwTiwyNCwyMF5GQjc2MCwxLDAsTCwwCl5GREVQQzogMzAzMTMyMzMzNDM1MzYzN15GUwpeRk84LDI3Ml5CWTMsMiw0NF5CQ04sNDQsTixOLE4KXkZEMzAzMTMyMzMzNDM1MzYzN15GUwpeUFExCl5YWgo=",
  "flBTCl5YQQpeTEgwLDAKXkZPOCwxNl5BME4sODgsNzZeRkI3ODQsMSwwLEMsMApeRkRDZWxsIEExXkZTCl5GTzEyMCwxMjReQlFOLDIsMTFeRkRMQSwzMDMxMzIzMzM0MzUzNjM3XkZTCl5QUTEKXlhaCg==",
  "flBTCl5YQQpeTEgwLDAKXkZPOCwyXkEwTiwyNCwyMF5GQjc4NCwyLDI4LEMsMApeRkRRb2xpcCBub21pXkZTCl5GTzEyMCw1Nl5CUU4sMiwxMV5GRExBLFJQUy1CQVRDSDoxMjNeRlMKXkZPOCwzNTJeQTBOLDE4LDE2XkZCNzg0LDEsMCxDLDAKXkZEQkFUQ0ggSUQ6IDEyM15GUwpeUFExCl5YWgo=",
  "flBTCl5YQQpeTEgwLDAKXlJTOCwsLDEsTgpeUkZXLEgsLCxBXkZEMzAzMTMyMzMzNDM1MzYzN15GUwpeRk84LDJeQTBOLDI0LDIwXkZCNzg0LDIsMjgsQywwCl5GRENQUCAxMDMwLzI1ICAyMyBrZ15GUwpeRk8xMjAsNTZeQlFOLDIsMTFeRkRMQSwzMDMxMzIzMzM0MzUzNjM3XkZTCl5GTzgsMzUyXkEwTiwxOCwxNl5GQjc4NCwxLDAsQywwCl5GREVQQzogMzAzMTMyMzMzNDM1MzYzN15GUwpeUFExCl5YWgo=",
  "flBTCl5YQQpeTEgwLDAKXk1NVApeRk84LDUyXkEwTiwzOCwzMl5GQjc2MCwxLDAsTCwwCl5GRE1BSFNVTE9UOiDQqNC+0LrQvtC70LDQtCAgIDEwMCVeRlMKXkZPOCwxMTheQTBOLDQ0LDM4Cl5GRFZBWk5JOiA3LjMga2deRlMKXkZPOCwxODReQTBOLDI0LDIwXkZCNzYwLDEsMCxMLDAKXkZERVBDOiAzMDMxMzIzMzM0MzUzNjM3XkZTCl5GTzgsMjM2XkJZMywyLDQ0XkJDTiw0NCxOLE4sTgpeRkQzMDMxMzIzMzM0MzUzNjM3XkZTCl5QUTEKXlhaCn5QUwpeWEEKXkxIMCwwCl5NTVQKXkZPOCw1Ml5BME4sMzgsMzJeRkI3NjAsMSwwLEwsMApeRkRNQUhTVUxPVDog0KjQvtC60L7Qu9Cw0LQgICAxMDAlXkZTCl5GTzgsMTE4XkEwTiw0NCwzOApeRkRWQVpOSTogNy4zIGtnXkZTCl5GTzgsMTg0XkEwTiwyNCwyMF5GQjc2MCwxLDAsTCwwCl5GREVQQzogMzAzMTMyMzMzNDM1MzYzN15GUwpeRk84LDIzNl5CWTMsMiw0NF5CQ04sNDQsTixOLE4KXkZEMzAzMTMyMzMzNDM1MzYzN15GUwpeUFExCl5YWgo="
];
for (let i = 0; i < inputs.length; i++) {
  test(`Zebra byte stream matches V2 case ${i + 1}`, () => {
    const request = new UsbRpsPrintRequest({ ...common, ...inputs[i] });
    assert.deepEqual(Buffer.from(ZebraRpsRenderer.renderRepeated(request)), Buffer.from(expected[i], 'base64'));
  });
}
// @v2-test test/zebra_rps_renderer_test.dart
test('invalid RFID EPCs are rejected', () => {
  assert.throws(() => ZebraRpsRenderer.render(new UsbRpsPrintRequest({ ...common, epc: 'xyz', itemCode: '', itemName: '', printMode: 'rfid', grossQty: 1 })), /hex/);
  assert.throws(() => ZebraRpsRenderer.render(new UsbRpsPrintRequest({ ...common, epc: 'AABB', itemCode: '', itemName: '', printMode: 'rfid', grossQty: 1 })), /uzunligi/);
});
