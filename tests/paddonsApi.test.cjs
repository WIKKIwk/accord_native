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
  loaded.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return loaded.exports;
}
function apiWith(authorizedFetch) {
  const auth = { authorizedFetch };
  const controls = load('workerControlsApi', { './authorizedFetch': auth, './sessionReadScope': load('sessionReadScope') });
  return load('paddonsApi', { './authorizedFetch': auth, './workerControlsApi': controls });
}
const station = 'apparatus:default:asset-010';

test('active paddon replays the V2 scoped GETs', async () => {
  const stem = 'worker_paddon_apparatus_tabs_test';
  const name = 'single cut apparatus toolbar follows tabs and keeps separate pallet selections';
  const route = '/v1/mobile/admin/production-maps/paddons/active';
  const replay = contractFetch(stem, name, { onlyPaths: [route], onlyMethods: ['GET'] });
  const session = recordedSession(stem, name);
  const records = loadContract(stem).filter(item => item.test === name && item.method === 'GET' && new URL(item.url).pathname === route);
  const api = apiWith((s, p, init) => replay(new URL(p, s.baseUrl), { ...init, headers: { Authorization: `Bearer ${s.token}` } }));
  for (const record of records) {
    const apparatus = new URL(record.url).searchParams.get('apparatus');
    assert.equal(await api.activeRezkaPaddon(session, ` ${apparatus} `), JSON.parse(record.responseBody.text).code);
  }
  replay.assertDone();
});

test('active paddon preserves null and untrimmed codes and rejects malformed authority', async () => {
  let response = { ok: true, apparatus: station, code: null };
  const api = apiWith(async () => ({ status: 200, json: async () => response }));
  assert.equal(await api.activeRezkaPaddon({}, station), null);
  response = { ok: true, apparatus: station, code: ' 0001 ' };
  assert.equal(await api.activeRezkaPaddon({}, station), ' 0001 ');
  for (const invalid of [
    {}, { ok: true, apparatus: station }, { ok: true, apparatus: 'other', code: '1' },
    { ok: true, apparatus: station, code: '' }, { ok: true, apparatus: station, code: 1 },
  ]) {
    response = invalid;
    await assert.rejects(api.activeRezkaPaddon({}, station), error => error.code === 'active_paddon_invalid_response');
  }
});

test('active paddon propagates a non-200 domain error', async () => {
  const api = apiWith(async () => ({ status: 403, json: async () => ({ error: 'forbidden' }) }));
  await assert.rejects(api.activeRezkaPaddon({}, station), error => error.code === 'forbidden' && error.statusCode === 403);
});
