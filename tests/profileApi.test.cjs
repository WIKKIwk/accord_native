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
test('profile updates session only if requested apparatus membership changed', async () => {
  let saved = 0, label = 'New';
  const session = { token: 't', baseUrl: 'https://example.test', profile: { role: 'aparatchi', ref: 'r' }, capabilities: [], assigned_apparatus: ['apparatus:default:a'], assigned_apparatus_labels: ['Old'] };
  const mocks = { './auth': { activeSessionToken: s => s.token, saveSession: async () => { saved++; } }, './authorizedFetch': { authorizedFetch: async () => ({ status: 200, json: async () => ({ role: 'aparatchi', ref: 'r', display_name: label, assigned_apparatus: ['apparatus:default:a'] }) }) } };
  const api = load('profileApi', mocks);
  assert.equal((await api.profile(session, true)).display_name, 'New'); assert.equal(saved, 0); assert.equal(session.assigned_apparatus_labels[0], 'Old');
  await api.profile(session, false); assert.equal(saved, 1); assert.equal(session.profile.display_name, 'New');
});
