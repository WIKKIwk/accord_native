// V2 has no direct HTTP recordings for these catalog readers; assertions follow the f119 source.
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
  module.require = name => {
    if (name.endsWith('/authorizedFetch')) return { authorizedFetch: fetch };
    if (name.endsWith('/appPreferences')) return { appPreferences: {} };
    if (name === './searchActivityStore') return { SearchActivityStore: class {
      async sortByItemCode(_session, values, _key, fallback) { return [...values].sort(fallback); }
    } };
    if (name.startsWith('.')) return load(path.resolve(path.dirname(resolved), name), fetch, cache);
    return require(name);
  };
  module._compile(ts.transpileModule(fs.readFileSync(resolved, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, resolved);
  cache.set(resolved, module.exports); return module.exports;
}
const filename = path.resolve(__dirname, '../src/werka/werkaCatalogApi.ts');
function setup(handler) {
  const calls = [], api = load(filename, async (_session, url) => { calls.push(url); const [status, data] = handler(url);
    return new Response(JSON.stringify(data), { status }); });
  return { api, calls };
}
test('supplier and customer items reuse the shared decoder and activity ordering', async () => {
  const { api, calls } = setup(() => [200, [{ code: 'B', name: 'Banana' }, { code: 'A', name: 'Apple', customer_names: [' A '] }]]);
  const supplier = await api.werkaSupplierItems({}, ' s ', { query: ' film ', limit: 10, offset: 5 });
  assert.deepEqual(supplier.map(item => item.code), ['A', 'B']); assert.deepEqual(supplier[0].customer_names, ['A']);
  await api.werkaCustomerItems({}, 'c', { limit: 0, offset: -1 });
  assert.deepEqual(calls, ['/v1/mobile/werka/supplier-items?supplier_ref=+s+&q=film&limit=10&offset=5',
    '/v1/mobile/werka/customer-items?customer_ref=c']);
});
test('options use item name, primary customer and item code fallback ordering', async () => {
  const { api, calls } = setup(() => [200, [
    { customer_ref: 's', customer_name: 'saidamin', item_name: 'Film', item_code: 'F' },
    { customer_ref: 'u', customer_name: 'Umar', item_name: 'Film', item_code: 'F' },
    { customer_ref: 'a', customer_name: 'A', item_name: 'Alpha', item_code: 'A' },
  ]]);
  const result = await api.werkaCustomerItemOptions({}, { query: ' F ', limit: 8, offset: 9 });
  assert.deepEqual(result.map(row => row.customerRef), ['a', 'u', 's']);
  assert.equal(calls[0], '/v1/mobile/werka/customer-item-options?q=F&limit=8&offset=9');
});
test('failed options endpoint falls back to customer item reads, filtering and deduplicating', async () => {
  const { api, calls } = setup(url => {
    if (url.startsWith('/v1/mobile/werka/customer-item-options')) return [503, {}];
    if (url.startsWith('/v1/mobile/werka/customers')) return [200, [{ ref: 'c', name: 'Alice', phone: '1' }]];
    if (url.startsWith('/v1/mobile/werka/customer-items')) return [200, [
      { code: 'A', name: 'Film', uom: 'kg' }, { code: 'A', name: 'Film', uom: 'kg' }, { code: 'B', name: 'Other' },
    ]];
    throw new Error(url);
  });
  const result = await api.werkaCustomerItemOptions({}, { query: 'Alice', limit: 1, offset: 50 });
  assert.deepEqual(result.map(row => row.itemCode), ['A', 'B']);
  assert.equal(calls[1], '/v1/mobile/werka/customers?limit=200');
  assert.equal(calls[2], '/v1/mobile/werka/customer-items?customer_ref=c&limit=100');
});
test('customers for an item check exact code, fall back to name and prefer primary customer', async () => {
  const { api, calls } = setup(url => {
    const q = new URL(url, 'https://example.invalid').searchParams.get('q');
    if (q === 'X') return [200, [{ customer_ref: 'wrong', customer_name: 'Wrong', item_code: 'Y', item_name: 'Film' }]];
    if (q === 'Film') return [200, [
      { customer_ref: 's', customer_name: 'saidamin', item_code: 'x', item_name: 'Film' },
      { customer_ref: 'u', customer_name: 'Umar', item_code: 'X', item_name: 'Film' },
      { customer_ref: 'u', customer_name: 'Duplicate', item_code: 'x', item_name: 'Film' },
    ]];
    throw new Error(url);
  });
  const result = await api.werkaCustomersForItem({}, { itemCode: ' X ', itemName: ' Film ', limit: 1 });
  assert.equal(result[0].ref, 'u'); assert.equal(result.length, 1);
  assert.equal(calls.length, 2); assert.match(calls[0], /q=X&limit=200/); assert.match(calls[1], /q=Film&limit=200/);
  await assert.rejects(api.werkaCustomersForItem({}, { itemCode: 'X', itemName: 'Film', offset: -1 }), RangeError);
});
