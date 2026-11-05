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
function api(fetch) { return load('productionCompletionApi', { './authorizedFetch': { authorizedFetch: fetch } }); }

// V2 has no recorded HTTP decisions request; assertions follow the baseline source.
test('completion decisions decode worker and decision details', async () => {
  let url;
  const client = api(async (_session, requested) => { url = requested; return new Response(JSON.stringify({ completion_request_decisions: [
    { event_id: 'event', apparatus: 'apparatus:default:asset-005', worker_ref: 'worker', decision: 'approved', created_at_unix: 10.9 } ] }), { status: 200 }); });
  const [decision] = await client.adminProductionMapCompletionRequestDecisions({});
  assert.equal(url, '/v1/mobile/admin/production-maps/completion-request-decisions');
  assert.equal(decision.worker_ref, 'worker');
  assert.equal(decision.decision, 'approved');
  assert.equal(decision.created_at_unix, 10);
});

test('completion decisions reject invalid items and accept a missing list', async () => {
  let body = '{}';
  const client = api(async () => new Response(body, { status: 200 }));
  assert.deepEqual(await client.adminProductionMapCompletionRequestDecisions({}), []);
  body = '{"completion_request_decisions":[null]}';
  await assert.rejects(client.adminProductionMapCompletionRequestDecisions({}), /Invalid completion decision/);
});
