const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
function load(file, overrides = {}) {
  const filename = path.resolve(__dirname, '../src', file + '.ts');
  const mod = new Module(filename, module); mod.filename = filename; mod.paths = module.paths;
  mod.require = name => Object.hasOwn(overrides, name) ? overrides[name] : name === 'expo/fetch' ? require('./support/expoFetch.cjs') : require(name);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return mod.exports;
}
const routes = load('shared/appRoutes');
const scope = load('sessionReadScope');
const exception = load('shared/mobileApiException');
const controls = load('workerControlsApi', { './authorizedFetch': {}, './sessionReadScope': {} });
const lamination = load('workerLaminationRemainders', { './workerControlsApi': controls, './workerProgressBatch': {} });
function fixture(refreshAction = () => {}) {
  const session = { baseUrl: 'https://server.example', token: 'initial', profile: { role: 'admin', ref: 'example' }, capabilities: ['admin.access'] };
  let active = session;
  const auth = { activeSessionToken: value => value === active ? value.token : null,
    refreshSession: async value => { refreshAction(value, () => { active = { ...value }; }); return true; } };
  const guard = load('admin/additionalSettingsSendGuard', { '../auth': auth, '../sessionReadScope': scope, '../shared/appRoutes': routes });
  const transport = load('authorizedFetch', { './auth': auth });
  const production = load('admin/productionSettingsApi', { '../authorizedFetch': transport, '../shared/mobileApiException': exception,
    '../workerControlsApi': controls, '../workerLaminationRemainders': lamination });
  return { session, guard: () => guard.additionalSettingsSendGuard(session), production, switchAccount: () => { active = { ...session }; } };
}
const response = () => new Response(JSON.stringify({ ok: true, settings: { free_movement_enabled: true, worker_visibility_enabled: false } }), { status: 200 });

test('all additional-settings reads and writes forward their optional per-attempt guard', async () => {
  const seen = [], beforeSend = () => {}, transport = { authorizedFetch: async (_session, url, _init, guard) => {
    seen.push([url, guard]);
    const settings = url.includes('paddons') ? { free_movement_enabled: true, worker_visibility_enabled: false } :
      url.includes('lamination') ? { print_wip_remainder_labels: true, print_film_remainder_labels: true } :
      url.includes('qolip') ? { automatic_confirmation_enabled: true, revision: 1 } : { mandatory_updates_enabled: true };
    return new Response(JSON.stringify({ ok: true, settings }), { status: 200 });
  } };
  const p = load('admin/productionSettingsApi', { '../authorizedFetch': transport, '../shared/mobileApiException': exception,
    '../workerControlsApi': controls, '../workerLaminationRemainders': lamination });
  const a = load('admin/appUpdateSettingsApi', { '../authorizedFetch': transport, '../shared/mobileApiException': exception });
  const q = load('admin/qolipStartSettingsApi', { '../authorizedFetch': transport, '../shared/mobileApiException': exception, '../workerControlsApi': controls });
  const session = {};
  await p.paddonManagementSettings(session, beforeSend); await p.updatePaddonManagementSettings(session, { freeMovementEnabled: true }, beforeSend);
  await p.laminationLabelSettings(session, beforeSend); await p.setLaminationLabelSettings(session, { printWipRemainderLabels: true }, beforeSend);
  await a.mandatoryAppUpdatesEnabled(session, beforeSend); await a.setMandatoryAppUpdatesEnabled(session, true, beforeSend);
  await q.qolipStartSettings(session, beforeSend); await q.setQolipAutomaticConfirmationEnabled(session, true, beforeSend);
  assert.equal(seen.length, 8); assert.ok(seen.every(([, callback]) => callback === beforeSend));
});

