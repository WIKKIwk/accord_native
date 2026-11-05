const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
function load(mocks) {
  const filename = path.resolve(__dirname, '../src/authorizedFetch.ts'), loaded = new Module(filename, module);
  loaded.filename = filename; loaded.paths = module.paths;
  loaded.require = id => id === './auth' ? mocks : require(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return loaded.exports;
}
test('image transport stays on the server origin and refreshes one unauthorized response', async () => {
  const old = global.fetch, account = { baseUrl: 'https://example.test', token: 'old' }, seen = [];
  const api = load({ activeSessionToken: s => s.token, refreshSession: async s => { s.token = 'new'; return true; } });
  global.fetch = async (url, init) => { seen.push({ url, authorization: init.headers.get('authorization') }); return { status: seen.length === 1 ? 401 : 200 }; };
  try {
    await assert.rejects(api.authorizedImageFetch(account, 'https://elsewhere.test/image'), /API manzili/);
    assert.equal((await api.authorizedImageFetch(account, '/images/one.png')).status, 200);
    assert.deepEqual(seen.map(item => item.authorization), ['Bearer old', 'Bearer new']);
    await assert.rejects(api.authorizedFetch(account, '/images/one.png'), /API manzili/);
  } finally { global.fetch = old; }
});
