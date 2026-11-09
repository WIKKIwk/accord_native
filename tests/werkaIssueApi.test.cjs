// V2 has no direct HTTP recordings for these writes; assertions follow the f119 source. No real server is called.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
function load(file, fetch, cache = new Map()) {
  const resolved = path.resolve(file.endsWith('.ts') ? file : `${file}.ts`);
  if (cache.has(resolved)) return cache.get(resolved);
  const module = new Module(resolved); module.filename = resolved; module.paths = require.main.paths; cache.set(resolved, module.exports);
  module.require = name => name === './werkaMutationScope' ? { werkaMutationScope: () => ({ beforeSend() {}, afterResponse() {} }) }
    : name.endsWith('/authorizedFetch') ? { authorizedFetch: fetch }
    : name.startsWith('.') ? load(path.resolve(path.dirname(resolved), name), fetch, cache) : require(name);
  module._compile(ts.transpileModule(fs.readFileSync(resolved, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, resolved);
  cache.set(resolved, module.exports); return module.exports;
}
const filename = path.resolve(__dirname, '../src/werka/werkaIssueApi.ts');
function setup(status, data) {
  const calls = [], api = load(filename, async (_session, url, init) => { calls.push({ url, init });
    return new Response(typeof data === 'string' ? data : JSON.stringify(data), { status }); });
  return { api, calls };
}
test('unannounced draft preserves fields and returns shared dispatch decoding', async () => {
  const { api, calls } = setup(200, { id: 'r1', status: 'draft' });
  const result = await api.createWerkaUnannouncedDraft({}, { supplierRef: ' s ', itemCode: 'i', qty: 3.5 });
  assert.equal(result.id, 'r1'); assert.equal(result.status, 'draft');
  assert.equal(calls[0].url, '/v1/mobile/werka/unannounced/create');
  assert.deepEqual(JSON.parse(calls[0].init.body), { supplier_ref: ' s ', item_code: 'i', qty: 3.5 });
});
test('customer issue sends optional QR source fields only when specified', async () => {
  const { api, calls } = setup(200, { entry_id: 'e1', qty: 2 });
  const result = await api.createWerkaCustomerIssue({}, { customerRef: 'c', itemCode: 'i', qty: 2,
    sourceBarcode: ' qr ', sourceStockEntryName: ' SE-1 ', sourceLineIndex: 4 });
  assert.equal(result.entryID, 'e1'); assert.equal(result.qty, 2);
  assert.deepEqual(JSON.parse(calls[0].init.body), { customer_ref: 'c', item_code: 'i', qty: 2,
    source_barcode: 'qr', source_stock_entry: 'SE-1', source_line_index: 4 });
  await api.createWerkaCustomerIssue({}, { customerRef: 'c', itemCode: 'i', qty: 2, sourceBarcode: ' ', sourceLineIndex: -1 });
  assert.deepEqual(JSON.parse(calls[1].init.body), { customer_ref: 'c', item_code: 'i', qty: 2 });
});
test('customer issue maps stock and duplicate source conflicts without retry', async () => {
  for (const [code, message] of [['insufficient_stock', 'Insufficient stock'], ['duplicate_customer_issue_source', 'QR already dispatched']]) {
    const { api, calls } = setup(400, { error_code: ` ${code} ` });
    await assert.rejects(api.createWerkaCustomerIssue({}, { customerRef: 'c', itemCode: 'i', qty: 1 }),
      error => error.code === code && error.message === message && error.statusCode === 409);
    assert.equal(calls.length, 1);
  }
});
test('batch preserves line order and parses successes and failures', async () => {
  const { api, calls } = setup(200, { client_batch_id: 'batch', created: [{ line_index: 0, record: { entry_id: 'e' } }],
    failed: [{ line_index: 1, error: 'No stock', error_code: 'insufficient_stock' }] });
  const result = await api.createWerkaCustomerIssueBatch({}, 'batch', [
    { customerRef: 'c1', itemCode: 'i1', qty: 1 }, { customerRef: 'c2', itemCode: 'i2', qty: 2 },
  ]);
  assert.equal(calls[0].url, '/v1/mobile/werka/customer-issue/batch-create');
  assert.deepEqual(JSON.parse(calls[0].init.body), { client_batch_id: 'batch', lines: [
    { customer_ref: 'c1', item_code: 'i1', qty: 1 }, { customer_ref: 'c2', item_code: 'i2', qty: 2 },
  ] });
  assert.equal(result.created[0].record.entryID, 'e'); assert.equal(result.failed[0].errorCode, 'insufficient_stock');
});
test('other failures and malformed results are not treated as success', async () => {
  const failed = setup(500, 'not JSON');
  await assert.rejects(failed.api.createWerkaCustomerIssue({}, { customerRef: 'c', itemCode: 'i', qty: 1 }), /Werka customer issue create failed/);
  assert.throws(() => failed.api.werkaCustomerIssueBatchResultFromJson({ created: 'not a list' }), /Invalid customer issue list/);
});
test('non-finite quantities fail with the Dart encoding error before any issue request', async () => {
  for (const qty of [NaN, Infinity, -Infinity]) {
    const { api, calls } = setup(200, {});
    const requests = [
      () => api.createWerkaUnannouncedDraft({}, { supplierRef: 's', itemCode: 'i', qty }),
      () => api.createWerkaCustomerIssue({}, { customerRef: 'c', itemCode: 'i', qty }),
      () => api.createWerkaCustomerIssueBatch({}, 'batch', [
        { customerRef: 'c1', itemCode: 'i1', qty: 1 }, { customerRef: 'c2', itemCode: 'i2', qty },
      ]),
    ];
    for (const request of requests) {
      await assert.rejects(request(), error => {
        const message = `Converting object to an encodable object failed: ${String(qty)}`;
        assert.equal(error.name, 'JsonUnsupportedObjectError');
        assert.equal(error.message, message);
        assert.equal(String(error), message);
        return true;
      });
      assert.equal(calls.length, 0);
    }
  }
});
test('unannounced API error matches the standalone f119 source-equivalent samples', async () => {
  // These are Dart-generated numeric and encoding samples, not Flutter UI tests.
  const fixture = require('./contracts/f11910bb/werka_json_nonfinite_oracle.json');
  assert.equal(fixture.baseline, 'f11910bb2c8c7081ce26770e69811b03fd0739ed');
  for (const sample of fixture.cases.filter(row => row.errorType)) {
    const qty = sample.input.includes('NaN') ? NaN : Infinity;
    const { api, calls } = setup(200, {});
    await assert.rejects(api.createWerkaUnannouncedDraft({}, { supplierRef: 's', itemCode: 'i', qty }), error => {
      assert.equal(error.name, sample.errorType);
      assert.equal(String(error), sample.errorText);
      return true;
    });
    assert.equal(calls.length, sample.postCalls);
  }
});
