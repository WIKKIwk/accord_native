const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
function load(file, mocks = {}) {
  const filename = path.resolve(__dirname, '../src', file + '.ts'), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths;
  mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : id === 'expo/fetch' ? require('./support/expoFetch.cjs') : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return mod.exports;
}
const tick = () => new Promise(resolve => setImmediate(resolve));
const flush = async () => { for (let i = 0; i < 8; i++) await tick(); };
const deferred = () => { let resolve; const promise = new Promise(yes => { resolve = yes; }); return { promise, resolve }; };
function payload(url, body = {}) {
  const settings = url.includes('paddons') ? { free_movement_enabled: false, worker_visibility_enabled: false } : url.includes('lamination')
    ? { print_wip_remainder_labels: true, print_film_remainder_labels: true } : url.includes('qolip')
      ? { automatic_confirmation_enabled: false, revision: 1 } : { mandatory_updates_enabled: false };
  return { ok: true, settings: { ...settings, ...body } };
}
const response = (url, body) => new Response(JSON.stringify(payload(url, body)), { status: 200 });
function fixture() {
  const session = { baseUrl: 'https://server.example', token: 'first', profile: { role: 'admin', ref: 'same' }, capabilities: ['admin.access'] };
  const witness = { session }, listeners = new Set(); let valid = true, epoch = 1, joins = 0, refreshes = 0, join = async () => false;
  const auth = { activeSessionToken: () => session.token, activeSessionEpoch: () => epoch,
    isSessionWitnessCurrent: value => valid && value === witness, registerSessionResetHook: () => () => {},
    subscribeSessionWitness: listener => { listeners.add(listener); return () => listeners.delete(listener); },
    refreshSession: async () => { refreshes++; return false; }, joinRefreshForGuardedRead: async (...args) => { joins++; return join(...args); } };
  const transport = load('authorizedFetch', { './auth': auth });
  const request = load('admin/additionalSettingsRequest', { '../authorizedFetch': transport });
  const exception = load('shared/mobileApiException'), controls = load('workerControlsApi', { './authorizedFetch': {}, './sessionReadScope': {} });
  const lamination = load('workerLaminationRemainders', { './workerControlsApi': controls, './workerProgressBatch': {} });
  const shared = { './additionalSettingsRequest': request, '../shared/mobileApiException': exception, '../workerControlsApi': controls };
  const api = load('admin/productionSettingsApi', { ...shared, '../workerLaminationRemainders': lamination });
  const app = load('admin/appUpdateSettingsApi', shared), qolip = load('admin/qolipStartSettingsApi', shared);
  const scope = load('sessionReadScope'), routes = load('shared/appRoutes');
  const guard = load('admin/additionalSettingsSendGuard', { '../auth': auth, '../sessionReadScope': scope, '../shared/appRoutes': routes,
    '../shared/camera/synchronousGuard': load('shared/camera/synchronousGuard') });
  let owner, effects;
  const react = { useMemo: create => owner ??= create(), useSyncExternalStore: (_subscribe, get) => get(), useEffect: fn => effects.push(fn) };
  const hook = load('admin/useAdditionalSettings', { react, '../auth': auth, '../sessionReadScope': scope, '../shared/appRoutes': routes,
    './additionalSettingsController': load('admin/additionalSettingsController'), './additionalSettingsSendGuard': guard,
    './productionSettingsApi': api, './appUpdateSettingsApi': app, './qolipStartSettingsApi': qolip });
  const render = () => { effects = []; const value = hook.useAdditionalSettings(session, witness, () => valid); return { ...value, mount: () => effects[0]() }; };
  return { session, witness, render, api, app, qolip, guard,
    retire() { valid = false; for (const listener of [...listeners]) listener(); }, restore() { valid = true; },
    advanceEpoch() { epoch++; }, onJoin: callback => { join = callback; }, counts: () => ({ joins, refreshes }) };
}

for (const status of [302, 401]) test(`settings original witness blocks stale ${status} continuation before another send`, async t => {
  const original = global.fetch; t.after(() => { global.fetch = original; }); const f = fixture(), first = deferred(); let sends = 0;
  global.fetch = async () => { sends++; return first.promise; };
  const h = f.render(), cleanup = h.mount(); await tick(); f.retire();
  first.resolve(new Response('', { status, headers: status === 302 ? { location: '/v1/mobile/next' } : {} })); await flush();
  assert.equal(sends, 1); assert.equal(h.controller.getSnapshot().screen, 'forbidden');
  assert.deepEqual(f.counts(), { joins: 0, refreshes: 0 }); cleanup();
});

