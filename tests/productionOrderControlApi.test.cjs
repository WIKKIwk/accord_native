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
function api(fetch) { return load('productionOrderControlApi', { './authorizedFetch': { authorizedFetch: fetch } }); }
const apparatus = 'apparatus:default:bosma_7', order = 'zakaz-scan-bootstrap';

// @v2-test test/stage_freeze_contract_test.dart
test('stage API sends an exact node and never changes scope implicitly', async () => {
  const stem = 'stage_freeze_contract_test', name = 'stage API sends an exact node and never changes scope implicitly';
  const replay = contractFetch(stem, name), session = recordedSession(stem, name);
  const client = api((s, p, init = {}) => replay(new URL(p, s.baseUrl), { ...init, headers: { ...init.headers, Authorization: `Bearer ${s.token}` } }));
  for (const action of ['freeze', 'cancel_freeze', 'unfreeze']) assert.equal(await client.adminProductionMapOrderControl(session,
    { order_id: order, action, apparatus, stage_node_id: 'apparatus', stage_freeze_supported: true }), 'frozen');
  assert.equal(await client.adminProductionMapOrderControl(session, { order_id: order, action: 'freeze' }), 'frozen');
  replay.assertDone();
});

test('stage API fails before sending on unsupported server or missing target', async () => {
  const client = api(async () => { throw Error('unexpected request'); });
  await assert.rejects(client.adminProductionMapOrderControl({}, { order_id: order, action: 'freeze', apparatus, stage_node_id: 'apparatus' }),
    error => error.code === 'stage_freeze_unsupported');
  await assert.rejects(client.adminProductionMapOrderControl({}, { order_id: order, action: 'freeze', apparatus, stage_freeze_supported: true }),
    error => error.code === 'stage_control_target_invalid');
  await assert.rejects(client.adminProductionMapOrderControl({}, { order_id: order, action: 'delete', apparatus, stage_node_id: 'a', stage_freeze_supported: true }),
    error => error.code === 'stage_control_target_invalid');
});

test('stage API rejects a returned different target; delete requires no JSON response', async () => {
  let body = '{"control":{"state":"frozen","stage_node_id":"wrong"}}';
  const client = api(async () => new Response(body, { status: 200 }));
  await assert.rejects(client.adminProductionMapOrderControl({}, { order_id: order, action: 'freeze', apparatus,
    stage_node_id: 'apparatus', stage_freeze_supported: true }), error => error.code === 'order_control_invalid_response');
  body = '';
  assert.equal(await client.adminProductionMapOrderControl({}, { order_id: order, action: 'delete' }), null);
});
