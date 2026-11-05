const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const { contractFetch, loadContract, recordedSession } = require('./support/contractFetch.cjs');
function load(name, mocks = {}) {
  const filename = path.resolve(__dirname, `../src/${name}.ts`), loaded = new Module(filename, module);
  loaded.filename = filename; loaded.paths = module.paths;
  loaded.require = id => Object.hasOwn(mocks, id) ? mocks[id] : id.startsWith('./') ? load(id.slice(2), mocks) : require(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return loaded.exports;
}
test('lamination astatka replays the persisted request without changes', async () => {
  const stem = 'lamination_layer_remainder_api_test', name = 'two kg fields submit source revisions and the same persisted request';
  const replay = contractFetch(stem, name), session = recordedSession(stem, name), records = loadContract(stem).filter(x => x.test === name);
  const client = load('laminationAstatkaSubmitApi', { './authorizedFetch': { authorizedFetch: (s, p, init = {}) => replay(new URL(p, s.baseUrl), { ...init, headers: { ...init.headers, Authorization: `Bearer ${s.token}` } }) } });
  for (const record of records) assert.equal((await client.adminSubmitLaminationAstatka(session, JSON.parse(record.requestBody.text))).action, 'pause');
  replay.assertDone();
});
test('incomplete lamination request is rejected', async () => {
  const client = load('laminationAstatkaSubmitApi', { './authorizedFetch': { authorizedFetch: () => { throw Error('unexpected'); } } });
  await assert.rejects(client.adminSubmitLaminationAstatka({}, { apparatus: 'apparatus:default:asset-007', order_id: 'order', request_id: 'id', session_id: 's' }), e => e.code === 'laminatsiya_astatka_metrics_required');
});
