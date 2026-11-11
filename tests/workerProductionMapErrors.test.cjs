const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const fixture = require('./contracts/f11910bb/material_history_errors.source.json');
function load(fetch = {}) {
  const filename = path.resolve(__dirname, '../src/workerControlsApi.ts'), loaded = new Module(filename, module);
  loaded.filename = filename; loaded.paths = module.paths;
  const mocks = { './authorizedFetch': { authorizedFetch: fetch }, './sessionReadScope': { sessionReadScope: () => 'scope' } };
  loaded.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return loaded.exports;
}
const api = load();
const error = (payload, fallback = 'queue_action_not_allowed', status = 400, requestId) => api.productionMapResponseError(status, payload, fallback,
  requestId === undefined ? undefined : new Headers({ 'x-request-id': requestId }));

// Source-derived expectations pinned to f119, not a new wire or Flutter recording.
for (const [code, message] of Object.entries(fixture.static_messages)) test(`worker errors retain source message: ${code}`, () => {
  const value = error({ error: `\u0085${code.toUpperCase()}\u0085` });
  assert.equal(value.code, code.toUpperCase()); assert.equal(value.message, message);
  assert.equal(String(value), message); assert.equal(value.statusCode, 400);
});

test('worker exceptions retain ordered apparatus choices, blockers, counts and header-first trace ID', () => {
  const payload = { error: 'order_delete_blocked', apparatus_options: [' A ', null, 7, ['a', true]],
    blockers: [{ message: ' First ' }, {}, false, { message: false }, { message: '\u0085Second\u0085' }],
    active_kadr_count: 7.9, scanned_kadr_count: -4.9, order_title: '\u0085Order\u0085', request_id: 'body', other: { retained: true } };
  const value = error(payload, 'queue_action_not_allowed', 409, 'header');
  assert.deepEqual(value.apparatusOptions, ['A', 'null', '7', '[a, true]']);
  assert.deepEqual(value.details, ['First', 'false', 'Second']);
  assert.equal(value.message, 'First\nfalse\nSecond');
  assert.equal(value.activeKadrCount, 7); assert.equal(value.scannedKadrCount, -4); assert.equal(value.orderTitle, 'Order');
  assert.equal(value.requestId, 'header'); assert.equal(value.diagnostics, payload);
  assert.equal(error({ request_id: 42 }).requestId, '42');
  assert.equal(error({ request_id: 'body' }, 'new', 400, '').requestId, '');
});

test('worker malformed diagnostic counts keep earlier fields without inventing merge counts', () => {
  const payload = { error: 'merge_input_frame_count_mismatch', active_kadr_count: '7', scanned_kadr_count: 9,
    order_title: ' Order ', request_id: 'body' };
  const first = error(payload); assert.equal(first.activeKadrCount, null); assert.equal(first.scannedKadrCount, null);
  assert.equal(first.orderTitle, 'Order'); assert.equal(first.requestId, 'body');
  assert.equal(first.message, 'Merge qilinmadi: scan qilingan WIPning kadr soni joriy rulon bilan bir xil emas');
  const second = error({ ...payload, active_kadr_count: 7.9, scanned_kadr_count: 9.9 });
  assert.equal(second.message, 'Merge qilinmadi: joriy rulon 7 kadr, scan qilingan WIP 9 kadr. Bir xil kadrli WIPni scan qiling');
});

test('worker width and assignment errors retain source diagnostic branches', () => {
  assert.equal(error({ error: 'raw_material_assignment_locked', order_title: ' Order 7 ', raw_material_status: 'in_use' }).message,
    'Bu homashyo “Order 7” buyurtmasida hozir ishlatilmoqda. Ulanishni uzib bo‘lmaydi');
  assert.equal(error({ error: 'raw_material_assignment_locked', raw_material_status: 'consumed' }).message,
    'Bu homashyo bu buyurtmada ishlatilgan. Ulanishni uzib bo‘lmaydi');
  assert.equal(error({ error: 'raw_material_already_assigned', order_title: ' Order 7 ' }).message,
    'Bu homashyo “Order 7” buyurtmasi uchun band qilingan');
  assert.equal(error({ error: 'raw_material_roll_size_mismatch', order_width_mm: 985, roll_width_mm: ' 970 ' }).message,
    'Mos emas: rulon eni 970 mm; talab qilinadigan minimum 985 mm.');
  assert.equal(error({ error: 'raw_material_roll_size_mismatch', order_width_mm: 985, minimum_width_mm: ' 9.6e2 ', maximum_width_mm: '1000.', roll_width_mm: '1001.24' }).message,
    'Mos emas: rulon eni 1001.2 mm; ruxsat etilgan oraliq 960 mm–1000 mm.');
  assert.equal(error({ error: 'raw_material_roll_size_mismatch', order_width_mm: '0xFF', roll_width_mm: 1 }).message,
    'Bu rulon bu buyurtma uchun mos emas');
});

test('worker unknown errors use the source endpoint operation, not a generic message', () => {
  const operations = { production_map_sequence: 'Orderlar ketma-ketligi saqlanmadi', wip_batches: 'WIP batchlar yuklanmadi',
    raw_material_start_requirements: 'Homashyo ish boshlash talablari yuklanmadi', raw_material_intake: 'Homashyo qabul qilinmadi',
    qolip_code_not_found: 'Qolip ma’lumotlari tekshirilmadi', paddons_list: 'Paddonlar yuklanmadi', production_map_move_batch: 'WIP batch ko‘chirilmagan' };
  for (const [fallback, operation] of Object.entries(operations)) for (const status of [400, 503]) {
    const advice = status >= 500 ? '. Serverda vaqtinchalik muammo yuz berdi. Keyinroq qayta urinib ko‘ring.' : '. Oynani yangilang va qayta urinib ko‘ring.';
    if (!Object.hasOwn(fixture.static_messages, fallback)) assert.equal(error({}, fallback, status).message, `${operation}${advice}`);
    for (const code of ['new_backend_code', '__proto__', 'constructor', 'toString']) {
      assert.equal(error({ error: code }, fallback, status).message, `${operation}. Server xato kodi: ${code} (HTTP ${status})${advice}`);
    }
  }
  assert.equal(error({ error: 'production_map_store_failed' }, 'production_map_sequence').message, 'Ish rejasi navbati serverdan yuklanmadi');
  assert.equal(error({ error: 'rezka_frame_groups_invalid', detail: ' Explain ' }).message, 'Explain');
});

test('worker command HTTP failures pass response headers into the structured exception', async () => {
  let calls = 0;
  const transport = load(async () => { calls++; return new Response(JSON.stringify({ error: 'raw_material_mismatch', request_id: 'body' }),
    { status: 409, headers: { 'x-request-id': 'header' } }); });
  await assert.rejects(transport.postWorkerApiRequest({}, '/fixture', {}, 'scope', true, 'raw_material_intake'), value => {
    assert.equal(value.message, 'Bu homashyo ish boshlash uchun mos emas'); assert.equal(value.requestId, 'header'); return true;
  });
  assert.equal(calls, 1);
});
test('local validation errors keep absent HTTP and request metadata null like MobileApiException', () => {
  const error = new (load().WorkerControlException)('apparatus_id_invalid', 'Canonical apparatus ID noto‘g‘ri');
  assert.equal(error.statusCode, null); assert.equal(error.requestId, null);
  assert.equal(String(error), error.message);
});
