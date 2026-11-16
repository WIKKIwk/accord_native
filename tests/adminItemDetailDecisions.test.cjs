const assert = require('node:assert/strict');
const test = require('node:test');
const s = require('./adminItemDetailDecisionSupport.cjs');

test('source edit trims once, prioritizes code validation and retains raw-vs-trim unchanged semantics', () => {
  assert.equal(s.edit.adminItemDetailEditDraft(' \u0085 ', ''), 'detail.code_required'); assert.equal(s.edit.adminItemDetailEditDraft('Code', '\u0085'), 'detail.name_required');
  const draft = s.edit.adminItemDetailEditDraft(' Code ', ' Name '); assert.deepEqual(draft, { code: 'Code', name: 'Name' }); assert.equal(Object.isFrozen(draft), true);
  assert.equal(s.edit.adminItemDetailEditUnchanged(draft, s.detail()), true); assert.equal(s.edit.adminItemDetailEditUnchanged(draft, s.detail({ code: ' Code ' })), false);
  assert.equal(s.edit.adminItemDetailOperationMessage({ toString: () => ' \nException: bad \n' }, 'Fallback'), 'bad');
  assert.equal(s.edit.adminItemDetailOperationMessage({ toString: () => 'Exception: \u0085' }, 'Fallback'), 'Fallback');
  assert.equal(s.edit.adminItemDetailCustomerError({ toString: () => 'Exception:  raw \n' }), ' raw \n');
});
test('rename validates in its original dialog, hides before writing and consumes only the original native completion ticket', async () => {
  const f = s.fixture(); await f.start(); const id = f.owner.requestEdit(f.initial); f.owner.changeEdit(id, 'code', ' ');
  assert.equal(f.owner.prepareClose(id, true), null); assert.equal(f.dialog(id).validation, 'detail.code_required'); assert.deepEqual(f.calls, []);
  f.owner.changeEdit(id, 'code', ' New '); f.owner.changeEdit(id, 'name', ' New Name '); const ticket = f.owner.prepareClose(id, true);
  assert.equal(f.dialog(id).closing, true); assert.deepEqual(f.calls, []); f.owner.changeEdit(id, 'code', 'poison'); assert.equal(f.owner.prepareClose(id, false), null);
  assert.deepEqual(await f.owner.completeClose({ ...ticket }), { changed: false, removed: false }); assert.deepEqual(f.calls, []);
  assert.deepEqual(await f.owner.completeClose(ticket), { changed: true, removed: false }); assert.equal(f.calls[0][1], f.initial); assert.deepEqual(f.calls[0][2], { code: 'New', name: 'New Name' });
  assert.equal(f.owner.getSnapshot().itemCode, 'New'); assert.equal(f.owner.getSnapshot().detail.order_image_order_id, ''); assert.equal(f.owner.getSnapshot().notice.key, 'detail.item_saved');
  await f.owner.completeClose(ticket); assert.equal(f.calls.length, 1); assert.deepEqual(f.reads, ['Code']);
});
test('unchanged/cancel edits do not write or invent notices; successful same-code edit retains its image', async () => {
  const f = s.fixture(); await f.start(); const unchanged = f.owner.requestEdit(f.initial); await f.close(unchanged, true); assert.deepEqual(f.calls, []); assert.equal(f.owner.getSnapshot().changed, false);
  const cancel = f.owner.requestEdit(f.initial); f.owner.changeEdit(cancel, 'name', 'Discarded'); await f.close(cancel, false); assert.deepEqual(f.calls, []);
  const changed = f.owner.requestEdit(f.initial); f.owner.changeEdit(changed, 'name', ' Changed '); await f.close(changed, true); assert.equal(f.owner.getSnapshot().detail.order_image_order_id, 'original image');
  assert.equal(f.owner.getSnapshot().notice.key, 'detail.item_saved');
});
test('accepted dialogs preserve initial captured DTO across reverse-awaited renames instead of retargeting to current code', async () => {
  const first = s.deferred(), second = s.deferred(), f = s.fixture({ rename: async (detail, draft, guard) => {
    guard(); f.calls.push(['rename', detail, draft]); return draft.code === 'First' ? first.promise : second.promise;
  } }); await f.start();
  const a = f.owner.requestEdit(f.initial), b = f.owner.requestEdit(f.initial); f.owner.changeEdit(b, 'code', 'Second'); const bTicket = f.owner.prepareClose(b, true), bSave = f.owner.completeClose(bTicket);
  f.owner.changeEdit(a, 'code', 'First'); const aTicket = f.owner.prepareClose(a, true), aSave = f.owner.completeClose(aTicket);
  second.resolve(s.detail({ code: 'Second' })); await bSave; assert.equal(f.owner.getSnapshot().itemCode, 'Second');
  first.resolve(s.detail({ code: 'First' })); await aSave; assert.equal(f.owner.getSnapshot().itemCode, 'First'); assert.equal(f.calls.length, 2); assert.equal(f.calls[0][1], f.initial); assert.equal(f.calls[1][1], f.initial);
  assert.equal(f.owner.requestEdit(f.initial), null); assert.deepEqual(f.reads, ['Code']);
});
test('real retry awaits the read, replaces/disposes original read instance and uses renamed code without an extra rename GET', async () => {
  const pending = s.deferred(); let latestGuard, count = 0; const f = s.fixture({ read: async (code, guard, witness) => { f.reads.push(code); if (++count === 1) return f.initial; latestGuard = guard; assert.equal(witness(), true); return pending.promise; } });
  await f.start(); const edit = f.owner.requestEdit(f.initial); f.owner.changeEdit(edit, 'code', 'New'); await f.close(edit, true); assert.deepEqual(f.reads, ['Code']);
  let settled = false; const reload = f.owner.reload().then(() => { settled = true; }); await s.tick(); assert.deepEqual(f.reads, ['Code', 'New']); assert.equal(settled, false);
  pending.resolve(s.detail({ code: 'New', name: 'Reloaded' })); await reload; assert.equal(f.owner.getSnapshot().detail.name, 'Reloaded');
  f.owner.dispose(); assert.throws(latestGuard, /changed/);
});
test('delete cancellation and failure keep page, exact captured DTO drives success changed/pop result after native close', async () => {
  let failing = true; const failure = { toString: () => 'Exception: active stock ' }, f = s.fixture({ remove: async (detail, guard) => { guard(); f.calls.push(['remove', detail]); if (failing) throw failure; } }); await f.start();
  await f.close(f.owner.requestDelete(f.initial), false); assert.deepEqual(f.calls, []);
  const failed = await f.close(f.owner.requestDelete(f.initial), true); assert.deepEqual(failed, { changed: false, removed: false }); assert.equal(f.owner.getSnapshot().phase, 'content');
  assert.equal(f.owner.getSnapshot().notice.key, 'detail.item_delete_failed'); assert.equal(f.owner.getSnapshot().notice.error, failure);
  failing = false; const id = f.owner.requestDelete(f.initial), ticket = f.owner.prepareClose(id, true); assert.equal(f.calls.length, 1);
  assert.deepEqual(await f.owner.completeClose(ticket), { changed: true, removed: true }); assert.equal(f.calls[1][1], f.initial); assert.equal(f.owner.getSnapshot().phase, 'removed'); assert.equal(f.owner.getSnapshot().deleting, false);
});
test('rename error keeps raw source text while group/delete retain fallback-aware operation error identity', async () => {
  const error = { toString: () => 'Exception: raw error \n' }, f = s.fixture({ rename: async () => { throw error; } }); await f.start();
  const id = f.owner.requestEdit(f.initial); f.owner.changeEdit(id, 'name', 'New'); await f.close(id, true);
  assert.deepEqual(f.owner.getSnapshot().notice, { serial: f.owner.getSnapshot().notice.serial, kind: 'raw', message: 'Exception: raw error \n' });
  assert.equal(f.owner.getSnapshot().changed, false); assert.equal(f.owner.getSnapshot().saving, false);
});
test('close publication fences reentrant opens and retirement before dispatch; no command from an old StrictMode callback survives', async () => {
  const f = s.fixture(); await f.start(); let reentrant = 'unseen'; f.owner.subscribe(() => { if (f.owner.getSnapshot().saving) reentrant = f.owner.requestDelete(f.owner.getSnapshot().detail); });
  const id = f.owner.requestEdit(f.initial); f.owner.changeEdit(id, 'name', 'New'); await f.close(id, true); assert.equal(reentrant, null);
  const g = s.fixture(); await g.start(); const old = g.owner.requestEdit(g.initial); g.owner.changeEdit(old, 'name', 'New'); const ticket = g.owner.prepareClose(old, true);
  g.owner.subscribe(() => { if (g.owner.getSnapshot().saving) g.owner.invalidate(); }); await g.owner.completeClose(ticket); assert.deepEqual(g.calls, []); assert.equal(g.owner.getSnapshot().phase, 'invalidated');
  const h = s.fixture(); await h.start(); const oldId = h.owner.requestDelete(h.initial), oldTicket = h.owner.prepareClose(oldId, true); h.owner.dispose(); h.owner.start(); await s.flush();
  await h.owner.completeClose(oldTicket); assert.deepEqual(h.calls, []); assert.equal(h.owner.prepareClose(oldId, true), null); await h.close(h.owner.requestDelete(h.initial), true); assert.equal(h.calls.length, 1);
});
test('original account retirement while native window closes or command waits cannot install ack/notice/pop in another owner', async () => {
  for (const at of ['native-close', 'request']) {
    const pending = s.deferred(), f = s.fixture({ rename: async () => pending.promise }); await f.start(); const id = f.owner.requestEdit(f.initial); f.owner.changeEdit(id, 'name', 'New'); const ticket = f.owner.prepareClose(id, true);
    if (at === 'native-close') f.retire(); const done = f.owner.completeClose(ticket); if (at === 'request') f.retire(); pending.resolve(s.detail({ name: 'Secret' })); await done;
    assert.equal(f.owner.getSnapshot().phase, 'invalidated'); assert.equal(f.owner.getSnapshot().detail, null); assert.equal(f.owner.getSnapshot().notice, null);
  }
});
test('new-open source visibility keeps combo locked and customers finished-only without cancelling already-issued DTO decisions', async () => {
  for (const initial of [s.detail({ item_group: ' \u0085 KOMBO ', is_finished_goods: false }), s.detail({ item_group: 'kombo', is_finished_goods: true })]) {
    const f = s.fixture({}, initial); await f.start(); assert.equal(f.owner.requestEdit(initial), null); assert.equal(f.owner.requestDelete(initial), null);
    assert.equal(await f.owner.requestGroup(initial), null); assert.equal(f.owner.requestCustomers(initial), null); assert.deepEqual(f.calls, []);
  }
  const ordinary = s.fixture(); await ordinary.start(); assert.equal(ordinary.owner.requestCustomers(ordinary.initial), null);
  const f = s.fixture({ rename: async (detail, draft) => s.detail({ ...detail, ...draft, item_group: 'kombo' }) }); await f.start();
  const originalDelete = f.owner.requestDelete(f.initial), edit = f.owner.requestEdit(f.initial); f.owner.changeEdit(edit, 'name', 'Combo now'); await f.close(edit, true);
  assert.equal(f.owner.requestEdit(f.owner.getSnapshot().detail), null); await f.close(originalDelete, true); assert.equal(f.calls[0][0], 'remove'); assert.equal(f.calls[0][1], f.initial);
});
test('error formatting and acknowledgment publication cannot publish an old notice after reentrant owner retirement', async () => {
  const error = { toString: () => { f.owner.dispose(); f.owner.start(); return 'old error'; } }, f = s.fixture({ rename: async () => { throw error; } }); await f.start();
  const id = f.owner.requestEdit(f.initial); f.owner.changeEdit(id, 'name', 'New'); await f.close(id, true); await s.flush(); assert.equal(f.owner.getSnapshot().notice, null); assert.equal(f.owner.getSnapshot().changed, false);
  const g = s.fixture(); await g.start(); let retired = false; g.owner.subscribe(() => {
    if (!retired && g.owner.getSnapshot().changed) { retired = true; g.owner.dispose(); g.owner.start(); }
  }); const edit = g.owner.requestEdit(g.initial); g.owner.changeEdit(edit, 'name', 'New'); await g.close(edit, true); await s.flush();
  assert.equal(g.owner.getSnapshot().notice, null); assert.equal(g.owner.getSnapshot().changed, false);
});
