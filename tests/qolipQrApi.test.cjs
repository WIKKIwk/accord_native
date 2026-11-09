const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

function load(relative, dependencies = {}) {
  const filename = path.resolve(__dirname, '../src', relative), loaded = new Module(filename, module);
  loaded.require = name => name in dependencies ? dependencies[name] : require(name);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ESNext },
  }).outputText, filename);
  return loaded.exports;
}
const { MobileApiException } = load('shared/mobileApiException.ts');
const common = load('qolip/qolipApiCommon.ts', { '../shared/mobileApiException': { MobileApiException } });
const productParser = load('qolipCatalogApi.ts', { './auth': {}, './authorizedFetch': {}, './workerControlsApi': {} });
const locationApi = load('qolip/qolipLocationsApi.ts', { '../auth': {}, '../authorizedFetch': {},
  '../shared/mobileApiException': { MobileApiException }, './qolipApiCommon': common });
const json = (value, status = 200) => new Response(JSON.stringify(value), { status });
const cell = { id: 'cell-1', block: 'A blok', warehouse: 'Qolip ombor', row_letter: 'A', column_number: 3,
  location_label: 'A3', qr_payload: 'CELL-QR-A3' };
const product = { code: 'ITEM-001', name: 'Kross qolip', item_group: 'Qolip', qolip_code: 'QOLIP-0007', size: 42 };
const location = { id: 'l1', block: 'A blok', warehouse: 'Qolip ombor', item_code: 'ITEM-001', item_name: 'Kross qolip',
  qolip_code: 'QOLIP-0007', size: 42, quantity: 1, row_letter: 'C', column_number: 4, location_label: 'C4' };
function harness(response, products = [], transport) {
  const calls = [], productCalls = [], session = { token: 'token' };
  const api = load('qolip/qolipQrApi.ts', {
    '../auth': { activeSessionToken: value => value.token || null },
    '../authorizedFetch': { authorizedFetch: async (value, target, ...args) => {
      calls.push({ session: value, target });
      if (transport) return transport(value, target, ...args);
      return typeof response === 'function' ? response(calls.length, target) : response;
    } },
    '../qolipCatalogApi': productParser,
    '../qolipProductsApi': { qolipProducts: async (value, input) => { productCalls.push({ session: value, input }); return products; } },
    '../shared/mobileApiException': { MobileApiException }, './qolipApiCommon': common,
    './qolipLocationsApi': locationApi,
  });
  return { api, calls, productCalls, session };
}

// Source assertions mirror the separately run HttpOverrides cases in test/qolip_cell_qr_flow_test.dart.
test('cell QR lookup trims and resolves the selected cell', async () => {
  const { api, calls, session } = harness(json({ cell_qr: cell }));
  assert.deepEqual(await api.qolipCellQrLookup(session, ' CELL-QR-A3 '), cell);
  assert.equal(calls[0].target, '/v1/mobile/qolip/cell-qr?qr=CELL-QR-A3');
});

test('universal scan distinguishes cell and mold and retains a location', async () => {
  const { api, calls, session } = harness(index => index === 1
    ? json({ kind: ' cell ', cell_qr: cell }) : json({ kind: 'qolip', product, location }));
  const first = await api.qolipScanQr(session, 'CELL-QR-A3');
  assert.equal(first.kind, 'cell');
  assert.equal(first.cell_qr.location_label, 'A3');
  const second = await api.qolipScanQr(session, ' QOLIP-0007 ');
  assert.equal(second.kind, 'qolip');
  assert.equal(second.product.qolip_code, 'QOLIP-0007');
  assert.equal(second.location.location_label, 'C4');
  assert.equal(calls[1].target, '/v1/mobile/qolip/scan?qr=QOLIP-0007');
  assert.equal(api.qolipScanResultFromJson({ kind: 'unknown', product, location: 'bad' }).location, null);
});

test('product lookup reuses Qolip product search and matches the exact normalized code', async () => {
  const products = [productParser.qolipProductFromJson({ ...product, qolip_code: 'OTHER' }), productParser.qolipProductFromJson(product)];
  const { api, productCalls, session } = harness(json({}), products);
  assert.equal((await api.qolipProductByQr(session, ' qolip-0007 ')).name, 'Kross qolip');
  assert.deepEqual(productCalls[0].input, { query: 'qolip-0007', limit: 20, with_qolip_only: true });
  await assert.rejects(api.qolipProductByQr(session, 'MISSING'), error => error.code === 'qolip_code_not_found');
});

