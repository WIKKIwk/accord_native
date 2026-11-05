const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const { loadContract } = require('./support/contractFetch.cjs');

function load(name, mocks = {}) {
  const filename = path.resolve(__dirname, `../src/${name}.ts`), loaded = new Module(filename, module);
  loaded.filename = filename; loaded.paths = module.paths;
  loaded.require = id => Object.hasOwn(mocks, id) ? mocks[id] : id.startsWith('./') ? load(id.slice(2), mocks) : require(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return loaded.exports;
}

test('legacy QR active-order validation handles a compact frozen worker snapshot', async () => {
  const record = loadContract('worker_list_api_test').find(value => value.test.startsWith('worker HTTP and v2 socket'));
  const snapshot = JSON.parse(record.responseBody.text), requests = [];
  const transport = { currentQueueSnapshotReadEpoch: () => 0, invalidateQueueSnapshotReads: () => {},
    authorizedFetch: async (_session, path, init = {}) => {
      requests.push({ path, method: init.method ?? 'GET' });
      if (init.method === 'POST') return { status: 200, json: async () => ({ batch: { batch_id: 'roll', order_id: 'work-1',
        apparatus: 'apparatus:default:bosma_7', wip_status: 'waiting', qr_payload: 'QR' } }) };
      return { status: 200, json: async () => snapshot };
    } };
  const api = load('workerProgressApi', { './authorizedFetch': transport, './auth': { activeSessionToken: session => session.token } });
  const session = { token: 'token', baseUrl: 'https://example.test', profile: { role: 'rezka_master', ref: 'worker' } };
  await assert.rejects(api.adminProgressQrLookup(session, 'QR', { requireActiveOrder: true }),
    error => error.code === 'order_frozen' && error.orderTitle === '');
  const query = new URL(requests[1].path, session.baseUrl).searchParams;
  assert.equal(query.get('worker_scope'), 'true');
  assert.equal(query.get('projection'), 'worker_list_v1');
});
