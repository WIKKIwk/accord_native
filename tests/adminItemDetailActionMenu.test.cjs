const assert = require('node:assert/strict');
const test = require('node:test');
const s = require('./adminItemDetailDecisionSupport.cjs');
async function fixture(overrides = {}, detail = s.detail({ is_finished_goods: true, order_image_order_id: 'image' })) {
  const f = s.fixture(overrides, detail); await f.start(); const menus = s.menus.createAdminItemDetailActionMenus(f.owner); menus.start(); return { ...f, menus };
}
test('source finished/locked-combo menu keeps exact four rows, order and localization keys without filtering disabled entries', () => {
  const finished = s.menuModel.adminItemDetailActionMenuPresentation('finished'), combo = s.menuModel.adminItemDetailActionMenuPresentation('combo');
  assert.equal(finished.titleKey, 'detail.item_actions'); assert.equal(finished.messageKey, null); assert.equal(combo.titleKey, 'calculate.combo_actions'); assert.equal(combo.messageKey, 'calculate.combo_actions_locked');
  assert.deepEqual(finished.rows.map(row => [row.action, row.labelKey, row.enabled]), [['rename', 'detail.edit_name_code', true], ['customers', 'detail.manage_customers', true], ['group', 'detail.change_group', true], ['delete', 'detail.item_delete_title', true]]);
  assert.deepEqual(combo.rows.map(row => row.key), ['admin-combo-action-rename', 'admin-combo-action-customers', 'admin-combo-action-group', 'admin-combo-action-delete']); assert.ok(combo.rows.every(row => !row.enabled)); assert.equal(combo.rows[0].labelKey, 'calculate.combo_action_rename');
});
test('each genuine four-action menu continuation waits for its exact native close and opens its captured source child flow', async () => {
  for (const [action, kind] of [['rename', 'edit'], ['customers', 'customers'], ['group', 'group'], ['delete', 'delete']]) {
    const f = await fixture(), ticket = f.menus.request(f.initial); assert.ok(ticket); const close = f.menus.prepareClose(ticket, action); assert.ok(close);
    assert.equal(f.menus.getSnapshot().menus[0].closing, true); assert.deepEqual(f.owner.getSnapshot().dialogs, []); assert.deepEqual(f.calls, []);
    assert.equal(await f.menus.completeClose({ ...close }), null); assert.equal(f.menus.prepareClose(ticket, 'delete'), null);
    const id = await f.menus.completeClose(close); assert.equal(f.dialog(id).kind, kind); assert.equal(f.dialog(id).detail, f.initial);
    assert.equal(await f.menus.completeClose(close), null); assert.equal(f.owner.getSnapshot().dialogs.length, 1);
    if (action === 'group') assert.deepEqual(f.calls, [['groups']]); else assert.deepEqual(f.calls, []);
  }
});
test('ordinary items have no menu, combo keeps all actions disabled and forged source continuation cannot mutate', async () => {
  const ordinary = await fixture({}, s.detail()); assert.equal(ordinary.menus.request(ordinary.initial), null);
  const combo = await fixture({}, s.detail({ item_group: ' KoMbO ', is_finished_goods: true })), ticket = combo.menus.request(combo.initial); assert.ok(ticket); assert.equal(ticket.kind, 'combo');
  for (const action of s.menuModel.adminItemDetailActions) assert.equal(combo.menus.prepareClose(ticket, action), null);
  assert.equal(await combo.owner.continueActionMenu(ticket, 'rename'), null); const cancel = combo.menus.prepareClose(ticket, null); assert.ok(cancel); assert.equal(await combo.menus.completeClose(cancel), null);
  assert.deepEqual(combo.owner.getSnapshot().dialogs, []); assert.deepEqual(combo.calls, []);
});
test('late original customer acknowledgment with same item code changes DTO identity/branch without invalidating the accepted finished action target', async () => {
  const pending = s.deferred(), f = await fixture({ setCustomer: async () => pending.promise });
  const customerId = f.owner.requestCustomers(f.initial); f.owner.activateCustomers(customerId); await s.flush(); const child = f.dialog(customerId).owner, customer = child.getSnapshot().customers[0];
  const assigning = child.toggle(child.row(customer), true); await f.close(customerId, false);
  const menu = f.menus.request(f.initial), close = f.menus.prepareClose(menu, 'rename');
  pending.resolve(s.detail({ item_group: 'kombo', customers: [customer] })); await assigning;
  assert.notEqual(f.owner.getSnapshot().detail, f.initial); assert.equal(f.owner.getSnapshot().itemCode, f.initial.code); assert.equal(f.owner.requestEdit(f.initial), null);
  const id = await f.menus.completeClose(close); assert.equal(f.dialog(id).kind, 'edit'); assert.equal(f.dialog(id).detail, f.initial); assert.deepEqual(f.owner.editValues(id), { code: f.initial.code, name: f.initial.name });
  f.owner.changeEdit(id, 'name', 'Changed'); await f.close(id, true); assert.equal(f.calls.find(value => value[0] === 'rename')[1], f.initial);
});
test('exact state.itemCode guard rejects renamed target even when current detail could still have the captured code', async () => {
  const pending = s.deferred(), f = await fixture({ setCustomer: async () => pending.promise });
  const customerId = f.owner.requestCustomers(f.initial); f.owner.activateCustomers(customerId); await s.flush(); const child = f.dialog(customerId).owner;
  const assigning = child.toggle(child.row(child.getSnapshot().customers[0]), true); await f.close(customerId, false);
  const menu = f.menus.request(f.initial), close = f.menus.prepareClose(menu, 'delete');
  const edit = f.owner.requestEdit(f.initial); f.owner.changeEdit(edit, 'code', 'Renamed'); await f.close(edit, true);
  pending.resolve(s.detail({ is_finished_goods: true })); await assigning; assert.equal(f.owner.getSnapshot().detail.code, f.initial.code);
  assert.equal(f.owner.getSnapshot().itemCode, 'Renamed'); assert.equal(await f.menus.completeClose(close), null); assert.equal(f.calls.filter(value => value[0] === 'remove').length, 0); assert.deepEqual(f.owner.getSnapshot().dialogs, []);
  const different = await fixture({}, s.detail({ code: ' Server code ', is_finished_goods: true })), mismatch = different.menus.request(different.initial); assert.ok(mismatch);
  assert.equal(await different.menus.completeClose(different.menus.prepareClose(mismatch, 'rename')), null); assert.deepEqual(different.owner.getSnapshot().dialogs, []);
});
test('accepted menu uses source busy check but no new phase gate, cancel consumes only its original target', async () => {
  const pending = s.deferred(), f = await fixture({ groups: () => pending.promise }), menu = f.menus.request(f.initial), close = f.menus.prepareClose(menu, 'rename');
  const group = f.owner.requestGroup(f.initial); assert.equal(await f.menus.completeClose(close), null); assert.equal(f.owner.getSnapshot().dialogs.length, 0); pending.resolve(['A']); await group;
  const reading = s.deferred(), initial = s.detail({ is_finished_goods: true }); let count = 0; const g = await fixture({ read: async () => ++count === 1 ? initial : reading.promise }, initial);
  const accepted = g.menus.request(g.initial), closed = g.menus.prepareClose(accepted, 'rename'), reloading = g.owner.reload(); assert.equal(g.owner.getSnapshot().phase, 'loading');
  const id = await g.menus.completeClose(closed); assert.equal(g.dialog(id).detail, g.initial); reading.resolve(g.initial); await reloading;
  const cancelled = g.menus.request(g.initial); assert.equal(await g.menus.completeClose(g.menus.prepareClose(cancelled, null)), null); assert.equal(g.owner.getSnapshot().dialogs.length, 1);
});
test('reentrant close publication cannot open another menu or continue a discarded original ticket into a new owner', async () => {
  const f = await fixture(), menu = f.menus.request(f.initial), close = f.menus.prepareClose(menu, 'rename'); let attempted = 'unseen', once = false;
  f.menus.subscribe(() => { if (!f.menus.getSnapshot().menus.length) attempted = f.menus.request(f.initial); }); await f.menus.completeClose(close); assert.equal(attempted, null); assert.equal(f.owner.getSnapshot().dialogs.length, 1);
  const g = await fixture(), original = g.menus.request(g.initial), oldClose = g.menus.prepareClose(original, 'delete');
  g.menus.subscribe(() => { if (!once && !g.menus.getSnapshot().menus.length) { once = true; g.menus.dispose(); g.menus.start(); } });
  assert.equal(await g.menus.completeClose(oldClose), null); assert.equal(await g.owner.continueActionMenu(original, 'delete'), null); assert.deepEqual(g.calls, []);
});
test('account retirement/native detach/StrictMode replay suppress old close while a fresh source menu continues normally', async () => {
  const f = await fixture(), menu = f.menus.request(f.initial), close = f.menus.prepareClose(menu, 'delete'); f.retire(); assert.equal(await f.menus.completeClose(close), null); assert.deepEqual(f.calls, []);
  const g = await fixture(), old = g.menus.request(g.initial), oldClose = g.menus.prepareClose(old, 'delete'), generation = g.menus.interactionGeneration;
  g.menus.dispose(); g.owner.dispose(); g.owner.start(); g.menus.start(); await s.flush(); assert.equal(await g.menus.completeClose(oldClose), null); assert.equal(g.menus.request(g.initial, generation), null);
  const fresh = g.menus.request(g.initial); assert.notEqual(fresh, old); const id = await g.menus.completeClose(g.menus.prepareClose(fresh, 'delete')); assert.equal(g.dialog(id).kind, 'delete'); await g.close(id, true); assert.equal(g.calls.length, 1);
});
test('a retained menu owner cannot adopt a replacement parent generation during child-dialog publication', async () => {
  const f = await fixture(), ticket = f.menus.request(f.initial), close = f.menus.prepareClose(ticket, 'rename'); let reset = false;
  f.owner.subscribe(() => { if (!reset && f.owner.getSnapshot().dialogs.some(dialog => dialog.kind === 'edit')) {
    reset = true; f.owner.dispose(); f.owner.start();
  } });
  assert.equal(await f.menus.completeClose(close), null); await s.flush(); assert.equal(f.menus.getSnapshot().invalidated, true); assert.deepEqual(f.owner.getSnapshot().dialogs, []); assert.deepEqual(f.calls, []);
  assert.equal(f.menus.request(f.initial), null); const fresh = s.menus.createAdminItemDetailActionMenus(f.owner); fresh.start(); assert.ok(fresh.request(f.initial));
});
test('menu activation binds original parent lifetime before any first native menu request', async () => {
  const f = await fixture(); f.owner.dispose(); f.owner.start(); await s.flush();
  assert.equal(f.menus.request(f.initial), null); assert.equal(f.menus.getSnapshot().invalidated, true);
  const replacement = s.menus.createAdminItemDetailActionMenus(f.owner); replacement.start(); assert.ok(replacement.request(f.initial));
});
