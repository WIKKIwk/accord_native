const assert = require('node:assert/strict');
const test = require('node:test');
const s = require('./adminUsersSupport.cjs');
async function fixture() {
  const roles = new s.roleStore.AdminUsersRoleStore(s.memoryStorage()), cache = new s.cache.AdminUsersCache(); await roles.saveRole('supplier', 'ADMIN');
  let valid = true, focused = true, reads = 0, backs = 0, open = async () => false;
  const controller = new s.controller.AdminUsersController({ isCurrent: () => valid, scope: () => 'original', revision: () => 1,
    profileRef: 'ADMIN', salesManager: false, roles, cache, readPage: async () => { reads++; return { items: [{ ...s.entry('ROW', 'Name'), phone: ' 998 ', blocked: true }], has_more: false }; },
    readAssignments: async () => [] }); controller.start(); await s.flush();
  let cursor = 0, layouts = []; const slots = [];
  const react = {
    useRef: value => { const index = cursor++; return slots[index] ??= { current: value }; },
    useState: value => { const index = cursor++; if (!(index in slots)) slots[index] = value;
      return [slots[index], next => { slots[index] = typeof next === 'function' ? next(slots[index]) : next; }]; },
    useSyncExternalStore: (_subscribe, get) => get(), useLayoutEffect: fn => layouts.push(fn),
  };
  const ownedBacks = [];
  const hook = s.load('admin/useAdminUsersScreen', { react, './AdminOwnedBackContext': { useAdminOwnedBack: handler => { ownedBacks.push(handler); } }, '../shared/camera/synchronousGuard': s.load('shared/camera/synchronousGuard'), 'expo-router': { useIsFocused: () => focused },
    '../shared/localization': s.l10n, '../shared/localization/runtime': { localeController: { locale: 'uz', addListener() {} } },
    './adminUsersModel': s.model, './dartJsonString': s.strings,
    './useAdminUsers': { useAdminUsers: () => ({ state: controller.getSnapshot(), controller, isCurrent: () => valid }) } });
  const props = { session: { profile: { role: 'admin' } }, onBack: () => { backs++; }, onOpenUser: (ticket, lifetime) => open(ticket, lifetime) };
  const render = () => { cursor = 0; layouts = []; const model = hook.useAdminUsersScreen(props); const cleanup = layouts.map(fn => fn()); return { model, cleanup: () => cleanup.forEach(fn => fn?.()) }; };
  return { controller, props, ownedBacks, render, get reads() { return reads; }, get backs() { return backs; }, retire() { valid = false; }, focus: value => { focused = value; },
    onOpen: value => { open = value; } };
}
test('screen model preserves exact visible subtitles, current role choices and raw search text', async () => {
  const f = await fixture(), first = f.render().model;
  assert.equal(first.rows[0].subtitle, 'Supplier • Blocked • 998'); assert.equal(first.roleOptions.length, 13);
  first.setSearch('  Name  '); const next = f.render().model;
  assert.equal(next.searchText, '  Name  '); assert.equal(f.controller.getSnapshot().query, 'Name'); assert.equal(next.hasSearchText, true);
  f.controller.dispose();
});
test('real detail callback receives issued ticket, is awaited once, and reloads even before native focus returns', async () => {
  const f = await fixture(), navigation = s.deferred(), tickets = [];
  f.onOpen(ticket => { tickets.push(ticket); return navigation.promise; });
  const model = f.render().model, reading = model.openUser('ROW'); await model.openUser('ROW');
  assert.equal(tickets.length, 1); assert.equal(tickets[0].routeName, '/admin-supplier-detail'); assert.equal(tickets[0].item.id, 'ROW');
  const before = f.reads; f.focus(false); f.render(); navigation.resolve(true); await reading; await s.flush();
  assert.equal(f.reads, before + 1); f.controller.dispose();
});
test('original session retirement during awaited detail return cannot refresh or act on the restored screen', async () => {
  const f = await fixture(), navigation = s.deferred(); f.onOpen(() => navigation.promise);
  const model = f.render().model, reading = model.openUser('ROW'), before = f.reads;
  f.retire(); navigation.resolve(true); await reading; await s.flush(); assert.equal(f.reads, before);
  assert.equal(f.controller.getSnapshot().screen, 'forbidden'); f.controller.dispose();
});
test('old native callbacks cannot touch a reattached owner; fresh callbacks retain their source actions', async () => {
  const f = await fixture(), first = f.render(); first.cleanup(); f.controller.dispose(); f.controller.start(); await s.flush();
  const fresh = f.render().model, before = f.reads;
  first.model.setSearch('stale'); first.model.selectRole('metalayzer'); first.model.toggleRoles(); first.model.back(); await first.model.reload(); await first.model.openUser('ROW');
  assert.equal(f.controller.getSnapshot().query, ''); assert.equal(f.controller.getSnapshot().selectedKind, 'supplier');
  assert.equal(f.reads, before); assert.equal(f.backs, 0);
  fresh.back(); assert.equal(f.backs, 1); fresh.selectRole('metalayzer'); await s.flush(); assert.equal(f.controller.getSnapshot().selectedKind, 'metalayzer'); f.controller.dispose();
});
test('route blur blocks native actions and pagination without retiring session ownership', async () => {
  const f = await fixture(), model = f.render().model; f.focus(false); f.render(); const before = f.reads;
  model.setSearch('hidden'); model.selectRole('metalayzer'); model.back(); await model.reload(); model.scrollMetrics(100, 0);
  assert.equal(f.controller.getSnapshot().query, ''); assert.equal(f.reads, before); assert.equal(f.backs, 0);
  f.focus(true); const focused = f.render().model; focused.back(); assert.equal(f.backs, 1); assert.equal(f.controller.getSnapshot().screen, 'content'); f.controller.dispose();
});
test('Users supplies original controller lifetime to navigation and host interaction cannot replace its awaited result authority', async () => {
  const f = await fixture(), pending = s.deferred(); let allowed = true, captured; f.props.canInteract = () => allowed;
  f.onOpen((ticket, lifetime) => { captured = { ticket, lifetime }; return pending.promise; }); const model = f.render().model, opening = model.openUser('ROW');
  assert.equal(captured.lifetime.isCurrent(), true); assert.equal(captured.lifetime.canInteract(), true); allowed = false;
  model.setSearch('hidden'); model.back(); await model.reload(); assert.equal(captured.lifetime.canInteract(), false); assert.equal(captured.lifetime.isCurrent(), true); assert.equal(f.backs, 0); assert.equal(f.controller.getSnapshot().query, '');
  const before = f.reads; pending.resolve(true); await opening; await s.flush(); assert.equal(f.reads, before + 1);
  f.controller.dispose(); assert.equal(captured.lifetime.isCurrent(), false); assert.equal(captured.lifetime.canInteract(), false);
});
test('real embedded Users model registers its genuine Back so an owned missing-ref fallback can leave without a changed result', async () => {
  const f = await fixture(), first = f.render(); f.ownedBacks.at(-1)(); assert.equal(f.backs, 1); f.focus(false); f.render(); f.ownedBacks.at(-1)(); assert.equal(f.backs, 1);
  first.cleanup(); f.controller.dispose(); first.model.back(); assert.equal(f.backs, 1);
});
