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
test('concurrent full reads share one request; 304 reuses parsed products', async () => {
  const stem = 'qolip_products_cache_test', name = 'concurrent full reads share one request; 304 reuses parsed products';
  const replay = contractFetch(stem, name), session = recordedSession(stem, name);
  const mocks = { './auth': { activeSessionToken: s => s.token }, './authorizedFetch': { currentQueueSnapshotReadEpoch: () => 0,
    authorizedFetch: (s, p, init = {}, guard) => { guard?.(); return replay(new URL(p, s.baseUrl), { ...init, headers: { ...init.headers, Authorization: `Bearer ${s.token}` } }); } } };
  const client = load('qolipProductsApi', mocks), options = { limit: 20000, with_qolip_only: true };
  const [one, two] = await Promise.all([client.qolipProducts(session, options), client.qolipProducts(session, options)]);
  assert.equal(one, two); assert.equal(client.cachedQolipProducts(session), one);
  assert.equal(await client.qolipProducts(session, options), one); replay.assertDone();
});
test('partial searches cannot overwrite the full catalog snapshot', async () => {
  const stem = 'qolip_products_cache_test', name = 'partial searches cannot overwrite the full catalog snapshot';
  const replay = contractFetch(stem, name), session = recordedSession(stem, name);
  const mocks = { './auth': { activeSessionToken: s => s.token }, './authorizedFetch': { currentQueueSnapshotReadEpoch: () => 0,
    authorizedFetch: (s, p, init = {}, guard) => { guard?.(); return replay(new URL(p, s.baseUrl), { ...init, headers: { ...init.headers, Authorization: `Bearer ${s.token}` } }); } } };
  const client = load('qolipProductsApi', mocks), full = await client.qolipProducts(session, { limit: 20000, with_qolip_only: true });
  await client.qolipProducts(session, { query: 'missing', with_qolip_only: true });
  assert.equal(client.cachedQolipProducts(session), full); replay.assertDone();
});
