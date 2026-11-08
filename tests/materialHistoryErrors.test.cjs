const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const fixture = require('./contracts/f11910bb/material_history_errors.source.json');

function compile(file, mocks = {}) {
  const filename = path.resolve(__dirname, `../src/${file}.ts`), loaded = new Module(filename, module);
  loaded.filename = filename; loaded.paths = module.paths;
  loaded.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText, filename);
  return loaded.exports;
}
const exceptions = compile('shared/mobileApiException');
const controls = compile('workerControlsApi', { './authorizedFetch': {}, './sessionReadScope': {} });
const dart = compile('shared/dartApparatus', { '../workerControlsApi': controls });
const mapper = compile('material/materialHistoryErrors', { '../shared/mobileApiException': exceptions,
  '../shared/dartApparatus': dart, './materialHistoryErrorMessages': compile('material/materialHistoryErrorMessages') });
const error = (payload, status = 400, requestId) => mapper.materialHistoryResponseError({ status,
  headers: new Headers(requestId === undefined ? {} : { 'x-request-id': requestId }) }, payload);

test('error expectations are pinned source-derived data, not a Flutter oracle or wire recording', () => {
  assert.equal(fixture.baseline, 'f11910bb2c8c7081ce26770e69811b03fd0739ed');
  assert.match(fixture.evidence, /No Dart\/Flutter execution/); assert.equal(Object.keys(fixture.static_messages).length, 179);
  assert.deepEqual(fixture.dynamic_codes, ['rezka_frame_groups_invalid', 'merge_input_frame_count_mismatch', 'order_delete_blocked',
    'raw_material_assignment_locked', 'raw_material_already_assigned', 'raw_material_roll_size_mismatch',
    'progress_batch_already_used', 'progress_batch_in_use', 'store_failed', 'production_map_store_failed']);
});
for (const [code, message] of Object.entries(fixture.static_messages)) {
  test(`f119 History fixed error: ${code}`, () => {
    const result = error({ error: `\u0085${code.toUpperCase()}\u0085` });
    assert.ok(result instanceof exceptions.MobileApiException); assert.equal(result.code, code.toUpperCase());
    assert.equal(result.message, message); assert.equal(result.statusCode, 400);
  });
}

test('History fallback and unknown codes use the source operation and status-dependent retry advice', () => {
  for (const status of [400, 401, 403, 422, 499, 500, 503, 599]) {
    const advice = status >= 500 ? '. Serverda vaqtinchalik muammo yuz berdi. Keyinroq qayta urinib ko‘ring.'
      : '. Oynani yangilang va qayta urinib ko‘ring.';
    for (const payload of [null, [], 'invalid', {}, { error: 42 }, { error: '\u0085 \u0085' }, { error: 'RAW_MATERIAL_HISTORY' }]) {
      assert.equal(error(payload, status).message, `Homashyo tarixi yuklanmadi${advice}`);
    }
    for (const code of ['new_backend_code', '__proto__', 'constructor', 'toString']) {
      const result = error({ error: `\u0085${code}\u0085`, message: 'Do not show arbitrary server detail' }, status);
      assert.equal(result.code, code);
      assert.equal(result.message, `Homashyo tarixi yuklanmadi. Server xato kodi: ${code} (HTTP ${status})${advice}`);
    }
  }
});

test('structured exception metadata preserves options, blocker order, diagnostics and header-first request ID', () => {
  const payload = { error: 'order_delete_blocked', apparatus_options: [' A ', '', '\u0085B\u0085', null, 7, ['a', true]],
    blockers: [{ message: ' One ' }, {}, 'skip', { message: null }, { message: false }, { message: '\u0085Two\u0085' }],
    order_title: '\u0085Order 42\u0085', active_kadr_count: 7.9, scanned_kadr_count: -4.9, request_id: 'body-id', custom: { keep: true } };
  const result = error(payload, 409, 'header-id');
  assert.deepEqual(result.apparatusOptions, ['A', 'B', 'null', '7', '[a, true]']);
  assert.deepEqual(result.details, ['One', 'false', 'Two']); assert.equal(result.message, 'One\nfalse\nTwo');
  assert.equal(result.orderTitle, 'Order 42'); assert.equal(result.activeKadrCount, 7); assert.equal(result.scannedKadrCount, -4);
  assert.equal(result.requestId, 'header-id'); assert.equal(result.diagnostics, payload);
  assert.equal(error({ request_id: ' body-id ' }).requestId, ' body-id ');
  assert.equal(error({ request_id: 'body-id' }, 400, '').requestId, '');
  assert.equal(error({ request_id: 42 }).requestId, '42'); assert.equal(error({}).requestId, null);
});

