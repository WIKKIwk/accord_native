const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const { contractFetch, loadContract, recordedSession } = require('./support/contractFetch.cjs');
function load(name, mocks = {}) {
  const filename = path.resolve(__dirname, `../src/${name}.ts`);
  const loaded = new Module(filename, module);
  loaded.filename = filename; loaded.paths = module.paths;
  loaded.require = id => Object.hasOwn(mocks, id) ? mocks[id] : id.startsWith('./') ? load(id.slice(2), mocks) : require(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return loaded.exports;
}
function api(fetch) { return load('productionOrderDetailApi', { './authorizedFetch': { authorizedFetch: fetch } }); }
for (const [stem, name, apparatus] of [
  ['admin_orders_list_api_test', 'generic detail omits apparatus and fetches exactly one canonical order', ''],
  ['admin_sequence_list_api_test', 'detail requests exactly one stable order ID with full canonical data', 'apparatus:default:bosma_7'],
]) test(name, async () => {
  const replay = contractFetch(stem, name), session = recordedSession(stem, name);
  const client = api((s, p, init = {}) => replay(new URL(p, s.baseUrl), { ...init, headers: { Authorization: `Bearer ${s.token}` } }));
  const result = await client.adminProductionOrderDetail(session, { apparatus, order_id: 'zakaz-scan-bootstrap' });
  assert.equal(result.maps[0].map.id, 'zakaz-scan-bootstrap');
  replay.assertDone();
});

test('detail refuses a missing order before sending', async () => {
  const client = api(async () => { throw Error('unexpected request'); });
  await assert.rejects(client.adminProductionOrderDetail({}, { apparatus: '', order_id: ' ' }), error => error.code === 'order_page_invalid');
});

test('admin detail rejects a valid compact worker snapshot as an invalid page', async () => {
  const record = loadContract('worker_list_api_test').find(value => value.test.startsWith('worker HTTP and v2 socket'));
  const wire = JSON.parse(record.responseBody.text);
  const client = api(async () => ({ status: 200, json: async () => wire }));
  await assert.rejects(client.adminProductionOrderDetail({}, { apparatus: '', order_id: 'work-1' }),
    error => error.code === 'order_page_invalid');
});

test('admin detail adds the opt-in identity compression query', async () => {
  let requested;
  const client = load('productionOrderDetailApi', {
    './productionReadSettings': { adminProductionReadIdentityCompression: true },
    './authorizedFetch': { authorizedFetch: async (_session, url) => {
      requested = new URL(url, 'https://example.test');
      return { status: 403, json: async () => ({}) };
    } },
  });
  await assert.rejects(client.adminProductionOrderDetail({}, { apparatus: '', order_id: 'work-1' }));
  assert.equal(requested.searchParams.get('compression'), 'identity');
});

for (const [stem, name, apparatus, attempts] of [
  ['admin_orders_list_api_test', 'full detail rejects templates for another order or invalid shape', '', 4],
  ['admin_sequence_list_api_test', 'detail rejects omitted, wrong or multiple maps and missing authority', 'apparatus:default:bosma_7', 5],
]) test(name, async () => {
  const replay = contractFetch(stem, name), session = recordedSession(stem, name);
  const client = api((s, p, init = {}) => replay(new URL(p, s.baseUrl), { ...init, headers: { Authorization: `Bearer ${s.token}` } }));
  for (let i = 0; i < attempts; i++) await assert.rejects(client.adminProductionOrderDetail(session, { apparatus, order_id: 'zakaz-scan-bootstrap' }));
  replay.assertDone();
});
