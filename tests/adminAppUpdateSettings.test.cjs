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
function fixture() {
  const requests = []; let status = 200, payload = { ok: true, settings: { mandatory_updates_enabled: false } };
  const api = load('admin/appUpdateSettingsApi', { '../authorizedFetch': { authorizedFetch: async (session, url, init = {}) => {
    requests.push({ session, url, init }); return new Response(JSON.stringify(payload), { status });
  } }, '../shared/mobileApiException': exception });
  return { ...api, requests, setResponse(value, code = 200) { payload = value; status = code; } };
}
test('mandatory updates read requires the acknowledged boolean', async () => {
  const api = fixture();
  assert.equal(await api.mandatoryAppUpdatesEnabled({}), false);
  assert.equal(api.requests[0].url, '/v1/mobile/admin/app-update/settings');
  for (const invalid of [{}, { ok: false, settings: { mandatory_updates_enabled: true } },
    { ok: true, settings: { mandatory_updates_enabled: 'true' } }, { ok: true, settings: [] }]) {
    api.setResponse(invalid);
    await assert.rejects(api.mandatoryAppUpdatesEnabled({}), e => e.code === 'app_update_settings_failed' &&
      e.message === 'Yangilash sozlamasi yuklanmadi' && e.statusCode === 200);
  }
  api.setResponse({}, 503);
  await assert.rejects(api.mandatoryAppUpdatesEnabled({}), e => e.code === 'app_update_settings_failed' && e.statusCode === 503);
});
test('mandatory updates write sends the choice and verifies the server echo', async () => {
  const api = fixture(); api.setResponse({ ok: true, settings: { mandatory_updates_enabled: true } });
  assert.equal(await api.setMandatoryAppUpdatesEnabled({}, true), true);
  assert.equal(api.requests[0].init.method, 'PUT');
  assert.deepEqual(JSON.parse(api.requests[0].init.body), { mandatory_updates_enabled: true });
  api.setResponse({ ok: true, settings: { mandatory_updates_enabled: false } });
  await assert.rejects(api.setMandatoryAppUpdatesEnabled({}, true), e => e.code === 'app_update_settings_failed' &&
    e.message === 'Yangilash sozlamasi saqlanmadi' && e.statusCode === null);
});
// @v2-test test/admin_additional_settings_test.dart, independently passed in the f119 oracle.
test('mandatory updates replay the f119 screen read, enable, reread and disable', async () => {
  const { contractFetch, recordedSession } = require('./support/contractFetch.cjs');
  const stem = 'f11910bb/admin_additional_settings_test', name = 'admin can persist and disable mandatory updates independently';
  const replay = contractFetch(stem, name, { onlyPaths: ['/v1/mobile/admin/app-update/settings'] });
  const session = recordedSession(stem, name);
  const api = load('admin/appUpdateSettingsApi', { '../authorizedFetch': { authorizedFetch: (s, p, init = {}) =>
    replay(new URL(p, s.baseUrl), { ...init, headers: { ...init.headers, Authorization: `Bearer ${s.token}` } }) },
    '../shared/mobileApiException': exception });
  assert.equal(await api.mandatoryAppUpdatesEnabled(session), false);
  assert.equal(await api.setMandatoryAppUpdatesEnabled(session, true), true);
  assert.equal(await api.mandatoryAppUpdatesEnabled(session), true);
  assert.equal(await api.setMandatoryAppUpdatesEnabled(session, false), false);
  replay.assertDone();
});