test('a malformed count aborts later decoding while retaining earlier fields, as in the Dart try/catch', () => {
  const payload = { error: 'merge_input_frame_count_mismatch', order_title: ' Order ', request_id: 'trace',
    apparatus_options: ['One'], active_kadr_count: '7', scanned_kadr_count: 9 };
  const first = error(payload); assert.equal(first.activeKadrCount, null); assert.equal(first.scannedKadrCount, null);
  assert.equal(first.orderTitle, 'Order'); assert.equal(first.requestId, 'trace'); assert.deepEqual(first.apparatusOptions, ['One']);
  assert.equal(first.diagnostics, payload);
  assert.equal(first.message, 'Merge qilinmadi: scan qilingan WIPning kadr soni joriy rulon bilan bir xil emas');
  const second = error({ ...payload, active_kadr_count: 7.9, scanned_kadr_count: '9' });
  assert.equal(second.activeKadrCount, 7); assert.equal(second.scannedKadrCount, null);
  assert.equal(error({ ...payload, active_kadr_count: 7.9, scanned_kadr_count: 9.9 }).message,
    'Merge qilinmadi: joriy rulon 7 kadr, scan qilingan WIP 9 kadr. Bir xil kadrli WIPni scan qiling');
});

test('frame-group detail is the only dynamic branch that chooses the source server message fallback', () => {
  const code = 'rezka_frame_groups_invalid';
  assert.equal(error({ error: code, detail: '\u0085Explain\u0085' }).message, 'Explain');
  assert.equal(error({ error: code, message: 'Preferred', detail: 'Other' }).message, 'Preferred');
  assert.equal(error({ error: code, message: '', detail: 'Ignored' }).message,
    'Kesish rejasidagi kadrlar taqsimoti mos emas. Production mapdagi Rezka tugunlari va kadr sonini tekshiring.');
  assert.equal(error({ error: code, message: { hint: [true, null, 'text'] } }).message, '{hint: [true, null, text]}');
});

test('assignment lock and reservation messages use source order-title and stock-state branches', () => {
  assert.equal(error({ error: 'raw_material_assignment_locked' }).message,
    'Bu homashyo allaqachon ishga tushgan yoki ishlatilgan, uzib bo‘lmaydi');
  assert.equal(error({ error: 'raw_material_assignment_locked', raw_material_status: 'IN_USE' }).message,
    'Bu homashyo bu buyurtmada hozir ishlatilmoqda. Ulanishni uzib bo‘lmaydi');
  assert.equal(error({ error: 'raw_material_assignment_locked', order_title: '\u0085Order 7\u0085', raw_material_status: '\u0085consumed\u0085' }).message,
    'Bu homashyo “Order 7” buyurtmasida ishlatilgan. Ulanishni uzib bo‘lmaydi');
  assert.equal(error({ error: 'raw_material_assignment_locked', order_title: 'Order 7' }).message,
    'Bu homashyo “Order 7” buyurtmasi uchun band. Ulanishni uzib bo‘lmaydi');
  assert.equal(error({ error: 'raw_material_already_assigned', order_title: ' Order 7 ' }).message,
    'Bu homashyo “Order 7” buyurtmasi uchun band qilingan');
  assert.equal(error({ error: 'raw_material_already_assigned' }).message, 'Bu homashyo boshqa zakaz uchun band qilingan');
});

test('roll-size diagnostic messages retain minimum/order fallback and supported decimal parsing', () => {
  const code = 'raw_material_roll_size_mismatch';
  assert.equal(error({ error: code }).message, 'Bu rulon bu buyurtma uchun mos emas');
  assert.equal(error({ error: code, order_width_mm: 985, roll_width_mm: ' 970 ' }).message,
    'Mos emas: rulon eni 970 mm; talab qilinadigan minimum 985 mm.');
  assert.equal(error({ error: code, order_width_mm: 985, minimum_width_mm: ' 9.6e2 ', maximum_width_mm: '1000.', roll_width_mm: '1001.24' }).message,
    'Mos emas: rulon eni 1001.2 mm; ruxsat etilgan oraliq 960 mm–1000 mm.');
  assert.equal(error({ error: code, order_width_mm: 985, roll_width_mm: 990 }).message,
    'Rulon eni 990 mm, buyurtma talabi 985 mm. Bu rulon mos emas');
  for (const invalid of ['', '0xFF', '1x', [], {}]) {
    assert.equal(error({ error: code, order_width_mm: invalid, roll_width_mm: 1 }).message, 'Bu rulon bu buyurtma uchun mos emas');
  }
  assert.equal(error({ error: code, order_width_mm: '\u0085+.5e1\u0085', roll_width_mm: 4 }).message,
    'Mos emas: rulon eni 4 mm; talab qilinadigan minimum 5 mm.');
  assert.equal(error({ error: code, order_width_mm: 'Infinity', roll_width_mm: 4 }).message,
    'Mos emas: rulon eni 4 mm; talab qilinadigan minimum Infinity mm.');
});

