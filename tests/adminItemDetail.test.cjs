const assert = require('node:assert/strict');
const test = require('node:test');
const { load, model, controller: { AdminItemDetailController }, detail, deferred, flush, sync } = require('./adminItemDetailSupport.cjs');

test('detail DTO follows source nullable scalars, num.toInt, map-only customers and immutable identity containers', () => {
  const row = model.adminItemDetailFromJson({ code: ' Raw ', created_at_unix: 12.9, updated_at_unix: -4.9,
    customers: [null, 7, [], { ref: ' ref ', name: null, phone: ' raw ' }] });
  assert.deepEqual(row, { code: ' Raw ', name: '', uom: '', item_group: '', is_finished_goods: false, created_at_unix: 12, updated_at_unix: -4,
    order_image_order_id: '', customers: [{ ref: ' ref ', name: '', phone: ' raw ' }] });
  assert.equal(Object.isFrozen(row), true); assert.equal(Object.isFrozen(row.customers), true); assert.equal(Object.isFrozen(row.customers[0]), true);
  for (const customers of [null, 7, {}]) assert.deepEqual(model.adminItemDetailFromJson({ customers }).customers, []);
  for (const value of [null, [], { code: 2 }, { is_finished_goods: 1 }, { created_at_unix: '12' }, { updated_at_unix: Infinity }, { customers: [{ phone: 4 }] }])
    assert.throws(() => model.adminItemDetailFromJson(value), TypeError);
});
test('source combo precedence and exact code/image-retention rules do not infer finished state from a group label', () => {
  assert.equal(model.adminItemDetailKind(detail({ item_group: ' \u0085 KoMbO ', is_finished_goods: true })), 'combo');
  assert.equal(model.adminItemDetailKind(detail({ item_group: 'tayyor mahsulot' })), 'ordinary');
  assert.equal(model.adminItemDetailKind(detail({ is_finished_goods: true })), 'finished');
  const previous = detail({ order_image_order_id: ' original image ' }), same = detail(), renamed = detail({ code: 'code' }), ownImage = detail({ order_image_order_id: ' ' });
  assert.equal(model.retainAdminItemDetailImage(same, previous).order_image_order_id, ' original image ');
  assert.equal(model.retainAdminItemDetailImage(renamed, previous), renamed); assert.equal(model.retainAdminItemDetailImage(ownImage, previous), ownImage);
});
test('read owner trims once, exposes source loading/error/retry and never dispatches before start', async () => {
  const calls = []; let failure = true;
  const owner = new AdminItemDetailController(' \u0085 Raw Code \u0085 ', { isCurrent: () => true, read: async (...args) => {
    const [code, guard, witness] = args; calls.push(code); guard(); assert.equal(witness(), true); if (failure) throw Error('offline'); return detail();
  } });
  assert.deepEqual(calls, []); assert.equal(owner.getSnapshot().phase, 'loading'); owner.start(); await flush();
  assert.deepEqual(calls, ['Raw Code']); assert.equal(owner.getSnapshot().phase, 'error'); failure = false; await owner.reload();
  assert.equal(owner.getSnapshot().phase, 'content'); assert.equal(owner.getSnapshot().detail.name, 'Name'); assert.equal(owner.getSnapshot().itemCode, 'Raw Code');
});
test('new retry supersedes original success, rejection and its retained read witness', async () => {
  for (const fails of [false, true]) {
    const pending = deferred(), callbacks = []; let count = 0;
    const owner = new AdminItemDetailController('Code', { isCurrent: () => true, read: async (_code, guard, witness) => { callbacks.push([guard, witness]); return ++count === 1 ? pending.promise : detail({ name: 'Latest' }); } });
    owner.start(); await owner.reload(); assert.throws(callbacks[0][0], /changed/); assert.throws(callbacks[0][1], /changed/);
    if (fails) pending.reject(Error('old failure')); else pending.resolve(detail({ name: 'Old' })); await flush();
    assert.equal(owner.getSnapshot().detail.name, 'Latest');
  }
});
test('same owner StrictMode cleanup/setup retains subscriptions but fences old in-flight callbacks and response', async () => {
  const pending = deferred(); let count = 0, guard, witness, changes = 0;
  const owner = new AdminItemDetailController('Code', { isCurrent: () => true, read: async (_code, g, w) => {
    if (++count === 1) { guard = g; witness = w; return pending.promise; } return detail({ name: 'Reconnected' });
  } });
  owner.subscribe(() => { changes++; }); owner.start(); const generation = owner.interactionGeneration; owner.dispose(); owner.start(); await flush();
  assert.equal(owner.isCurrent(generation), false); assert.throws(guard, /changed/); assert.throws(witness, /changed/);
  pending.resolve(detail({ name: 'Detached' })); await flush(); assert.equal(owner.getSnapshot().detail.name, 'Reconnected'); assert.equal(changes, 4);
});
test('reentrant publication retirement prevents first dispatch and reads never install a DTO after original authority expires', async () => {
  let calls = 0; const owner = new AdminItemDetailController('Code', { isCurrent: () => true, read: async () => { calls++; return detail(); } });
  owner.subscribe(() => { if (owner.getSnapshot().phase === 'loading') owner.invalidate(); }); owner.start(); await flush();
  assert.equal(calls, 0); assert.equal(owner.getSnapshot().phase, 'invalidated'); owner.start(); assert.equal(calls, 0);
  const pending = deferred(); let current = true;
  const original = new AdminItemDetailController('Code', { isCurrent: () => current, read: () => pending.promise }); original.start(); current = false; pending.resolve(detail()); await flush();
  assert.equal(original.getSnapshot().phase, 'invalidated'); current = true; original.start(); assert.equal(original.isCurrent(), false);
});
test('async and recursively reentrant owner guards retire permanently', async () => {
  for (const asynchronous of [false, true]) {
    let owner; owner = new AdminItemDetailController('Code', { isCurrent: () => asynchronous ? Promise.reject(Error('async')) : owner.isCurrent(), read: async () => { throw Error('must not send'); } });
    owner.start(); await flush(); assert.equal(owner.getSnapshot().phase, 'invalidated'); assert.equal(owner.isCurrent(), false);
  }
});
function sessionFixture() {
  const session = { baseUrl: 'https://erp.example', token: 't', profile: { role: 'admin' } }, witness = { session }; let epoch = 1, scope = 'scope', allowed = true, issued = true, account = session, external = () => true; const calls = [];
  const factory = load('admin/adminItemDetailSession', { '../auth': { activeSessionEpoch: value => account === value ? epoch : null, activeSessionToken: value => account === value ? value.token : null, isSessionWitnessCurrent: value => issued && value === witness },
    '../sessionReadScope': { sessionReadScope: () => scope }, '../shared/appRoutes': { appRoutes: { adminItemDetail: '/detail' }, canOpenRoute: () => allowed },
    '../shared/camera/synchronousGuard': sync, './adminItemDetailApi': { adminItemDetail: async (...args) => { calls.push(args); args[3](); assert.equal(args[4](), true); return detail(); } },
    './adminItemDetailController': { AdminItemDetailController } });
  const owner = factory.createAdminItemDetailSession(session, witness, () => external(), ' Raw ');
  return { owner, session, witness, calls, epoch: value => { epoch = value; }, scope: value => { scope = value; }, permission: value => { allowed = value; }, issued: value => { issued = value; }, account: value => { account = value; }, external: value => { external = value; } };
}
test('session factory binds original route/capability/witness and screen include_image reads while allowing same-owner token refresh', async () => {
  const f = sessionFixture(); f.owner.controller.start(); await flush(); assert.equal(f.calls.length, 1);
  assert.equal(f.calls[0][0], f.session); assert.equal(f.calls[0][1], 'Raw'); assert.deepEqual(f.calls[0][2], { includeImage: true });
  f.session.token = 'refreshed'; assert.equal(f.owner.current(), true); await f.owner.controller.reload(); assert.equal(f.calls.length, 2);
});
test('factory authority is sticky across epoch/scope/account/witness/permission changes and invalid external callbacks', () => {
  for (const change of [f => f.epoch(2), f => f.scope('another'), f => f.account({ ...f.session }), f => f.issued(false), f => f.permission(false),
    f => { f.session.token = 'test-mode-token'; }, f => f.external(() => Promise.reject(Error('async'))), f => f.external(() => f.owner.current())]) {
    const f = sessionFixture(); assert.equal(f.owner.current(), true); change(f); assert.equal(f.owner.current(), false);
    f.epoch(1); f.scope('scope'); f.account(f.session); f.issued(true); f.permission(true); f.session.token = 't'; f.external(() => true); assert.equal(f.owner.current(), false);
  }
});
