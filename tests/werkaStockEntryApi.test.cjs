// V2 has no HTTP recording for werkaStockEntryLookup; assertions follow the f119 source.
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
const filename = path.resolve(__dirname, '../src/werka/werkaStockEntryApi.ts');
function setup(status, data) {
  const calls = [], api = load(filename, async (_session, url) => { calls.push(url); return new Response(data, { status }); });
  return { api, calls };
}
test('lookup trims the barcode and filters non-object entries', async () => {
  const { api, calls } = setup(200, JSON.stringify({ barcode: 'QR', entries: [null, { stock_entry_name: 'SE-1',
    line_index: 3.9, item_code: 'A', qty: 2.5 }, 'bad', { stock_entry_name: 'SE-2' }] }));
  const result = await api.werkaStockEntryLookup({}, ' QR ');
  assert.equal(calls[0], '/v1/mobile/stock-entry/lookup?barcode=QR&limit=20');
  assert.equal(result.count, 2); assert.equal(result.hasMultipleEntries, true); assert.equal(result.entries[0].lineIndex, 3);
  assert.equal(result.entries[0].qty, 2.5); assert.equal(result.entries[1].stockUOM, '');
});
test('non-positive limit is omitted and default count uses the decoded entries', async () => {
  const { api, calls } = setup(200, '{"entries":[]}');
  assert.equal((await api.werkaStockEntryLookup({}, ' a & b ', 0)).count, 0);
  assert.equal(calls[0], '/v1/mobile/stock-entry/lookup?barcode=a+%26+b');
});
test('status-specific errors preserve server message, default and status', async () => {
  for (const [status, code] of [[400, 'stock_entry_lookup_bad_request'], [404, 'stock_entry_not_found'],
    [503, 'direct_db_lookup_unavailable'], [500, 'stock_entry_lookup_failed']]) {
    const { api } = setup(status, '{"error":"  failed  "}');
    await assert.rejects(api.werkaStockEntryLookup({}, 'x'), error => error.code === code && error.message === 'failed' && error.statusCode === status);
  }
  const fallback = setup(500, 'not JSON');
  await assert.rejects(fallback.api.werkaStockEntryLookup({}, 'x'), error => error.message === 'Stock entry lookup failed');
});