test('settings reads only join an independent refresh and keep V2 Paddon-first card mounting', async t => {
  const original = global.fetch; t.after(() => { global.fetch = original; }); const f = fixture(), sent = [];
  f.onJoin(async (session, failed, check) => { check(); assert.equal(failed, 'first'); session.token = 'second'; check(); return true; });
  global.fetch = async (url, init) => { sent.push([url, new Headers(init.headers).get('authorization')]);
    return sent.length === 1 ? new Response('', { status: 401 }) : response(url); };
  const h = f.render(), cleanup = h.mount(); await flush();
  assert.equal(h.controller.getSnapshot().screen, 'content'); assert.equal(sent.length, 5);
  assert.ok(sent[0][0].includes('paddons')); assert.equal(sent[0][0], sent[1][0]);
  assert.equal(sent[0][1], 'Bearer first'); assert.ok(sent.slice(1).every(([, token]) => token === 'Bearer second'));
  assert.deepEqual(f.counts(), { joins: 1, refreshes: 0 }); cleanup();
});

test('settings unaided 401 exposes the existing load error without credential refresh or child reads', async t => {
  const original = global.fetch; t.after(() => { global.fetch = original; }); const f = fixture(); let sends = 0;
  global.fetch = async () => { sends++; return new Response('', { status: 401 }); };
  const h = f.render(), cleanup = h.mount(); await flush();
  assert.equal(h.controller.getSnapshot().screen, 'error'); assert.equal(sends, 1);
  assert.deepEqual(f.counts(), { joins: 1, refreshes: 0 }); cleanup();
});

test('StrictMode reattachment starts fresh reads but the earlier request cannot follow a redirect', async t => {
  const original = global.fetch; t.after(() => { global.fetch = original; }); const f = fixture(), first = deferred(), sent = [];
  global.fetch = async url => { sent.push(url); return sent.length === 1 ? first.promise : response(url); };
  const h = f.render(), detach = h.mount(); await tick(); detach(); const next = f.render(), cleanup = next.mount(); await flush();
  assert.equal(h.controller, next.controller); assert.equal(next.controller.getSnapshot().screen, 'content'); assert.equal(sent.length, 5);
  first.resolve(new Response('', { status: 302, headers: { location: '/v1/mobile/stale-hop' } })); await flush();
  assert.equal(sent.length, 5); cleanup();
});

for (const action of ['setWorkerVisibility', 'setAppUpdate', 'setLaminationWip', 'setQolip']) {
  test(`${action} discards acknowledged or failed body settlement after account retirement`, async t => {
    const original = global.fetch; t.after(() => { global.fetch = original; }); const f = fixture(), body = deferred(); let writes = 0;
    global.fetch = async url => response(url);
    const h = f.render(), cleanup = h.mount(); await flush();
    global.fetch = async (url, init) => { assert.equal(init.method, 'PUT'); writes++;
      const result = response(url); result.json = () => body.promise; return result; };
    h.controller[action](true); await tick(); f.retire(); body.resolve(payload(action === 'setAppUpdate' ? 'app-update' : action === 'setQolip' ? 'qolip' : action === 'setWorkerVisibility' ? 'paddons' : 'lamination',
      action === 'setAppUpdate' ? { mandatory_updates_enabled: true } : action === 'setQolip' ? { automatic_confirmation_enabled: true } : action === 'setWorkerVisibility' ? { worker_visibility_enabled: true } : {}));
    await flush(); assert.equal(writes, 1); assert.equal(h.controller.getSnapshot().screen, 'forbidden');
    assert.equal(h.controller.getSnapshot().notice, null); cleanup();
  });
}

test('a failed-login rollback or restored scope cannot revive the original settings guard', () => {
  const f = fixture(), check = f.guard.additionalSettingsSendGuard(f.session, f.witness, () => true);
  check(); f.advanceEpoch(); assert.throws(check, /session changed/); assert.throws(check, /session changed/);
});
