const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

function loadTs(file, overrides = {}) {
  const filename = path.resolve(__dirname, '../src', file);
  const loaded = new Module(filename, module); loaded.filename = filename; loaded.paths = module.paths;
  loaded.require = name => Object.hasOwn(overrides, name) ? overrides[name] : require(name);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return loaded.exports;
}
function fixture(raw = '{}', status = 200) {
  const calls = [], session = { baseUrl: 'https://example.invalid', token: 'token' };
  const fetch = async (...args) => { calls.push(args); return { status, text: async () => raw, json: async () => JSON.parse(raw) }; };
  const notification = loadTs('shared/notificationApi.ts', { '../authorizedFetch': { authorizedFetch: fetch } });
  const logic = loadTs('customer/customerLogic.ts');
  const api = loadTs('customer/customerApi.ts', { '../authorizedFetch': { authorizedFetch: fetch },
    '../shared/notificationApi': notification, './customerLogic': logic });
  return { ...api, logic, calls, session };
}
const record = { id: 'DN 7', record_type: 'delivery_note', supplier_ref: 'C1', supplier_name: 'A', item_code: 'X',
  item_name: 'Item', uom: 'kg', sent_qty: 10.5, accepted_qty: 2, amount: 3.25, currency: 'UZS', note: 'Note',
  event_type: 'customer_delivery_pending', highlight: '', status: ' Accepted ', created_label: '2026-01-01' };

// Source-derived from mobile_api_customer.dart and shared app_models. No V2 Customer HTTP recording was found.
test('summary uses the V2 authenticated path and parses integer counts and defaults', async () => {
  const f = fixture('{"pending_count":2,"confirmed_count":null,"rejected_count":-3}');
  assert.deepEqual(await f.customerSummary(f.session), { pendingCount: 2, confirmedCount: 0, rejectedCount: -3 });
  assert.equal(f.calls.length, 1); assert.equal(f.calls[0][0], f.session);
  assert.equal(f.calls[0][1], '/v1/mobile/customer/summary'); assert.equal(f.calls[0][2], undefined);
  assert.deepEqual(f.customerSummaryFromJsonText('{}'), { pendingCount: 0, confirmedCount: 0, rejectedCount: 0 });
});

test('summary preserves Dart integer token validation for nested, escaped and duplicate keys', () => {
  const f = fixture();
  assert.deepEqual(f.customerSummaryFromJsonText('{"pending_count":1.5,"nested":{"confirmed_count":1.0,"q":"}\\\"["},' +
    '"pending_count":7,"confirmed_\\u0063ount":8,"rejected_count":-0}'),
  { pendingCount: 7, confirmedCount: 8, rejectedCount: 0 });
  for (const value of ['1.0', '1e0', '1.2', '"1"', 'true', '[]', '{}', '9007199254740992']) {
    assert.throws(() => f.customerSummaryFromJsonText(`{"pending_count":${value}}`), TypeError, value);
  }
  assert.throws(() => f.customerSummaryFromJsonText('[]'), TypeError);
  assert.throws(() => f.customerSummaryFromJsonText('{"pending_count":'), SyntaxError);
});

test('status details uses each V2 kind and the shared DispatchRecord parser without mutating inputs', async () => {
  for (const kind of ['pending', 'confirmed', 'rejected']) {
    const f = fixture(JSON.stringify([record, {}]));
    const result = await f.customerStatusDetails(f.session, kind);
    assert.equal(f.calls[0][1], `/v1/mobile/customer/status-details?kind=${kind}`);
    assert.equal(result[0].status, 'accepted'); assert.equal(result[0].sent_qty, 10.5);
    assert.equal(result[1].status, 'pending'); assert.equal(result[1].item_name, '');
  }
  const f = fixture();
  const source = Object.freeze({ ...record, status: '\u0085Accepted\u0085' });
  const parsed = f.customerDeliveryDetailFromJson({ record: source });
  assert.equal(parsed.record.status, 'accepted'); assert.equal(source.status, '\u0085Accepted\u0085');
  assert.throws(() => f.customerDeliveryDetailFromJson({ record: { status: 9 } }), TypeError);
  await assert.rejects(f.customerStatusDetails(f.session, 'pending'), TypeError);
});

test('delivery detail preserves query encoding, response flags and defaults', async () => {
  const f = fixture(JSON.stringify({ record, can_approve: true, can_reject: false, can_partially_accept: true, can_report_claim: true }));
  const result = await f.customerDeliveryDetail(f.session, 'DN +/');
  assert.equal(f.calls[0][1], '/v1/mobile/customer/detail?delivery_note_id=DN+%2B%2F');
  assert.deepEqual([result.canApprove, result.canReject, result.canPartiallyAccept, result.canReportClaim], [true, false, true, true]);
  assert.equal(result.record.id, 'DN 7');
  assert.deepEqual(f.customerDeliveryDetailFromJson({}), { record: f.customerDeliveryDetailFromJson({ record: {} }).record,
    canApprove: false, canReject: false, canPartiallyAccept: false, canReportClaim: false });
  assert.throws(() => f.customerDeliveryDetailFromJson({ can_approve: 1 }), TypeError);
  assert.throws(() => f.customerDeliveryDetailFromJson({ record: [] }), TypeError);
});

test('delivery response posts the exact V2 body, including false, zero and trimmed optional comment', async () => {
  const f = fixture(JSON.stringify({ record, can_report_claim: true }));
  const reply = { deliveryNoteID: ' DN ', approve: false, mode: 'acceptPartial', acceptedQty: 0, returnedQty: 10,
    reason: ' raw reason ', comment: '\u0085 issue \u0085' };
  const result = await f.customerRespondDelivery(f.session, reply);
  assert.equal(result.canReportClaim, true);
  assert.equal(f.calls[0][1], '/v1/mobile/customer/respond');
  assert.equal(f.calls[0][2].method, 'POST'); assert.deepEqual(f.calls[0][2].headers, { 'Content-Type': 'application/json' });
  assert.equal(f.calls[0][2].body, '{"delivery_note_id":" DN ","reason":" raw reason ","approve":false,' +
    '"mode":"accept_partial","accepted_qty":0,"returned_qty":10,"comment":"issue"}');
  await assert.rejects(f.customerRespondDelivery(f.session, { deliveryNoteID: 'DN', returnedQty: Infinity }), TypeError);
  assert.equal(f.calls.length, 1);
});

test('all four endpoints accept only 200 and retain V2 exception wording', async () => {
  for (const [method, args, expected] of [
    ['customerSummary', [], 'Customer summary failed'], ['customerStatusDetails', ['pending'], 'Customer status details failed'],
    ['customerDeliveryDetail', ['id'], 'Customer detail failed'], ['customerRespondDelivery', [{ deliveryNoteID: 'id' }], 'Customer respond failed'],
  ]) {
    const f = fixture('{}', 201);
    await assert.rejects(f[method](f.session, ...args), error => String(error) === `Exception: ${expected}`);
  }
});
