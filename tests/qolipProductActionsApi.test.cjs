const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const { contractFetch, recordedSession } = require('./support/contractFetch.cjs');

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
const json = (value, status = 200) => new Response(JSON.stringify(value), { status });
const rawProduct = (overrides = {}) => ({ code: 'ITEM', name: 'Product', item_group: 'Finished', warehouse: ' Product W ',
  qolip_code: 'Q-1', size: 42, color: 'Red', has_qolip_spec: true, ...overrides });
function harness(response, options = {}) {
  const calls = [], applied = [], session = { token: 'token', profile: { ref: 'clerk', role: 'qolipchi' }, baseUrl: 'https://example.test' };
  const api = load('qolip/qolipProductActionsApi.ts', {
    '../auth': { activeSessionToken: value => value.token || null },
    '../sessionReadScope': { sessionReadScope: value => JSON.stringify([value.baseUrl, value.profile]) },
    '../qolipCatalogApi': productParser,
    '../shared/mobileApiException': { MobileApiException },
    '../shared/qolipCatalogRuntime': { qolipCatalogRuntimeFor: () => ({ applyResponse: (data, scope) => applied.push({ data, scope }) }) },
    './qolipApiCommon': common,
    '../authorizedFetch': { authorizedFetch: async (value, target, init = {}) => {
      calls.push({ session: value, target, init });
      const result = typeof response === 'function' ? response(calls.length, init) : response;
      options.afterResponse?.(session);
      return result;
    } },
  });
  return { api, calls, applied, session };
}
const product = productParser.qolipProductFromJson(rawProduct());

function fixtureHarness(stem, name) {
  const replay = contractFetch(stem, name), recorded = recordedSession(stem, name);
  const session = { ...recorded, profile: { ref: 'clerk', role: 'qolipchi' } };
  const api = load('qolip/qolipProductActionsApi.ts', {
    '../auth': { activeSessionToken: value => value.token || null },
    '../sessionReadScope': { sessionReadScope: value => JSON.stringify([value.baseUrl, value.profile]) },
    '../qolipCatalogApi': productParser, '../shared/mobileApiException': { MobileApiException },
    '../shared/qolipCatalogRuntime': { qolipCatalogRuntimeFor: () => ({ applyResponse: () => {} }) },
    './qolipApiCommon': common,
    '../authorizedFetch': { authorizedFetch: (value, target, init = {}) => {
      const headers = new Headers(init.headers);
      headers.set('Authorization', `Bearer ${value.token}`);
      return replay(new URL(target, value.baseUrl), { ...init, headers });
    } },
  });
  return { api, replay, session };
}

// @v2-test test/qolip_warehouse_ownership_test.dart
test('f119 single and batch receipts replay the persisted warehouse contract', async () => {
  const stem = 'f11910bb/qolip_warehouse_ownership_test';
  const metadata = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'contracts', `${stem}.json`), 'utf8'));
  assert.equal(metadata.baseline, 'f11910bb2c8c7081ce26770e69811b03fd0739ed');
  const { api, replay, session } = fixtureHarness(stem, 'single and batch receipts send and restore persisted warehouse');
  const initial = productParser.qolipProductFromJson({ code: 'ITEM', name: 'Product', item_group: 'Tayyor mahsulot' });
  const first = await api.qolipSaveProductSpec(session, { product: initial, qolipCode: 'Q-1', size: 40, warehouse: 'Flexo ombori' });
  assert.equal(first.warehouse, 'Flexo ombori');
  await api.qolipSaveProductSpec(session, { product: first, qolipCode: 'Q-RENAMED', size: 41, previousQolipCode: 'Q-1' });
  const batch = await api.qolipSaveProductSpecsBatch(session, { product: initial, warehouse: 'Flexo ombori',
    specs: [{ qolipCode: 'Q-2', size: 40 }] });
  assert.equal(batch[0].warehouse, 'Flexo ombori');
  replay.assertDone();
});

// @v2-test test/qolip_product_transfer_test.dart
test('f119 transfer replay rejects an incomplete response', async () => {
  const stem = 'f11910bb/qolip_product_transfer_test';
  const metadata = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'contracts', `${stem}.json`), 'utf8'));
  assert.equal(metadata.baseline, 'f11910bb2c8c7081ce26770e69811b03fd0739ed');
  const { api, replay, session } = fixtureHarness(stem, 'API sends stable QR identities and rejects an incomplete transfer response');
  await assert.rejects(api.qolipTransferProducts(session, { requestId: 'same-request', fromItemCode: 'SOURCE',
    toItemCode: 'TARGET', qolipCodes: ['QR-1', 'QR-2'] }), error =>
    error instanceof MobileApiException && error.code === 'qolip_product_transfer_failed');
  replay.assertDone();
});

