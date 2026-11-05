const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const { contractFetch, recordedSession } = require('./support/contractFetch.cjs');
function load(name, mocks = {}) {
  const filename = path.resolve(__dirname, `../src/${name}.ts`);
  const loaded = new Module(filename, module);
  loaded.filename = filename; loaded.paths = module.paths;
  loaded.require = id => Object.hasOwn(mocks, id) ? mocks[id] : id.startsWith('./') ? load(id.slice(2), mocks) : require(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return loaded.exports;
}
const station = 'apparatus:default:asset-007';
function api(fetch) { return load('workerLayerRemainderReprintApi', { './authorizedFetch': { authorizedFetch: fetch } }); }

test('reprinting refers to saved operation without creating stock', async () => {
  const stem = 'lamination_layer_remainder_api_test', name = 'reprinting refers to saved operation without creating stock';
  const replay = contractFetch(stem, name), session = recordedSession(stem, name);
  const client = api((s, p, init = {}) => replay(new URL(p, s.baseUrl), { ...init, headers: { ...init.headers, Authorization: `Bearer ${s.token}` } }));
  const result = await client.adminLayerRemainderReprint(session, { apparatus: station, order_id: 'order-1', operation_id: 'remainder-operation' });
  assert.equal(result.remainder.operation_id, 'remainder-operation');
  assert.equal(result.print_ok, false);
  assert.equal(result.print_status, 'print_failed');
  assert.equal(result.print_job, null);
  replay.assertDone();
});

test('reprint normalizes local printer settings and preserves prepared label data', async () => {
  let body, calls = 0;
  const client = api(async (_session, _url, init) => {
    calls++; body = JSON.parse(init.body);
    return new Response(JSON.stringify({ ok: true, remainder: { operation_id: 'op' },
      print: { ok: true, status: 'prepared', epc: 'label', gross_qty: 22 } }), { status: 200 });
  });
  await assert.rejects(client.adminLayerRemainderReprint({}, { apparatus: station, order_id: 'o', operation_id: ' ' }),
    error => error.code === 'layer_remainder_not_found');
  assert.equal(calls, 0);
  const result = await client.adminLayerRemainderReprint({}, { apparatus: ` ${station} `, order_id: ' o ', operation_id: ' op ',
    printer: ' godex ', driver_url: ' usb://local ', print_mode: ' label ', print_transport: 'bluetooth' });
  assert.deepEqual(body, { apparatus: station, order_id: 'o', operation_id: 'op', driver_url: 'usb://local',
    printer: 'godex', print_mode: 'label', print_transport: 'offline', print_count: 1 });
  assert.equal(result.print_ok, true);
  assert.equal(result.print_job.epc, 'label');
  assert.throws(() => client.layerRemainderResultFromJson({ ok: true }), error => error.code === 'layer_remainder_invalid_response');
});
