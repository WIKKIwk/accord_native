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
function api(fetch) { return load('productionMapReplayApi', { './authorizedFetch': { authorizedFetch: fetch } }); }

// V2 has no recorded replay HTTP request; these assertions follow the baseline source.
test('production replay preserves requested scope and assigns the envelope epoch to each delta', async () => {
  let url;
  const client = api(async (_session, requested) => { url = new URL(requested, 'https://example.test');
    return new Response(JSON.stringify({ epoch: 'server', events: [null, { epoch: 'old', apparatus: 'a', base_revision: '1', revision: 2,
      ops: [{ type: 'move', id: 'one', after_id: 'two' }] }] }), { status: 200 }); });
  const [event] = await client.adminProductionMapReplay({}, { apparatus: ' a ', from_rev: 1, to_rev: 2 });
  assert.equal(url.pathname, '/v1/mobile/admin/production-maps/replay');
  assert.deepEqual(Object.fromEntries(url.searchParams), { apparatus: ' a ', from_rev: '1', to_rev: '2' });
  assert.equal(event.epoch, 'server');
  assert.equal(event.base_revision, 1);
  assert.equal(event.ops[0].after_id, 'two');
});

test('production replay accepts missing events and preserves server errors', async () => {
  let response = new Response('{}', { status: 200 });
  const client = api(async () => response);
  assert.deepEqual(await client.adminProductionMapReplay({}, { apparatus: '', from_rev: 0, to_rev: 0 }), []);
  response = new Response('{"error":"replay_gap"}', { status: 409 });
  await assert.rejects(client.adminProductionMapReplay({}, { apparatus: '', from_rev: 0, to_rev: 0 }), error => error.code === 'replay_gap');
});
