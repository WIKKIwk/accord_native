const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
function load(fetch) {
  const filename = path.resolve(__dirname, '../src/admin/adminSettings.ts');
  const mod = new Module(filename, module); mod.filename = filename; mod.paths = module.paths;
  mod.require = name => name === '../authorizedFetch' ? { authorizedFetch: fetch } : require(name);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return mod.exports;
}
function fixture() {
  let status = 200, payload = {}; const requests = [];
  const api = load(async (session, url, init = {}) => {
    requests.push({ session, url, init }); return new Response(JSON.stringify(payload), { status });
  });
  return { ...api, requests, setResponse(value, code = 200) { payload = value; status = code; } };
}
const session = { token: 'test' };
test('admin settings parser retains all fields, defaults and strict field types', () => {
  const api = fixture();
  const defaults = { erp_url: '', erp_api_key: '', erp_api_secret: '', default_target_warehouse: '', default_uom: '',
    werka_phone: '', werka_name: '', werka_avatar_url: '', werka_code: '', werka_code_locked: false,
    werka_code_retry_after_sec: 0, admin_phone: '', admin_name: '' };
  assert.deepEqual(api.adminSettingsFromJson({}), defaults);
  assert.deepEqual(api.adminSettingsFromJson({ ...defaults, default_uom: 'kg', werka_code_locked: true }),
    { ...defaults, default_uom: 'kg', werka_code_locked: true });
  assert.throws(() => api.adminSettingsFromJson(null), TypeError);
  assert.throws(() => api.adminSettingsFromJson({ admin_name: 2 }), TypeError);
  assert.throws(() => api.adminSettingsFromJson({ werka_code_locked: 1 }), TypeError);
  assert.throws(() => api.adminSettingsFromJson({ werka_code_retry_after_sec: 1.5 }), TypeError);
});

// V2's test-mode case does not record an HTTP request. These mocks follow the f119 source.
test('read and update preserve V2 route, methods, complete body and failure behavior', async () => {
  const api = fixture(); api.setResponse({ default_uom: 'kg', admin_name: 'Admin' });
  const settings = await api.adminSettings(session);
  assert.equal(settings.default_uom, 'kg');
  await api.updateAdminSettings(session, { ...settings, unknown: 'excluded' });
  assert.deepEqual(api.requests.map(item => item.url), ['/v1/mobile/admin/settings', '/v1/mobile/admin/settings']);
  assert.deepEqual(api.requests[0].init, {});
  assert.equal(api.requests[1].init.method, 'PUT');
  assert.deepEqual(api.requests[1].init.headers, { 'Content-Type': 'application/json' });
  assert.deepEqual(JSON.parse(api.requests[1].init.body), settings);
  api.setResponse({}, 403);
  await assert.rejects(api.adminSettings(session), /Admin settings failed/);
  await assert.rejects(api.updateAdminSettings(session, settings), /Admin settings update failed/);
});
