const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const test = require('node:test');
const ts = require('typescript');
function load(file, mocks = {}) {
  const filename = path.resolve(__dirname, '../src', file + '.ts'), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths;
  mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return mod.exports;
}
const models = load('shared/appUpdateModels');
const { installedAppInfo } = load('shared/appUpdateNativeInfo', { './appUpdateModels': models });
const { AppUpdateService } = load('shared/appUpdateService', { './appUpdateModels': models });

test('installed version uses native application metadata and refuses missing data', () => {
  const info = installedAppInfo({ applicationId: 'com.accord.mobilev4', nativeApplicationVersion: '1.2', nativeBuildVersion: '23' });
  assert.equal(info.packageName, 'com.accord.mobilev4');
  assert.equal(info.versionName, '1.2');
  assert.equal(info.versionCode, 23);
  for (const native of [null, {}, { applicationId: 'app', nativeApplicationVersion: '1', nativeBuildVersion: '1.5' }]) {
    assert.throws(() => installedAppInfo(native), error => error.code === 'app_info_failed');
  }
});

test('manual update check reads the server without requiring an APK installer', async () => {
  const calls = [];
  const service = new AppUpdateService({ baseUrl: 'https://example.test', storage: {},
    platform: { isSupported: false, currentAppInfo: async () => installedAppInfo({ applicationId: 'app', nativeApplicationVersion: '1', nativeBuildVersion: '2' }) },
    fetch: async (url, options) => { calls.push({ url, options }); return new Response(null, { status: 204 }); } });
  const result = await service.check();
  assert.equal(result.updateAvailable, false);
  assert.equal(result.current.versionCode, 2);
  assert.deepEqual(calls, [{ url: 'https://example.test/v1/mobile/app-update/android', options: { method: 'GET' } }]);
});
