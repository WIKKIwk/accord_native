const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const { contractFetch, loadContract, recordedSession } = require('./support/contractFetch.cjs');
function load(name, mocks = {}) {
  const filename = path.resolve(__dirname, `../src/${name}.ts`), loaded = new Module(filename, module);
  loaded.filename = filename; loaded.paths = module.paths;
  loaded.require = id => Object.hasOwn(mocks, id) ? mocks[id] : id.startsWith('./') ? load(id.slice(2), mocks) : require(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return loaded.exports;
}
test('active paddon selection replays apparatus-specific V2 changes', async () => {
  const stem = 'worker_paddon_apparatus_tabs_test', name = 'multiple cut apparatus toolbar follows tabs and keeps separate pallet selections';
  const replay = contractFetch(stem, name, { onlyPaths: ['/v1/mobile/admin/production-maps/paddons/active'], onlyMethods: ['PUT'] }), session = recordedSession(stem, name);
  const records = loadContract(stem).filter(x => x.test === name && x.method === 'PUT' && x.url.endsWith('/paddons/active'));
  const api = load('activePaddonSetApi', { './authorizedFetch': { authorizedFetch: (s, p, init = {}) => replay(new URL(p, s.baseUrl), { ...init, headers: { ...init.headers, Authorization: `Bearer ${s.token}` } }) } });
  for (const record of records) { const body = JSON.parse(record.requestBody.text), result = JSON.parse(record.responseBody.text); assert.equal(await api.setActiveRezkaPaddon(session, body.apparatus, body.code), result.code); }
  replay.assertDone();
});
