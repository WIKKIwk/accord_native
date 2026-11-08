const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
function load(name, mocks = {}) {
  const filename = path.resolve(__dirname, `../src/${name}.ts`), loaded = new Module(filename, module);
  loaded.filename = filename; loaded.paths = module.paths;
  loaded.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return loaded.exports;
}
const errors = load('shared/mobileApiException');
function setup(fetch) {
  const controls = load('workerControlsApi', { './authorizedFetch': { authorizedFetch: fetch }, './sessionReadScope': { sessionReadScope: () => '' } });
  const dart = load('shared/dartApparatus', { '../workerControlsApi': controls });
  const mapper = load('material/materialHistoryErrors', { '../shared/dartApparatus': dart, '../shared/mobileApiException': errors,
    './materialHistoryErrorMessages': load('material/materialHistoryErrorMessages') });
  const api = load('material/materialHistoryApi', { '../authorizedFetch': { authorizedFetch: fetch }, '../shared/mobileApiException': errors,
    '../shared/dartApparatus': dart, '../workerControlsApi': controls, './materialHistoryErrors': mapper });
  const presentation = load('material/materialHistoryPresentation', { '../shared/mobileApiException': errors,
    '../shared/dartApparatus': dart, '../workerControlsApi': controls });
  return { ...api, ...presentation };
}
const station = 'apparatus:default:bosma_7';

test('history requests the V2 limit and filters, parses typed fields and rejects bad apparatus and quantities', async () => {
  const calls = [], api = setup(async (_session, url, init) => { calls.push({ url, init }); return { status: 200, json: async () => [{
    event_type: 'receipt_posted', apparatus: ` ${station} `, qty_delta: 12.5, occurred_at_unix: 10.9, payload_json: { a: 1 },
  }] }; });
  const rows = await api.adminRawMaterialHistory({}, { warehouse: ' A B ', eventType: ' receipt_posted ', limit: 100 });
  assert.deepEqual(Object.fromEntries(new URL(calls[0].url, 'https://example.test').searchParams), { warehouse: 'A B', event_type: 'receipt_posted', limit: '100' });
  assert.equal(calls[0].init.method, undefined); assert.equal(rows[0].apparatus, station); assert.equal(rows[0].occurred_at_unix, 10);
  assert.equal(rows[0].item_code, ''); assert.deepEqual(rows[0].payload_json, { a: 1 });
  assert.throws(() => api.rawMaterialEvent({ apparatus: 'Bosma' }), error => error.code === 'apparatus_id_invalid');
  assert.throws(() => api.rawMaterialEvent({ qty_delta: '12.5' }), TypeError);
  await api.adminRawMaterialHistory({}, { limit: 0 });
  assert.equal(new URL(calls[1].url, 'https://example.test').search, '');
});

test('history preserves the source-specific 404 and generic network messages', async () => {
  const api = setup(async () => ({ status: 404 }));
  await assert.rejects(api.adminRawMaterialHistory({}), error => {
    assert.equal(error.code, 'raw_material_history_not_found'); assert.equal(error.statusCode, 404);
    assert.equal(api.materialHistoryErrorMessage(error), 'Backend hali yangi history endpoint bilan ko‘tarilmagan (404)'); return true;
  });
  assert.equal(api.materialHistoryErrorMessage(new Error('network')), 'Serverdan ma’lumot olinmadi');
});

// @v2-test test/admin_production_map_material_delivery_test_part.dart
// The source test is a part of admin_production_map_test_screen_test.dart.
test('material delivery retains deliverer, receiving operator and safe apparatus display', () => {
  const api = setup(() => {}), event = api.rawMaterialEvent({ event_type: 'delivery_received', item_name: ' Rulon ',
    apparatus: station, actor_display_name: 'Qabul qilgan operator', payload_json: {
      delivered_by: { ref: 'mover-1', name: 'Olib kelgan Ali' }, received_by: { ref: 'worker-1', name: 'Qabul qilgan operator' },
    } });
  assert.equal(event.payload_json.received_by.ref, 'worker-1');
  assert.equal(api.materialHistoryTitle(event), 'Rulon apparat oldiga yetkazildi');
  assert.equal(api.materialHistorySubtitle(event, []), '');
  const details = api.materialHistoryDetails(event, [{ id: station, name: ' Bosma ' }]);
  assert.deepEqual(details, [
    { label: 'Harakat turi', value: 'Apparat oldiga yetkazildi va qabul qilindi' }, { label: 'Mahsulot', value: 'Rulon' },
    { label: 'Apparat', value: 'Bosma' }, { label: 'Olib kelgan', value: 'Olib kelgan Ali' },
    { label: 'Qabul qilgan', value: 'Qabul qilgan operator' },
  ]);
});

