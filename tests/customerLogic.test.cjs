const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

const filename = path.resolve(__dirname, '../src/customer/customerLogic.ts');
const loaded = new Module(filename, module); loaded.filename = filename; loaded.paths = module.paths;
loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
const logic = loaded.exports;
const dialog = (changes = {}) => ({ sentQty: 10, rawQty: '4', selectedReason: ' Defective ', comment: '',
  allowFullReturn: false, requireQtyEntry: true, ...changes });

// Source-derived from customer_delivery_detail_screen__CustomerDeliveryDetailScreenState_methods_01.dart.
test('return quantity uses Dart double syntax and the V2 comma normalization', () => {
  for (const [raw, expected] of [[' 1,25 ', 1.25], ['0.', 0], ['.5', .5], ['-1.e3', -1000], ['+.12e-9', .12e-9],
    ['1234E+7', 1234e7], ['+Infinity', Infinity]]) assert.equal(logic.parseCustomerReturnQty(raw), expected, raw);
  assert.equal(Number.isNaN(logic.parseCustomerReturnQty('-NaN')), true);
  for (const raw of ['', '   ', '1.2x', '0xFF', '1,2,3', '1e', '1 2', 'infinity']) assert.equal(logic.parseCustomerReturnQty(raw), null, raw);
});

test('return dialog requires a reason or three Unicode code points and valid quantity', () => {
  assert.deepEqual(logic.customerReturnInput(dialog()), { returnedQty: 4, reason: 'Defective', comment: '' });
  assert.equal(logic.customerReturnInput(dialog({ selectedReason: null, comment: ' ab ' })), null);
  assert.deepEqual(logic.customerReturnInput(dialog({ selectedReason: null, comment: ' 😀😀😀 ' })),
    { returnedQty: 4, reason: '', comment: '😀😀😀' });
  for (const rawQty of ['', '0', '-1', '10', '11', 'NaN', 'Infinity']) {
    assert.equal(logic.customerReturnInput(dialog({ rawQty })), null, rawQty);
  }
  assert.deepEqual(logic.customerReturnInput(dialog({ rawQty: '10', allowFullReturn: true })).returnedQty, 10);
  assert.deepEqual(logic.customerReturnInput(dialog({ rawQty: '', requireQtyEntry: false })).returnedQty, 10);
});

test('the four delivery responses preserve V2 modes, flags and amounts', () => {
  const input = { returnedQty: 2.5, reason: 'Wrong item', comment: ' details ' };
  assert.deepEqual(logic.customerDeliveryResponseBody(logic.customerApproveAll(' id ')),
    { delivery_note_id: ' id ', reason: '', approve: true, mode: 'accept_all' });
  assert.deepEqual(logic.customerDeliveryResponseBody(logic.customerRejectAll('id', 10, input)),
    { delivery_note_id: 'id', reason: 'Wrong item', approve: false, mode: 'reject_all', returned_qty: 10, comment: 'details' });
  assert.deepEqual(logic.customerDeliveryResponseBody(logic.customerAcceptPartial('id', 10, input)),
    { delivery_note_id: 'id', reason: 'Wrong item', mode: 'accept_partial', accepted_qty: 7.5, returned_qty: 2.5, comment: 'details' });
  assert.deepEqual(logic.customerDeliveryResponseBody(logic.customerReportClaim('id', input)),
    { delivery_note_id: 'id', reason: 'Wrong item', mode: 'claim_after_accept', returned_qty: 2.5, comment: 'details' });
});

test('response body keeps present false and zero, omits absent fields, and rejects non-finite JSON numbers', () => {
  assert.deepEqual(logic.customerDeliveryResponseBody({ deliveryNoteID: '', approve: false, acceptedQty: 0,
    returnedQty: 0, reason: ' raw ', comment: '   ' }),
  { delivery_note_id: '', reason: ' raw ', approve: false, accepted_qty: 0, returned_qty: 0 });
  assert.throws(() => logic.customerDeliveryResponseBody({ deliveryNoteID: 'id', acceptedQty: NaN }), TypeError);
  assert.throws(() => logic.customerDeliveryResponseBody({ deliveryNoteID: 'id', returnedQty: Infinity }), TypeError);
});
