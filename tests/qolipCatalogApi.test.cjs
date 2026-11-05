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
