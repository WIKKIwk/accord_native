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
const lamination = load('workerLaminationRemainders', { './workerControlsApi': controls, './workerProgressBatch': {} });
function fixture() {
  const requests = []; let status = 200, payload = {};
  const api = load('admin/productionSettingsApi', { '../authorizedFetch': { authorizedFetch: async (session, url, init = {}) => {
    requests.push({ session, url, init }); return new Response(JSON.stringify(payload), { status });
  } }, '../shared/mobileApiException': exception, '../workerControlsApi': controls, '../workerLaminationRemainders': lamination });
  return { ...api, requests, setResponse(value, code = 200) { payload = value; status = code; } };
}
test('paddon settings require a boolean, default absent worker visibility, and verify requested changes', async () => {
  const api = fixture(); api.setResponse({ ok: true, settings: { free_movement_enabled: true } });
  assert.deepEqual(await api.paddonManagementSettings({}), { free_movement_enabled: true, worker_visibility_enabled: false });
  api.setResponse({ ok: true, settings: { free_movement_enabled: true, worker_visibility_enabled: true } });
  await api.updatePaddonManagementSettings({}, { workerVisibilityEnabled: true });
  assert.deepEqual(JSON.parse(api.requests[1].init.body), { worker_visibility_enabled: true });
  await assert.rejects(api.updatePaddonManagementSettings({}, { freeMovementEnabled: false }), e => e.code === 'paddon_management_settings');
  api.setResponse({ ok: true, settings: { free_movement_enabled: true, worker_visibility_enabled: 'true' } });
  await assert.rejects(api.paddonManagementSettings({}), e => e.code === 'paddon_management_settings');
});
test('lamination switches validate both response booleans and only send specified fields', async () => {
  const api = fixture();
  await assert.rejects(api.setLaminationLabelSettings({}, {}), /A label switch is required/);
  assert.equal(api.requests.length, 0);
  api.setResponse({ ok: true, settings: { print_wip_remainder_labels: false, print_film_remainder_labels: true } });
  assert.deepEqual(await api.setLaminationLabelSettings({}, { printWipRemainderLabels: false }),
    { print_wip_remainder_labels: false, print_film_remainder_labels: true });
  assert.deepEqual(JSON.parse(api.requests[0].init.body), { print_wip_remainder_labels: false });
  await assert.rejects(api.setLaminationLabelSettings({}, { printWipRemainderLabels: true }), e => e.code === 'lamination_settings');
  api.setResponse({ ok: true, settings: { print_wip_remainder_labels: true } });
  await assert.rejects(api.laminationLabelSettings({}), e => e.code === 'lamination_label_backend_required');
});
// @v2-test test/admin_additional_settings_test.dart: both cases passed independently in the f119 oracle.
for (const name of ['admin confirms enable and can disable the shared server setting', 'lamination label switches persist independently for each layer']) {
  test(`production settings replay f119: ${name}`, async () => {
    const { contractFetch, recordedSession } = require('./support/contractFetch.cjs');
    const stem = 'f11910bb/admin_additional_controls_test';
    const paddon = name.startsWith('admin confirms');
    const path = paddon ? '/v1/mobile/admin/production-maps/paddons/management-settings' : '/v1/mobile/admin/production-maps/lamination-settings';
    const replay = contractFetch(stem, name, { onlyPaths: [path] }), session = recordedSession(stem, name);
    const api = load('admin/productionSettingsApi', { '../authorizedFetch': { authorizedFetch: (s, p, init = {}) =>
      replay(new URL(p, s.baseUrl), { ...init, headers: { ...init.headers, Authorization: `Bearer ${s.token}` } }) },
      '../shared/mobileApiException': exception, '../workerControlsApi': controls, '../workerLaminationRemainders': lamination });
    if (paddon) {
      assert.deepEqual(await api.paddonManagementSettings(session), { free_movement_enabled: false, worker_visibility_enabled: true });
      assert.equal(await api.setPaddonFreeMovementEnabled(session, true), true);
      assert.equal(await api.setPaddonFreeMovementEnabled(session, false), false);
    } else {
      assert.deepEqual(await api.laminationLabelSettings(session), { print_wip_remainder_labels: true, print_film_remainder_labels: true });
      assert.deepEqual(await api.setLaminationLabelSettings(session, { printWipRemainderLabels: false }),
        { print_wip_remainder_labels: false, print_film_remainder_labels: true });
      assert.deepEqual(await api.laminationLabelSettings(session), { print_wip_remainder_labels: false, print_film_remainder_labels: true });
      assert.deepEqual(await api.setLaminationLabelSettings(session, { printFilmRemainderLabels: false }),
        { print_wip_remainder_labels: false, print_film_remainder_labels: false });
    }
    replay.assertDone();
  });
}