test('remaining dynamic progress and store branches keep f119 wording', () => {
  assert.equal(error({ error: 'progress_batch_already_used', apparatus_name: '\u0085Bosma 7\u0085' }).message,
    'Bu rulon Bosma 7 apparatida allaqachon ishlatilgan. Qayta ish boshlash uchun ishlatilmagan rulon QR sini skanerlang.');
  assert.equal(error({ error: 'progress_batch_in_use' }).message, 'Bu rulon hozir ishlatilmoqda. Uni qayta ishga olib bo‘lmaydi.');
  for (const code of ['store_failed', 'production_map_store_failed']) {
    assert.equal(error({ error: code }).message, 'Production map ma’lumotlarini saqlashda server xatosi');
  }
  assert.equal(error({ error: 'order_delete_blocked' }).message, 'Buyurtmani o‘chirib bo‘lmaydi');
});

test('History presentation recognizes the shared exception and appends the source HTTP status once', () => {
  const presentation = compile('material/materialHistoryPresentation', { '../shared/mobileApiException': exceptions,
    '../shared/dartApparatus': dart, '../workerControlsApi': controls });
  assert.equal(presentation.materialHistoryErrorMessage(error({ error: 'forbidden' }, 403)),
    'Bu amal sizning rolingiz uchun ruxsat etilmagan (403)');
  assert.equal(presentation.materialHistoryErrorMessage(error({}, 500)),
    'Homashyo tarixi yuklanmadi. Serverda vaqtinchalik muammo yuz berdi. Keyinroq qayta urinib ko‘ring. (500)');
  assert.equal(presentation.materialHistoryErrorMessage(new Error('network')), 'Serverdan ma’lumot olinmadi');
});

test('History API uses the role-local adapter for non-404 responses and preserves the dedicated 404', async () => {
  let response;
  const api = compile('material/materialHistoryApi', { '../authorizedFetch': { authorizedFetch: async () => response },
    '../shared/mobileApiException': exceptions, '../shared/dartApparatus': dart, '../workerControlsApi': controls,
    './materialHistoryErrors': mapper });
  for (const [status, payload, message] of [[403, { error: 'forbidden' }, 'Bu amal sizning rolingiz uchun ruxsat etilmagan'],
    [503, {}, 'Homashyo tarixi yuklanmadi. Serverda vaqtinchalik muammo yuz berdi. Keyinroq qayta urinib ko‘ring.']]) {
    response = new Response(JSON.stringify(payload), { status, headers: { 'x-request-id': 'trace' } });
    await assert.rejects(api.adminRawMaterialHistory({}), error => {
      assert.ok(error instanceof exceptions.MobileApiException); assert.equal(error.message, message);
      assert.equal(error.statusCode, status); assert.equal(error.requestId, 'trace'); return true;
    });
  }
  response = new Response('not json', { status: 502, headers: { 'x-request-id': 'bad-json' } });
  await assert.rejects(api.adminRawMaterialHistory({}), error => {
    assert.equal(error.code, 'raw_material_history'); assert.equal(error.requestId, 'bad-json');
    assert.equal(error.message, 'Homashyo tarixi yuklanmadi. Serverda vaqtinchalik muammo yuz berdi. Keyinroq qayta urinib ko‘ring.'); return true;
  });
  response = new Response('{"error":"forbidden"}', { status: 404, headers: { 'x-request-id': 'ignored' } });
  await assert.rejects(api.adminRawMaterialHistory({}), error => {
    assert.equal(error.code, 'raw_material_history_not_found'); assert.equal(error.message, 'Serverda tarix endpointi yo‘q');
    assert.equal(error.requestId, null); return true;
  });
});
