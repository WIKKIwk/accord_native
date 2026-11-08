const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const file = path.resolve(__dirname, '../src/rezka/rezkaScannerOwner.ts'), mod = new Module(file, module);
mod.filename = file; mod.paths = module.paths;
mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, file);
const { RezkaScannerOwner } = mod.exports;
function setup() {
  let session = true; const owner = new RezkaScannerOwner(() => session);
  owner.mount(); owner.setFocused(true); owner.setForeground(true);
  return { owner, invalidate: () => { session = false; owner.recheckSession(); } };
}
test('one scan accepts the first nonempty raw detection and rejects duplicates', async () => {
  const { owner } = setup(), pending = owner.open(), ticket = owner.getSnapshot().ticket;
  assert.ok(ticket); assert.equal(await owner.open(), null);
  owner.accept(ticket, '   '); assert.equal(owner.getSnapshot().ticket, ticket);
  owner.accept(ticket, '  QR  '); owner.accept(ticket, 'duplicate');
  const result = await pending; assert.equal(result.value, 'QR'); assert.equal(result.isCurrent(), true); assert.equal(owner.getSnapshot().ticket, null);
});
test('late events cannot complete a new dialog generation', async () => {
  const { owner } = setup(), first = owner.open(), old = owner.getSnapshot().ticket;
  owner.cancel(old); assert.equal(await first, null);
  const second = owner.open(), next = owner.getSnapshot().ticket; assert.notEqual(old, next);
  owner.accept(old, 'old'); owner.cancel(old); assert.equal(owner.getSnapshot().ticket, next);
  owner.accept(next, 'new'); assert.equal((await second).value, 'new');
});
test('focus loss, account transition and unmount cancel without delivering queued events', async () => {
  for (const condition of ['focus', 'session', 'unmount']) {
    const { owner, invalidate } = setup(), pending = owner.open(), ticket = owner.getSnapshot().ticket;
    if (condition === 'focus') owner.setFocused(false);
    if (condition === 'session') invalidate();
    if (condition === 'unmount') owner.unmount();
    owner.accept(ticket, 'late'); assert.equal(await pending, null, condition); assert.equal(owner.getSnapshot().ticket, null, condition);
  }
});
test('inactive or background app pauses detections while preserving the dialog, then resumes like V2', async () => {
  const { owner } = setup(), pending = owner.open(), ticket = owner.getSnapshot().ticket;
  owner.setForeground(false); assert.equal(owner.accepts(ticket), false); owner.accept(ticket, 'inactive');
  assert.equal(owner.getSnapshot().ticket, ticket); owner.setForeground(true); owner.accept(ticket, 'active');
  assert.equal((await pending).value, 'active');
});
test('result continuation is invalid after focus ABA, app ABA, reset or unmount/remount', async () => {
  for (const condition of ['focus', 'app', 'reset', 'unmount']) {
    const { owner } = setup(), pending = owner.open(), ticket = owner.getSnapshot().ticket;
    owner.accept(ticket, 'accepted-before-transition');
    if (condition === 'focus') { owner.setFocused(false); owner.setFocused(true); }
    if (condition === 'app') { owner.setForeground(false); owner.setForeground(true); }
    if (condition === 'reset') owner.cancel();
    if (condition === 'unmount') { owner.unmount(); owner.mount(); owner.setFocused(true); owner.setForeground(true); }
    const result = await pending; assert.equal(result.isCurrent(), false, condition);
  }
});
test('opening a newer dialog invalidates a previously accepted result before its continuation runs', async () => {
  const { owner } = setup(), first = owner.open(), ticket = owner.getSnapshot().ticket;
  owner.accept(ticket, 'old'); const second = owner.open();
  assert.equal((await first).isCurrent(), false);
  owner.accept(owner.getSnapshot().ticket, 'new'); assert.equal((await second).value, 'new');
});
test('unmounted, unfocused, background and expired sessions cannot open a dialog', async () => {
  for (const condition of ['unmounted', 'focus', 'app', 'session']) {
    const { owner, invalidate } = setup();
    if (condition === 'unmounted') owner.unmount();
    if (condition === 'focus') owner.setFocused(false);
    if (condition === 'app') owner.setForeground(false);
    if (condition === 'session') invalidate();
    assert.equal(await owner.open(), null, condition); assert.equal(owner.getSnapshot().ticket, null, condition);
  }
});
test('unchanged ownership publishes no new snapshot and never cancels an active scan', async () => {
  const { owner } = setup(), pending = owner.open(), before = owner.getSnapshot(); let updates = 0;
  const unsubscribe = owner.subscribe(() => updates++);
  owner.setFocused(true); owner.setForeground(true); owner.recheckSession();
  assert.equal(owner.getSnapshot(), before); assert.equal(updates, 0);
  owner.accept(before.ticket, 'QR'); assert.equal((await pending).isCurrent(), true); assert.equal(updates, 1); unsubscribe();
});
