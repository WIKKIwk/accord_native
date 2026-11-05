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
test('mobile push configuration validates the platform identity', async () => {
  const config = { project_id: 'project-1', app_id: '1:123:android:abc', api_key: 'AIza123', messaging_sender_id: '123', application_id: 'com.example.accord_mobile_v2' };
  const api = load('mobilePushConfigApi', { './authorizedFetch': { authorizedFetch: async (_s, path) => { assert.equal(path, '/v1/mobile/push-config'); return { status: 200, json: async () => ({ android: config }) }; } } });
  assert.deepEqual(await api.mobilePushConfig({}, 'android'), config); assert.equal(await api.mobilePushConfig({}, 'ios'), null);
  config.application_id = 'wrong'; await assert.rejects(api.mobilePushConfig({}, 'android'), /Invalid Firebase client configuration/);
});
