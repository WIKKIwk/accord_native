const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
function client(send) {
  const filename = path.resolve(__dirname, '../src/qolipProductsApi.ts'), loaded = new Module(filename, module);
  loaded.require = target => ({
    './auth': { activeSessionToken: session => session.token },
    './authorizedFetch': { currentQueueSnapshotReadEpoch: () => 0, authorizedFetch: send },
    './workerControlsApi': { WorkerControlException: class extends Error {} },
    './qolipCatalogApi': { qolipAccountGuard: () => () => {}, qolipProductFromJson: row => row },
  })[target] ?? require(target);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return loaded.exports;
}
const session = { token: 'test-local', baseUrl: 'https://example.test', profile: { role: 'qolipchi', ref: 'A' } };
const full = { limit: 20000, with_qolip_only: true };
const response = rows => new Response(JSON.stringify({ products: rows }), { status: 200, headers: { etag: 'one' } });
test('guarded product reads keep exact source requests and share only their original witness cache', async () => {
  const calls = [], guard = () => true, other = () => true;
  const api = client(async (account, path, init, before, timeout, options) => { before(); calls.push({ account, path, init, options }); return response([{ qolip_code: 'Q' }]); });
  const [one, two] = await Promise.all([api.qolipProducts(session, full, guard), api.qolipProducts(session, full, guard)]);
  assert.equal(one, two); assert.equal(calls.length, 1); assert.equal(calls[0].path, '/v1/mobile/qolip/products?limit=20000&with_qolip=true');
  assert.equal(calls[0].options.readWitness, guard);
  await api.qolipProducts(session, full, other); assert.equal(calls.length, 2); assert.deepEqual(calls[1].init.headers, {});
  assert.equal(api.cachedQolipProducts(session), null, 'role witness cache must not replace legacy worker/preparation snapshot');
});
test('guard expiry prevents initial dispatch, refresh retry and late JSON publication', async () => {
  let current = false, calls = 0;
  const guard = () => current;
  const api = client(async (account, path, init, before) => { calls++; current = false; before(); return response([]); });
  assert.throws(() => api.qolipProducts(session, full, guard), /expired/); assert.equal(calls, 0);
  current = true; await assert.rejects(api.qolipProducts(session, full, guard), /expired/); assert.equal(calls, 1);
  current = true;
  const late = client(async (account, path, init, before) => { before(); return { status: 200, json: async () => { current = false; return { products: [] }; }, headers: new Headers() }; });
  await assert.rejects(late.qolipProducts(session, full, guard), /expired/);
});
test('a swallowed recursive guard rejection cannot authorize a product read', () => {
  let calls = 0, checking = false;
  const api = client(async () => { calls++; throw new Error('should not dispatch'); });
  const guard = () => {
    if (!checking) { checking = true; try { api.qolipProducts(session, full, guard); } catch {} finally { checking = false; } }
    return true;
  };
  assert.throws(() => api.qolipProducts(session, full, guard), /expired/); assert.equal(calls, 0);
});
