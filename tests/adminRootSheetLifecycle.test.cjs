const assert = require('node:assert/strict'), test = require('node:test');
const s = require('./adminRootSheetLifecycleSupport.cjs');
const types = s.load('admin/AdminRootSheetTypes');
test('typed fixed native sheet options require exact Android barrier and hold current production admission before mutations', () => {
  assert.equal(types.adminRootSheetAdmission.status, 'unavailable'); assert.equal(types.adminRootSheetAdmission.reason, 'original-cleanup-coordinator-unavailable');
  assert.deepEqual(types.captureAdminRootSheetOptions({ platform: 'android', heightPoints: 400, cornerRadius: 32, barrierOpacity: .32 }), { platform: 'android', heightPoints: 400, cornerRadius: 32, barrierOpacity: .32 });
  for (const patch of [{ barrierOpacity: undefined }, { heightPoints: 0 }, { cornerRadius: -1 }, { barrierOpacity: 2 }]) assert.equal(types.captureAdminRootSheetOptions({ platform: 'android', heightPoints: 400, cornerRadius: 32, barrierOpacity: .32, ...patch }), null);
  const f = s.rootFixture('ios'); f.rootReady(); const before = f.chain.getSnapshot(); let reads = 0;
  const held = { kind: 'sheet', get identity() { reads++; throw Error('must not read'); }, get nativeCapability() { reads++; throw Error('no cleanup'); }, get presentation() { reads++; throw Error('must not read'); } };
  assert.equal(f.chain.open(held), null); assert.equal(reads, 0); assert.equal(f.chain.getSnapshot(), before); f.rootStop();
});
test('fixed geometry captures each original field once and never freezes a later getter value after validation', () => {
  let platforms = 0, heights = 0;
  const input = { get platform() { return ++platforms === 1 ? 'android' : 'ios'; }, get heightPoints() { return ++heights === 1 ? 400 : Infinity; }, cornerRadius: 32, barrierOpacity: .32 };
  const captured = types.captureAdminRootSheetOptions(input); assert.deepEqual(captured, { platform: 'android', heightPoints: 400, cornerRadius: 32, barrierOpacity: .32 }); assert.equal(platforms, 1); assert.equal(heights, 1); assert.ok(Object.isFrozen(captured));
  assert.equal(types.captureAdminRootSheetOptions(Object.assign([], { platform: 'ios', heightPoints: 400, cornerRadius: 32 })), null);
});
test('registration/layout supply no shown proof; only original native shown permits ordinary interaction', () => {
  const f = s.fixture(); try {
    assert.equal(f.owner.canInteract(), false); assert.equal(f.event('layout', { width: 390, height: 400 }), true); assert.equal(f.owner.canInteract(), false);
    const shown = f.wire('shown'); assert.equal(f.owner.receive({}, shown), false); assert.equal(f.owner.receive(f.identity, { ...shown, parentTicket: 'foreign' }), false);
    assert.equal(f.owner.receive(f.identity, shown), true); assert.equal(f.owner.receive(f.identity, shown), false); assert.equal(f.owner.canInteract(), true);
  } finally { f.cleanup(); }
});
test('willDismiss immediately fences ordinary commands/children without Source cancellation; exact native cancellation restores SAME shown', () => {
  const f = s.fixture(); try {
    f.shown(); assert.equal(f.event('willDismiss', { transaction: 'native-pan-1' }), true); assert.equal(f.owner.canInteract(), false); assert.equal(f.owner.canOpenNewDescendant(), false); assert.equal(f.owner.readCurrent(), true); assert.deepEqual(f.leases, []);
    assert.equal(f.event('cancelled', { transaction: 'foreign-pan' }), false); assert.equal(f.event('cancelled', { transaction: 'native-pan-1' }), true); assert.equal(f.owner.canInteract(), true); assert.equal(f.owner.getSnapshot().shown, true);
    assert.equal(f.event('shown'), false); assert.equal(f.event('willDismiss', { transaction: 'native-pan-1' }), false); assert.equal(f.event('willDismiss', { transaction: 'native-pan-2' }), true);
  } finally { f.cleanup(); }
});
test('actual early dismissal dispatches one opaque original cancel lease, but callback return or Promise never accepts Source close', async () => {
  const f = s.fixture(); try {
    f.onCancel(lease => { f.leases.push(lease); return Promise.reject(Error('no Source acceptance')); }); f.shown(); f.event('didDismiss', { transaction: 'physical-1' }); await s.flush();
    const lease = f.leases[0]; assert.equal(f.leases.length, 1); assert.equal(f.owner.isCancellationCurrent(lease), true); assert.equal(f.owner.isCancellationCurrent({ ...lease }), false);
    assert.equal(f.owner.getSnapshot().acceptedClose, null); assert.equal(f.owner.acceptedCloseIntent(), null); assert.equal(f.owner.canInteract(), false); assert.equal(f.owner.readCurrent(), true);
    assert.equal(f.event('didDismiss', { transaction: 'physical-1' }), false); assert.equal(f.leases.length, 1);
  } finally { f.cleanup(); }
});
test('explicit accepted original cancellation joins native C/G only after actual physical receipt, not gesture/callback/closeAccepted', async () => {
  const f = s.fixture(); try {
    f.shown(); f.event('willDismiss', { transaction: 'native-user' }); f.event('didDismiss', { transaction: 'native-user' }); const lease = f.leases[0];
    assert.equal(f.owner.requestClose({ ...lease }), false); assert.equal(f.owner.requestClose(lease), true); const intent = f.owner.acceptedCloseIntent(); assert.equal(intent.transaction, 'native-user'); assert.equal(f.owner.isCancellationCurrent(lease), false);
    assert.equal(f.event('closeJoined', { transaction: 'native-user', acceptedClose: intent.closeTicket }), false);
    assert.equal(f.event('closeAccepted', { transaction: 'foreign-native', acceptedClose: intent.closeTicket }), false); assert.equal(f.event('closeAccepted', { transaction: 'native-user', acceptedClose: intent.closeTicket }), true);
    assert.equal(f.owner.getSnapshot().outcome, null); assert.equal(f.event('closeJoined', { transaction: 'native-user', acceptedClose: 'foreign-C' }), false);
    assert.equal(f.event('closeJoined', { transaction: 'native-user', acceptedClose: intent.closeTicket }), true); assert.equal(await f.owner.closed, 'closed');
  } finally { f.cleanup(); }
});
test('programmatic Source C/null remains immutable while native atomically binds a real pending or early-dismissed G', async () => {
  for (const physical of [false, true]) {
    const f = s.fixture(); try {
      f.shown(); f.event('willDismiss', { transaction: 'native-atomic' }); if (physical) f.event('didDismiss', { transaction: 'native-atomic' });
      assert.equal(f.owner.requestClose(), true); const intent = f.owner.acceptedCloseIntent(); assert.equal(intent.transaction, null);
      assert.equal(f.event('closeAccepted', { transaction: 'native-atomic', acceptedClose: intent.closeTicket }), true); assert.equal(f.owner.acceptedCloseIntent(), intent); assert.equal(intent.transaction, null);
      if (!physical) f.event('didDismiss', { transaction: 'native-atomic', acceptedClose: intent.closeTicket });
      assert.equal(f.event('closeJoined', { transaction: 'native-atomic', acceptedClose: intent.closeTicket }), true); assert.equal(await f.owner.closed, 'closed');
    } finally { f.cleanup(); }
  }
});
test('cancellation received before native acceptance clears only its old G while preserving independently accepted C/null and new atomic echo', () => {
  const f = s.fixture(); try {
    f.shown(); f.event('willDismiss', { transaction: 'old-pan' }); f.owner.requestClose(); const intent = f.owner.acceptedCloseIntent();
    assert.equal(f.event('cancelled', { transaction: 'old-pan' }), true); assert.equal(f.owner.canInteract(), false); assert.equal(f.owner.acceptedCloseIntent(), intent);
    assert.equal(f.event('closeAccepted', { transaction: 'native-new', acceptedClose: intent.closeTicket }), true); assert.equal(f.owner.getSnapshot().boundTransaction, 'native-new');
    assert.equal(f.event('cancelled', { transaction: 'native-new' }), false);
  } finally { f.cleanup(); }
});
test('accepted Source close before native show waits genuine shown/didDismiss/Joined and does not admit queued descendants', async () => {
  const f = s.fixture(); try {
    assert.equal(f.owner.requestClose(), true); f.facts.noChildren = false; assert.equal(f.owner.acceptedCloseIntent(), null); f.facts.noChildren = true;
    const intent = f.owner.acceptedCloseIntent(); f.event('closeAccepted', { transaction: 'native-pre-show', acceptedClose: intent.closeTicket });
    assert.equal(f.owner.canInteract(), false); assert.equal(f.event('didDismiss', { transaction: 'native-pre-show', acceptedClose: intent.closeTicket }), false);
    assert.equal(f.event('shown', { transaction: 'native-pre-show', acceptedClose: intent.closeTicket }), true); f.event('didDismiss', { transaction: 'native-pre-show', acceptedClose: intent.closeTicket });
    f.facts.noChildren = false; assert.equal(f.event('closeJoined', { transaction: 'native-pre-show', acceptedClose: intent.closeTicket }), false); f.facts.noChildren = true;
    assert.equal(f.event('closeJoined', { transaction: 'native-pre-show', acceptedClose: intent.closeTicket }), true); assert.equal(await f.owner.closed, 'closed');
  } finally { f.cleanup(); }
});
test('native receipts cannot create Source C, adopt a different original presentation, or grant readiness to copied native identities', () => {
  const f = s.fixture(); try {
    f.shown(); assert.equal(f.event('closeAccepted', { transaction: 'native-forged', acceptedClose: 'wire-only-C' }), false); assert.equal(f.owner.getSnapshot().acceptedClose, null); assert.equal(f.owner.canInteract(), true);
    assert.equal(f.owner.receive(f.identity, f.wire('didDismiss', { transaction: 'physical', presentationTicket: 'different-original' })), false); assert.deepEqual(f.leases, []);
  } finally { f.cleanup(); }
});
test('original account or Source retirement cannot revive, native membership/parent temporary loss merely holds same-original reads', async () => {
  for (const fact of ['account', 'source']) {
    const f = s.fixture(); try { f.shown(); f.facts[fact] = false; assert.equal(f.owner.readCurrent(), false); assert.equal(await f.owner.closed, 'retired'); f.facts[fact] = true; assert.equal(f.owner.requestClose(), false); assert.equal(f.owner.canInteract(), false); } finally { f.cleanup(); }
  }
  const f = s.fixture(); try { f.shown(); for (const fact of ['native', 'parent']) { f.facts[fact] = false; assert.equal(f.owner.readCurrent(), false); f.facts[fact] = true; assert.equal(f.owner.canInteract(), true); } } finally { f.cleanup(); }
});
test('Strict replay preserves original shown proof, final member loss retires without inventing physical cleanup or Source C', async () => {
  const f = s.fixture(); f.shown(); f.stop(); assert.equal(f.owner.canInteract(), false); const replay = f.owner.attach(); await s.flush(); assert.equal(f.owner.canInteract(), true);
  replay(); await s.flush(); assert.equal(await f.owner.closed, 'retired'); assert.equal(f.owner.getSnapshot().physicalDismissed, false); assert.equal(f.owner.getSnapshot().acceptedClose, null);
});
test('strict async/reentrant guards and Source callback account/unmount changes cannot accept retained cancellations', async () => {
  for (const fact of ['account', 'source', 'native', 'parent', 'noChildren']) {
    const f = s.fixture(); try { f.shown(); f.owner.requestClose(); f.facts[fact] = () => Promise.reject(Error('not a native fact')); assert.equal(f.owner.acceptedCloseIntent(), null); await s.flush(); } finally { f.cleanup(); }
  }
  const f = s.fixture(); try { f.shown(); let once = true, nested; f.facts.native = () => { if (once) { once = false; nested = f.owner.canInteract(); } return true; }; assert.equal(f.owner.canInteract(), false); assert.equal(nested, false); } finally { f.cleanup(); }
  for (const mode of ['account', 'unmount']) {
    const f = s.fixture(); try { f.onCancel(lease => { if (mode === 'account') f.facts.account = false; else f.stop(); assert.equal(f.owner.requestClose(lease), false); }); f.shown(); f.event('didDismiss', { transaction: 'real-gone' }); await s.flush(); assert.equal(f.owner.getSnapshot().acceptedClose, null); assert.equal(await f.owner.closed, 'retired'); } finally { f.cleanup(); }
  }
});
test('final native membership and queued descendants are rechecked after original Source callbacks', () => {
  for (const fact of ['native', 'parent']) {
    const f = s.fixture(); try { f.shown(); f.facts.source = () => { f.facts[fact] = false; return true; }; assert.equal(f.owner.canInteract(), false); assert.equal(f.owner.requestClose(), false); } finally { f.cleanup(); }
  }
  const f = s.fixture(); try {
    f.shown(); f.owner.requestClose(); let reads = 0; f.facts.source = () => { if (++reads >= 3) f.facts.noChildren = false; return true; };
    assert.equal(f.owner.acceptedCloseIntent(), null);
  } finally { f.cleanup(); }
});
test('close publication cannot resolve success after original account/Source retirement; accepted body unmount cannot invent a new owner or revoke consumed proof', async () => {
  for (const mode of ['account', 'source', 'unmount', 'explicit-retire']) {
    const f = s.fixture(); try {
      f.shown(); f.owner.requestClose(); const intent = f.owner.acceptedCloseIntent(); f.event('closeAccepted', { transaction: 'native-final', acceptedClose: intent.closeTicket }); f.event('didDismiss', { transaction: 'native-final', acceptedClose: intent.closeTicket });
      const observed = []; f.owner.subscribe(() => { const state = f.owner.getSnapshot(); observed.push(state.outcome); if (state.settling) { assert.equal(state.outcome, null); if (mode === 'unmount') { f.stop(); f.facts.native = false; } else if (mode === 'explicit-retire') f.owner.retire(); else f.facts[mode] = false; } });
      assert.equal(f.event('closeJoined', { transaction: 'native-final', acceptedClose: intent.closeTicket }), true);
      assert.equal(await f.owner.closed, mode === 'unmount' ? 'closed' : 'retired'); assert.equal(f.owner.getSnapshot().outcome, mode === 'unmount' ? 'closed' : 'retired');
      assert.equal(observed.includes('closed'), mode === 'unmount');
    } finally { f.cleanup(); }
  }
});
test('already reserved child may finish through accepted ancestor C while no new child can open or bypass pending native dismissal', () => {
  const f = s.fixture(); try {
    const child = Object.freeze({ id: 'actual-original-child' }); f.reserved.add(child); f.shown(); f.facts.noChildren = false;
    assert.equal(f.owner.canPresentReservedDescendant(child), true); assert.equal(f.owner.requestClose(), true); assert.equal(f.owner.acceptedCloseIntent(), null); assert.equal(f.owner.canOpenNewDescendant(), false);
    assert.equal(f.owner.canPresentReservedDescendant(child), true); assert.equal(f.owner.canPresentReservedDescendant({ ...child }), false);
    f.reserved.delete(child); f.facts.noChildren = true; assert.equal(f.owner.canPresentReservedDescendant(child), false); assert.ok(f.owner.acceptedCloseIntent());
  } finally { f.cleanup(); }
  const f2 = s.fixture(); try { const child = {}; f2.reserved.add(child); f2.shown(); f2.event('willDismiss', { transaction: 'real-pending' }); assert.equal(f2.owner.canPresentReservedDescendant(child), false); f2.event('cancelled', { transaction: 'real-pending' }); assert.equal(f2.owner.canPresentReservedDescendant(child), true); } finally { f2.cleanup(); }
});
test('final closed publication is already linearized; later observer account retirement cannot retroactively change the original result', async () => {
  const f = s.fixture(); try {
    f.shown(); f.owner.requestClose(); const intent = f.owner.acceptedCloseIntent(); f.event('closeAccepted', { transaction: 'native-linear', acceptedClose: intent.closeTicket }); f.event('didDismiss', { transaction: 'native-linear', acceptedClose: intent.closeTicket });
    f.owner.subscribe(() => { if (f.owner.getSnapshot().outcome === 'closed') { f.facts.account = false; f.owner.retire(); } });
    f.event('closeJoined', { transaction: 'native-linear', acceptedClose: intent.closeTicket }); assert.equal(await f.owner.closed, 'closed'); assert.equal(f.owner.getSnapshot().outcome, 'closed'); assert.equal(f.owner.readCurrent(), false);
  } finally { f.cleanup(); }
});
test('reserved original child retains only actual resource through parent Source retirement; copied/reentrant/retired child or account cannot revive', () => {
  const f = s.fixture(); try {
    const child = {}; f.reserved.add(child); f.shown(); f.facts.source = false; assert.equal(f.owner.readCurrent(), false);
    assert.equal(f.owner.canPresentReservedDescendant(child), true); assert.equal(f.owner.canOpenNewDescendant(), false); f.reserved.delete(child); assert.equal(f.owner.canPresentReservedDescendant(child), false);
    f.reserved.add(child); f.facts.account = false; assert.equal(f.owner.canPresentReservedDescendant(child), false);
  } finally { f.cleanup(); }
  const child = {}, actual = new Set([child]); let f2, once = true, nested;
  f2 = s.fixture({ isReservedDescendantCurrent: candidate => { if (once) { once = false; nested = f2.owner.canPresentReservedDescendant(candidate); } return actual.has(candidate); } });
  try { f2.shown(); assert.equal(f2.owner.canPresentReservedDescendant(child), false); assert.equal(nested, false); assert.equal(f2.owner.canPresentReservedDescendant(child), true); f2.options.isReservedDescendantCurrent = () => true; assert.equal(f2.owner.canPresentReservedDescendant({ ...child }), false); }
  finally { f2.cleanup(); }
});
test('final descendant callback cannot retire account just before success; final original authority follows all resource callbacks', async () => {
  const f = s.fixture(); try {
    f.shown(); f.owner.requestClose(); const intent = f.owner.acceptedCloseIntent(); f.event('closeAccepted', { transaction: 'native-final-resource', acceptedClose: intent.closeTicket }); f.event('didDismiss', { transaction: 'native-final-resource', acceptedClose: intent.closeTicket });
    f.facts.noChildren = () => { if (f.owner.getSnapshot().settling) f.facts.account = false; return true; };
    f.event('closeJoined', { transaction: 'native-final-resource', acceptedClose: intent.closeTicket }); assert.equal(await f.owner.closed, 'retired'); assert.equal(f.owner.getSnapshot().outcome, 'retired');
  } finally { f.cleanup(); }
});
test('actual native failure or native retirement fences retained resources even after independent Source result already retired', async () => {
  for (const kind of ['failed', 'retired']) {
    const f = s.fixture(); try {
      const child = {}; f.reserved.add(child); f.shown(); f.facts.source = false; f.owner.readCurrent(); assert.equal(await f.owner.closed, 'retired'); assert.equal(f.owner.canPresentReservedDescendant(child), true);
      assert.equal(f.event(kind, kind === 'failed' ? { reason: 'actual-native-failure' } : {}), true); assert.equal(f.owner.canPresentReservedDescendant(child), false);
      assert.equal(f.owner.getSnapshot()[kind === 'failed' ? 'failed' : 'nativeRetired'], true); assert.equal(f.owner.getSnapshot().physicalDismissed, false); assert.equal(f.owner.getSnapshot().acceptedClose, null);
      f.facts.source = true; assert.equal(f.owner.requestClose(), false); assert.equal(await f.owner.closed, 'retired');
    } finally { f.cleanup(); }
  }
});
test('passive Source epoch rejects final account callback retiring Source or queued children during settlement', async () => {
  for (const fact of ['source', 'noChildren']) {
    const f = s.fixture(); try {
      f.shown(); f.owner.requestClose(); const intent = f.owner.acceptedCloseIntent(); f.event('closeAccepted', { transaction: 'native-passive', acceptedClose: intent.closeTicket }); f.event('didDismiss', { transaction: 'native-passive', acceptedClose: intent.closeTicket });
      let reads = 0; f.facts.account = () => { if (f.owner.getSnapshot().settling && ++reads === 2) f.facts[fact] = false; return true; };
      const outcomes = []; f.owner.subscribe(() => outcomes.push(f.owner.getSnapshot().outcome)); f.event('closeJoined', { transaction: 'native-passive', acceptedClose: intent.closeTicket });
      assert.equal(reads, 2); assert.equal(await f.owner.closed, 'retired'); assert.equal(outcomes.includes('closed'), false);
    } finally { f.cleanup(); }
  }
});
test('passive all-authority epoch rejects final-parent/final-descendant/final-reservation cross-fact mutations', () => {
  const f = s.fixture(); try { f.shown(); let reads = 0; f.facts.parent = () => { if (++reads === 2) f.facts.account = false; return true; }; assert.equal(f.owner.canInteract(), false); assert.equal(reads, 2); } finally { f.cleanup(); }
  const g = s.fixture(); try { g.shown(); g.owner.requestClose(); let reads = 0; g.facts.noChildren = () => { if (++reads === 2) g.facts.account = false; return true; }; assert.equal(g.owner.acceptedCloseIntent(), null); assert.equal(reads, 2); } finally { g.cleanup(); }
  let h, reads = 0; const child = {}; h = s.fixture({ isReservedDescendantCurrent: candidate => { if (++reads === 2) h.facts.account = false; return candidate === child; } });
  try { h.shown(); assert.equal(h.owner.canPresentReservedDescendant(child), false); assert.equal(reads, 2); } finally { h.cleanup(); }
});
test('receive reserves its frame before raw getters and original authority callbacks; nested shown cannot establish readiness', () => {
  const f = s.fixture(); try {
    let nested; const raw = f.wire('layout', { width: 390, height: 400 }); Object.defineProperty(raw, 'kind', { get() { nested = f.event('shown'); return 'layout'; } });
    assert.equal(f.owner.receive(f.identity, raw), false); assert.equal(nested, false); assert.equal(f.owner.getSnapshot().shown, false); assert.equal(f.owner.canInteract(), false);
  } finally { f.cleanup(); }
  const g = s.fixture(); try {
    let once = true, nested, parsed = 0; g.facts.account = () => { if (once) { once = false; nested = g.event('shown'); } return true; };
    const raw = g.wire('layout', { width: 390, height: 400 }); Object.defineProperty(raw, 'kind', { get() { parsed++; return 'layout'; } });
    assert.equal(g.owner.receive(g.identity, raw), false); assert.equal(nested, false); assert.equal(parsed, 0); assert.equal(g.owner.getSnapshot().shown, false);
  } finally { g.cleanup(); }
});
test('raw-parser scope mutations invalidate the original receive stamp before any event publication', () => {
  const f = s.fixture(); try {
    const raw = f.wire('shown'); Object.defineProperty(raw, 'kind', { get() { f.facts.native = false; return 'shown'; } }); const before = f.owner.getSnapshot();
    assert.equal(f.owner.receive(f.identity, raw), false); assert.equal(f.owner.getSnapshot(), before); assert.equal(f.owner.canInteract(), false);
  } finally { f.cleanup(); }
});
test('raw parser and authority callbacks cannot manufacture Source C or new-child permission while a native event is unvalidated', () => {
  const f = s.fixture(); try {
    f.shown(); let accepted, interactive, child; const raw = f.wire('layout', { width: 390, height: 400 });
    Object.defineProperty(raw, 'kind', { get() { interactive = f.owner.canInteract(); child = f.owner.canOpenNewDescendant(); accepted = f.owner.requestClose(); return 'layout'; } });
    assert.equal(f.owner.receive(f.identity, raw), false); assert.equal(accepted, false); assert.equal(interactive, false); assert.equal(child, false); assert.equal(f.owner.getSnapshot().acceptedClose, null);
  } finally { f.cleanup(); }
});
test('ONLY validated actual-did cancellation dispatch permits explicit same-lease Source acceptance; callback truth and wrong/copy leases cannot accept', async () => {
  const f = s.fixture(); try {
    let accepted; f.onCancel(lease => { assert.equal(f.owner.isCancellationCurrent(lease), true); accepted = f.owner.requestClose(lease); return true; });
    f.shown(); assert.equal(f.event('didDismiss', { transaction: 'actual-dispatch-G' }), true); assert.equal(accepted, true); const intent = f.owner.acceptedCloseIntent(); assert.equal(intent.transaction, 'actual-dispatch-G');
    f.event('closeAccepted', { transaction: 'actual-dispatch-G', acceptedClose: intent.closeTicket }); f.event('closeJoined', { transaction: 'actual-dispatch-G', acceptedClose: intent.closeTicket }); assert.equal(await f.owner.closed, 'closed');
  } finally { f.cleanup(); }
  for (const kind of ['none', 'copy']) {
    const g = s.fixture(); try { let accepted; g.onCancel(lease => { accepted = g.owner.requestClose(kind === 'none' ? undefined : { ...lease }); return true; }); g.shown(); assert.equal(g.event('didDismiss', { transaction: 'actual-but-rejected-G' }), false); assert.equal(accepted, false); assert.equal(g.owner.getSnapshot().acceptedClose, null); } finally { g.cleanup(); }
  }
});
