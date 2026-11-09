const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
function load(name, mocks = {}) {
  const filename = path.resolve(__dirname, `../src/${name}.ts`), loaded = new Module(filename, module);
  loaded.filename = filename; loaded.paths = module.paths;
  loaded.require = id => Object.hasOwn(mocks, id) ? mocks[id] : id.startsWith('./') ? load(id.slice(2), mocks) : id === 'expo/fetch' ? require('./support/expoFetch.cjs') : require(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return loaded.exports;
}
test('authenticate account leaves supplied credentials intact and parses profile assignments', async () => {
  const original = global.fetch; let request;
  global.fetch = async (url, init) => { request = { url, ...init }; return { status: 200, json: async () => ({ token: ' token ', profile: { role: ' aparatchi ', ref: 'one', assigned_warehouses: ['W'] }, capabilities: ['run'], assigned_apparatus: [' apparatus:default:press ', 'apparatus:default:press'], assigned_apparatus_labels: [' Print '] }) }; };
  try {
    const result = await load('authenticateAccount', { './authorizedFetch': {} }).authenticateAccount('example.test', ' +998 ', ' 123 ');
    assert.equal(request.url, 'https://example.test/v1/mobile/auth/login');
    assert.equal(request.credentials, 'omit');
    assert.equal(request.redirect, 'manual');
    assert.deepEqual(JSON.parse(request.body), { phone: ' +998 ', code: ' 123 ' });
    assert.equal(result.token, 'token'); assert.deepEqual(result.profile.assigned_apparatus, ['apparatus:default:press']);
    assert.deepEqual(result.profile.assigned_warehouses, ['W']); assert.equal(result.werka_home, null);
  } finally { global.fetch = original; }
});
test('authenticate account rejects non-HTTPS and invalid sessions', async () => {
  const original = global.fetch;
  global.fetch = async () => ({ status: 200, json: async () => ({ token: ' ', profile: {} }) });
  try {
    const { authenticateAccount } = load('authenticateAccount', { './authorizedFetch': {} });
    await assert.rejects(authenticateAccount('http://example.test', '', ''), /HTTPS/);
    await assert.rejects(authenticateAccount('https://example.test', '', ''), e => e.statusCode === 200);
  } finally { global.fetch = original; }
});
