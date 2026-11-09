const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
function load(file, overrides = {}) {
  const filename = path.resolve(__dirname, '../src', file + '.ts');
  const mod = new Module(filename, module); mod.filename = filename; mod.paths = module.paths;
  mod.require = name => Object.hasOwn(overrides, name) ? overrides[name] : require(name);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return mod.exports;
}
const exception = load('shared/mobileApiException');
const controls = load('workerControlsApi', { './authorizedFetch': {}, './sessionReadScope': {} });
function fixture() {
  const requests = []; let status = 200, payload = { ok: true, settings: { automatic_confirmation_enabled: false, revision: 0 } };
  const api = load('admin/qolipStartSettingsApi', { '../authorizedFetch': { authorizedFetch: async (session, url, init = {}) => {
    requests.push({ session, url, init }); return new Response(JSON.stringify(payload), { status });
  } }, '../shared/mobileApiException': exception, '../workerControlsApi': controls });
  return { ...api, requests, setResponse(value, code = 200) { payload = value; status = code; } };
}
test('qolip settings require acknowledged boolean and nonnegative integer revision', async () => {
  const api = fixture();
  assert.deepEqual(await api.qolipStartSettings({}), { automatic_confirmation_enabled: false, revision: 0 });
  for (const invalid of [{}, { ok: false, settings: { automatic_confirmation_enabled: true, revision: 1 } },
    { ok: true, settings: { automatic_confirmation_enabled: true } }, { ok: true, settings: { automatic_confirmation_enabled: 'true', revision: 1 } },
    { ok: true, settings: { automatic_confirmation_enabled: true, revision: -1 } },
    { ok: true, settings: { automatic_confirmation_enabled: true, revision: 1.5 } }]) {
    api.setResponse(invalid); await assert.rejects(api.qolipStartSettings({}), e => e.code === 'qolip_automatic_confirmation_invalid');
  }
  api.setResponse({}, 500); await assert.rejects(api.qolipStartSettings({}), e => e.code === 'qolip_start_settings' && e.statusCode === 500);
});
test('qolip setter verifies the backend actually accepted the requested value', async () => {
  const api = fixture(); api.setResponse({ ok: true, settings: { automatic_confirmation_enabled: true, revision: 3 } });
  assert.deepEqual(await api.setQolipAutomaticConfirmationEnabled({}, true), { automatic_confirmation_enabled: true, revision: 3 });
  assert.equal(api.requests[0].url, '/v1/mobile/admin/production-maps/qolip-start-settings');
  assert.equal(api.requests[0].init.method, 'PUT');
  assert.deepEqual(JSON.parse(api.requests[0].init.body), { automatic_confirmation_enabled: true });
  api.setResponse({ ok: true, settings: { automatic_confirmation_enabled: false, revision: 4 } });
  await assert.rejects(api.setQolipAutomaticConfirmationEnabled({}, true), e => e.code === 'qolip_automatic_confirmation_invalid');
});
// @v2-test test/qolip_start_settings_api_test.dart, independently passed in the f119 oracle.
for (const name of ['mold setting read and writes preserve the server revision', 'unacknowledged or malformed settings cannot enable bypass']) {
  test(`qolip setting replays f119: ${name}`, async () => {
    const { contractFetch, recordedSession } = require('./support/contractFetch.cjs');
    const stem = 'f11910bb/qolip_start_settings_api_test';
    const replay = contractFetch(stem, name), session = recordedSession(stem, name);
    const api = load('admin/qolipStartSettingsApi', { '../authorizedFetch': { authorizedFetch: (s, p, init = {}) =>
      replay(new URL(p, s.baseUrl), { ...init, headers: { ...init.headers, Authorization: `Bearer ${s.token}` } }) },
      '../shared/mobileApiException': exception, '../workerControlsApi': controls });
    if (name.startsWith('mold setting')) {
      assert.deepEqual(await api.qolipStartSettings(session), { automatic_confirmation_enabled: false, revision: 0 });
      assert.deepEqual(await api.setQolipAutomaticConfirmationEnabled(session, true), { automatic_confirmation_enabled: true, revision: 1 });
      assert.deepEqual(await api.setQolipAutomaticConfirmationEnabled(session, false), { automatic_confirmation_enabled: false, revision: 2 });
    } else {
      for (let index = 0; index < 4; index++) await assert.rejects(api.setQolipAutomaticConfirmationEnabled(session, true), e =>
        e.code === 'qolip_automatic_confirmation_invalid');
    }
    replay.assertDone();
  });
}
