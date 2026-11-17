const assert = require('node:assert/strict'), test = require('node:test');
const { fixture, sheetCapability, parentDomain, content, deferred, flush } = require('./adminRootPresentationSupport.cjs');

async function owned(platform = 'android', options = {}) {
  const f = fixture(platform); f.rootReady();
  const parent = new parentDomain.AdminRootNativeParentOwner({ chain: f.chain, parent: f.chain.root, nativeIdentity: f.rootNative });
  let stopParent = parent.attach(); const view = {}; parent.capture(view, 101);
  const binding = parent.read(f.chain, f.chain.root), cap = await sheetCapability(platform, options.native);
  const source = new Set(); let sourceCurrent = true, sequence = 0, onClose = () => {};
  const opened = f.open({ kind: 'sheet', ...cap, presentation: { platform, heightPoints: 420, cornerRadius: 28, ...(platform === 'android' ? { barrierOpacity: .32 } : {}) },
    isCurrent: () => sourceCurrent, subscribeCurrent: changed => { source.add(changed); return () => source.delete(changed); }, onRequestClose: lease => onClose(lease) });
  assert.ok(opened); const identity = {}, attach = () => f.chain.attachSheet(opened.entry, identity, binding);
  let stop = attach(); assert.equal(typeof stop, 'function');
  const event = (kind, extra = {}, nativeIdentity = identity) => f.chain.receiveSheetEvent(opened.entry, nativeIdentity,
    { protocol: 1, kind, sequence: ++sequence, presentationTicket: opened.entry.id, parentTicket: f.chain.root.id, transaction: null, acceptedClose: null, reason: null, ...extra });
  const joined = (transaction = 'native-close') => {
    const accepted = f.chain.sheetAcceptedClose(opened.entry, identity); assert.ok(accepted);
    assert.equal(event('closeAccepted', { transaction, acceptedClose: accepted.closeTicket }), true);
    const state = f.chain.sheetLifecycle(opened.entry, identity);
    if (!state.physicalDismissed) assert.equal(event('didDismiss', { transaction, acceptedClose: accepted.closeTicket }), true);
    assert.equal(event('closeJoined', { transaction, acceptedClose: accepted.closeTicket }), true);
  };
  return { ...cap, ...f, opened, identity, parent, binding, source, attach, event, joined,
    onClose: fn => { onClose = fn; }, stop: () => stop(), stopParent: () => stopParent(),
    reconnect: () => { stop = attach(); stopParent = parent.attach(); },
    sourceCurrent: value => { sourceCurrent = value; for (const changed of [...source]) changed(); },
    cleanup: () => { stop?.(); stopParent(); parent.retire(); f.chain.retire(); } };
}

