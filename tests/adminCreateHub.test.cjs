const assert = require('node:assert/strict');
const test = require('node:test');
const s = require('./adminUsersSupport.cjs');
const strict = s.load('shared/camera/synchronousGuard');
const dock = s.load('admin/adminDockModel', { '../shared/appRoutes': s.routes, '../shared/localization': s.l10n });
const model = s.load('admin/adminCreateHubModel', { '../shared/camera/synchronousGuard': strict, './adminDockModel': dock });
const domain = s.load('admin/adminCreateHubController', { '../shared/camera/synchronousGuard': strict });
const session = (caps, role = 'admin') => ({ token: 'token', baseUrl: 'https://one', capabilities: caps, profile: { role, ref: 'u' } });
const full = session(['admin.access', 'party.supplier.manage', 'catalog.item.create']);
test('default hub retains the exact five source rows/order/words and holds every unavailable genuine destination', () => {
  const plan = model.adminCreateHubPlan(full, 'uz', () => false); assert.equal(plan.hasPrimary, true); assert.equal(plan.ready, false);
  assert.deepEqual(plan.actions.map(row => row.id), ['admin-hub-user-create', 'admin-hub-item-create', 'admin-hub-progress-qr-scan', 'admin-hub-quick-orders', 'admin-hub-calculate-order-create']);
  assert.deepEqual(plan.actions.map(row => row.label), ['adminCreateUserTitle', 'adminCreateItemTitle', 'adminQrScanTitle', 'adminQuickOrdersTitle', 'adminOpenOrderTitle'].map(key => s.l10n.localizedGetter(key, 'uz')));
  assert.deepEqual(plan.actions.map(row => row.staggerOrder), [4, 3, 2, 1, 0]); assert.deepEqual(plan.missingRoutes, plan.actions.map(row => row.routeName));
  assert.equal(model.adminCreateHubPlan(full, 'uz', route => route !== plan.actions[0].routeName).missingRoutes.length, 1);
  assert.equal(model.adminCreateHubPlan(full, 'uz', () => true).ready, true); assert.equal(model.adminCreateHubPlan(full, 'uz', async () => true).ready, false);
});
test('static source capability branches remain canonical; an empty eligible default menu still has a real FAB', () => {
  for (const value of [session([], 'admin'), session(['sales.access', 'admin.access'], 'sales_manager'), session(['brigader.access'], 'brigader'), session(['rezka.master.access'], 'rezka_master')]) {
    const plan = model.adminCreateHubPlan(value, 'ru', () => true); assert.deepEqual(plan.actions, dock.adminDefaultCreateActions(value, 'ru'));
  }
  const empty = model.adminCreateHubPlan(session(['catalog.item_group.manage']), 'uz', () => false); assert.equal(empty.hasPrimary, true); assert.equal(empty.actions.length, 0); assert.equal(empty.ready, true);
});
test('source dock/FAB host policy is distinct from outer body reserve and has no fabricated measurement fallback', () => {
  assert.deepEqual(model.adminCreateHubLayout(15, true, true), { dockHeight: 75, hostHeight: 199, toggleBottom: 89, actionsBottom: 179 });
  assert.equal(model.adminCreateHubLayout(24, true, false).hostHeight, 84); assert.equal(model.adminCreateHubLayout(24, false, true).hostHeight, 84);
  assert.deepEqual(model.adminCreateHubLayout(null, true, true), { dockHeight: null, hostHeight: null, toggleBottom: null, actionsBottom: null });
  assert.equal(model.adminCreateHubGeometry.iconSize, 24); assert.equal(model.adminHubStaggerSpatial(0, 0), 0); assert.equal(model.adminHubStaggerSpatial(1, 4), 1);
  assert.equal(model.adminHubSpringScale(0), .86); assert.equal(model.adminHubSpringScale(1), 1); assert.equal(model.adminHubSpatial(2), 1.18);
});
test('source Flutter cubic golden values apply to reveal and closing animateWith forward-status opacity', () => {
  assert.equal(model.adminHubEaseOutCubic(.2), .5075639337301254); assert.equal(model.adminHubEaseOutCubic(.5), .8751163475867361);
  assert.equal(model.adminHubStaggerOpacity(.112, 0), model.adminHubEaseOutCubic(.2));
  assert.equal(model.adminHubStaggerSpatial(.56 * .86 * .2, 0), model.adminHubEaseOutCubic(.2));
});
function fixture(overrides = {}) {
  let valid = true, focused = true, page = true, interactive = true, available = true, labels = 'Original'; const frames = [], calls = [];
  const defaults = () => [{ id: 'route', label: labels, routeName: '/real', materialIcon: 'add_task_outlined', row: 0, staggerOrder: 0 }];
  const deps = { isCurrent: () => valid, readiness: () => ({ ready: available, missingRoutes: available ? [] : ['/real'], hasPrimary: true }), actions: defaults,
    routeAvailable: () => available, openRoute: route => calls.push(['route', route]), nextFrame: callback => { const frame = { callback, canceled: false }; frames.push(frame); return () => { frame.canceled = true; }; }, ...overrides };
  const controller = new domain.AdminCreateHubController(deps); controller.start();
  const request = patch => ({ isCurrent: () => page, canInteract: () => interactive, isFocused: () => focused, ...patch });
  const ticket = controller.register(request());
  const open = () => { assert.equal(controller.open(ticket), true); return controller.getSnapshot().overlay; };
  return { controller, deps, ticket, request, open, frames, calls, valid: value => { valid = value; }, focus: value => { focused = value; }, page: value => { page = value; }, interactive: value => { interactive = value; }, available: value => { available = value; }, labels: value => { labels = value; }, run: () => frames.splice(0).forEach(frame => { if (!frame.canceled) frame.callback(); }) };
}
test('default tap starts closing then pushes next frame before all three native animations acknowledge removal', () => {
  const f = fixture(), overlay = f.open(); assert.equal(f.controller.select(overlay.id, overlay.generation, 'route'), true);
  const closing = f.controller.getSnapshot().overlay; assert.equal(closing.targetOpen, false); assert.deepEqual(f.calls, []); assert.equal(f.controller.primary().visible, false);
  f.focus(false); f.page(false); f.controller.unregister(f.ticket); f.run(); assert.deepEqual(f.calls, [['route', '/real']]); assert.equal(f.controller.getSnapshot().overlay.id, overlay.id);
  f.controller.closed(closing.id, closing.generation, closing.motion); assert.equal(f.controller.getSnapshot().overlay, null);
});
test('custom tap removes the root overlay immediately, then invokes its captured action next frame', () => {
  const f = fixture(), action = { id: 'custom', label: 'Exact', icon: { android: 'warehouse', ios: 'shippingbox' }, onPress: () => f.calls.push('custom') };
  const ticket = f.controller.register(f.request({ actions: [action] })); assert.equal(f.controller.open(ticket), true); const overlay = f.controller.getSnapshot().overlay;
  f.controller.select(overlay.id, overlay.generation, 'custom'); assert.equal(f.controller.getSnapshot().overlay, null); assert.deepEqual(f.calls, []); f.focus(false); f.run(); assert.deepEqual(f.calls, ['custom']);
});
test('global duplicate open reopens the same original overlay and ignores a second caller custom argument list', () => {
  const f = fixture(), original = f.open(); f.controller.close(original.id, original.generation); const closing = f.controller.getSnapshot().overlay;
  const second = f.controller.register(f.request({ actions: [{ id: 'second', label: 'Different', icon: {}, onPress() {} }] })); assert.equal(f.controller.open(second), true);
  const reopened = f.controller.getSnapshot().overlay; assert.equal(reopened.id, original.id); assert.equal(reopened.mode, 'default'); assert.equal(reopened.actions[0].id, 'route');
  f.controller.closed(closing.id, closing.generation, closing.motion); assert.equal(f.controller.getSnapshot().overlay.targetOpen, true);
});
test('default translations update in place without retargeting a captured custom list or restarting its spring motion', () => {
  const f = fixture(), first = f.open(); f.labels('Translated'); f.controller.refreshLocale(); const changed = f.controller.getSnapshot().overlay;
  assert.equal(changed.id, first.id); assert.equal(changed.motion, first.motion); assert.equal(changed.actions[0].label, 'Translated');
  f.controller.close(changed.id, changed.generation); const closing = f.controller.getSnapshot().overlay; f.controller.closed(closing.id, closing.generation, closing.motion);
  const ticket = f.controller.register(f.request({ actions: [{ id: 'custom', label: 'Captured', icon: {}, onPress() {} }] })); f.controller.open(ticket); f.labels('Later'); f.controller.refreshLocale(); assert.equal(f.controller.getSnapshot().overlay.actions[0].label, 'Captured');
});
test('actual profile presence and showPrimaryFab hide only the trigger; original overlay persists across profile pushes', () => {
  const f = fixture(); assert.equal(f.controller.primary().visible, true); f.controller.setProfileOnStack(true); assert.equal(f.controller.primary().visible, false); assert.equal(f.controller.open(f.ticket), false);
  f.controller.setProfileOnStack(false); const overlay = f.open(); f.controller.setProfileOnStack(true); assert.equal(f.controller.getSnapshot().overlay.id, overlay.id);
  const g = fixture(); g.controller.register(g.request({ showPrimaryFab: false })); assert.equal(g.controller.primary().visible, false);
});
test('missing default destination holds the complete source scope; real custom actions and valid empty default menus work', () => {
  const f = fixture(); f.available(false); assert.equal(f.controller.primary().ready, false); assert.equal(f.controller.open(f.ticket), false);
  const ticket = f.controller.register(f.request({ actions: [{ id: 'disabled', label: 'Disabled', icon: {}, enabled: false, onPress: () => f.calls.push('bad') }] }));
  assert.equal(f.controller.primary().ready, true); assert.equal(f.controller.open(ticket), true); const overlay = f.controller.getSnapshot().overlay;
  assert.equal(f.controller.select(overlay.id, overlay.generation, 'disabled'), false); assert.deepEqual(f.calls, []);
  const empty = fixture({ actions: () => [] }); assert.equal(empty.open().actions.length, 0);
});
test('source genuine replacement includes the primary even without hub permission and never opens a false create overlay', () => {
  const f = fixture({ readiness: () => ({ ready: false, missingRoutes: [], hasPrimary: false }) }), replacement = { actual: 'source move selected native action' };
  const ticket = f.controller.register(f.request({ hasReplacement: true, replacement })), primary = f.controller.primary();
  assert.equal(primary.hasPrimary, true); assert.equal(primary.visible, true); assert.equal(primary.ready, true); assert.equal(primary.replacementValue, replacement); assert.equal(f.controller.open(ticket), false);
});
test('account retirement, dispatcher availability change and StrictMode replay cancel original frame commands/native callbacks', () => {
  for (const kind of ['retire', 'availability', 'replay']) {
    const f = fixture(), overlay = f.open(); f.controller.select(overlay.id, overlay.generation, 'route');
    if (kind === 'retire') { f.valid(false); f.controller.recheck(); } else if (kind === 'availability') f.available(false); else { f.controller.dispose(); f.controller.start(); }
    f.run(); assert.deepEqual(f.calls, []); assert.equal(f.controller.open(f.ticket), false); assert.equal(f.controller.overlayCurrent(overlay.id, overlay.generation), kind === 'availability');
  }
});
test('reentrant close publication cannot reopen/select while immediate custom removal settles; invalidation suppresses queued work', () => {
  const f = fixture(), ticket = f.controller.register(f.request({ actions: [{ id: 'custom', label: 'Custom', icon: {}, onPress: () => f.calls.push('bad') }] })); f.controller.open(ticket); const overlay = f.controller.getSnapshot().overlay;
  f.controller.subscribe(() => { if (!f.controller.getSnapshot().overlay) { assert.equal(f.controller.open(ticket), false); f.valid(false); } });
  assert.equal(f.controller.select(overlay.id, overlay.generation, 'custom'), false); assert.equal(f.frames.length, 0); assert.deepEqual(f.calls, []);
});
test('async/reentrant page guards and root planner callbacks fail closed without dispatch or recapturing authority', () => {
  const f = fixture(), async = f.controller.register(f.request({ canInteract: async () => true })); assert.equal(f.controller.open(async), false);
  const recursive = f.controller.register(f.request({ isCurrent: () => { f.controller.primary(); return true; } })); assert.equal(f.controller.open(recursive), false);
  const g = fixture(); g.deps.readiness = () => { g.controller.primary(); return { ready: true, missingRoutes: [], hasPrimary: true }; }; assert.equal(g.controller.open(g.ticket), false); assert.deepEqual(g.calls, []);
});
test('session owner binds original witness/epoch/read scope while accepted commands survive page focus only', () => {
  let epoch = 1, valid = true, readScope = 'original'; const frames = [], calls = [], value = full, witness = { session: value };
  const factory = s.load('admin/adminCreateHubSession', { '../auth': { activeSessionEpoch: () => epoch, activeSessionToken: () => value.token, isSessionWitnessCurrent: input => input === witness && valid },
    '../sessionReadScope': { sessionReadScope: () => readScope }, '../shared/camera/synchronousGuard': strict, './adminCreateHubController': domain, './adminCreateHubModel': model });
  const owner = factory.createAdminCreateHubSession(value, witness, () => true, () => true, route => calls.push(route), () => 'uz', callback => { frames.push(callback); return () => {}; });
  owner.controller.start(); const ticket = owner.controller.register({ isCurrent: () => true, canInteract: () => true, isFocused: () => true }); owner.controller.open(ticket);
  const overlay = owner.controller.getSnapshot().overlay; owner.controller.select(overlay.id, overlay.generation, overlay.actions[0].id); epoch++; frames.forEach(callback => callback()); assert.deepEqual(calls, []); epoch--; assert.equal(owner.current(), false);
  valid = true; readScope = 'changed'; assert.equal(owner.current(), false);
});
