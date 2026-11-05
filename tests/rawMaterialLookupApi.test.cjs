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
test('raw material lookup retries the recorded transient GET', async () => {
  const stem = 'mobile_api_read_reliability_test', name = 'MobileApi retries GET but never repeats an assignment mutation';
  const replay = contractFetch(stem, name, { onlyPaths: ['/v1/mobile/admin/raw-material-assignments/lookup'] }), session = recordedSession(stem, name);
  const api = load('rawMaterialLookupApi', { './authorizedFetch': { authorizedFetch: async (s, p, init = {}) => {
    try { return await replay(new URL(p, s.baseUrl), { ...init, headers: { ...init.headers, Authorization: `Bearer ${s.token}` } }); }
    catch (error) { if (error.message.includes('ClientException')) throw new TypeError('Network request failed'); throw error; }
  } } });
  const result = await api.adminRawMaterialLookup(session, ' 30AA ');
  assert.equal(result.barcode, '30AA');
  assert.equal(result.assignment, null);
  assert.equal(result.qty, 0);
  replay.assertDone();
});
test('lookup preserves stock and validates queue states and logs', () => {
  const api = load('rawMaterialLookupApi', { './authorizedFetch': { authorizedFetch: () => {} } });
  const result = api.rawMaterialLookupFromJson({ barcode: 'A', qty: 2.5, warehouse: 'T', queue_states: {}, logs: [] });
  assert.equal(result.qty, 2.5);
  assert.equal(result.warehouse, 'T');
  assert.deepEqual(result.queue_states, {});
  assert.throws(() => api.rawMaterialLookupFromJson({ qty: '2' }), TypeError);
});
