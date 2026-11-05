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
function api(fetch) { return load('productionMapReadApi', { './authorizedFetch': { authorizedFetch: fetch } }); }

// @v2-test test/production_map_load_api_test.dart
for (const status of [403, 404, 500, 502, 503]) test(`HTTP ${status} without domain error does not mean map missing`, async () => {
  const stem = 'production_map_load_api_test', name = `HTTP ${status} without domain error does not mean map missing`;
  const replay = contractFetch(stem, name), session = recordedSession(stem, name);
  const client = api((s, p, init = {}) => replay(new URL(p, s.baseUrl), { ...init, headers: { Authorization: `Bearer ${s.token}` } }));
  await assert.rejects(client.adminProductionMap(session, ' template-existing '), error => error.statusCode === status && error.code !== 'map_not_found');
  replay.assertDone();
});

test('explicit map_not_found response preserves the HTTP status', async () => {
  const stem = 'production_map_load_api_test', name = 'explicit map_not_found response preserves the HTTP status';
  const replay = contractFetch(stem, name), session = recordedSession(stem, name);
  const client = api((s, p, init = {}) => replay(new URL(p, s.baseUrl), { ...init, headers: { Authorization: `Bearer ${s.token}` } }));
  await assert.rejects(client.adminProductionMap(session, 'template-missing'), error => error.statusCode === 404 && error.code === 'map_not_found');
  replay.assertDone();
});

test('production map decodes a saved map and its program', async () => {
  const client = api(async () => new Response('{"map":{"id":"map"},"program":{}}', { status: 200 }));
  const result = await client.adminProductionMap({}, 'map');
  assert.equal(result.map.id, 'map');
  assert.deepEqual(result.program.operations, []);
});

// V2 has no recorded production-map list request; the request follows its source.
test('production map list fetches and decodes all saved maps', async () => {
  let url;
  const client = api(async (_session, requested) => { url = requested;
    return new Response('[{"map":{"id":"one"},"program":{}},{"map":{"id":"two"},"program":{}}]', { status: 200 }); });
  const result = await client.adminProductionMaps({});
  assert.equal(url, '/v1/mobile/admin/production-maps');
  assert.deepEqual(result.map(item => item.map.id), ['one', 'two']);
});
