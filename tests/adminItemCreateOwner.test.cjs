const assert = require('node:assert/strict');
const test = require('node:test');
const s = require('./adminItemCreateSupport.cjs');
test('coordinator local group/UOM picker result waits its native sheet close before refreshing original dialog', async () => {
  const one = s.owner(); one.controller.start(); await s.flush(); one.controller.openDialog(); const dialog = one.controller.getSnapshot().form.dialog;
  one.controller.openPicker('group', dialog); const picker = one.controller.getSnapshot().picker; await s.flush(); assert.equal(picker.kind, 'group');
  picker.controller.select('Raw'); assert.equal(one.controller.getSnapshot().form.draft.group, 'All Item Groups'); picker.controller.completeClose();
  assert.equal(one.controller.getSnapshot().picker, null); assert.equal(one.controller.getSnapshot().form.draft.group, 'Raw'); assert.notEqual(one.controller.getSnapshot().form.dialog, dialog);
});
test('picker cancel also rebuilds the original StatefulBuilder snapshot, including live saving busy state', async () => {
  const create = s.deferred(), f = s.formOwner({ create: () => create.promise }), one = s.owner({ form: f.deps }); one.controller.start(); await s.flush(); one.controller.openDialog(); const dialog = one.controller.getSnapshot().form.dialog;
  const saving = one.controller.save(dialog); await s.flush(); assert.equal(one.controller.getSnapshot().form.dialog.savingView, false);
  one.controller.openPicker('group', dialog); const picker = one.controller.getSnapshot().picker; picker.controller.dismiss(); picker.controller.completeClose();
  assert.equal(one.controller.getSnapshot().form.dialog.savingView, true); create.resolve(s.item('Created')); await saving;
});
test('returnOnCreate only emits after original native dialog dismissal, once; stale acknowledgement never closes another dialog', async () => {
  const one = s.owner({ form: s.formOwner({ returnOnCreate: true }).deps }); one.controller.start(); await s.flush(); one.controller.openDialog(); const dialog = one.controller.getSnapshot().form.dialog;
  await one.controller.save(dialog); assert.equal(one.controller.getSnapshot().form.dialog, null); assert.equal(one.returned.length, 0);
  one.controller.completeDialog(dialog.id + 1); assert.equal(one.returned.length, 0); one.controller.completeDialog(dialog.id); one.controller.completeDialog(dialog.id); assert.equal(one.returned.length, 1);
});
test('unmount retires returned dialog acknowledgement and native picker result; reattach keeps new callbacks active', async () => {
  const one = s.owner({ form: s.formOwner({ returnOnCreate: true }).deps }); one.controller.start(); await s.flush(); one.controller.openDialog(); const old = one.controller.getSnapshot().form.dialog;
  await one.controller.save(old); one.controller.dispose(); one.controller.start(); await s.flush(); one.controller.completeDialog(old.id); assert.equal(one.returned.length, 0);
  one.controller.openDialog(); const next = one.controller.getSnapshot().form.dialog; assert.notEqual(next.generation, old.generation); await one.controller.save(next); one.controller.completeDialog(next.id); assert.equal(one.returned.length, 1);
});
test('subscriber cannot reopen a picker or recursively dismiss a closing original dialog publication', async () => {
  const one = s.owner(); one.controller.start(); await s.flush(); one.controller.openDialog(); const original = one.controller.getSnapshot().form.dialog;
  one.controller.subscribe(() => { if (!one.controller.getSnapshot().form.dialog) { one.controller.openDialog(); one.controller.openPicker('group', original); one.controller.completeDialog(original.id); } });
  one.controller.closeDialog(original, true); assert.equal(one.controller.getSnapshot().form.dialog, null); assert.equal(one.controller.getSnapshot().picker, null);
});
test('source dialog dismissal barrier holds new FAB opens until genuine native completion, including manual dismiss', async () => {
  const one = s.owner(); one.controller.start(); await s.flush(); one.controller.openDialog(); const dialog = one.controller.getSnapshot().form.dialog;
  one.controller.closeDialog(dialog, true); one.controller.openDialog(); assert.equal(one.controller.getSnapshot().form.dialog, null); assert.equal(one.controller.getSnapshot().closingDialog.id, dialog.id);
  one.controller.completeDialog(dialog.id + 1); one.controller.openDialog(); assert.equal(one.controller.getSnapshot().form.dialog, null);
  one.controller.completeDialog(dialog.id); one.controller.openDialog(); assert.notEqual(one.controller.getSnapshot().form.dialog.id, dialog.id);
});