test('single spec preserves selected warehouse, previous code and exact V2 body', async () => {
  const { api, calls, applied, session } = harness(json({ product: rawProduct({ warehouse: 'Flexo ombori' }) }));
  const saved = await api.qolipSaveProductSpec(session, { product, warehouse: ' Flexo ombori ', qolipCode: ' Q-1 ',
    size: 40, qolipColor: ' Red ', previousQolipCode: ' OLD ' });
  assert.equal(saved.warehouse, 'Flexo ombori');
  assert.equal(calls[0].target, '/v1/mobile/qolip/product-specs');
  assert.equal(calls[0].init.method, 'POST');
  assert.deepEqual(JSON.parse(calls[0].init.body), { item_code: 'ITEM', item_name: 'Product', item_group: 'Finished',
    qolip_code: 'Q-1', warehouse: 'Flexo ombori', color: 'Red', previous_qolip_code: 'OLD', size: 40 });
  assert.equal(applied.length, 1);
});

test('single spec falls back to the product warehouse without trimming it', async () => {
  const { api, calls, session } = harness(json({ product: rawProduct() }));
  await api.qolipSaveProductSpec(session, { product, warehouse: ' ', qolipCode: 'Q-1', size: 42, previousQolipCode: ' ' });
  assert.deepEqual(JSON.parse(calls[0].init.body), { item_code: 'ITEM', item_name: 'Product', item_group: 'Finished',
    qolip_code: 'Q-1', warehouse: ' Product W ', color: '', size: 42 });
});

test('batch requires a selection and sends its own warehouse without product fallback', async () => {
  const { api, calls, applied, session } = harness(() => json({ products: [rawProduct()] }));
  await assert.rejects(api.qolipSaveProductSpecsBatch(session, { product, specs: [] }), error =>
    error instanceof MobileApiException && error.code === 'qolip_code_required');
  assert.equal(calls.length, 0);
  assert.equal((await api.qolipSaveProductSpecsBatch(session, { product, specs: [{ qolipCode: ' Q-1 ', size: 42 }] })).length, 1);
  assert.deepEqual(JSON.parse(calls[0].init.body), { specs: [{ item_code: 'ITEM', item_name: 'Product', item_group: 'Finished',
    qolip_code: 'Q-1', warehouse: '', color: '', size: 42 }] });
  assert.equal(applied.length, 1);
});

test('delete filters blanks, preserves case-sensitive distinct codes and applies catalog delta', async () => {
  const { api, calls, applied, session } = harness(json({ deleted_count: 2.9 }));
  assert.equal(await api.qolipDeleteProductSpecs(session, [' ', '\u0085']), 0);
  assert.equal(calls.length, 0);
  assert.equal(await api.qolipDeleteProductSpecs(session, [' Q-1 ', 'Q-1', 'q-1', '']), 2);
  assert.equal(calls[0].init.method, 'DELETE');
  assert.deepEqual(JSON.parse(calls[0].init.body), { qolip_codes: ['Q-1', 'q-1'] });
  assert.equal(applied.length, 1);
});

test('transfer is limited to qolipchi, normalizes identities and rejects partial server results', async () => {
  const partial = harness(json({ specs: [{ item_code: 'TARGET', item_name: 'Product', qolip_code: 'QR-1', size: 42 }] }));
  const input = { requestId: 'same-request', fromItemCode: ' SOURCE ', toItemCode: ' TARGET ', qolipCodes: ['QR-2', ' QR-1 ', 'qr-1'] };
  partial.session.profile.role = 'admin';
  await assert.rejects(partial.api.qolipTransferProducts(partial.session, input), error => error.code === 'forbidden');
  assert.equal(partial.calls.length, 0);
  partial.session.profile.role = 'qolipchi';
  await assert.rejects(partial.api.qolipTransferProducts(partial.session, input), error =>
    error.code === 'qolip_product_transfer_failed' && error.message === 'Incomplete transfer response');
  assert.deepEqual(JSON.parse(partial.calls[0].init.body), { request_id: 'same-request', from_item_code: 'SOURCE',
    to_item_code: 'TARGET', qolip_codes: ['qr-1', 'qr-2'] });
  assert.equal(partial.applied.length, 0);
});

test('transfer follows V2 set-based validation even when returned rows repeat a selected code', async () => {
  const spec = { item_code: 'TARGET', item_name: 'Product', qolip_code: 'QR-1', size: 42 };
  const { api, session, applied } = harness(json({ specs: [spec, spec] }));
  const rows = await api.qolipTransferProducts(session, { requestId: 'id', fromItemCode: 'SOURCE',
    toItemCode: 'TARGET', qolipCodes: ['QR-1'] });
  assert.equal(rows.length, 2);
  assert.equal(applied.length, 1);
});

test('scope changes do not apply a stale catalog delta', async () => {
  const { api, session, applied } = harness(json({ product: rawProduct() }), { afterResponse: value => { value.profile.ref = 'other'; } });
  await api.qolipSaveProductSpec(session, { product, qolipCode: 'Q-1', size: 42 });
  assert.equal(applied.length, 0);
});

test('test mode cannot send product actions to a backend', async () => {
  const { api, calls, session } = harness(json({ products: [] }));
  session.token = 'test-mode-token';
  await assert.rejects(api.qolipSaveProductSpecsBatch(session, { product, specs: [{ qolipCode: 'Q-1', size: 42 }] }),
    /test mode is not yet ported/);
  assert.equal(calls.length, 0);
});
