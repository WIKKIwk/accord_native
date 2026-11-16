const assert = require('node:assert/strict');
const test = require('node:test');
const { load, strings, deferred, tick } = require('./adminUsersSupport.cjs');
const sync = load('shared/camera/synchronousGuard'), exception = load('shared/mobileApiException');
const originalFetch = global.fetch;
function fixture(t) {
  t.after(() => { global.fetch = originalFetch; }); let current = true, handler = async () => new Response('{}'), refresh = async () => true;
  const session = { baseUrl: 'https://server.example', token: 'token' }, requests = [];
  const transport = load('authorizedFetch', { './auth': { activeSessionToken: () => session.token, refreshSession: async () => refresh() } });
  const controls = load('workerControlsApi', { './authorizedFetch': transport, './sessionReadScope': {} });
  const request = load('admin/adminProductionRequest', { '../authorizedFetch': transport, '../shared/mobileApiException': exception, '../workerControlsApi': controls });
  const child = load('admin/adminWarehouseItemRollsApi', { '../authorizedFetch': transport, '../shared/camera/synchronousGuard': sync, '../workerProductionMapSaved': {}, '../workerControlsApi': controls,
    './adminProductionRequest': request, './dartJsonString': strings, './dartUri': {}, './warehouseStockApi': {} });
  const jobs = load('workerPrintJob', { './workerControlsApi': controls }), print = load('shared/printApi', { '../authorizedFetch': transport, './mobileApiException': exception, '../workerPrintJob': jobs });
  const api = load('admin/adminWarehouseRawQrApi', { '../authorizedFetch': transport, '../shared/mobileApiException': exception, '../shared/printApi': print, '../workerPrintJob': jobs, './adminWarehouseItemRollsApi': child, './dartJsonString': strings });
  global.fetch = async (url, init) => { requests.push({ url: new URL(url), init }); return handler(requests.at(-1)); };
  return { session, api, child, requests, guard: () => { if (!current) throw Error('original expired'); }, retire: () => { current = false; }, handler: value => { handler = value; }, refresh: value => { refresh = value; } };
}
const prepared = { reprint_id: ' raw ID ', stock: { barcode: ' 30AA ', source_receipt_id: ' Receipt ' }, print: { epc: '30AA' } };
test('scoped prepare/confirm preserve source two POST envelopes, response DTOs and exact error mapping', async t => {
  const f = fixture(t); f.handler(async () => new Response(JSON.stringify(prepared))); const result = await f.api.prepareAdminWarehouseRawQr(f.session, '\u0085 30AA \u0085', ' ORDER ', f.guard);
  assert.equal(result.reprint_id, ' raw ID '); assert.equal(result.stock.source_receipt_id, ' Receipt '); assert.deepEqual(JSON.parse(f.requests[0].init.body), { barcode: '30AA', order_id: 'ORDER' });
  await f.api.confirmAdminWarehouseRawQr(f.session, result.stock.barcode, result.reprint_id, f.guard); assert.deepEqual(JSON.parse(f.requests[1].init.body), { barcode: '30AA', reprint_id: 'raw ID' });
  assert.equal(f.requests[0].init.redirect, 'manual'); f.handler(async () => new Response(JSON.stringify({ error: ' forbidden ' }), { status: 403 }));
  await assert.rejects(f.api.prepareAdminWarehouseRawQr(f.session, '30AA', '', f.guard), error => error.code === 'forbidden' && error.message === 'Bu homashyo sizga biriktirilgan omborda emas');
  f.handler(async () => new Response(JSON.stringify({ error: 'constructor' }), { status: 400 })); await assert.rejects(f.api.prepareAdminWarehouseRawQr(f.session, '30AA', '', f.guard), error => error.message === 'QR kodini qayta chop etib bo‘lmadi');
});
for (const action of ['prepare', 'confirm']) test(`guarded${action} never redirects and cannot retry after original authority changes`, async t => {
  const f = fixture(t), run = () => action === 'prepare' ? f.api.prepareAdminWarehouseRawQr(f.session, '30AA', '', f.guard) : f.api.confirmAdminWarehouseRawQr(f.session, '30AA', 'id', f.guard);
  f.handler(async () => new Response('{}', { status: 302, headers: { location: '/v1/mobile/next' } })); await assert.rejects(run()); assert.equal(f.requests.length, 1);
  f.handler(async () => new Response('{}', { status: 401 })); f.refresh(async () => { f.retire(); f.session.token = 'new'; return true; }); await assert.rejects(run(), /expired/); assert.equal(f.requests.length, 2);
});
for (const status of [200, 400]) for (const reject of [false, true]) test(`prepare ${status} body ${reject ? 'rejection' : 'settlement'} cannot return a retired result/error`, async t => {
  const f = fixture(t), body = deferred(); f.handler(async () => ({ status, json: () => body.promise })); const pending = f.api.prepareAdminWarehouseRawQr(f.session, '30AA', '', f.guard); await tick(); f.retire(); if (reject) body.reject(Error('body')); else body.resolve(status === 200 ? prepared : { error: 'forbidden' }); await assert.rejects(pending, /expired/); assert.equal(f.requests.length, 1);
});
test('native USB detection is separated from the physical write by the original guard, and GoDEX never dispatches', async t => {
  const f = fixture(t), detected = deferred(), calls = []; let current = true, kind = 'zebra';
  const models = load('printing/printModels', { '../workerControlsApi': { isCanonicalApparatusId: () => true } }), zebra = load('printing/zebraRpsRenderer', { './printModels': models });
  const { printAdminWarehouseRawQr } = load('admin/adminWarehouseRawQrPrint', { '../printing/nativePrinter': { NativeUsbPrinter: { detectPrinter: async () => { calls.push('detect'); await detected.promise; return new models.UsbPrinterProfile(kind, 'Printer', 1, 2, '', ''); }, printRaw: async () => { calls.push('write'); return { ok: true }; } } },
    '../printing/printModels': models, '../printing/zebraRpsRenderer': zebra, './adminWarehouseItemRollsApi': f.child });
  const guard = () => { if (!current) throw Error('retired'); }, job = { epc: '30AA30AA', item_code: 'C', item_name: 'Name', warehouse: 'A', printer: 'zebra', print_mode: 'rfid', label_kind: 'material_product', gross_qty: 1, unit: 'kg', print_count: 1 };
  const pending = printAdminWarehouseRawQr(job, guard); current = false; detected.resolve(); await assert.rejects(pending, /retired|expired/); assert.deepEqual(calls, ['detect']);
  current = true; kind = 'godex'; await assert.rejects(printAdminWarehouseRawQr(job, guard), /Zebra/); assert.deepEqual(calls, ['detect', 'detect']);
  kind = 'zebra'; assert.equal(await printAdminWarehouseRawQr(job, guard), true); assert.deepEqual(calls, ['detect', 'detect', 'detect', 'write']);
});
test('prepare parser side effects cannot return a result after the original authority expires', async t => {
  const f = fixture(t), value = { ...prepared, stock: { ...prepared.stock } }; Object.defineProperty(value.stock, 'source_receipt_id', { get() { f.retire(); return 'other'; } });
  f.handler(async () => ({ status: 200, json: async () => value })); await assert.rejects(f.api.prepareAdminWarehouseRawQr(f.session, '30AA', '', f.guard), /expired/); assert.equal(f.requests.length, 1);
});
