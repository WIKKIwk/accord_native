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
test('raw material unlink does not retry failed mutations', async () => {
  const stem = 'mobile_api_read_reliability_test', name = 'MobileApi retries GET but never repeats an assignment mutation';
  const replay = contractFetch(stem, name, { onlyMethods: ['DELETE'] }), session = recordedSession(stem, name);
  const record = loadContract(stem).find(x => x.test === name && x.method === 'DELETE'), input = JSON.parse(record.requestBody.text);
  const client = load('rawMaterialUnlinkApi', { './authorizedFetch': { authorizedFetch: (s, p, init = {}) => replay(new URL(p, s.baseUrl), { ...init, headers: { ...init.headers, Authorization: `Bearer ${s.token}` } }) } });
  await assert.rejects(client.adminUnlinkRawMaterialAssignment(session, input.order_id, input.barcode));
  replay.assertDone();
});
test('unlink decodes a nested assignment after trimming inputs', async () => {
  let sent;
  const client = load('rawMaterialUnlinkApi', { './authorizedFetch': { authorizedFetch: async (_s, _p, init) => { sent = JSON.parse(init.body); return { status: 200, json: async () => ({ assignment: { order_id: 'order', barcode: 'abc', apparatus: 'apparatus:default:bosma_7' } }) }; } } });
  const result = await client.adminUnlinkRawMaterialAssignment({}, ' order ', ' abc ');
  assert.deepEqual(sent, { order_id: 'order', barcode: 'abc' });
  assert.equal(result.barcode, 'abc');
});

test('unlink checks the original account scope before a 401 retry', async () => {
  const originalFetch = global.fetch;
  let requests = 0;
  const session = { baseUrl: 'https://example.test', token: 'old', identity: 'first' };
  const auth = { activeSessionToken: value => value.token, refreshSession: async value => {
    value.token = 'new'; value.identity = 'second'; return true;
  } };
  const client = load('rawMaterialUnlinkApi', { './auth': auth });
  global.fetch = async () => { requests++; return new Response('', { status: 401 }); };
  try {
    await assert.rejects(client.adminUnlinkRawMaterialAssignment(session, 'order', 'abc', () => {
      if (session.identity !== 'first') throw new Error('scope changed');
    }), /scope changed/);
    assert.equal(requests, 1);
  } finally { global.fetch = originalFetch; }
});
