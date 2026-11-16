const assert = require('node:assert/strict'), test = require('node:test');
const { load, deferred, flush } = require('./adminUsersSupport.cjs');
const { AdminPresentationWindowOwner } = load('admin/adminPresentationWindowOwner', { '../shared/camera/synchronousGuard': load('shared/camera/synchronousGuard') });
function fixture() {
  const calls = [], arm = deferred(), detached = deferred(); let current = true, closing = false, scope;
  const native = { capabilities: async () => ({ protocol: 1, platform: 'android', guarantee: 'window-tree-detach' }),
    arm: (tag, ticket) => { calls.push(['arm', tag, ticket]); scope = { protocol: 1, guarantee: 'window-tree-detach', handle: `window-${ticket}`, ticket, viewTag: tag }; return arm.promise; },
    waitForDetach: (handle, ticket) => { calls.push(['wait', handle, ticket]); return detached.promise; },
    cancelPending: async ticket => { calls.push(['pending-cancel', ticket]); return false; }, cancel: async (handle, ticket) => { calls.push(['cancel', handle, ticket]); return true; } };
  const adapter = load('admin/adminPresentationWindow', { expo: { requireOptionalNativeModule: () => native } });
  const options = { identity: {}, ticket: 'original', isCurrent: () => current, isClosing: () => closing, onDetached: () => calls.push('completed') };
  return { calls, arm, detached, options, native, scope: () => scope, current: value => { current = value; }, closing: value => { closing = value; },
    async create() { const capability = await adapter.readAdminPresentationWindowCapability('android'); options.observer = capability.observer; return new AdminPresentationWindowOwner(options); },
    ack: () => arm.resolve({ ...scope, state: 'armed' }), removed: () => detached.resolve({ ...scope, state: 'detached' }) };
}
test('accepted close keeps original dialog until real arm ACK and only genuine original window removal completes', async () => {
  const f = fixture(), owner = await f.create(), stop = owner.attach(); f.closing(true); owner.requestClose(); assert.equal(owner.getSnapshot().present, true); owner.markerTag(17); assert.equal(owner.getSnapshot().phase, 'arming'); assert.equal(owner.getSnapshot().present, true);
  f.ack(); await flush(); assert.equal(owner.getSnapshot().phase, 'removing'); assert.equal(owner.getSnapshot().present, false); assert.equal(f.calls.includes('completed'), false); assert.equal(f.calls.filter(value => value[0] === 'wait').length, 1);
  f.removed(); await flush(); assert.equal(owner.getSnapshot().phase, 'detached'); assert.equal(f.calls.filter(value => value === 'completed').length, 1); stop(); await flush(); assert.equal(f.calls.filter(value => value === 'completed').length, 1);
});
test('arming alone and an unaccepted close cannot remove or complete native content', async () => {
  const f = fixture(), owner = await f.create(), stop = owner.attach(); owner.markerTag(17); f.ack(); await flush(); owner.requestClose(); assert.equal(owner.getSnapshot().present, true); assert.equal(owner.getSnapshot().phase, 'armed'); assert.equal(f.calls.includes('completed'), false); stop(); await flush();
});
test('invalid or absent actual marker never arms and cleanup never fabricates a close', async () => {
  const f = fixture(), owner = await f.create(), stop = owner.attach(); for (const value of [undefined, null, 0, -1, NaN, 1.5, 2_147_483_648]) owner.markerTag(value); f.closing(true); owner.requestClose(); stop(); await flush(); assert.deepEqual(f.calls, []); assert.equal(owner.getSnapshot().phase, 'retired');
});
test('native observer arm rejection retains the dialog and never completes accepted creation', async () => {
  const f = fixture(), owner = await f.create(), stop = owner.attach(); owner.markerTag(17); f.closing(true); owner.requestClose(); f.arm.reject(Error('marker_unavailable')); await flush(); assert.equal(owner.getSnapshot().present, true); assert.equal(owner.getSnapshot().phase, 'failed'); assert.equal(f.calls.includes('completed'), false); stop(); await flush();
});
test('native root loss before accepted close cannot later acknowledge another close or rearm a successor', async () => {
  const f = fixture(), owner = await f.create(), stop = owner.attach(); owner.markerTag(17); f.ack(); await flush(); f.removed(); await flush(); assert.equal(owner.getSnapshot().phase, 'failed'); f.closing(true); owner.requestClose(); owner.markerTag(19); assert.equal(f.calls.filter(value => value[0] === 'arm').length, 1); assert.equal(f.calls.includes('completed'), false); stop(); await flush();
});
test('actual unmount cancels pending arm and a late native receipt is released without completion', async () => {
  const f = fixture(), owner = await f.create(), stop = owner.attach(); owner.markerTag(17); stop(); await flush(); assert.deepEqual(f.calls, [['arm', 17, 'original'], ['pending-cancel', 'original']]); f.ack(); await flush(); assert.ok(f.calls.some(value => value[0] === 'cancel')); assert.equal(f.calls.includes('completed'), false);
});
test('StrictMode detach/reattach keeps an already open native window and its one original watcher', async () => {
  const f = fixture(), owner = await f.create(); let stop = owner.attach(); owner.markerTag(17); f.ack(); await flush(); stop(); stop = owner.attach(); await flush(); owner.markerTag(17);
  assert.equal(f.calls.filter(value => value[0] === 'cancel' || value[0] === 'pending-cancel').length, 0); assert.equal(f.calls.filter(value => value[0] === 'arm').length, 1); assert.equal(f.calls.filter(value => value[0] === 'wait').length, 1);
  f.closing(true); owner.requestClose(); f.removed(); await flush(); assert.equal(f.calls.includes('completed'), true); stop(); await flush();
});
test('account/owner retirement after arm rejects old native events and suppresses in-flight detach completion', async () => {
  const f = fixture(), owner = await f.create(), stop = owner.attach(); owner.markerTag(17); f.ack(); await flush(); f.closing(true); owner.requestClose(); f.current(false); owner.checkCurrent(); f.removed(); await flush(); assert.equal(owner.getSnapshot().phase, 'retired'); assert.equal(f.calls.includes('completed'), false); assert.ok(f.calls.some(value => value[0] === 'cancel')); stop();
});
test('delayed old-presenter cleanup releases only old resources and never a replacement dialog', async () => {
  const f = fixture(), old = await f.create(), oldStop = old.attach(); old.markerTag(17); f.ack(); await flush(); const fresh = fixture(); fresh.options.ticket = 'fresh'; const next = await fresh.create(), newStop = next.attach(); oldStop(); next.markerTag(19); fresh.ack(); await flush();
  assert.ok(f.calls.some(value => value[0] === 'cancel')); assert.equal(fresh.calls.some(value => value[0] === 'cancel'), false); fresh.closing(true); next.requestClose(); fresh.removed(); await flush(); assert.equal(fresh.calls.includes('completed'), true); assert.equal(f.calls.includes('completed'), false); newStop(); await flush();
});
test('issued authority can finish through page blur, but live accepted-closing withdrawal denies completion', async () => {
  const f = fixture(), owner = await f.create(), stop = owner.attach(); owner.markerTag(17); f.ack(); await flush(); f.closing(true); owner.requestClose(); f.closing(false); f.removed(); await flush(); assert.equal(f.calls.includes('completed'), false); stop(); await flush();
  const g = fixture(), visible = await g.create(), close = visible.attach(); visible.markerTag(17); g.ack(); await flush(); g.closing(true); visible.requestClose(); g.removed(); await flush(); assert.equal(g.calls.includes('completed'), true); close(); await flush();
});
test('synchronous reentrant and accidentally async original guards never authorize native work', async () => {
  const f = fixture(); f.options.isCurrent = () => Promise.reject(Error('async current')); const owner = await f.create(), stop = owner.attach(); owner.markerTag(17); await flush(); assert.equal(owner.getSnapshot().phase, 'retired'); assert.deepEqual(f.calls, []); stop();
  const g = fixture(); let nested; g.options.isCurrent = () => { nested.checkCurrent(); return true; }; nested = await g.create(); const close = nested.attach(); nested.markerTag(17); assert.equal(nested.getSnapshot().phase, 'retired'); assert.deepEqual(g.calls, []); close(); await flush();
});
test('native failure or reentrant observer retirement cannot be converted into a completed domain close', async () => {
  const f = fixture(), owner = await f.create(), stop = owner.attach(); owner.markerTag(17); f.ack(); await flush(); f.closing(true); owner.requestClose(); f.detached.reject(Error('activity_destroyed')); await flush(); assert.equal(owner.getSnapshot().phase, 'failed'); assert.equal(f.calls.includes('completed'), false); stop(); await flush();
  const g = fixture(), other = await g.create(), close = other.attach(); other.subscribe(() => { if (other.getSnapshot().phase === 'detached') g.current(false); }); other.markerTag(17); g.ack(); await flush(); g.closing(true); other.requestClose(); g.removed(); await flush(); assert.equal(g.calls.includes('completed'), false); close(); await flush();
});
test('constructor captures original callbacks and refuses missing authority or malformed ticket', async () => {
  const f = fixture(), owner = await f.create(), stop = owner.attach(); f.options.onDetached = () => { throw Error('new callback must not replace original'); }; owner.markerTag(17); f.ack(); await flush(); f.closing(true); owner.requestClose(); f.removed(); await flush(); assert.equal(f.calls.includes('completed'), true); stop();
  for (const patch of [{ identity: null }, { ticket: undefined }, { ticket: 'has space' }, { isCurrent: null }, { isClosing: null }, { observer: null }, { onDetached: null }]) assert.throws(() => new AdminPresentationWindowOwner({ ...f.options, ...patch }), TypeError); await flush();
});
test('unique native tickets use genuine UUIDs and never a JS/HMR counter or fallback', () => {
  const values = ['a3de7746-3d66-47de-af96-aa84dd44e765', 'c83f730a-2204-46ce-9d69-e393db71a077'];
  const { createAdminPresentationWindowTicket } = load('admin/adminPresentationWindowTicket', { 'expo-crypto': { randomUUID: () => values.shift() } });
  const first = createAdminPresentationWindowTicket(), second = createAdminPresentationWindowTicket(); assert.notEqual(first, second); assert.match(first, /^admin-window-/); assert.throws(createAdminPresentationWindowTicket, /genuine unique ticket/);
});
function hookFixture(options) {
  const slots = []; let cursor = 0, pending = [], closing = false;
  const same = (left, right) => !!left && !!right && left.length === right.length && left.every((value, index) => value === right[index]);
  const memo = (read, deps) => { const index = cursor++, old = slots[index]; if (!old || !same(old.deps, deps)) slots[index] = { deps, value: read() }; return slots[index].value; };
  const effect = (create, deps) => { const index = cursor++, old = slots[index]; if (!old || !same(old.deps, deps)) { const entry = { create, deps, cleanup: old?.cleanup }; slots[index] = entry; pending.push(() => { entry.cleanup?.(); entry.cleanup = create(); }); } };
  const hook = load('admin/useAdminPresentationWindow', { react: { useMemo: memo, useLayoutEffect: effect, useSyncExternalStore: (_subscribe, get) => get() },
    './adminPresentationWindowOwner': { AdminPresentationWindowOwner } }).useAdminPresentationWindow;
  const render = () => { cursor = 0; pending = []; const value = hook(options, closing); pending.splice(0).forEach(run => run()); return value; };
  const cleanup = () => slots.forEach(slot => slot.cleanup?.()), replay = () => { cleanup(); slots.forEach(slot => { if (slot.create) slot.cleanup = slot.create(); }); };
  return { render, cleanup, replay, closing: value => { closing = value; }, options: value => { options = value; } };
}
test('actual hook keeps an open window through StrictMode replay and requires native completion after accepted closing render', async () => {
  const f = fixture(); await f.create(); const hook = hookFixture(f.options), initial = hook.render(); initial.owner.markerTag(17); f.ack(); await flush(); hook.replay(); await flush(); assert.equal(f.calls.some(value => value[0] === 'cancel'), false);
  f.closing(true); hook.closing(true); const closing = hook.render(); assert.equal(closing.owner.getSnapshot().present, false); assert.equal(f.calls.includes('completed'), false); f.removed(); await flush(); assert.equal(f.calls.includes('completed'), true); hook.cleanup(); await flush();
});
test('actual hook never swaps original authority for new callbacks under the same native identity', async () => {
  const f = fixture(); await f.create(); const hook = hookFixture(f.options), value = hook.render(); value.owner.markerTag(17); f.ack(); await flush(); f.current(false);
  hook.options({ ...f.options, isCurrent: () => true, isClosing: () => true, onDetached: () => { throw Error('new authority must not replace original'); } }); hook.closing(true); const retained = hook.render(); assert.equal(retained.owner, value.owner); assert.equal(retained.owner.getSnapshot().phase, 'retired'); f.removed(); await flush(); assert.equal(f.calls.includes('completed'), false); hook.cleanup(); await flush();
});
