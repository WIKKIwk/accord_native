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
function api(fetch) { return load('workerOpeningWipCandidatesApi', { './authorizedFetch': { authorizedFetch: fetch },
  './workerOpeningWip': { openingWipBatch: batch => ({ decoded: batch }) } }); }

// V2 has no recorded HTTP request for this method; it follows the baseline source.
test('opening WIP candidates use blank QR lookup and decode only object batches', async () => {
  let url, body;
  const client = api(async (_session, requested, init) => {
    url = requested; body = JSON.parse(init.body);
    return new Response(JSON.stringify({ batches: [null, { batch_id: 'b' }, 1] }), { status: 200 });
  });
  const batches = await client.adminOpeningWipCandidates({}, { apparatus: ' machine ', order_id: ' order ' });
  assert.equal(url, '/v1/mobile/admin/production-maps/opening-wip/lookup');
  assert.deepEqual(body, { apparatus: 'machine', order_id: 'order', qr_payload: '' });
  assert.deepEqual(batches, [{ decoded: { batch_id: 'b' } }]);
});

test('opening WIP candidates reject malformed lists and preserve server errors', async () => {
  let response = new Response('{"batches":{}}', { status: 200 });
  const client = api(async () => response);
  await assert.rejects(client.adminOpeningWipCandidates({}, { apparatus: '', order_id: '' }), /Invalid opening WIP batches/);
  response = new Response('{"error":"opening_wip_lookup"}', { status: 409 });
  await assert.rejects(client.adminOpeningWipCandidates({}, { apparatus: '', order_id: '' }), error => error.code === 'opening_wip_lookup');
});