test('history renders signed quantity, status transitions, unknown labels, timestamps and concealed refs', () => {
  const api = setup(() => {}), e = api.rawMaterialEvent({ event_type: 'receipt_posted', item_code: 'RM', qty_delta: -12.5, uom: ' kg ',
    stock_status_before: 'available', stock_status_after: 'reserved', actor_display_name: 'worker:id', actor_ref: 'worker:id',
    owner_ref: 'Short', owner_role: 'OTHER', warehouse: ' Ombor ', order_id: ' 10 ', barcode: ' QR ' });
  assert.equal(api.materialHistoryTitle(e), 'RM kirim 12.500  kg ');
  assert.equal(api.materialHistorySubtitle(e, []), 'Ombor • Zakaz 10 • QR');
  const details = api.materialHistoryDetails(e, []);
  assert.ok(details.some(x => x.label === 'Miqdor' && x.value === '-12.500 kg'));
  assert.ok(details.some(x => x.label === 'Holati' && x.value === 'Mavjud → Band qilingan'));
  assert.ok(!details.some(x => x.label === 'Bajargan'));
  assert.ok(details.some(x => x.label === 'Egasi' && x.value === 'Short'));
  assert.ok(details.some(x => x.label === 'Egasi roli' && x.value === 'other'));
  const date = new Date(2026, 10, 8, 9, 4), seconds = Math.floor(date.getTime() / 1000);
  assert.equal(api.materialHistoryTime(seconds, date), '09:04');
  assert.equal(api.materialHistoryTime(seconds, new Date(2026, 10, 9)), '08.11 09:04');
  assert.equal(api.materialHistoryDateTime(seconds), '08.11.2026 09:04');
});

test('history filters, safe labels and detail rows use Dart whitespace at both edges', async () => {
  const calls = [], api = setup(async (_session, url) => { calls.push(url); return { status: 200, json: async () => [] }; });
  const whitespace = require('./contracts/f11910bb/material_unicode_trim.json').trim;
  for (const point of whitespace) {
    const w = String.fromCodePoint(point), wrapped = value => `${w}${value}${w}`;
    const event = api.rawMaterialEvent({ event_type: 'receipt_posted', item_name: wrapped('Rulon'), warehouse: wrapped('Ombor'),
      order_id: wrapped('42'), barcode: wrapped('QR'), apparatus: wrapped(station), actor_display_name: wrapped('Ali'),
      stock_status_before: wrapped('available'), stock_status_after: wrapped('reserved') });
    assert.equal(event.apparatus, station); assert.equal(api.materialHistoryTitle(event), 'Rulon kirim');
    assert.equal(api.materialHistorySubtitle(event, [{ id: wrapped(station), name: wrapped('Bosma') }]), 'Ombor • Zakaz 42 • Bosma • QR');
    const details = api.materialHistoryDetails(event, []);
    assert.ok(details.some(item => item.label === 'Bajargan' && item.value === 'Ali'));
    assert.ok(details.some(item => item.label === 'Holati' && item.value === 'Mavjud → Band qilingan'));
  }
  await api.adminRawMaterialHistory({}, { warehouse: '\u0085Ombor\u0085', eventType: '\u0085receipt_posted\u0085' });
  assert.deepEqual(Object.fromEntries(new URL(calls[0], 'https://example.test').searchParams),
    { warehouse: 'Ombor', event_type: 'receipt_posted', limit: '50' });
});

test('unverified non-ASCII history apparatus IDs fail closed rather than using JS-only canonical rules', () => {
  const api = setup(() => {});
  assert.throws(() => api.rawMaterialEvent({ apparatus: 'apparatus:default:\u037f' }), error => error.code === 'apparatus_id_invalid');
});