for (const platform of ['android', 'ios']) {
  test(`${platform}: original sheet waits for real shown; programmatic close waits for joined native Source receipt`, async () => {
    const f = await owned(platform); try {
      assert.equal(f.chain.canInteract(f.opened.entry), false);
      assert.equal(f.chain.nativeShown(f.opened.entry, f.identity), false); assert.equal(f.chain.nativeArmed(f.opened.entry, f.identity), false);
      assert.equal(f.event('layout', { width: 390, height: 420 }), true); assert.equal(f.chain.canInteract(f.opened.entry), false);
      assert.equal(f.event('shown', {}, {}), false); assert.equal(f.event('shown'), true); assert.equal(f.chain.canInteract(f.opened.entry), true);
      assert.equal(f.chain.requestClose(f.opened.entry), true); assert.equal(f.chain.canInteract(f.opened.entry), false);
      assert.equal(f.chain.nativeRemoved(f.opened.entry, f.identity), false); assert.equal(f.chain.nativeResourceRemoved(f.opened.entry, f.identity), false);
      assert.equal(f.chain.sourceOutcome(f.opened.entry), null); f.joined();
      assert.equal(await f.opened.closed, 'closed'); assert.equal(f.chain.hasSheetResource(f.opened.entry, f.identity), false);
      assert.equal(f.calls.length, 0); assert.equal(f.source.size, 0);
    } finally { f.cleanup(); }
  });
  test(`${platform}: native cancellation forwards original lease and needs an explicit Source close decision`, async () => {
    const f = await owned(platform); try {
      f.event('shown'); let lease; f.onClose(value => { lease = value; });
      f.event('willDismiss', { transaction: 'gesture-one' }); assert.equal(f.chain.canInteract(f.opened.entry), false);
      assert.equal(f.event('didDismiss', { transaction: 'gesture-one' }), true); assert.ok(lease);
      assert.equal(f.chain.sourceOutcome(f.opened.entry), null); assert.equal(f.chain.sheetAcceptedClose(f.opened.entry, f.identity), null);
      assert.equal(f.chain.requestClose(f.opened.entry, { ...lease }), false); assert.equal(f.chain.requestClose(f.opened.entry, lease), true);
      assert.equal(f.chain.sheetAcceptedClose(f.opened.entry, f.identity).transaction, 'gesture-one'); f.joined('gesture-one');
      assert.equal(await f.opened.closed, 'closed');
    } finally { f.cleanup(); }
  });
  test(`${platform}: synchronous Source acceptance inside native cancellation preserves original transaction`, async () => {
    const f = await owned(platform); try {
      f.event('shown'); f.onClose(lease => { assert.equal(f.chain.requestClose(f.opened.entry, lease), true); });
      f.event('willDismiss', { transaction: 'gesture-now' }); assert.equal(f.event('didDismiss', { transaction: 'gesture-now' }), true);
      assert.equal(f.chain.sheetLifecycle(f.opened.entry, f.identity).outcome, null); f.joined('gesture-now'); assert.equal(await f.opened.closed, 'closed');
    } finally { f.cleanup(); }
  });
  test(`${platform}: owner retirement retains original resources until genuine cleanup, with no successful Source result`, async () => {
    const wait = deferred(); let request;
    const f = await owned(platform, { native: { retireSheet: (p, parent, retirement) => { request = { p, parent, retirement }; return wait.promise; } } });
    try {
      f.event('shown'); f.sourceCurrent(false); assert.equal(await f.opened.closed, 'retired');
      assert.equal(f.chain.hasSheetResource(f.opened.entry, f.identity), true); assert.ok(request); assert.equal(f.source.size, 1);
      wait.resolve({ protocol: 1, platform, presentationTicket: request.p, parentTicket: request.parent, retirementTicket: request.retirement,
        receiptID: '11111111-2222-4333-8444-555555555555', disposition: 'removed' }); await flush();
      assert.equal(f.chain.hasSheetResource(f.opened.entry, f.identity), false); assert.equal(f.chain.sourceOutcome(f.opened.entry), 'retired'); assert.equal(f.source.size, 0);
      assert.equal(f.chain.getSnapshot().retired, false); assert.equal(f.chain.canInteract(f.chain.root), true);
    } finally { f.cleanup(); }
  });
  test(`${platform}: queued and mounted descendants block parent cleanup; postorder retains parent outlet`, async () => {
    const f = await owned(platform); try {
      f.event('shown'); const child = f.open({ kind: 'dialog', renderContent: content }); assert.ok(child);
      const native = f.native(child.entry); native.ready(); f.sourceCurrent(false); assert.equal(await f.opened.closed, 'retired'); assert.equal(f.calls.length, 0);
      assert.equal(f.chain.retained(f.opened.entry), true); assert.equal(f.chain.canInteract(child.entry), true);
      assert.equal(f.chain.requestClose(child.entry), true); native.removed(); assert.equal(await child.closed, 'closed'); await flush();
      assert.equal(f.calls.length, 1); assert.equal(f.chain.hasSheetResource(f.opened.entry, f.identity), false);
    } finally { f.cleanup(); }
  });
  test(`${platform}: descendant-first StrictMode replay reconnects SAME original sheet while parent is temporarily detached`, async () => {
    const f = await owned(platform); try {
      f.event('shown'); f.stop(); f.stopParent(); f.reconnect(); await flush();
      assert.equal(f.chain.getSnapshot().retired, false); assert.equal(f.chain.canInteract(f.opened.entry), true);
      assert.equal(f.chain.sheetLifecycle(f.opened.entry, f.identity).shown, true); assert.equal(f.calls.length, 0);
    } finally { f.cleanup(); }
  });
}
test('copied/mismatched native capability pairs and unsubscribed owners do not admit a sheet', async () => {
  const f = fixture('ios'); f.rootReady(); const a = await sheetCapability('ios'), b = await sheetCapability('ios');
  const request = { kind: 'sheet', ...a, presentation: { platform: 'ios', heightPoints: 420, cornerRadius: 28 }, subscribeCurrent: () => () => {} };
  for (const patch of [{ nativeCapability: { ...a.nativeCapability } }, { retirementCapability: { ...a.retirementCapability } }, { retirementCapability: b.retirementCapability }, { subscribeCurrent: undefined }]) assert.equal(f.open({ ...request, ...patch }), null);
  f.chain.retire();
});
test('a queued original Source owner is subscribed immediately; retirement cancels its never-mounted suffix without native cleanup', async () => {
  const f = fixture('ios'); f.rootReady(); const cap = await sheetCapability('ios'), source = new Set(); let current = true;
  const opened = f.open({ kind: 'sheet', ...cap, presentation: { platform: 'ios', heightPoints: 400, cornerRadius: 24 },
    isCurrent: () => current, subscribeCurrent: changed => { source.add(changed); return () => source.delete(changed); } });
  assert.ok(opened); assert.equal(source.size, 1); const child = f.open(); assert.ok(child);
  current = false; for (const changed of [...source]) changed(); current = true;
  assert.equal(await opened.closed, 'retired'); assert.equal(await child.closed, 'retired');
  assert.equal(source.size, 0); assert.equal(cap.calls.length, 0); assert.equal(f.chain.top(), f.chain.root); f.chain.retire();
});
test('missing synchronous owner cleanup cancels admission, observes rejected thenables, and allocates no native resource', async () => {
  const f = fixture('ios'); f.rootReady(); const cap = await sheetCapability('ios');
  const opened = f.open({ kind: 'sheet', ...cap, presentation: { platform: 'ios', heightPoints: 400, cornerRadius: 24 },
    subscribeCurrent: () => Promise.reject(Error('not a subscription cleanup')) });
  assert.equal(opened, null); await flush(); assert.deepEqual(f.chain.getSnapshot().resources, []); assert.equal(cap.calls.length, 0); f.chain.retire();
});
test('pending native gesture holds new descendants; cancellation restores the same sheet without a Source close', async () => {
  const f = await owned('android'); try {
    f.event('shown'); assert.equal(f.event('attempt'), true); assert.equal(f.chain.sourceOutcome(f.opened.entry), null);
    f.event('willDismiss', { transaction: 'cancelled-gesture' }); assert.equal(f.open(), null);
    assert.equal(f.event('cancelled', { transaction: 'cancelled-gesture' }), true); assert.equal(f.chain.canInteract(f.opened.entry), true);
    assert.ok(f.open());
  } finally { f.cleanup(); }
});
test('an accepted Source parent close retains a previously reserved child and sends close intent only after that child leaves', async () => {
  const f = await owned('ios'); try {
    f.event('shown'); const child = f.open(); assert.ok(child);
    assert.equal(f.chain.requestClose(f.opened.entry), true); assert.equal(f.chain.sheetAcceptedClose(f.opened.entry, f.identity), null);
    assert.equal(f.chain.canPresent(child.entry), true); const native = f.native(child.entry); native.ready();
    assert.equal(f.chain.canInteract(child.entry), true); assert.equal(f.open(), null);
    f.chain.requestClose(child.entry); native.removed(); assert.equal(await child.closed, 'closed');
    assert.ok(f.chain.sheetAcceptedClose(f.opened.entry, f.identity)); f.joined(); assert.equal(await f.opened.closed, 'closed');
  } finally { f.cleanup(); }
});
test('whole account retirement drains a genuine child first and never upgrades retired Source results', async () => {
  const f = await owned('android'); try {
    f.event('shown'); const child = f.open(), native = f.native(child.entry); native.ready(); f.chain.retire();
    assert.equal(await f.opened.closed, 'retired'); assert.equal(await child.closed, 'retired'); assert.equal(f.calls.length, 0);
    assert.equal(f.chain.nativeResourceRemoved(child.entry, native.identity), true); await flush();
    assert.equal(f.calls.length, 1); assert.equal(f.chain.hasSheetResource(f.opened.entry, f.identity), false);
    assert.equal(f.chain.sourceOutcome(f.opened.entry), 'retired'); assert.equal(f.chain.sourceOutcome(child.entry), 'retired');
  } finally { f.cleanup(); }
});
test('a native retired event is not itself a resource removal receipt', async () => {
  const wait = deferred(); const f = await owned('ios', { native: { retireSheet: () => wait.promise } });
  try {
    f.event('shown'); assert.equal(f.event('retired'), true); assert.equal(await f.opened.closed, 'retired');
    assert.equal(f.chain.hasSheetResource(f.opened.entry, f.identity), true); assert.equal(f.chain.nativeResourceRemoved(f.opened.entry, f.identity), false);
  } finally { f.cleanup(); }
});
test('malformed cleanup receipt holds the resource, then a genuine Root resource change retries the same retirement ticket', async () => {
  let attempts = 0; const calls = [];
  const f = await owned('ios', { native: { retireSheet: async (presentationTicket, parentTicket, retirementTicket) => {
    calls.push([presentationTicket, parentTicket, retirementTicket]);
    return { protocol: 1, platform: 'ios', presentationTicket, parentTicket, retirementTicket,
      receiptID: ++attempts === 1 ? 'not-a-native-receipt' : '11111111-2222-4333-8444-555555555555', disposition: 'removed' };
  } } });
  try {
    f.event('shown'); f.sourceCurrent(false); await flush(); assert.equal(calls.length, 1); assert.equal(f.chain.hasSheetResource(f.opened.entry, f.identity), true);
    f.chain.nativeShown(f.chain.root, f.rootNative); await flush(); assert.equal(calls.length, 2); assert.deepEqual(calls[0], calls[1]);
    assert.equal(f.chain.hasSheetResource(f.opened.entry, f.identity), false); assert.equal(await f.opened.closed, 'retired');
  } finally { f.cleanup(); }
});
test('a shown sheet rejects a contradictory neverPresented cleanup result', async () => {
  const f = await owned('ios', { native: { retireSheet: async (presentationTicket, parentTicket, retirementTicket) => ({ protocol: 1, platform: 'ios', presentationTicket, parentTicket, retirementTicket,
    receiptID: '11111111-2222-4333-8444-555555555555', disposition: 'neverPresented' }) } });
  try {
    f.event('shown'); f.sourceCurrent(false); await flush(); assert.equal(await f.opened.closed, 'retired'); assert.equal(f.chain.hasSheetResource(f.opened.entry, f.identity), true);
  } finally { f.cleanup(); }
});