test('blank QR input fails before requests', async () => {
  const { api, calls, productCalls, session } = harness(json({}));
  await assert.rejects(api.qolipCellQrLookup(session, ' \u0085 '), error => error.code === 'qolip_cell_qr_required');
  await assert.rejects(api.qolipScanQr(session, ''), error => error.code === 'qolip_qr_required');
  await assert.rejects(api.qolipProductByQr(session, ''), error => error.code === 'qolip_code_required');
  assert.equal(calls.length + productCalls.length, 0);
});

test('cell QR server error mapping retains code, status and explicit message', async () => {
  for (const [body, code, message] of [
    [{ error: 'cell_qr_not_found' }, 'cell_qr_not_found', 'Bu QR yachayka uchun topilmadi.'],
    [{ code: 'qr_required' }, 'qr_required', 'Yachayka QR bo‘sh.'],
    [{ error: 'cell_qr_not_found', message: ' Maxsus ' }, 'cell_qr_not_found', 'Maxsus'],
  ]) {
    const { api, session } = harness(json(body, 404));
    await assert.rejects(api.qolipCellQrLookup(session, 'QR'), error => error instanceof MobileApiException &&
      error.code === code && error.statusCode === 404 && error.message === message);
  }
  const fallback = harness(new Response('not json', { status: 500 }));
  await assert.rejects(fallback.api.qolipCellQrLookup(fallback.session, 'QR'), error =>
    error.code === 'qolip_cell_qr_lookup_failed' && error.message === 'Yachayka QR tekshirishda xatolik.');
});

test('malformed scan payloads fail and test mode cannot reach a backend', async () => {
  const { api, calls, productCalls, session } = harness(json({}));
  assert.throws(() => api.qolipScanResultFromJson({ kind: 'cell' }));
  assert.throws(() => api.qolipScanResultFromJson({ kind: 'qolip' }));
  session.token = 'test-mode-token';
  await assert.rejects(api.qolipCellQrLookup(session, 'QR'), /test mode is not yet ported/);
  await assert.rejects(api.qolipProductByQr(session, 'QR'), /test mode is not yet ported/);
  assert.equal(calls.length + productCalls.length, 0);
});

test('scanner cell lookup forwards its original lifetime to guarded read dispatch without changing the V2 query', async () => {
  let sent = 0; const guard = () => true;
  const h = harness(null, [], async (account, target, init, beforeSend, timeout, options) => {
    sent++; assert.equal(account, h.session); assert.equal(target, '/v1/mobile/qolip/cell-qr?qr=CELL+QR');
    assert.deepEqual(init, {}); assert.equal(timeout, 10000); assert.equal(options.readWitness, guard);
    beforeSend(); return json({ cell_qr: cell });
  });
  assert.equal((await h.api.qolipCellQrLookup(h.session, ' CELL QR ', guard)).id, 'cell-1'); assert.equal(sent, 1);
});
test('retired and asynchronous scanner guards fail before the first transport call', async () => {
  const h = harness(json({ cell_qr: cell }));
  for (const guard of [() => false, async () => true, null, () => { throw Error('retired'); }]) {
    await assert.rejects(h.api.qolipCellQrLookup(h.session, 'QR', guard));
  }
  assert.equal(h.calls.length, 0);
});
for (const status of [200, 404]) test(`a stale ${status} body cannot publish a cell or its source error`, async () => {
  let current = true;
  const h = harness({ status, json: async () => { current = false; return status === 200 ? { cell_qr: cell } : { error: 'cell_qr_not_found' }; } });
  await assert.rejects(h.api.qolipCellQrLookup(h.session, 'QR', () => current), /qolip_read_expired/);
});
test('each opt-in dispatch checks the original lifetime and the current demo token', async () => {
  let current = true;
  const h = harness(null, [], async (_account, _target, _init, beforeSend) => {
    beforeSend(); current = false; assert.throws(beforeSend, /qolip_read_expired/); current = true;
    h.session.token = 'test-mode-token'; assert.throws(beforeSend, /test mode/);
    throw Error('stopped before a simulated retry send');
  });
  await assert.rejects(h.api.qolipCellQrLookup(h.session, 'QR', () => current), /stopped before/);
});
