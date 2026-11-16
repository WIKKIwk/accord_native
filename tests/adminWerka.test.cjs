const assert = require('node:assert/strict');
const test = require('node:test');
const { load, strings, checked, deferred, flush } = require('./adminUsersSupport.cjs');
const strict = load('shared/camera/synchronousGuard');
const { AdminWerkaController } = load('admin/adminWerkaController', { '../shared/camera/synchronousGuard': strict, './dartJsonString': strings });
const settingsApi = load('admin/adminSettings', { '../authorizedFetch': {} });
const { adminWerkaInitials } = load('admin/adminWerkaPresentation', { './dartJsonString': strings });
const value = (patch = {}) => ({ erp_url: 'https://erp.example', erp_api_key: 'key', erp_api_secret: 'secret', default_target_warehouse: 'Target', default_uom: 'kg',
  werka_phone: 'old phone', werka_name: 'Old Name', werka_avatar_url: 'https://images.example/avatar', werka_code: ' original ', werka_code_locked: true,
  werka_code_retry_after_sec: 3, admin_phone: 'admin phone', admin_name: 'admin', ...patch });
function fixture(overrides = {}) {
  let current = true;
  const calls = [], ticks = new Set();
  const deps = { isCurrent: () => current, read: async (guard, witness) => { guard(); assert.equal(witness(), true); calls.push('read'); return value(); },
    write: async (input, guard) => { guard(); calls.push(['write', input]); return value({ werka_code: 'saved code', werka_name: 'ack name', werka_phone: 'ack phone', werka_code_retry_after_sec: 100 }); },
    regenerate: async guard => { guard(); calls.push('regenerate'); return value({ werka_code: 'new code', werka_code_retry_after_sec: 5 }); },
    copy: async (code, guard) => { guard(); calls.push(['copy', code]); },
    everySecond: callback => { ticks.add(callback); return callback; }, cancelTimer: callback => ticks.delete(callback), ...overrides };
  const controller = new AdminWerkaController(deps);
  return { controller, deps, calls, ticks, retire: () => { current = false; }, restore: () => { current = true; },
    tick: () => [...ticks].forEach(callback => callback()), start: async () => { controller.start(); await flush(); } };
}
test('Werka initial read atomically fills visible fields/code/countdown; text controller edits wait for source parent rebuild', async () => {
  const f = fixture(); await f.start(); const state = f.controller.getSnapshot();
  assert.deepEqual(state.fields, { name: 'Old Name', phone: 'old phone' }); assert.equal(state.code, ' original '); assert.equal(state.seconds, 3);
  assert.equal(Object.hasOwn(state, 'erp_api_secret'), false); f.controller.change('name', 'Draft'); assert.equal(f.controller.getSnapshot(), state);
  assert.equal(f.controller.currentFields.name, 'Draft', 'locale parent rebuild reads the live draft without a controller publication');
  f.controller.currentFields.name = 'external edit'; assert.equal(f.controller.currentFields.name, 'Draft');
  f.controller.toggle(); assert.equal(f.controller.getSnapshot().fields.name, 'Draft'); assert.equal(f.controller.getSnapshot().expanded, true);
  f.tick(); assert.equal(f.controller.getSnapshot().seconds, 2); f.tick(); f.tick(); assert.equal(f.controller.getSnapshot().seconds, 0); assert.equal(f.ticks.size, 0);
});
test('Werka save uses loaded hidden values without reread, trims both fields and sends remaining countdown; acknowledgment changes only code', async () => {
  const f = fixture(); await f.start(); f.controller.change('name', '\u0085 Draft \u0085'); f.controller.change('phone', ' 123 '); f.tick(); await f.controller.save();
  assert.deepEqual(f.calls, ['read', ['write', value({ werka_name: 'Draft', werka_phone: '123', werka_code: '', werka_code_retry_after_sec: 2 })]]);
  const state = f.controller.getSnapshot(); assert.deepEqual(state.fields, { name: '\u0085 Draft \u0085', phone: ' 123 ' });
  assert.equal(state.code, 'saved code'); assert.equal(state.seconds, 2); assert.equal(state.changed, true); assert.equal(state.copiedNotice, null);
});
test('save captures controller values before synchronous saving publication, while later typing remains editable', async () => {
  const pending = deferred(), f = fixture({ write: async (input, guard) => { guard(); f.calls.push(input); return pending.promise; } }); await f.start();
  f.controller.change('name', 'Captured'); let once = false;
  f.controller.subscribe(() => { if (f.controller.getSnapshot().saving && !once) { once = true; f.controller.change('name', 'Newer typing'); } });
  const save = f.controller.save(); assert.equal(f.calls.at(-1).werka_name, 'Captured'); pending.resolve(value({ werka_code: 'ack' })); await save;
  assert.equal(f.controller.getSnapshot().fields.name, 'Newer typing');
});
test('regeneration is allowed during positive countdown/locked code and independently of saving', async () => {
  const save = deferred(), regen = deferred(), f = fixture({ write: async () => save.promise, regenerate: async () => regen.promise }); await f.start();
  const savePending = f.controller.save(), regenPending = f.controller.regenerate();
  assert.equal(f.controller.getSnapshot().saving, true); assert.equal(f.controller.getSnapshot().regenerating, true);
  regen.resolve(value({ werka_code: 'regenerated', werka_code_retry_after_sec: 7 })); await regenPending;
  save.resolve(value({ werka_code: 'late save', werka_code_retry_after_sec: 100 })); await savePending;
  assert.equal(f.controller.getSnapshot().code, 'late save'); assert.equal(f.controller.getSnapshot().seconds, 7, 'save acknowledgment must not replace countdown');
});
test('copy writes raw code, only acknowledged copy shows notice, and copy does not rebuild draft header fields', async () => {
  const f = fixture(); await f.start(); f.controller.change('name', 'Unsaved'); await f.controller.copy();
  assert.deepEqual(f.calls.at(-1), ['copy', ' original ']); assert.equal(f.controller.getSnapshot().fields.name, 'Old Name');
  const first = f.controller.getSnapshot().copiedNotice; await f.controller.copy(); const latest = f.controller.getSnapshot().copiedNotice;
  f.controller.dismissNotice(first); assert.equal(f.controller.getSnapshot().copiedNotice, latest);
  f.controller.dismissNotice(latest); assert.equal(f.controller.getSnapshot().copiedNotice, null);
  const failed = fixture({ copy: async () => { throw Error('clipboard unavailable'); } }); await failed.start();
  await assert.rejects(failed.controller.copy()); assert.equal(failed.controller.getSnapshot().copiedNotice, null);
});
test('load/save/regenerate failures retain source retry/busy/changed behavior without success messages', async () => {
  let failRead = true;
  const f = fixture({ read: async () => { if (failRead) throw Error('offline'); return value(); }, write: async () => { throw Error('write failed'); }, regenerate: async () => { throw Error('regen failed'); } });
  await f.start(); assert.equal(f.controller.getSnapshot().phase, 'error'); failRead = false; await f.controller.reload();
  await assert.rejects(f.controller.save()); await assert.rejects(f.controller.regenerate());
  assert.equal(f.controller.getSnapshot().saving, false); assert.equal(f.controller.getSnapshot().regenerating, false);
  assert.equal(f.controller.getSnapshot().changed, false); assert.equal(f.controller.getSnapshot().copiedNotice, null);
});
test('retirement during reads, writes, regeneration or clipboard settlement scrubs state and rejects stale acknowledgment', async () => {
  for (const operation of ['read', 'write', 'regenerate', 'copy']) {
    const pending = deferred(), f = fixture();
    if (operation !== 'read') await f.start();
    f.deps[operation] = async () => pending.promise;
    const promise = operation === 'read' ? f.controller.reload() : operation === 'write' ? f.controller.save() : f.controller[operation]();
    if (operation === 'read') { await f.start(); }
    f.retire(); pending.resolve(value()); await promise.catch(() => {}); await flush();
    assert.equal(f.controller.getSnapshot().phase, 'invalidated'); assert.equal(f.controller.getSnapshot().code, ''); assert.equal(f.ticks.size, 0);
    f.restore(); f.controller.start(); assert.equal(f.controller.getSnapshot().phase, 'invalidated');
  }
});
test('StrictMode cleanup/start creates a new read lifetime and rejects a prior redirect guard', async () => {
  const reads = [], f = fixture({ read: (guard, witness) => { const pending = deferred(); reads.push({ guard, witness, pending }); return pending.promise; } });
  f.controller.start(); const old = reads[0]; f.controller.dispose(); f.controller.start();
  assert.throws(old.guard); assert.throws(old.witness); old.pending.resolve(value({ werka_code: 'stale' })); reads[1].pending.resolve(value({ werka_code: 'fresh' })); await flush();
  assert.equal(f.controller.getSnapshot().code, 'fresh'); f.controller.dispose(); assert.equal(f.ticks.size, 0);
});
test('asynchronous current predicates fail closed and synchronous publication cannot send after retirement', async () => {
  const bad = fixture({ isCurrent: () => Promise.reject(Error('async')) }); await bad.start(); assert.deepEqual(bad.calls, []);
  const f = fixture(); await f.start(); f.controller.subscribe(() => { if (f.controller.getSnapshot().saving) f.retire(); });
  await assert.rejects(f.controller.save()); assert.deepEqual(f.calls, ['read']); assert.equal(f.controller.getSnapshot().phase, 'invalidated');
});
test('source initials use first/last grapheme with empty fallback and locale-independent uppercase', () => {
  assert.equal(adminWerkaInitials('  '), 'O'); assert.equal(adminWerkaInitials('ali'), 'A'); assert.equal(adminWerkaInitials(' ali middle valiyev '), 'AV');
  assert.equal(adminWerkaInitials('👨‍👩‍👧‍👦 Someone'), '👨‍👩‍👧‍👦S'); assert.equal(adminWerkaInitials('a\u0301 bo'), 'A\u0301B');
});

