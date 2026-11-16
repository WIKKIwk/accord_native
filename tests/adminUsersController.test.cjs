const assert = require('node:assert/strict');
const test = require('node:test');
const { controller: { AdminUsersController }, roleStore: { AdminUsersRoleStore }, cache: { AdminUsersCache }, entry, flush, deferred, memoryStorage, scheduler } = require('./adminUsersSupport.cjs');
async function fixture(kind = null, salesManager = false) {
  const storage = memoryStorage(), roles = new AdminUsersRoleStore(storage), cache = new AdminUsersCache(), time = scheduler(), calls = [];
  if (kind !== null) await roles.saveRole(kind, 'ADMIN');
  let current = true, scope = 'scope', revision = 1;
  const deps = { isCurrent: () => current, scope: () => scope, revision: () => revision, profileRef: 'ADMIN', salesManager, roles, cache,
    schedule: time.set, cancel: time.clear,
    readPage: async (options, guard) => { guard(); calls.push(['page', options]); return { items: [entry('A', 'Abdusoma'), entry('B', 'Abdulla')], has_more: false }; },
    readAssignments: async guard => { guard(); calls.push(['assignments']); return []; } };
  const controller = new AdminUsersController(deps);
  return { controller, deps, calls, storage, roles, cache, time, setCurrent: value => { current = value; },
    setScope: value => { scope = value; }, setRevision: value => { revision = value; } };
}
test('unselected users screen reads assignments only; worker selection uses unified list and skips assignments', async () => {
  const f = await fixture(); f.controller.start(); await flush();
  assert.equal(f.controller.getSnapshot().screen, 'unselected'); assert.deepEqual(f.calls, [['assignments']]);
  f.calls.length = 0; f.controller.selectKind('worker'); await flush();
  assert.deepEqual(f.calls, [['page', { query: '', limit: 50, offset: 0, role: 'worker' }]]);
  f.controller.dispose();
});
test('sales manager always starts with customer and never loads role preferences or role assignments', async () => {
  const f = await fixture(null, true); f.controller.start(); await flush();
  assert.equal(f.controller.getSnapshot().selectedKind, 'customer'); assert.equal(f.storage.calls.length, 0);
  assert.deepEqual(f.calls.map(([kind]) => kind), ['page']);
  f.controller.selectKind('supplier'); f.controller.toggleRoleMenu();
  assert.equal(f.controller.getSnapshot().selectedKind, 'customer'); assert.equal(f.controller.getSnapshot().roleMenuOpen, false);
  f.controller.dispose();
});
// @v2-test test/admin_suppliers_screen_test_cases_resplit_part_03.dart verified subset + 220ms debounce.
test('search immediately preserves a verified subset and waits 220ms before the authoritative read', async () => {
  const f = await fixture('supplier'), narrow = deferred();
  const original = f.deps.readPage;
  f.deps.readPage = (options, guard) => options.query === 'abdusoma' ? (guard(), f.calls.push(['page', options]), narrow.promise) : original(options, guard);
  f.controller.start(); await flush(); f.calls.length = 0;
  f.controller.setSearch('abdu'); assert.equal(f.controller.getSnapshot().screen, 'content');
  f.time.advance(219); await flush(); assert.equal(f.calls.length, 0);
  f.time.advance(1); await flush(); assert.equal(f.calls.filter(([kind]) => kind === 'page').length, 1);
  f.controller.setSearch('abdusoma'); assert.deepEqual(f.controller.getSnapshot().items.map(item => item.id), ['A']);
  assert.equal(f.controller.getSnapshot().screen, 'content');
  f.time.advance(220); await flush(); assert.equal(f.controller.getSnapshot().screen, 'content');
  assert.deepEqual(f.controller.visibleItems('uz').map(item => item.id), ['A']);
  narrow.resolve({ items: [entry('A', 'Abdusoma')], has_more: false }); await flush();
  assert.deepEqual(f.controller.getSnapshot().items.map(item => item.id), ['A']); f.controller.dispose();
});
test('a failed narrow search retains its verified subset without replacing it with the initial error screen', async () => {
  const f = await fixture('supplier'); f.controller.start(); await flush();
  f.deps.readPage = async () => { throw new Error('offline'); };
  f.controller.setSearch('Abdusoma'); f.time.advance(220); await flush();
  assert.equal(f.controller.getSnapshot().screen, 'content'); assert.deepEqual(f.controller.getSnapshot().items.map(item => item.id), ['A']);
  f.controller.dispose();
});
test('initial failure exposes retry while pagination failure keeps rows and reports the source notice', async () => {
  const f = await fixture('supplier'); f.deps.readPage = async () => { throw new Error('offline'); };
  f.controller.start(); await flush(); assert.equal(f.controller.getSnapshot().screen, 'error');
  f.deps.readPage = async () => ({ items: [entry('A')], has_more: true }); await f.controller.refresh();
  assert.equal(f.controller.getSnapshot().screen, 'content'); f.deps.readPage = async () => { throw new Error('offline page'); };
  await f.controller.loadMore(); const state = f.controller.getSnapshot();
  assert.equal(state.screen, 'content'); assert.equal(state.loadingMore, false); assert.equal(state.items.length, 1);
  assert.equal(state.notice.key, 'users.next_page_failed'); f.controller.dispose();
});
// @v2-test test/admin_suppliers_screen_test_cases_resplit_part_03.dart rejects stale load-more results.
test('search and role changes reject stale next pages before they can append or affect the new footer', async () => {
  const f = await fixture('supplier'), old = deferred();
  f.deps.readPage = async (options, guard) => { guard(); f.calls.push(['page', options]);
    return options.offset ? old.promise : { items: [entry(options.query ? 'NEW' : 'OLD', options.query ? 'New user' : 'Old user')], has_more: !options.query }; };
  f.controller.start(); await flush(); const paging = f.controller.loadMore();
  f.controller.setSearch('new'); f.time.advance(220); await flush(); old.resolve({ items: [entry('STALE')], has_more: true }); await paging;
  assert.deepEqual(f.controller.getSnapshot().items.map(item => item.id), ['NEW']); assert.equal(f.controller.getSnapshot().hasMore, false);
  f.controller.dispose();
});
test('pagination starts below the source 2.5 viewport threshold and preserves duplicate server rows and raw offset', async () => {
  const f = await fixture('supplier'); f.deps.readPage = async (options, guard) => { guard(); f.calls.push(['page', options]);
    return { items: [entry('SAME')], has_more: options.offset === 0 }; };
  f.controller.start(); await flush(); f.calls.length = 0;
  f.controller.handleScrollMetrics(100, 250); await flush(); assert.equal(f.calls.length, 0);
  f.controller.handleScrollMetrics(100, 249); await flush();
  assert.equal(f.calls[0][1].offset, 1); assert.equal(f.controller.getSnapshot().offset, 2);
  assert.deepEqual(f.controller.getSnapshot().items.map(item => item.id), ['SAME', 'SAME']); f.controller.dispose();
});
test('cache restores query and selected role only for the same scope and revision; invalidation reloads active owners', async () => {
  const f = await fixture('supplier'); f.controller.start(); await flush(); f.controller.setSearch('abdu'); f.time.advance(220); await flush(); f.controller.dispose();
  f.calls.length = 0; const restored = new AdminUsersController(f.deps); restored.start(); await flush();
  assert.equal(restored.getSnapshot().query, 'abdu'); assert.equal(restored.getSnapshot().selectedKind, 'supplier'); assert.equal(f.calls.length, 0);
  f.cache.invalidate(); await flush(); assert.equal(f.calls.filter(([kind]) => kind === 'page').length, 1); restored.dispose();
  f.calls.length = 0; f.setRevision(2); const different = new AdminUsersController(f.deps); different.start(); await flush();
  assert.ok(f.calls.some(([kind]) => kind === 'page')); different.dispose();
});
test('StrictMode detach/reattach keeps subscriptions and retires the old request lifetime', async () => {
  const f = await fixture('supplier'), old = deferred(); let first = true, updates = 0;
  f.deps.readPage = async () => first ? (first = false, old.promise) : { items: [entry('CURRENT')], has_more: false };
  f.controller.subscribe(() => { updates++; }); f.controller.start(); await flush(); f.controller.dispose(); f.controller.start(); await flush();
  old.resolve({ items: [entry('OLD')], has_more: false }); await flush();
  assert.deepEqual(f.controller.getSnapshot().items.map(item => item.id), ['CURRENT']); assert.ok(updates > 1); f.controller.dispose();
});
test('scope and callback changes during state publication clear old rows before any new send', async () => {
  const f = await fixture(); f.controller.start(); await flush(); f.calls.length = 0;
  f.controller.subscribe(() => { if (f.controller.getSnapshot().selectedKind === 'supplier') f.setScope('different'); });
  f.controller.selectKind('supplier'); await flush(); assert.equal(f.controller.getSnapshot().screen, 'forbidden'); assert.equal(f.calls.length, 0);
  f.setScope('scope'); f.controller.start(); assert.equal(f.controller.getSnapshot().screen, 'forbidden'); f.controller.dispose();
});
test('detail-return tickets are issued, single-use and tied to their original mounted lifetime', async () => {
  const f = await fixture('supplier'); f.controller.start(); await flush();
  const old = f.controller.captureDetail('A', 'uz'); assert.ok(old); f.controller.dispose(); f.controller.start(); await flush(); f.calls.length = 0;
  f.controller.completeDetail(old, true); await flush(); assert.equal(f.calls.length, 0);
  f.controller.completeDetail({ item: entry('A'), routeName: '/admin-supplier-detail' }, true); await flush(); assert.equal(f.calls.length, 0);
  const current = f.controller.captureDetail('A', 'uz'); f.controller.completeDetail(current, true); f.controller.completeDetail(current, true); await flush();
  assert.equal(f.calls.filter(([kind]) => kind === 'page').length, 1); f.controller.dispose();
});
