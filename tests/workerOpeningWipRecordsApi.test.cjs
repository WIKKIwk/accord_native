const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
function load(name, mocks = {}) {
  const filename = path.resolve(__dirname, `../src/${name}.ts`);
  const loaded = new Module(filename, module);
  loaded.filename = filename; loaded.paths = module.paths;
  loaded.require = id => Object.hasOwn(mocks, id) ? mocks[id] : id.startsWith('./') ? load(id.slice(2), mocks) : require(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return loaded.exports;
}
function api(fetch) { return load('workerOpeningWipRecordsApi', { './authorizedFetch': { authorizedFetch: fetch },
  './workerOpeningWip': { openingWipBatch: batch => batch } }); }

// V2 has no recorded HTTP GET for this method; the request follows the baseline source.
test('opening WIP records clamp the limit and preserve intake and batch fields', async () => {
  let url;
  const client = api(async (_session, requested) => {
    url = new URL(requested, 'https://example.test');
    return new Response(JSON.stringify({ records: [null, { intake: { order_id: ' order ', source_apparatus: ' machine ',
      resume_stage_node_id: 'stage', actor: { ref_: ' user ', display_name: ' Worker ' }, created_at_unix: 3.9 },
      batches: [null, { batch_id: 'batch' }] }] }), { status: 200 });
  });
  const [record] = await client.adminOpeningWipRecords({}, { order_id: ' order ', status: ' Waiting ', limit: 1000 });
  assert.equal(url.pathname, '/v1/mobile/admin/production-maps/opening-wip');
  assert.deepEqual(Object.fromEntries(url.searchParams), { limit: '500', order_id: 'order', status: 'Waiting' });
  assert.equal(record.intake.order_id, 'order');
  assert.equal(record.intake.actor_ref, 'user');
  assert.equal(record.intake.created_at_unix, 3);
  assert.equal(client.openingWipIntakeSourceStageNodeId(record.intake), 'stage');
  assert.deepEqual(record.batches, [{ batch_id: 'batch' }]);
});

test('opening WIP records apply default and minimum limits and handle malformed lists', async () => {
  let url, body = '{}';
  const client = api(async (_session, requested) => { url = new URL(requested, 'https://example.test'); return new Response(body, { status: 200 }); });
  assert.deepEqual(await client.adminOpeningWipRecords({}, { limit: -2, order_id: ' ' }), []);
  assert.deepEqual(Object.fromEntries(url.searchParams), { limit: '1' });
  await client.adminOpeningWipRecords({});
  assert.equal(url.searchParams.get('limit'), '100');
  body = '{"records":{}}';
  await assert.rejects(client.adminOpeningWipRecords({}), /Invalid opening WIP records/);
});
