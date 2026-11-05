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
test('partial readiness responses fail instead of hiding tasks', async () => {
  const stem = 'qolip_tasks_test', name = 'partial readiness responses fail instead of hiding tasks', replay = contractFetch(stem, name), session = recordedSession(stem, name);
  const client = load('qolipOrderProductsApi', { './auth': { activeSessionToken: s => s.token }, './authorizedFetch': { authorizedFetch: (s, p, init = {}) => replay(new URL(p, s.baseUrl), { ...init, headers: { ...init.headers, Authorization: `Bearer ${s.token}` } }) } });
  await assert.rejects(client.qolipOrderProducts(session, ['zakaz-1']), /Incomplete Qolip readiness response/); replay.assertDone();
});
test('empty order list sends no request', async () => {
  const client = load('qolipOrderProductsApi', { './auth': {}, './authorizedFetch': {} });
  assert.deepEqual(await client.qolipOrderProducts({}, []), {});
});
