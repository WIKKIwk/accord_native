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
for (const [name, attempts, valid] of [['pending detail requests one ID and retains complete calculation data', 1, true], ['pending detail rejects wrong IDs, list responses and HTTP errors', 3, false]]) test(name, async () => {
  const stem = 'admin_orders_list_api_test', replay = contractFetch(stem, name), session = recordedSession(stem, name);
  const api = load('pendingOrderApi', { './authorizedFetch': { authorizedFetch: (s, p, init = {}) => replay(new URL(p, s.baseUrl), { ...init, headers: { ...init.headers, Authorization: `Bearer ${s.token}` } }) } });
  for (let i = 0; i < attempts; i++) {
    if (valid) { const order = await api.pendingOrderDetail(session, 'pending-3'); assert.equal(order.template.kg, 500); assert.equal(order.manager_name, 'Manager'); }
    else await assert.rejects(api.pendingOrderDetail(session, 'pending-3'));
  }
  replay.assertDone();
});
