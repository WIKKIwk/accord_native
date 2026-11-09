// V2 has no HTTP recordings for these methods. Assertions follow the f119 source and reuse DispatchRecord.fromJson.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
function load(file, fetch, cache = new Map()) {
  const resolved = path.resolve(file.endsWith('.ts') ? file : `${file}.ts`);
  if (cache.has(resolved)) return cache.get(resolved);
  const module = new Module(resolved); module.filename = resolved; module.paths = require.main.paths;
  cache.set(resolved, module.exports);
  module.require = name => {
    if (name === './werkaMutationScope') return { werkaMutationScope: () => ({ beforeSend() {}, afterResponse() {} }) };
    if (name.endsWith('/authorizedFetch') || name === './authorizedFetch') return { authorizedFetch: fetch };
    if (name.startsWith('.')) return load(path.resolve(path.dirname(resolved), name), fetch, cache);
    return require(name);
  };
  module._compile(ts.transpileModule(fs.readFileSync(resolved, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, resolved);
  cache.set(resolved, module.exports); return module.exports;
}
const filename = path.resolve(__dirname, '../src/werka/werkaRecordApi.ts');
function setup(data, status = 200) {
  const calls = [];
  const api = load(filename, async (session, url, init = {}) => { calls.push({ session, url, init });
    return new Response(JSON.stringify(data), { status }); });
  return { api, calls, session: { token: 'test' } };
}
test('pending, history and notifications use the shared DispatchRecord parser', async () => {
  const { api, calls, session } = setup([{ id: 'r1', status: 'accepted', sent_qty: 1.5 }, {}]);
  for (const method of ['werkaPending', 'werkaHistory', 'werkaNotifications']) {
    const rows = await api[method](session); assert.equal(rows[0].id, 'r1'); assert.equal(rows[0].status, 'accepted');
    assert.equal(rows[1].status, 'pending'); assert.equal(rows[1].sent_qty, 0);
  }
  assert.deepEqual(calls.map(call => call.url), ['/v1/mobile/werka/pending', '/v1/mobile/werka/history', '/v1/mobile/werka/notifications']);
});
test('summary and status breakdown preserve typed defaults and queries', async () => {
  const summary = setup({ pending_count: 3, confirmed_count: 2 });
  assert.deepEqual(await summary.api.werkaSummary(summary.session), { pending_count: 3, confirmed_count: 2, returned_count: 0 });
  assert.equal(summary.calls[0].url, '/v1/mobile/werka/summary');
  const breakdown = setup([{ supplier_ref: 's1', receipt_count: 2, total_sent_qty: 3.5 }, {}]);
  const rows = await breakdown.api.werkaStatusBreakdown(breakdown.session, 'returned');
  assert.equal(breakdown.calls[0].url, '/v1/mobile/werka/status-breakdown?kind=returned');
  assert.equal(rows[0].supplierRef, 's1'); assert.equal(rows[0].totalSentQty, 3.5); assert.equal(rows[1].receiptCount, 0);
  assert.throws(() => breakdown.api.werkaStatusBreakdownEntryFromJson({ receipt_count: 1.5 }), /integer/);
});
test('status details preserve supplier reference including spaces', async () => {
  const { api, calls, session } = setup([{ id: 'one' }]);
  assert.equal((await api.werkaStatusDetails(session, 'confirmed', ' S & 1 '))[0].id, 'one');
  assert.equal(calls[0].url, '/v1/mobile/werka/status-details?kind=confirmed&supplier_ref=+S+%26+1+');
});
test('receipt confirmation sends all V2 default fields once', async () => {
  const { api, calls, session } = setup({ id: 'one', status: 'accepted' });
  const result = await api.confirmReceipt(session, { receiptID: ' r1 ', acceptedQty: 3 });
  assert.equal(result.status, 'accepted'); assert.equal(calls.length, 1); assert.equal(calls[0].url, '/v1/mobile/werka/confirm');
  assert.deepEqual(JSON.parse(calls[0].init.body), { receipt_id: ' r1 ', accepted_qty: 3, returned_qty: 0, return_reason: '', return_comment: '' });
  assert.equal(calls[0].init.headers['Content-Type'], 'application/json');
});
test('server errors and invalid list shapes do not become success', async () => {
  const failed = setup({}, 503); await assert.rejects(failed.api.werkaPending(failed.session), /Werka pending failed/);
  const invalid = setup({}); await assert.rejects(invalid.api.werkaHistory(invalid.session), /Invalid Werka list/);
});
test('non-finite accepted or returned quantity fails before sending and formats like Dart', async () => {
  for (const qty of [NaN, Infinity, -Infinity]) {
    for (const field of ['acceptedQty', 'returnedQty']) {
      const { api, calls, session } = setup({});
      await assert.rejects(api.confirmReceipt(session, { receiptID: 'r', acceptedQty: 1, [field]: qty }), error => {
        const message = `Converting object to an encodable object failed: ${String(qty)}`;
        assert.equal(error.name, 'JsonUnsupportedObjectError');
        assert.equal(String(error), message);
        // V2's detail screen interpolates the exception into this snackbar.
        assert.equal(`Qabul qilish bo‘lmadi: ${error}`, `Qabul qilish bo‘lmadi: ${message}`);
        return true;
      });
      assert.equal(calls.length, 0);
    }
  }
});
