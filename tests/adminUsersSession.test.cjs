const assert = require('node:assert/strict');
const test = require('node:test');
const s = require('./adminUsersSupport.cjs');
const scope = s.load('sessionReadScope'), profile = s.load('shared/profileSessionGuard');
const payload = url => url.includes('role-assignments') ? [] : { items: [{ id: 'CURRENT', source: 'supplier', name: 'Current user' }], has_more: false };
const response = url => new Response(JSON.stringify(payload(url)));
async function fixture(kind = 'supplier') {
  const session = { baseUrl: 'https://server.example', token: 'first', profile: { role: 'admin', ref: 'ADMIN' }, capabilities: ['party.supplier.read'] };
  const witness = { session, generation: 4 }, listeners = new Set(), storage = s.memoryStorage();
  const roles = new s.roleStore.AdminUsersRoleStore(storage), cache = new s.cache.AdminUsersCache();
  if (kind !== null) await roles.saveRole(kind, 'ADMIN');
  let current = true, epoch = 1, joins = 0, refreshes = 0, outer = () => true, join = async () => false;
  const auth = { activeSessionEpoch: () => epoch, activeSessionToken: () => session.token || null,
    isSessionWitnessCurrent: value => current && value === witness,
    subscribeSessionWitness: listener => { listeners.add(listener); return () => listeners.delete(listener); },
    refreshSession: async () => { refreshes++; return false; }, joinRefreshForGuardedRead: async (...args) => { joins++; return join(...args); } };
  const transport = s.load('authorizedFetch', { './auth': auth });
  const api = s.api(transport.authorizedFetch);
  const sessionModule = s.load('admin/adminUsersSession', { '../auth': auth, '../sessionReadScope': scope, '../shared/appRoutes': s.routes,
    '../shared/profileSessionGuard': profile, './adminUsersApi': api, './adminUsersController': s.controller,
    './adminUsersRuntime': { adminUsersCache: cache, adminUsersRoleStore: roles } });
  const owner = sessionModule.createAdminUsersSession(session, witness, () => outer(), { roles, cache });
  return { session, witness, auth, api, owner, cache, roles, storage, sessionModule, onJoin: value => { join = value; },
    retire() { current = false; for (const listener of [...listeners]) listener(); }, restore() { current = true; },
    advanceEpoch() { epoch++; }, resetEpoch() { epoch = 1; }, setOuter: value => { outer = value; }, counts: () => ({ joins, refreshes }) };
}
for (const status of [302, 401]) test(`users original witness blocks stale ${status} before any redirect or refresh continuation`, async t => {
  const original = global.fetch; t.after(() => { global.fetch = original; }); const f = await fixture(), first = s.deferred(), calls = [];
  global.fetch = async url => { calls.push(url); return calls.length === 1 ? first.promise : response(url); };
  f.owner.controller.start(); await s.flush(); f.retire();
  first.resolve(new Response('', { status, headers: status === 302 ? { location: '/v1/mobile/admin/stale-hop' } : {} })); await s.flush();
  assert.equal(calls.length, 2); assert.equal(f.owner.controller.getSnapshot().screen, 'forbidden');
  assert.deepEqual(f.counts(), { joins: 0, refreshes: 0 }); f.owner.detach();
});
test('users original witness is rechecked after JSON decoding before data/cache installation', async t => {
  const original = global.fetch; t.after(() => { global.fetch = original; }); const f = await fixture(), body = s.deferred();
  global.fetch = async url => { const value = response(url); if (url.includes('users/list')) value.json = () => body.promise; return value; };
  f.owner.controller.start(); await s.flush(); f.retire(); body.resolve(payload('users/list')); await s.flush();
  assert.equal(f.owner.controller.getSnapshot().screen, 'forbidden'); assert.equal(f.owner.controller.getSnapshot().items.length, 0);
  assert.equal(f.cache.read(scope.sessionReadScope(f.session), f.witness.generation), null); f.owner.detach();
});
test('users scoped 401 joins an independent token refresh while preserving query and original access scope', async t => {
  const original = global.fetch; t.after(() => { global.fetch = original; }); const f = await fixture(), calls = [];
  f.onJoin(async (session, failedToken, check) => { check(); assert.equal(failedToken, 'first'); session.token = 'second'; check(); return true; });
  global.fetch = async (url, init) => { calls.push([url, new Headers(init.headers).get('authorization')]);
    return calls.length === 1 ? new Response('', { status: 401 }) : response(url); };
  f.owner.controller.start(); await s.flush(); assert.equal(f.owner.controller.getSnapshot().screen, 'content');
  const list = calls.filter(([url]) => url.includes('users/list')); assert.equal(list.length, 2); assert.equal(list[0][0], list[1][0]);
  assert.equal(list[0][1], 'Bearer first'); assert.equal(list[1][1], 'Bearer second');
  assert.deepEqual(f.counts(), { joins: 1, refreshes: 0 }); f.owner.detach();
});
test('users unaided 401 retains the existing load-error behavior without starting credential refresh', async t => {
  const original = global.fetch; t.after(() => { global.fetch = original; }); const f = await fixture();
  global.fetch = async url => url.includes('users/list') ? new Response('', { status: 401 }) : response(url);
  f.owner.controller.start(); await s.flush(); assert.equal(f.owner.controller.getSnapshot().screen, 'error');
  assert.deepEqual(f.counts(), { joins: 1, refreshes: 0 }); f.owner.detach();
});
test('retiring users during the independent refresh join blocks the authenticated retry', async t => {
  const original = global.fetch; t.after(() => { global.fetch = original; }); const f = await fixture(), joined = s.deferred(), calls = [];
  f.onJoin(() => joined.promise);
  global.fetch = async url => { calls.push(url); return url.includes('users/list') ? new Response('', { status: 401 }) : response(url); };
  f.owner.controller.start(); await s.flush(); assert.equal(f.counts().joins, 1);
  f.retire(); f.session.token = 'second'; joined.resolve(true); await s.flush();
  assert.equal(calls.filter(url => url.includes('users/list')).length, 1);
  assert.equal(f.owner.controller.getSnapshot().screen, 'forbidden'); f.owner.detach();
});
test('legacy direct users API callers retain the existing credential-refresh transport branch', async t => {
  const original = global.fetch; t.after(() => { global.fetch = original; }); const f = await fixture();
  global.fetch = async () => new Response('', { status: 401 });
  await assert.rejects(f.api.adminUserList(f.session), /Admin user list failed/);
  assert.deepEqual(f.counts(), { joins: 0, refreshes: 1 });
});
test('StrictMode setup/cleanup/setup retires the original redirect while the new mounted lifetime succeeds', async t => {
  const original = global.fetch; t.after(() => { global.fetch = original; }); const f = await fixture(), first = s.deferred(), calls = [];
  let memo, effects;
  const react = { useMemo: create => memo ??= create(), useSyncExternalStore: (_subscribe, get) => get(), useEffect: effect => effects.push(effect) };
  const hook = s.load('admin/useAdminUsers', { react, '../auth': f.auth, './adminUsersSession': f.sessionModule });
  const render = () => { effects = []; const value = hook.useAdminUsers(f.session, f.witness, () => true); return { ...value, mount: () => effects[0]() }; };
  global.fetch = async url => { calls.push(url); return calls.length === 1 ? first.promise : response(url); };
  const firstRender = render(), detach = firstRender.mount(); await s.flush(); detach();
  const second = render(), cleanup = second.mount(); await s.flush(); assert.equal(firstRender.controller, second.controller);
  assert.equal(second.controller.getSnapshot().screen, 'content'); const count = calls.length;
  first.resolve(new Response('', { status: 302, headers: { location: '/v1/mobile/admin/old-hop' } })); await s.flush();
  assert.equal(calls.length, count); assert.equal(second.controller.getSnapshot().items[0].id, 'CURRENT'); cleanup();
});
test('initial users read is denied for expired witness, reserved test token, async callback or missing capability', async t => {
  const original = global.fetch; t.after(() => { global.fetch = original; }); let calls = 0; global.fetch = async url => { calls++; return response(url); };
  for (const change of [f => f.retire(), f => { f.session.token = 'test-mode-token'; }, f => { f.session.capabilities = []; },
    f => f.setOuter(async () => { throw new Error('expired'); })]) {
    const f = await fixture(); change(f); f.owner.controller.start(); await s.flush();
    assert.equal(f.owner.controller.getSnapshot().screen, 'forbidden'); f.owner.detach();
  }
  assert.equal(calls, 0);
});
test('failed-login epoch rollback and restored scope cannot revive a retired users owner', async () => {
  const f = await fixture(); assert.equal(f.owner.current(), true); f.advanceEpoch(); assert.equal(f.owner.current(), false);
  f.resetEpoch(); f.restore(); assert.equal(f.owner.current(), false);
  const g = await fixture(); g.session.assigned_item_groups = ['changed']; assert.equal(g.owner.current(), false);
  g.session.assigned_item_groups = []; assert.equal(g.owner.current(), false);
});
