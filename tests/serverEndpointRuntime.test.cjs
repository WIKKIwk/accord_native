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
function storage() {
  const values = new Map();
  return { values, getItem: async key => values.get(key) ?? null, setItem: async (key, value) => { values.set(key, value); },
    removeItem: async key => { values.delete(key); } };
}

test('the shared API base URL follows the persisted active server', async () => {
  const prefs = storage();
  prefs.values.set('active_server_endpoint', 'https://selected.test');
  const runtime = load('serverEndpointRuntime', { './appPreferences': { appPreferences: prefs } });
  const { MobileApi } = load('mobileApi', { './serverEndpointRuntime': runtime });
  const [first, second] = await Promise.all([runtime.initializeServerEndpoints(), runtime.initializeServerEndpoints()]);
  assert.equal(first, second);
  assert.equal(MobileApi.instance, MobileApi.instance);
  assert.equal(MobileApi.instance.baseUrl, 'https://selected.test');
  assert.equal(MobileApi.baseUrl, 'https://selected.test');
  await first.setBaseUrl('other.test');
  assert.equal(MobileApi.instance.baseUrl, 'https://other.test');
  assert.equal(MobileApi.baseUrl, 'https://other.test');
  assert.equal((await runtime.initializeServerEndpoints()).baseUrl, 'https://other.test');
});
