const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const { contractFetch, recordedSession } = require('./support/contractFetch.cjs');
function load(name, mocks = {}) {
  const filename = path.resolve(__dirname, `../src/${name}.ts`), loaded = new Module(filename, module);
  loaded.filename = filename; loaded.paths = module.paths;
  loaded.require = id => Object.hasOwn(mocks, id) ? mocks[id] : id.startsWith('./') ? load(id.slice(2), mocks) : require(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return loaded.exports;
}
test('transfer API validates the confirmed source, destination and selected WIPs', async () => {
  const stem = 'paddon_transfer_test', name = 'transfer API validates the confirmed source, destination and selected WIPs';
  const replay = contractFetch(stem, name), session = recordedSession(stem, name);
  const api = load('paddonTransferApi', { './authorizedFetch': { authorizedFetch: (s, p, init = {}) => replay(new URL(p, s.baseUrl), { ...init, headers: { ...init.headers, Authorization: `Bearer ${s.token}` } }) } });
  await api.transferPaddonItems(session, '00001', '00002', ['roll-1']);
  await assert.rejects(api.transferPaddonItems(session, '00002', '00001', ['roll-1']), e => e.code === 'paddon_transfer');
  replay.assertDone();
});
