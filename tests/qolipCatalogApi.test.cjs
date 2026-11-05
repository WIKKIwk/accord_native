const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const { contractFetch, recordedSession } = require('./support/contractFetch.cjs');
function load(name, mocks = {}) {
  const filename = path.resolve(__dirname, `../src/${name}.ts`), loaded = new Module(filename, module);
  loaded.filename = filename; loaded.paths = module.paths;
  loaded.require = id => Object.hasOwn(mocks, id) ? mocks[id] : id.startsWith('./') ? load(id.slice(2), mocks) : require(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return loaded.exports;
}
test('qolip catalog detail loads and parses a product', async () => {
  const stem = 'qolip_catalog_test', name = 'only names load initially; tapping loads and reuses one product detail';
  const replay = contractFetch(stem, name, { onlyPaths: ['/v1/mobile/qolip/products/detail'] }), session = recordedSession(stem, name);
  const api = load('qolipCatalogApi', { './auth': { activeSessionToken: s => s.token }, './authorizedFetch': { authorizedFetch: (s, p, init = {}, guard) => { guard?.(); return replay(new URL(p, s.baseUrl), { ...init, headers: { ...init.headers, Authorization: `Bearer ${s.token}` } }); } } });
  const products = await api.qolipCatalogDetails(session, 'row-0');
  assert.equal(products[0].qolip_code, 'MOLD-001'); assert.equal(products[0].set_id, 'set-1'); replay.assertDone();
});
test('qolip catalog bounds pages and rejects stuck continuation', async () => {
  const stem = 'qolip_catalog_test', name = 'catalog requests are bounded, scoped and reject a stuck continuation';
  const replay = contractFetch(stem, name), session = recordedSession(stem, name);
  const api = load('qolipCatalogApi', { './auth': { activeSessionToken: s => s.token }, './authorizedFetch': { authorizedFetch: (s, p, init = {}, guard) => { guard?.(); return replay(new URL(p, s.baseUrl), { ...init, headers: { ...init.headers, Authorization: `Bearer ${s.token}` } }); } } });
  const page = await api.qolipCatalogPage(session, { query: ' Product ', limit: 999 });
  assert.equal(page.items.length, 200); assert.equal(page.next_cursor, 'next');
  await assert.rejects(api.qolipCatalogPage(session, { query: 'Product', cursor: 'next' }), /Invalid Qolip catalog page/);
  replay.assertDone();
});
for (const [name, valid] of [['product molds sends the exact code and keeps every returned mold', true], ['product molds preserves product_not_found and its server message', false]]) test(name, async () => {
  const stem = 'qolip_product_molds_api_test', replay = contractFetch(stem, name), session = recordedSession(stem, name);
  const api = load('qolipCatalogApi', { './auth': { activeSessionToken: s => s.token }, './authorizedFetch': { authorizedFetch: (s, p, init = {}) => replay(new URL(p, s.baseUrl), { ...init, headers: { ...init.headers, Authorization: `Bearer ${s.token}` } }) } });
  if (valid) { const rows = await api.qolipProductMolds(session, ' Zizi '); assert.ok(rows.length > 1); assert.equal(rows[0].code, 'Zizi'); }
  else await assert.rejects(api.qolipProductMolds(session, 'Zizi'), e => e.code === 'product_not_found');
  replay.assertDone();
});