test('Werka regenerate sends exact POST with no JSON payload and rechecks body/model/error boundaries', async () => {
  const calls = []; let current = true, payload = value();
  const api = load('admin/adminWerkaApi', { '../authorizedFetch': { authorizedFetch: async (_session, path, init, guard) => {
    guard?.(); calls.push([path, init]); return { status: 200, json: async () => payload }; } },
    './adminProductionRequest': checked, './adminSettings': settingsApi });
  const guard = () => { if (!current) throw Error('expired'); };
  assert.equal((await api.adminRegenerateWerkaCode({}, guard)).werka_code, ' original ');
  assert.deepEqual(calls, [['/v1/mobile/admin/werka/code/regenerate', { method: 'POST' }]]);
  payload = new Proxy(value(), { get(target, key) { if (key === 'werka_phone') current = false; return target[key]; } });
  await assert.rejects(api.adminRegenerateWerkaCode({}, guard), /expired/);
  const before = calls.length; await assert.rejects(api.adminRegenerateWerkaCode({}, guard)); assert.equal(calls.length, before);
});

function sessionFixture(t, copy) {
  let scope = 'scope', epoch = 1, active = true;
  const session = { token: 'token', profile: { role: 'admin', ref: 'owner' } }, witness = { session }, copies = [];
  const { createAdminWerkaSession } = load('admin/adminWerkaSession', { 'expo-clipboard': { setStringAsync: async text => { copies.push(text); return copy ? copy() : true; } },
    '../auth': { activeSessionEpoch: () => active ? epoch : null, activeSessionToken: () => active ? session.token : null, isSessionWitnessCurrent: snapshot => snapshot === witness },
    '../sessionReadScope': { sessionReadScope: () => scope }, '../shared/appRoutes': { appRoutes: { adminWerka: '/werka' }, canOpenRoute: () => true },
    '../shared/profileSessionGuard': load('shared/profileSessionGuard'), './adminSettings': { adminSettings: async () => value(), updateAdminSettings: async () => value() },
    './adminWerkaApi': { adminRegenerateWerkaCode: async () => value() }, './adminWerkaController': { AdminWerkaController } });
  const owner = createAdminWerkaSession(session, witness, () => true); t.after(() => owner.controller.dispose());
  return { owner, copies, retire: () => { active = false; }, scope: value => { scope = value; }, epoch: value => { epoch = value; } };
}
test('real Werka session factory requires original epoch/scope and actual clipboard acknowledgment', async t => {
  const f = sessionFixture(t); f.owner.controller.start(); await flush(); await f.owner.controller.copy(); assert.deepEqual(f.copies, [' original ']);
  f.scope('new'); assert.equal(f.owner.current(), false); f.scope('scope'); assert.equal(f.owner.current(), false);
  const pending = deferred(), stale = sessionFixture(t, () => pending.promise); stale.owner.controller.start(); await flush();
  const write = stale.owner.controller.copy(); stale.epoch(2); pending.resolve(true); await assert.rejects(write); assert.equal(stale.owner.controller.getSnapshot().copiedNotice, null);
  const failed = sessionFixture(t, () => false); failed.owner.controller.start(); await flush(); await assert.rejects(failed.owner.controller.copy(), /Clipboard write failed/);
});
