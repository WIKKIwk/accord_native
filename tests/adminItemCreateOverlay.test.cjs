const assert = require('node:assert/strict');
const test = require('node:test');
const s = require('./adminItemCreateSupport.cjs');
const { AdminItemCreateOverlayController } = s.load('admin/AdminItemCreateOverlayController', { '../shared/camera/synchronousGuard': s.strict });
async function fixture(options = {}) {
  const one = s.owner(options); one.controller.start(); await s.flush(); const generation = one.controller.getSnapshot().generation; let focused = true;
  const overlays = new AdminItemCreateOverlayController({ controller: one.controller }, () => one.controller.isCurrent(generation), () => focused); overlays.start();
  return { ...one, overlays, focus: value => { focused = value; } };
}
test('native presentation retains original closing create content and emits return only after its genuine completion event', async () => {
  const f = await fixture({ form: s.formOwner({ returnOnCreate: true }).deps }); f.controller.openDialog(); const ticket = f.overlays.getSnapshot().create;
  f.overlays.completeCreate(ticket); assert.equal(f.overlays.getSnapshot().createVisible, true); assert.equal(f.returned.length, 0);
  await f.controller.save(ticket.dialog); assert.equal(f.overlays.getSnapshot().createVisible, false); assert.equal(f.overlays.getSnapshot().create, ticket); assert.equal(f.returned.length, 0);
  f.overlays.completeCreate(ticket); f.overlays.completeCreate(ticket); assert.equal(f.returned.length, 1); assert.equal(f.overlays.getSnapshot().create, null);
});
test('native original-window identity survives StatefulBuilder body refresh without retargeting completion to a different dialog', async () => {
  const f = await fixture(); f.controller.openDialog(); const original = f.overlays.getSnapshot().create; f.controller.form.refreshDialog(original.dialog.id); const refreshed = f.overlays.getSnapshot().create;
  assert.notEqual(original, refreshed); assert.equal(original.identity, refreshed.identity); f.controller.closeDialog(refreshed.dialog, true); f.overlays.completeCreate(original); assert.equal(f.controller.getSnapshot().closingDialog, null);
  f.controller.openDialog(); const next = f.overlays.getSnapshot().create; assert.notEqual(original.identity, next.identity); f.overlays.completeCreate(original); assert.equal(f.overlays.getSnapshot().create, next);
});
test('move command requires original native confirmation removal, and accepted account command survives blur exactly once', async () => {
  let sends = 0; const f = await fixture({ list: s.listOwner({ move: async () => { sends++; return { updated_count: 1, failed_count: 0, updated_item_codes: ['A'] }; } }).deps });
  f.controller.list.toggleItem(s.item('A')); f.controller.list.changeGroup('G'); await s.flush(); f.controller.list.requestMove(); const ticket = f.overlays.getSnapshot().move;
  await f.overlays.completeMove(ticket); assert.equal(sends, 0); f.overlays.chooseMove(ticket, true); assert.equal(f.controller.getSnapshot().list.prompt, null); assert.equal(f.overlays.getSnapshot().moveVisible, false); assert.equal(sends, 0);
  f.focus(false); await f.overlays.completeMove(ticket); await f.overlays.completeMove(ticket); assert.equal(sends, 1); assert.equal(f.overlays.getSnapshot().move, null);
});
test('focus rejects unaccepted native confirm while account retirement/disposal rejects already accepted close acknowledgement', async () => {
  let sends = 0; const f = await fixture({ list: s.listOwner({ move: async () => { sends++; throw Error('unexpected'); } }).deps });
  f.controller.list.toggleItem(s.item('A')); f.controller.list.changeGroup('G'); await s.flush(); f.controller.list.requestMove(); const ticket = f.overlays.getSnapshot().move;
  f.focus(false); f.overlays.chooseMove(ticket, true); assert.equal(f.controller.getSnapshot().list.prompt, ticket.prompt); f.focus(true); f.overlays.chooseMove(ticket, true); f.overlays.dispose(); await f.overlays.completeMove(ticket); assert.equal(sends, 0);
});
test('reentrant native completion during closing publication cannot dispatch before acceptance settles', async () => {
  let sends = 0; const f = await fixture({ list: s.listOwner({ move: async () => { sends++; return { updated_count: 0, failed_count: 0, updated_item_codes: [] }; } }).deps });
  f.controller.list.toggleItem(s.item('A')); f.controller.list.changeGroup('G'); await s.flush(); f.controller.list.requestMove(); const ticket = f.overlays.getSnapshot().move;
  f.overlays.subscribe(() => { if (!f.overlays.getSnapshot().moveVisible) void f.overlays.completeMove(ticket); });
  f.overlays.chooseMove(ticket, true); assert.equal(sends, 0); await f.overlays.completeMove(ticket); assert.equal(sends, 1);
});
