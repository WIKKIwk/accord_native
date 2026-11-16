const assert = require('node:assert/strict');
const test = require('node:test');
const s = require('./adminUsersSupport.cjs');
const strict = s.load('shared/camera/synchronousGuard'), mobile = s.load('shared/mobileApiException');
const catalog = s.load('shared/catalogApi', { '../authorizedFetch': {}, '../appPreferences': {}, './mobileApiException': mobile, './searchActivityStore': { SearchActivityStore: class {} } });
const model = s.load('admin/adminCustomerDetailModel', { '../shared/catalogApi': catalog, './dartJsonString': s.strings });
const { AdminCustomerDetailController } = s.load('admin/adminCustomerDetailController', { '../shared/mobileApiException': mobile, '../shared/camera/synchronousGuard': strict,
  './adminCustomerDetailModel': model, './dartJsonString': s.strings });
const { AdminCustomerDetailPresentation } = s.load('admin/adminCustomerDetailPresentation', { '../shared/camera/synchronousGuard': strict, './dartJsonString': s.strings });
const item = (code, name = code) => catalog.supplierItemFromJson({ code, name });
const detail = patch => model.adminCustomerDetailFromJson({ ref: 'dto ref', name: 'Original', phone: 'old', code: ' code ', assigned_items: [item('A')], assigned_item_groups: ['Rulon'], assigned_warehouses: ['W'], ...patch });
function fixture(t, overrides = {}) {
  let valid = true, focused = true, removed = 0;
  const calls = [], timers = new Map(), deps = { isCurrent: () => valid, mode: { management: true, items: true, remove: true, material: false },
    read: async () => detail(), phone: async () => detail(), regenerate: async () => detail(), remove: async () => { calls.push('remove'); },
    items: async () => [item('A'), item('B'), item('C')], assign: async row => { calls.push(['assign', row.code]); return detail({ assigned_items: [item('A'), row] }); },
    unassign: async row => { calls.push(['unassign', row.code]); return detail({ assigned_items: [] }); }, groups: async () => ['Kley', 'Rulon'],
    updateGroups: async (dto, groups) => { calls.push(['groups', dto.ref, groups]); return detail({ assigned_item_groups: groups }); }, copy: async () => {},
    everySecond: () => 1, cancelTimer() {}, ...overrides };
  const controller = new AdminCustomerDetailController(deps), ui = new AdminCustomerDetailPresentation({ controller, interactive: () => focused,
    onRemoved: () => { removed++; }, schedule: (callback, milliseconds) => { assert.equal(milliseconds, 180); const token = {}; timers.set(token, callback); return token; }, cancel: token => timers.delete(token) });
  t.after(() => { ui.detach(); controller.dispose(); });
  return { controller, ui, deps, calls, timers, get removed() { return removed; }, focus: value => { focused = value; }, retire: () => { valid = false; },
    start: async () => { controller.start(); ui.activate(); await s.flush(); controller.toggle(); },
    flushTimers: async () => { [...timers.values()].forEach(run => run()); await s.flush(); }, top: () => ui.getSnapshot().sheets.at(-1) };
}
test('material groups keep source search/selection/counts and begin native closure before resolving the original picker', async t => {
  const f = fixture(t, { mode: { management: true, material: true, items: false, remove: false } }); await f.start();
  const editing = f.ui.editGroups(); await s.flush(); let sheet = f.top(); assert.equal(sheet.kind, 'groups'); assert.equal(f.controller.getSnapshot().editingGroups, true);
  f.ui.searchGroups(sheet.id, '  KL  '); sheet = f.top(); assert.equal(sheet.query, 'kl'); assert.deepEqual(f.ui.visibleGroups(sheet), ['Kley']);
  f.ui.toggleGroup(sheet.id, 'Rulon', false); assert.deepEqual(f.top().selectedKeys, []); assert.equal(f.ui.beginCloseSheet(sheet.id, true), false);
  f.ui.toggleGroup(sheet.id, 'Kley', true); f.ui.toggleGroup(sheet.id, 'forged', true); assert.deepEqual(f.top().selectedKeys, ['kley']);
  f.deps.read = async () => detail({ assigned_item_groups: ['Kley'] }); assert.equal(f.ui.beginCloseSheet(sheet.id, true), true);
  assert.equal(f.top().closing, true); assert.deepEqual(f.calls, []); f.ui.finishCloseSheet(sheet.id); await editing;
  assert.deepEqual(f.calls, [['groups', 'dto ref', ['Kley']]]); assert.equal(f.controller.getSnapshot().notice.key, 'detail.groups_saved'); assert.deepEqual(f.ui.getSnapshot().sheets, []);
});
test('cancelled groups and a StrictMode detach settle pending picks without saving or borrowing a reattached owner', async t => {
  const f = fixture(t, { mode: { management: true, material: true, items: false, remove: false } }); await f.start();
  const first = f.ui.editGroups(); await s.flush(); const old = f.top(), generation = f.ui.interactionGeneration; f.ui.dismissSheet(old.id); await first; assert.deepEqual(f.calls, []);
  const pending = f.ui.editGroups(); await s.flush(); const stale = f.top(); f.ui.detach(); f.controller.dispose(); f.controller.start(); f.ui.activate(); await s.flush(); f.controller.toggle(); await pending;
  assert.equal(f.ui.beginCloseSheet(stale.id, true, generation), false); assert.equal(f.ui.getSnapshot().sheets.length, 0); assert.deepEqual(f.calls, []);
});
test('available sheets preserve original DTO/case-sensitive exclusions through the catalog await', async t => {
  const catalogRead = s.deferred(), f = fixture(t, { items: async () => catalogRead.promise }); await f.start(); const original = f.controller.getSnapshot().detail;
  const opening = f.ui.openAvailable(); await f.controller.assignItem(item('B')); catalogRead.resolve([item('B'), item('a'), item('A'), item('C')]); await opening;
  assert.equal(f.top().detail, original); assert.deepEqual(f.top().items.map(row => row.code), ['B', 'a', 'C']);
  f.ui.openAssigned(original); assert.equal(f.ui.getSnapshot().sheets.length, 1, 'underlying parent controls cannot bypass a native overlay');
});
test('concurrent accepted catalog reads retain separate native sheets even while an earlier host is closing', async t => {
  const first = s.deferred(), second = s.deferred(); let reads = 0;
  const f = fixture(t, { items: () => ++reads === 1 ? first.promise : second.promise }); await f.start();
  const one = f.ui.openAvailable(), two = f.ui.openAvailable(); first.resolve([item('B')]); await one; const old = f.top();
  assert.equal(f.ui.beginCloseSheet(old.id), true); second.resolve([item('C')]); await two;
  assert.deepEqual(f.ui.getSnapshot().sheets.map(sheet => sheet.items[0].code), ['B', 'C']); const fresh = f.top();
  f.ui.finishCloseSheet(old.id); assert.equal(f.top().id, fresh.id); assert.equal(f.ui.sheetInteractive(fresh.id), true);
  f.ui.nativeBeginDismiss(old.id); f.ui.finishCloseSheet(old.id); assert.equal(f.top().id, fresh.id);
});
test('native swipe cancellation remains a pure cleanup after focus loss and cannot replace a group Save decision', async t => {
  const f = fixture(t, { mode: { management: true, material: true, items: false, remove: false } }); await f.start();
  const first = f.ui.editGroups(); await s.flush(); const cancelled = f.top(); f.focus(false);
  f.ui.nativeBeginDismiss(cancelled.id); assert.equal(f.top().closing, true); f.ui.finishCloseSheet(cancelled.id); await first; assert.deepEqual(f.calls, []);
  f.focus(true); const second = f.ui.editGroups(); await s.flush(); const saved = f.top(); f.ui.toggleGroup(saved.id, 'Kley', true);
  f.deps.read = async () => detail({ assigned_item_groups: ['Kley', 'Rulon'] }); assert.equal(f.ui.beginCloseSheet(saved.id, true), true); f.focus(false);
  f.ui.nativeBeginDismiss(saved.id); f.ui.finishCloseSheet(saved.id); await second; assert.deepEqual(f.calls, [['groups', 'dto ref', ['Kley', 'Rulon']]]);
});
test('Add sheet keeps only its currently active code disabled and source boolean/row settlement behavior for concurrent other rows', async t => {
  const first = s.deferred(), second = s.deferred(), f = fixture(t, { assign: async row => { f.calls.push(['assign', row.code]); return row.code === 'B' ? first.promise : second.promise; } }); await f.start();
  await f.ui.openAvailable(); const sheet = f.top(), [b, c] = sheet.items, one = f.ui.actOnItem(sheet.id, b); await f.ui.actOnItem(sheet.id, b);
  const two = f.ui.actOnItem(sheet.id, c); assert.deepEqual(f.calls, [['assign', 'B'], ['assign', 'C']]); assert.equal(f.top().activeCode, 'C');
  first.resolve(detail({ assigned_items: [item('A'), b] })); await s.flush(); assert.equal(f.controller.getSnapshot().addingItem, false, 'source boolean clears after the first completion');
  assert.deepEqual(f.top().collapsingCodes, ['B']); await f.flushTimers(); await one; assert.deepEqual(f.top().items.map(row => row.code), ['C']);
  assert.equal(f.top().activeCode, null, 'first 180ms completion clears the shared active code even while the other row is pending');
  second.resolve(detail({ assigned_items: [item('A'), c] })); await s.flush(); await f.flushTimers(); await two;
  assert.equal(f.top().id, sheet.id); assert.deepEqual(f.top().items, [], 'an emptied source sheet remains open without an invented empty message');
});
test('assigned sheet item prompts retain object identity and return success to the original row only after the confirmed command', async t => {
  const pending = s.deferred(), f = fixture(t, { read: async () => detail({ assigned_items: [item('A'), item('B')] }), unassign: async row => { f.calls.push(['unassign', row.code]); return pending.promise; } }); await f.start();
  f.ui.openAssigned(f.controller.getSnapshot().detail); const sheet = f.top(), [a, b] = sheet.items, removing = f.ui.actOnItem(sheet.id, a), prompt = f.controller.getSnapshot().prompt;
  assert.equal(f.top().activeCode, 'A'); assert.equal(f.ui.choosePrompt({ ...prompt }, true), false); assert.equal(f.ui.choosePrompt(prompt, true), true);
  assert.equal(f.ui.back(), true); assert.equal(f.controller.getSnapshot().prompt, prompt, 'back cannot cancel an already accepted host-close decision');
  const confirmed = f.ui.confirmPrompt(prompt); assert.deepEqual(f.calls, [['unassign', 'A']]); const other = f.ui.actOnItem(sheet.id, b), next = f.controller.getSnapshot().prompt;
  assert.equal(next.item, b); assert.equal(f.ui.choosePrompt(next, false), true); f.ui.dismissPrompt(next); await other; assert.equal(f.top().activeCode, null);
  pending.resolve(detail({ assigned_items: [b] })); await confirmed; await s.flush(); await f.flushTimers(); await removing;
  assert.deepEqual(f.top().items.map(row => row.code), ['B']); assert.equal(f.ui.choosePrompt(prompt, true), false);
});
test('closing a sheet permits its accepted write to update the parent, while detached row callbacks and collapsing timers stay retired', async t => {
  const pending = s.deferred(), f = fixture(t, { assign: async row => { f.calls.push(['assign', row.code]); return pending.promise; } }); await f.start();
  await f.ui.openAvailable(); const sheet = f.top(), row = sheet.items[0], writing = f.ui.actOnItem(sheet.id, row);
  f.ui.dismissSheet(sheet.id); assert.equal(f.ui.getSnapshot().sheets.length, 0); pending.resolve(detail({ name: 'Ack', assigned_items: [row] })); await writing;
  assert.equal(f.controller.getSnapshot().detail.name, 'Ack'); assert.equal(f.timers.size, 0); await f.ui.actOnItem(sheet.id, row); assert.equal(f.calls.length, 1);
});
test('forged/closed sheet rows and old UI generations cannot dispatch another command', async t => {
  const f = fixture(t); await f.start(); await f.ui.openAvailable(); const original = f.top(), generation = f.ui.interactionGeneration;
  await f.ui.actOnItem(original.id, { ...original.items[0] }); assert.deepEqual(f.calls, []); f.ui.dismissSheet(original.id);
  f.ui.detach(); f.controller.dispose(); f.controller.start(); f.ui.activate(); await s.flush(); f.controller.toggle(); await f.ui.openAvailable();
  const fresh = f.top(); await f.ui.actOnItem(fresh.id, fresh.items[0], generation); await f.ui.actOnItem(original.id, original.items[0]); assert.deepEqual(f.calls, []);
});
test('prompt acceptance is focus-gated once; the accepted original customer removal survives blur and calls the genuine changed back result once', async t => {
  const pending = s.deferred(), f = fixture(t, { remove: async () => { f.calls.push('remove'); await pending.promise; } }); await f.start();
  f.ui.requestRemove(); const prompt = f.controller.getSnapshot().prompt; f.focus(false); assert.equal(f.ui.choosePrompt(prompt, true), false); f.focus(true);
  assert.equal(f.ui.choosePrompt(prompt, true), true); f.focus(false); const saving = f.ui.confirmPrompt(prompt); await f.ui.confirmPrompt(prompt); assert.deepEqual(f.calls, ['remove']);
  pending.resolve(); await saving; assert.equal(f.removed, 1); await f.ui.confirmPrompt(prompt); assert.equal(f.removed, 1);
});
test('owner cleanup immediately settles an item row waiting for an already claimed remote prompt, then ignores its late acknowledgment', async t => {
  const pending = s.deferred(), f = fixture(t, { unassign: async () => pending.promise }); await f.start(); f.ui.openAssigned(f.controller.getSnapshot().detail);
  const sheet = f.top(), row = f.ui.actOnItem(sheet.id, sheet.items[0]), prompt = f.controller.getSnapshot().prompt; f.ui.choosePrompt(prompt, true); const command = f.ui.confirmPrompt(prompt);
  f.ui.detach(); f.controller.dispose(); await row; assert.equal(f.ui.getSnapshot().sheets.length, 0); pending.resolve(detail()); await command; assert.equal(f.removed, 0);
});
test('session retirement during a prepared prompt suppresses dispatch and clears private sheet/picker data', async t => {
  const f = fixture(t); await f.start(); f.ui.requestRemove(); const prompt = f.controller.getSnapshot().prompt; f.ui.choosePrompt(prompt, true); f.retire(); await f.ui.confirmPrompt(prompt);
  assert.deepEqual(f.calls, []); assert.equal(f.removed, 0); assert.deepEqual(f.ui.getSnapshot().sheets, []); assert.equal(f.controller.getSnapshot().valid, false);
});