test('guard rejects an initial request after scope, permission, or session changes', async () => {
  for (const mutate of [f => { f.session.profile.role = 'rezka_master'; f.session.capabilities = ['rezka.master.access']; },
    f => { f.session.capabilities = []; }, f => f.switchAccount()]) {
    const f = fixture(), beforeSend = f.guard(); mutate(f);
    const original = global.fetch; let sends = 0; global.fetch = async () => { sends++; return response(); };
    try { await assert.rejects(f.production.updatePaddonManagementSettings(f.session, { freeMovementEnabled: true }, beforeSend)); assert.equal(sends, 0); }
    finally { global.fetch = original; }
  }
});

test('guard blocks a 401 retry after role, capability or account changes', async () => {
  for (const mutate of [(session) => { session.profile.role = 'rezka_master'; session.capabilities = ['rezka.master.access']; },
    session => { session.capabilities = []; }, (_session, switchAccount) => switchAccount()]) {
    const f = fixture(mutate), original = global.fetch, sends = [];
    global.fetch = async (_url, init) => { sends.push(init); return sends.length === 1 ? new Response('', { status: 401 }) : response(); };
    try { await assert.rejects(f.production.updatePaddonManagementSettings(f.session, { freeMovementEnabled: true }, f.guard())); assert.equal(sends.length, 1); }
    finally { global.fetch = original; }
  }
});

test('401 retry continues when only the token refreshes and scope is unchanged', async () => {
  const f = fixture(session => { session.token = 'refreshed'; }), original = global.fetch, tokens = [];
  global.fetch = async (_url, init) => { tokens.push(new Headers(init.headers).get('authorization')); return tokens.length === 1 ? new Response('', { status: 401 }) : response(); };
  try {
    assert.equal((await f.production.updatePaddonManagementSettings(f.session, { freeMovementEnabled: true }, f.guard())).free_movement_enabled, true);
    assert.deepEqual(tokens, ['Bearer initial', 'Bearer refreshed']);
  } finally { global.fetch = original; }
});

test('settings hook applies a session-bound guard to each read and write', async () => {
  let dependencies; const calls = [], guards = [];
  class Controller { constructor(value) { dependencies = value; } subscribe() {} getSnapshot() { return {}; } }
  const record = name => (...args) => { calls.push([name, args]); return Promise.resolve(); };
  const session = { profile: { role: 'admin' } };
  const hook = load('admin/useAdditionalSettings', { react: { useMemo: fn => fn(), useEffect() {}, useSyncExternalStore: () => ({}) },
    '../auth': { activeSessionToken: () => 'token', registerSessionResetHook: () => () => {} }, '../sessionReadScope': { sessionReadScope: () => 'scope' },
    '../shared/appRoutes': { appRoutes: { adminAdditionalSettings: '/admin-additional-settings' }, canOpenRoute: () => true },
    './additionalSettingsController': { AdditionalSettingsController: Controller },
    './additionalSettingsSendGuard': { additionalSettingsSendGuard: value => { assert.equal(value, session); const guard = () => {}; guards.push(guard); return guard; } },
    './appUpdateSettingsApi': { mandatoryAppUpdatesEnabled: record('readApp'), setMandatoryAppUpdatesEnabled: record('writeApp') },
    './productionSettingsApi': { paddonManagementSettings: record('readPaddon'), updatePaddonManagementSettings: record('writePaddon'),
      laminationLabelSettings: record('readLamination'), setLaminationLabelSettings: record('writeLamination') },
    './qolipStartSettingsApi': { qolipStartSettings: record('readQolip'), setQolipAutomaticConfirmationEnabled: record('writeQolip') } });
  hook.useAdditionalSettings(session);
  await dependencies.readPaddon(); await dependencies.writePaddon({ freeMovementEnabled: true });
  await dependencies.readAppUpdate(); await dependencies.writeAppUpdate(true);
  await dependencies.readLamination(); await dependencies.writeLamination({ printWipRemainderLabels: true });
  await dependencies.readQolip(); await dependencies.writeQolip(true);
  assert.equal(calls.length, 8); assert.equal(guards.length, 8);
  calls.forEach(([, args], index) => { assert.equal(args[0], session); assert.equal(args.at(-1), guards[index]); });
});
