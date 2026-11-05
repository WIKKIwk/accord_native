const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
function load(name, mocks = {}) {
  const filename = path.resolve(__dirname, `../src/${name}.ts`), loaded = new Module(filename, module);
  loaded.filename = filename; loaded.paths = module.paths;
  loaded.require = id => Object.hasOwn(mocks, id) ? mocks[id] : id.startsWith('./') ? load(id.slice(2), mocks) : require(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return loaded.exports;
}
test('unlock verifies the returned paddon identity', async () => {
  let code = 'P1';
  const api = load('paddonUnlockApi', { './authorizedFetch': { authorizedFetch: async (_s, path, init) => { assert.equal(path, '/v1/mobile/admin/production-maps/paddons/unlock'); assert.equal(JSON.parse(init.body).code, 'P1'); return { status: 200, json: async () => ({ ok: true, paddon: { code }, items: [] }) }; } } });
  assert.equal((await api.unlockPaddon({}, ' P1 ')).paddon.code, 'P1');
  code = 'P2'; await assert.rejects(api.unlockPaddon({}, 'P1'), e => e.code === 'paddon_unlock');
});
