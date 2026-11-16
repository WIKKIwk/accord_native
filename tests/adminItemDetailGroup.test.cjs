const assert = require('node:assert/strict');
const test = require('node:test');
const s = require('./adminItemDetailDecisionSupport.cjs');
test('source group picker keeps current first spelling, trims/deduplicates case-insensitively then filters without selection mutation', () => {
  const choices = s.group.adminItemDetailGroupChoices(' b ', [' B ', 'a', '', 'A', ' c ']); assert.deepEqual(choices, ['a', 'b', 'c']);
  assert.deepEqual(s.group.adminItemDetailVisibleGroups(choices, ' \u0085 B '), ['b']); assert.equal(s.group.adminItemDetailSameGroup(' Kraska ', 'KRASKA'), true);
});
test('full group catalog loading blocks new body opens, clears busy before sheet and only dispatches after native apply completion', async () => {
  const pending = s.deferred(), f = s.fixture({ groups: async (guard, witness) => { guard(); assert.equal(witness(), true); return pending.promise; } }); await f.start();
  const opening = f.owner.requestGroup(f.initial); assert.equal(f.owner.getSnapshot().changingGroup, true); assert.equal(f.owner.requestEdit(f.initial), null);
  pending.resolve([' B ', 'A', 'b']); const id = await opening; assert.equal(f.owner.getSnapshot().changingGroup, false); assert.deepEqual(f.dialog(id).groups, ['A', 'B', 'Kraska']);
  f.owner.changeGroupQuery(id, 'B'); f.owner.selectGroup(id, 'foreign'); assert.equal(f.dialog(id).selected, 'Kraska'); f.owner.selectGroup(id, 'B');
  const ticket = f.owner.prepareClose(id, true); f.owner.selectGroup(id, 'A'); assert.deepEqual(f.calls, []);
  await f.owner.completeClose(ticket); assert.equal(f.calls[0][0], 'group'); assert.equal(f.calls[0][1], f.initial); assert.equal(f.calls[0][2], 'B');
  assert.equal(f.owner.getSnapshot().detail.item_group, 'B'); assert.equal(f.owner.getSnapshot().detail.order_image_order_id, 'original image'); assert.equal(f.owner.getSnapshot().notice.key, 'detail.group_updated');
});
test('group unchanged/cancel does not write and empty current cannot apply until an actual catalog row is selected', async () => {
  const f = s.fixture(); await f.start(); await f.close(await f.owner.requestGroup(f.initial), true); assert.equal(f.calls.filter(value => value[0] === 'group').length, 0);
  await f.close(await f.owner.requestGroup(f.initial), false); assert.equal(f.calls.filter(value => value[0] === 'group').length, 0);
  const g = s.fixture({}, s.detail({ item_group: '' })); await g.start(); const id = await g.owner.requestGroup(g.initial); assert.equal(g.owner.prepareClose(id, true), null); g.owner.selectGroup(id, 'A'); await g.close(id, true); assert.equal(g.owner.getSnapshot().changed, true);
});
test('group stale loader, failure and reentrant sheet completion preserve source loading/notice and original generation', async () => {
  const pending = s.deferred(), f = s.fixture({ groups: () => pending.promise }); await f.start(); const opening = f.owner.requestGroup(f.initial); f.owner.dispose(); f.owner.start(); await s.flush(); pending.resolve(['New']);
  assert.equal(await opening, null); assert.deepEqual(f.owner.getSnapshot().dialogs, []);
  const error = { toString: () => 'Exception: unavailable' }, g = s.fixture({ groups: async () => { throw error; } }); await g.start(); assert.equal(await g.owner.requestGroup(g.initial), null);
  assert.equal(g.owner.getSnapshot().changingGroup, false); assert.equal(g.owner.getSnapshot().notice.error, error);
  const saving = s.deferred(), h = s.fixture({ moveGroup: async () => saving.promise }); await h.start(); let completed, seen = false;
  h.owner.subscribe(() => { const dialog = h.owner.getSnapshot().dialogs.at(-1); if (dialog?.kind === 'group' && !dialog.closing && !seen) {
    seen = true; h.owner.selectGroup(dialog.id, 'B'); const ticket = h.owner.prepareClose(dialog.id, true); completed = h.owner.completeClose(ticket);
  } });
  await h.owner.requestGroup(h.initial); assert.equal(h.owner.getSnapshot().changingGroup, true);
  saving.resolve(s.detail({ item_group: 'B' })); await completed; assert.equal(h.owner.getSnapshot().changingGroup, false); assert.equal(h.owner.getSnapshot().detail.item_group, 'B');
});
