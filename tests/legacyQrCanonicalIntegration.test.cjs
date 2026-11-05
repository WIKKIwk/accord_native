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
test('legacy active-order lookup rejects canonical frozen state with order title', async () => {
  const fixture = loadContract('worker_list_api_test').find(x => x.test === 'worker single detail requests one ID and returns full action authority');
  const snapshot = JSON.parse(fixture.responseBody.text), station = 'apparatus:default:bosma_7', order = 'zakaz-scan-bootstrap';
  snapshot.order_controls[order] = { state: 'frozen' }; delete snapshot.projection;
  let epoch = 0;
  const transport = { currentQueueSnapshotReadEpoch: () => epoch, invalidateQueueSnapshotReads: () => { epoch++; },
    authorizedFetch: async (_session, path, init = {}, guard) => { guard?.(); return { status: 200, json: async () => path.includes('lookup') ? {
      batch: { batch_id: 'roll', order_id: order, wip_status: 'waiting', apparatus: station }, validated_apparatus: station, validated_order_id: order,
    } : snapshot }; } };
  const api = load('workerProgressApi', { './auth': { activeSessionToken: session => session.token }, './authorizedFetch': transport });
  const session = { baseUrl: 'https://example.test', token: 'token', profile: { role: 'aparatchi', ref: 'r' } };
  await assert.rejects(api.adminProgressQrLookup(session, 'qr', { apparatus: station, orderId: order, requireActiveOrder: true }),
    error => error.code === 'order_frozen' && error.orderTitle === 'Full graph');
});
