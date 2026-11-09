const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
function load(file, overrides = {}) {
  const filename = path.resolve(__dirname, '../src', file + '.ts');
  const mod = new Module(filename, module); mod.filename = filename; mod.paths = module.paths;
  mod.require = name => Object.hasOwn(overrides, name) ? overrides[name] : require(name);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return mod.exports;
}
const exception = load('shared/mobileApiException');
const parser = load('shared/printApi', { '../authorizedFetch': {}, './mobileApiException': exception, '../workerPrintJob': {} });
const dart = load('admin/dartJsonString');
function fixture() {
  const requests = []; let status = 200, payload = [];
  const api = load('admin/rawMaterialStockApi', { '../authorizedFetch': { authorizedFetch: async (session, url, init = {}) => {
    requests.push({ session, url, init }); return new Response(JSON.stringify(payload), { status });
  } }, '../shared/mobileApiException': exception, '../shared/printApi': parser, './dartJsonString': dart });
  return { ...api, requests, setResponse(value, code = 200) { payload = value; status = code; } };
}
test('raw stock list preserves query and reuses existing print parser', async () => {
  const api = fixture(); api.setResponse([{ barcode: 'A', qty: 12.5, width_mm: 300 }]);
  assert.deepEqual(await api.adminRawMaterialStock({}, { warehouse: ' A B ', limit: 10 }),
    [parser.rawMaterialStockFromJson({ barcode: 'A', qty: 12.5, width_mm: 300 })]);
  assert.equal(api.requests[0].url, '/v1/mobile/admin/raw-material-stock?warehouse=A+B&limit=10');
  await api.adminRawMaterialStock({}, { warehouse: '\u0085 ', limit: 0 });
  assert.equal(api.requests[1].url, '/v1/mobile/admin/raw-material-stock');
  api.setResponse({}, 500); await assert.rejects(api.adminRawMaterialStock({}), /Admin raw material stock failed/);
});
test('stock update validates IDs and finite positive quantity, then preserves the response model', async () => {
  const api = fixture();
  for (const [barcode, item, qty] of [[' ', 'A', 1], ['A', '\u0085', 1], ['A', 'B', 0], ['A', 'B', -1], ['A', 'B', Infinity]]) {
    await assert.rejects(api.adminUpdateRawMaterialStock({}, barcode, item, qty), e => e.code === 'raw_material_stock_update_invalid');
  }
  assert.equal(api.requests.length, 0);
  api.setResponse({ barcode: 'B', item_code: 'A', qty: 10.5, source_receipt_id: 'R' });
  const result = await api.adminUpdateRawMaterialStock({}, ' B ', ' A ', 10.5);
  assert.equal(result.barcode, 'B'); assert.equal(result.source_receipt_id, 'R');
  assert.equal(api.requests[0].init.method, 'PUT');
  assert.deepEqual(JSON.parse(api.requests[0].init.body), { barcode: 'B', item_code: 'A', qty: 10.5 });
  api.setResponse({ error: 'raw_material_stock_locked' }, 409);
  await assert.rejects(api.adminUpdateRawMaterialStock({}, 'B', 'A', 1), e => e.code === 'raw_material_stock_locked' &&
    e.message === 'Bu homashyo zakazga to‘liq yoki qisman band qilingan. Uni tahrirlab bo‘lmaydi' && e.statusCode === 409);
});
test('stock delete sends a barcode and reports its distinct error messages', async () => {
  const api = fixture(); await assert.rejects(api.adminDeleteRawMaterialStock({}, ' '), e => e.code === 'raw_material_stock_delete_invalid');
  api.setResponse({}); await api.adminDeleteRawMaterialStock({}, ' B ');
  assert.equal(api.requests[0].init.method, 'DELETE'); assert.deepEqual(JSON.parse(api.requests[0].init.body), { barcode: 'B' });
  api.setResponse({ error: 'raw_material_stock_locked' }, 409);
  await assert.rejects(api.adminDeleteRawMaterialStock({}, 'B'), e => e.message === 'Zakazga biriktirilgan, transferdagi yoki State’dagi homashyoni o‘chirib bo‘lmaydi');
  api.setResponse({ error: 'constructor' }, 409);
  await assert.rejects(api.adminDeleteRawMaterialStock({}, 'B'), e => e.code === 'constructor' && e.message === 'Homashyoni o‘chirib bo‘lmadi');
});
// @v2-test test/admin_warehouses_screen_test.dart, independently passed in the f119 oracle.
test('raw stock list replays the f119 warehouse widget test', async () => {
  const { contractFetch, recordedSession } = require('./support/contractFetch.cjs');
  const stem = 'f11910bb/admin_warehouses_screen_test', name = 'admin warehouse detailed stock and QR reprint: available';
  const replay = contractFetch(stem, name, { onlyPaths: ['/v1/mobile/admin/raw-material-stock'] }), session = recordedSession(stem, name);
  const api = load('admin/rawMaterialStockApi', { '../authorizedFetch': { authorizedFetch: (s, p, init = {}) =>
    replay(new URL(p, s.baseUrl), { ...init, headers: { ...init.headers, Authorization: `Bearer ${s.token}` } }) },
    '../shared/mobileApiException': exception, '../shared/printApi': parser, './dartJsonString': dart });
  const rows = await api.adminRawMaterialStock(session, { warehouse: 'Ulug‘bek ombori', limit: 500 });
  assert.equal(rows.length, 1); assert.equal(rows[0].barcode, '30AA'); assert.equal(rows[0].qty, 100);
  assert.equal(rows[0].source_receipt_id, 'GSR-30AA'); replay.assertDone();
});
// Source-derived probe authored locally and run independently against f119, not an upstream V2 test.
for (const name of ['raw stock update sends normalized fields and reads identity', 'raw stock deletion reports locked server response']) {
  test(`raw stock mutation replays f119: ${name}`, async () => {
    const { contractFetch, recordedSession } = require('./support/contractFetch.cjs');
    const stem = 'f11910bb/admin_raw_stock_probe_test', replay = contractFetch(stem, name), session = recordedSession(stem, name);
    const api = load('admin/rawMaterialStockApi', { '../authorizedFetch': { authorizedFetch: (s, p, init = {}) =>
      replay(new URL(p, s.baseUrl), { ...init, headers: { ...init.headers, Authorization: `Bearer ${s.token}` } }) },
      '../shared/mobileApiException': exception, '../shared/printApi': parser, './dartJsonString': dart });
    if (name.startsWith('raw stock update')) {
      const row = await api.adminUpdateRawMaterialStock(session, ' B ', ' A ', 10.5);
      assert.equal(row.barcode, 'B'); assert.equal(row.item_code, 'A'); assert.equal(row.qty, 10.5); assert.equal(row.source_receipt_id, 'R');
    } else {
      await assert.rejects(api.adminDeleteRawMaterialStock(session, ' B '), e => e.code === 'raw_material_stock_locked' &&
        e.message === 'Zakazga biriktirilgan, transferdagi yoki State’dagi homashyoni o‘chirib bo‘lmaydi');
    }
    replay.assertDone();
  });
}
