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
const stem = 'rezka_astatka_api_test';
for (const record of loadContract(stem).filter(x => x.method === 'POST')) test(record.test, async () => {
  const replay = contractFetch(stem, record.test), session = recordedSession(stem, record.test);
  const client = load('rezkaAstatkaApi', { './authorizedFetch': { authorizedFetch: (s, p, init = {}) => replay(new URL(p, s.baseUrl), { ...init, headers: { ...init.headers, Authorization: `Bearer ${s.token}` } }) } });
  const input = JSON.parse(record.requestBody.text);
  input.total_waste_only = input.rezka_bosma_waste == null;
  if (record.test.includes('rejects malformed')) await assert.rejects(client.adminRezkaAstatkaReport(session, input), e => e.code === 'rezka_astatka_invalid_response');
  else assert.equal((await client.adminRezkaAstatkaReport(session, input)).order_id, input.order_id);
  replay.assertDone();
});
test('report rejects nonfinite or missing metrics before transport', async () => {
  const client = load('rezkaAstatkaApi', { './authorizedFetch': { authorizedFetch: () => { throw Error('unexpected'); } } });
  await assert.rejects(client.adminRezkaAstatkaReport({}, { apparatus: 'apparatus:default:asset-010', order_id: 'order', request_id: 'request-a', session_id: 'session', total_waste: NaN, total_waste_only: true }), e => e.code === 'rezka_astatka_metrics_required');
});

test('snapshot binds a session and reconciles a saved receipt', async () => {
  const name = 'rezka astatka snapshot binds session and reconciles saved receipt';
  const replay = contractFetch(stem, name), session = recordedSession(stem, name);
  const client = load('rezkaAstatkaApi', { './authorizedFetch': { authorizedFetch: (s, p, init = {}) => replay(new URL(p, s.baseUrl), { ...init, headers: { ...init.headers, Authorization: `Bearer ${s.token}` } }) } });
  const input = { apparatus: 'apparatus:default:asset-010', order_id: 'order-a', request_id: 'request-a' };
  assert.equal((await client.adminRezkaAstatkaSnapshot(session, input)).stage_node_id, 'cut-stage-a');
  assert.equal((await client.adminRezkaAstatkaSnapshot(session, input)).request_result.report_id, 'saved-a');
  replay.assertDone();
});
