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
  module.require = name => name.endsWith('/authorizedFetch') ? { authorizedFetch: fetch }
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
