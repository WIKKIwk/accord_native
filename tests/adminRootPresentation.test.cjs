const assert = require('node:assert/strict'), test = require('node:test');
const { core, fixture, content, presentation, flush } = require('./adminRootPresentationSupport.cjs');

test('Root membership and React registration never declare native readiness', () => {
  const f = fixture(); assert.equal(f.chain.getSnapshot().rootReady, false); assert.equal(f.open(), null);
  f.chain.nativeShown(f.chain.root, f.rootNative); assert.equal(f.chain.getSnapshot().rootReady, false); assert.equal(f.open(), null);
  f.chain.nativeArmed(f.chain.root, f.rootNative); assert.equal(f.chain.getSnapshot().rootReady, true); assert.ok(f.open()); f.chain.retire();
});
test('Android ACK before onShow also holds Root; iOS requires genuine onShow without an Android substitute', () => {
  const f = fixture(); f.chain.nativeArmed(f.chain.root, f.rootNative); assert.equal(f.open(), null); f.chain.nativeShown(f.chain.root, f.rootNative); assert.ok(f.open()); f.chain.retire();
  const ios = fixture('ios'); assert.equal(ios.chain.nativeArmed(ios.chain.root, ios.rootNative), false); assert.equal(ios.open(), null); ios.rootReady(); assert.ok(ios.open()); ios.chain.retire();
});
test('accepted requests keep exact ordered opaque ancestry while waiting for real parent presentation', () => {
  const f = fixture(); f.rootReady(); const first = f.open(), second = f.open({ kind: 'dialog' }), third = f.open({ kind: 'dialog' });
  assert.equal(f.chain.top(), third.entry); assert.deepEqual(f.chain.getSnapshot().entries, [first.entry, second.entry, third.entry]);
  assert.equal(f.chain.child(f.chain.root), first.entry); assert.equal(f.chain.child(first.entry), second.entry); assert.equal(f.chain.child(second.entry), third.entry);
  assert.equal(f.chain.canPresent(first.entry), true); assert.equal(f.chain.canPresent(second.entry), false);
  const native = f.native(first.entry); native.shown(); assert.equal(f.chain.canPresent(second.entry), false); native.armed(); assert.equal(f.chain.canPresent(second.entry), true); f.chain.retire();
});
test('old root, reflected, proxied, foreign parent and reused source identities cannot be retargeted', () => {
  const f = fixture(); f.rootReady(); const identity = {}, first = f.open({ identity });
  for (const parent of [f.chain.root, { ...first.entry }, new Proxy(first.entry, {}), null, {}]) assert.equal(f.open({ parent }), null);
  assert.equal(f.open({ identity }), null); assert.equal(f.chain.nativeShown(first.entry, {}), false); assert.equal(f.chain.nativeShown(new Proxy(first.entry, {}), {}), false);
  assert.equal(f.chain.attachNative(first.entry, null), null); f.chain.retire();
});
test('original callbacks/options are captured and malformed runtime content/presentation is rejected', () => {
  const f = fixture(); f.rootReady(); let calls = 0; const request = f.request({ onRequestClose: () => { calls++; } }), opened = f.chain.open(request), native = f.native(opened.entry); native.ready();
  request.onRequestClose = () => { calls += 100; }; request.renderContent = () => { throw Error('replacement'); }; request.presentation = { ...presentation, animationType: 'slide' };
  assert.equal(f.chain.content(opened.entry), content); assert.equal(f.chain.presentation(opened.entry).animationType, 'none'); f.chain.nativeRequestClose(opened.entry, native.identity); assert.equal(calls, 1);
  f.chain.retire(); const next = fixture(); next.rootReady();
  for (const changes of [{ renderContent: null }, { kind: 'sheet' }, { presentation: { ...presentation, animationType: 'invalid' } }, { identity: null }, { onRequestClose: null }, { isCurrent: null }]) assert.equal(next.open(changes), null);
  assert.equal(next.chain.open(new Proxy({}, { get() { throw Error('proxy'); } })), null); next.chain.retire();
});
test('native requests require the exact top shown+armed lease and call original close authority only', () => {
  const f = fixture(); f.rootReady(); let one = 0, two = 0; const a = f.open({ onRequestClose: () => one++ }), an = f.native(a.entry);
  f.chain.nativeRequestClose(a.entry, an.identity); an.shown(); f.chain.nativeRequestClose(a.entry, an.identity); assert.equal(one, 0); an.armed();
  const b = f.open({ onRequestClose: () => two++ }), bn = f.native(b.entry); bn.ready(); f.chain.nativeRequestClose(a.entry, an.identity); f.chain.nativeRequestClose(b.entry, {}); f.chain.nativeRequestClose(b.entry, bn.identity);
  assert.equal(one, 0); assert.equal(two, 1); f.chain.retire();
});
test('accepted reads retain originating owner while logical/native top belongs to a different page', async () => {
  let origin = true, profile = true; const f = fixture(); f.rootReady(); const page = f.open({ isCurrent: () => profile }), native = f.native(page.entry); native.ready();
  const code = f.open({ kind: 'dialog', isCurrent: () => origin }); assert.ok(code); assert.equal(f.chain.isCurrent(code.entry), true);
  origin = false; assert.equal(f.chain.isCurrent(code.entry), false); assert.equal(await code.closed, 'retired'); assert.equal(f.chain.canInteract(page.entry), true); assert.equal(profile, true); f.chain.retire(); assert.equal(await page.closed, 'retired');
});
test('closing retains an inert original parent carrier until descendants genuinely close and rejects new children', async () => {
  const f = fixture(); f.rootReady(); const a = f.open(), an = f.native(a.entry); an.ready(); const b = f.open({ kind: 'dialog' }), bn = f.native(b.entry); bn.ready();
  let parentResult; a.closed.then(value => { parentResult = value; }); assert.equal(f.chain.requestClose(a.entry), true); assert.equal(f.chain.retained(a.entry), true);
  assert.equal(f.chain.shouldRemove(a.entry), false); assert.equal(f.chain.canInteract(a.entry), false); assert.equal(f.open(), null); assert.equal(an.removed(), false); await flush(); assert.equal(parentResult, undefined);
  f.chain.requestClose(b.entry); assert.equal(bn.removed(), true); assert.equal(await b.closed, 'closed'); assert.equal(f.chain.shouldRemove(a.entry), true); assert.equal(f.chain.getSnapshot().entries[0], a.entry);
  assert.equal(an.removed(), true); assert.equal(await a.closed, 'closed'); assert.equal(f.chain.top(), f.chain.root); f.chain.retire();
});
test('accepted close waits for real show and ACK and never treats arm failure or removal request as completion', async () => {
  const f = fixture(); f.rootReady(); const a = f.open(), native = f.native(a.entry); let result; a.closed.then(value => { result = value; }); f.chain.requestClose(a.entry);
  assert.equal(f.chain.shouldRemove(a.entry), false); native.armed(); assert.equal(f.chain.shouldRemove(a.entry), false); native.shown(); assert.equal(f.chain.shouldRemove(a.entry), true);
  f.chain.nativeFailed(a.entry, native.identity); assert.equal(native.removed(), false); await flush(); assert.equal(result, undefined); f.chain.retire(); assert.equal(await a.closed, 'retired');
});
test('unexpected onDismiss/root failure cannot close an entry or authorize its descendant', async () => {
  const f = fixture('ios'); f.rootReady(); const a = f.open(), an = f.native(a.entry); an.ready(); const b = f.open(), bn = f.native(b.entry); bn.ready();
  assert.equal(bn.removed(), false); f.chain.nativeFailed(a.entry, an.identity); assert.equal(f.chain.canInteract(b.entry), false); f.chain.nativeRequestClose(b.entry, bn.identity);
  f.chain.nativeFailed(f.chain.root, f.rootNative); assert.equal(f.chain.getSnapshot().rootReady, false); assert.equal(f.open(), null); f.chain.retire(); assert.equal(await b.closed, 'retired');
});
test('StrictMode cleanup/reconnect preserves already shown original Root and child native leases', async () => {
  const f = fixture(); f.rootReady(); const a = f.open(), an = f.native(a.entry); an.ready(); f.rootStop(); an.stop();
  const rootAgain = f.chain.attachNative(f.chain.root, f.rootNative, f.rootIdentity), childAgain = f.chain.attachNative(a.entry, an.identity); await flush();
  assert.equal(f.chain.getSnapshot().retired, false); assert.equal(f.chain.canInteract(a.entry), true); f.chain.requestClose(a.entry); assert.equal(an.removed(), true); assert.equal(await a.closed, 'closed'); rootAgain(); childAgain(); await flush();
});
test('actual Root or carrier unmount retires pending results and delayed old cleanup cannot target a new chain', async () => {
  const f = fixture(); f.rootReady(); const a = f.open(), native = f.native(a.entry); native.ready(); const other = fixture(); other.rootReady(); const b = other.open(), bn = other.native(b.entry); bn.ready();
  native.stop(); await flush(); assert.equal(await a.closed, 'retired'); assert.equal(other.chain.canInteract(b.entry), true); f.rootStop(); await flush();
  assert.equal(f.chain.nativeShown(a.entry, native.identity), true); assert.equal(f.chain.canInteract(a.entry), false);
  assert.equal(f.chain.nativeResourceRemoved(a.entry, native.identity), true); assert.equal(await a.closed, 'retired'); assert.equal(other.chain.canInteract(b.entry), true); other.chain.retire();
});
test('duplicate native presenter identities cannot bind another window to an original ticket', () => {
  const f = fixture(); f.rootReady(); const a = f.open(), an = f.native(a.entry); an.ready(); assert.equal(f.chain.attachNative(a.entry, {}), null);
  assert.equal(f.chain.attachNative(f.chain.root, {}, f.rootIdentity), null); assert.equal(f.chain.attachNative(f.chain.root, f.rootNative, {}), null); f.chain.retire();
});
test('old shown/dismiss/arm events never revive or close a replacement original ticket', async () => {
  const f = fixture(); f.rootReady(); const a = f.open(), an = f.native(a.entry); an.ready(); f.chain.requestClose(a.entry); an.removed(); assert.equal(await a.closed, 'closed');
  const b = f.open(), bn = f.native(b.entry); bn.ready(); assert.equal(an.shown(), false); assert.equal(an.armed(), false); assert.equal(an.removed(), false); an.stop(); await flush(); assert.equal(f.chain.canInteract(b.entry), true); f.chain.retire();
});
test('account retirement/reentrant current and rejected async current cannot revive accepted results', async () => {
  const f = fixture(); f.rootReady(); const a = f.open(); f.current(false); assert.equal(f.chain.top(), null); assert.equal(await a.closed, 'retired'); f.current(true); assert.equal(f.open(), null);
  let chain; chain = new core.AdminRootPresentationChain({ platform: 'ios', rootIdentity: {}, isCurrent: () => { chain.retire(); return true; } }); assert.equal(chain.top(), null);
  const asyncCurrent = fixture('ios', { isCurrent: () => Promise.reject(Error('invalid async guard')) }); assert.equal(asyncCurrent.chain.current(), false); await flush();
});
test('native removal rechecks original authority after synchronous publication before resolving success', async () => {
  const f = fixture('ios'); f.rootReady(); let original = true; const a = f.open({ isCurrent: () => original }), an = f.native(a.entry); an.ready(); f.chain.requestClose(a.entry);
  const stop = f.chain.subscribe(() => { if (!f.chain.getSnapshot().entries.length) original = false; }); an.removed(); assert.equal(await a.closed, 'retired'); stop(); f.chain.retire();
});
test('subscriber throws or reentrant open cannot interrupt publication or issue a duplicate decision', async () => {
  const f = fixture('ios'); f.rootReady(); let nested; f.chain.subscribe(() => { throw Error('observer'); }); f.chain.subscribe(() => { nested = f.open(); }); const a = f.open(); assert.equal(nested, null); assert.equal(f.chain.top(), a.entry); f.chain.retire(); assert.equal(await a.closed, 'retired');
});
test('Root constructor has no readiness fallback and rejects missing original native identity/authority', () => {
  for (const changes of [{ rootIdentity: null }, { platform: 'web' }, { isCurrent: undefined }]) assert.throws(() => new core.AdminRootPresentationChain({ platform: 'android', rootIdentity: {}, isCurrent: () => true, ...changes }), TypeError);
});
test('source-owner retirement cancels its original native child without retiring an unrelated current Profile parent', async () => {
  const f = fixture('ios'); f.rootReady(); const profile = f.open(), pn = f.native(profile.entry); pn.ready(); let origin = true;
  const code = f.open({ kind: 'dialog', isCurrent: () => origin }), cn = f.native(code.entry); cn.ready(); origin = false;
  assert.equal(f.chain.isCurrent(code.entry), false); assert.equal(await code.closed, 'retired'); assert.equal(f.chain.getSnapshot().retired, false);
  assert.equal(f.chain.isCurrent(profile.entry), true); assert.equal(f.chain.shouldRemove(code.entry), true); assert.equal(cn.removed(), true); assert.equal(f.chain.canInteract(profile.entry), true); f.chain.retire();
});
test('retired original parent remains an inert native shell until existing descendants close; new children remain held', async () => {
  const f = fixture('ios'); f.rootReady(); let origin = true; const parent = f.open({ isCurrent: () => origin }), pn = f.native(parent.entry); pn.ready(); const child = f.open(), cn = f.native(child.entry); cn.ready();
  origin = false; assert.equal(f.chain.isCurrent(parent.entry), false); assert.equal(await parent.closed, 'retired'); assert.equal(f.chain.nativeCurrent(parent.entry), true); assert.equal(f.chain.retained(parent.entry), true);
  assert.equal(f.chain.canInteract(child.entry), true); assert.equal(f.open(), null); assert.equal(pn.removed(), false); f.chain.requestClose(child.entry); cn.removed(); assert.equal(await child.closed, 'closed'); assert.equal(pn.removed(), true); f.chain.retire();
});
test('source retirement before any actual native mount cancels its unpresented suffix without a close-success acknowledgment', async () => {
  const f = fixture('ios'); f.rootReady(); let origin = true; const a = f.open({ isCurrent: () => origin }), b = f.open(); origin = false;
  assert.equal(f.chain.isCurrent(a.entry), false); assert.equal(await a.closed, 'retired'); assert.equal(await b.closed, 'retired'); assert.equal(f.chain.top(), f.chain.root); assert.equal(f.chain.getSnapshot().retired, false); f.chain.retire();
});
test('reentrant owner check cannot create a child after its original parent has entered closing or failed', () => {
  const f = fixture('ios'); f.rootReady(); const a = f.open(), an = f.native(a.entry); an.ready();
  assert.equal(f.open({ isCurrent: () => { f.chain.requestClose(a.entry); return true; } }), null); assert.equal(f.chain.getSnapshot().entries.length, 1); f.chain.retire();
});
test('new request guard silently retiring parent authority cannot admit a child after initial parent check', async () => {
  const f = fixture('ios'); f.rootReady(); let original = true; const parent = f.open({ isCurrent: () => original }), native = f.native(parent.entry); native.ready();
  const child = f.open({ isCurrent: () => { original = false; return true; } }); assert.equal(child, null); assert.deepEqual(f.chain.getSnapshot().entries, [parent.entry]); assert.equal(await parent.closed, 'retired');
  assert.equal(f.chain.shouldRemove(parent.entry), true); native.removed(); assert.equal(f.chain.top(), f.chain.root); f.chain.retire();
});
test('actual originating-owner cancellation is exact, idempotent, independent of page blur, and cannot cancel a replacement entry', async () => {
  const f = fixture('ios'); f.rootReady(); const a = f.open(), an = f.native(a.entry); an.ready(); assert.equal(f.chain.cancel(new Proxy(a.entry, {})), false);
  assert.equal(f.chain.cancel(a.entry), true); assert.equal(await a.closed, 'retired'); assert.equal(f.chain.cancel(a.entry), false); assert.equal(an.removed(), true);
  const b = f.open(), bn = f.native(b.entry); bn.ready(); assert.equal(f.chain.cancel(a.entry), false); assert.equal(f.chain.canInteract(b.entry), true); f.chain.retire();
});
test('real authority notification rechecks original entry guard while preserving still-current Root', async () => {
  let notify; const f = fixture('ios', { subscribeCurrent: listener => { notify = listener; return () => {}; } }); f.rootReady(); let entryCurrent = true; const a = f.open({ isCurrent: () => entryCurrent }), native = f.native(a.entry); native.ready();
  entryCurrent = false; notify(); assert.equal(await a.closed, 'retired'); assert.equal(f.chain.getSnapshot().retired, false); assert.equal(f.chain.shouldRemove(a.entry), true); native.removed(); f.chain.retire();
});

test('whole-account retirement preserves pending original resources and drains postorder without accepting Source close', async () => {
  const f = fixture('ios'); f.rootReady(); const a = f.open(), an = f.native(a.entry), b = f.open(), bn = f.native(b.entry);
  // B cannot attach before A's real show. Keep a real pending A, and cancel B's never-carrier admission.
  assert.equal(f.chain.getSnapshot().resources.length, 2); assert.equal(f.chain.hasNativeResource(b.entry, bn.identity), false);
  f.current(false); f.chain.current(); assert.equal(await a.closed, 'retired'); assert.equal(await b.closed, 'retired');
  assert.deepEqual(f.chain.getSnapshot().entries, []); assert.deepEqual(f.chain.getSnapshot().resources, [a.entry]);
  assert.equal(f.chain.attachNative(b.entry, bn.identity), null); assert.equal(f.chain.canPresent(a.entry), true); assert.equal(f.chain.shouldRemove(a.entry), false);
  an.shown(); assert.equal(f.chain.shouldRemove(a.entry), true); assert.equal(f.chain.canInteract(a.entry), false); assert.equal(f.chain.requestClose(a.entry), false);
  assert.equal(f.chain.shouldRemove(f.chain.root), false); assert.equal(f.chain.nativeResourceRemoved(a.entry, {}), false);
  assert.equal(f.chain.nativeResourceRemoved(a.entry, an.identity), true); assert.equal(await a.closed, 'retired');
  assert.equal(f.chain.shouldRemove(f.chain.root), true); assert.equal(f.chain.nativeResourceRemoved(f.chain.root, f.rootNative), true);
  assert.equal(f.chain.getSnapshot().rootResource, 'removed'); assert.equal(f.chain.nativeCurrent(f.chain.root), false);
});
test('never-carrier Root cancellation is distinct from physical removal and denies delayed admission', () => {
  const identity = {}, chain = new core.AdminRootPresentationChain({ platform: 'ios', rootIdentity: identity, isCurrent: () => true });
  for (const invalid of [undefined, null, {}, []]) { assert.equal(chain.hasNativeLease(chain.root, invalid), false); assert.equal(chain.hasNativeResource(chain.root, invalid), false); assert.equal(chain.hasNativeRemovalProof(chain.root, invalid), false); }
  chain.retire();
  assert.equal(chain.getSnapshot().rootResource, 'cancelledBeforeCarrier'); assert.equal(chain.attachNative(chain.root, {}, identity), null); assert.equal(chain.nativeResourceRemoved(chain.root, {}), false);
});
test('actual resource proof after member loss releases only its original window and never revives Source or copied handles', async () => {
  const f = fixture('ios'); f.rootReady(); const a = f.open(), an = f.native(a.entry); an.ready(); an.stop(); await flush();
  assert.equal(await a.closed, 'retired'); assert.equal(f.chain.hasNativeLease(a.entry, an.identity), false); assert.equal(f.chain.hasNativeResource(a.entry, an.identity), true);
  assert.equal(f.chain.nativeResourceRemoved({ ...a.entry }, an.identity), false); assert.equal(f.chain.nativeResourceRemoved(a.entry, an.identity), true);
  assert.equal(f.chain.nativeResourceRemoved(a.entry, an.identity), false); assert.equal(f.chain.attachNative(a.entry, an.identity), null); assert.equal(await a.closed, 'retired');
});
test('Source and resource epochs publish synchronous actual changes without invoking account guards', () => {
  let reads = 0; const f = fixture('ios', { isCurrent: () => { reads++; return true; } }); const source = f.chain.sourceStamp(), resource = f.chain.resourceStamp();
  let sourceCalls = 0, resourceCalls = 0; f.chain.subscribeSource(() => sourceCalls++); f.chain.subscribeResource(() => resourceCalls++);
  f.chain.nativeShown(f.chain.root, f.rootNative); assert.equal(f.chain.sourceStamp(), source); assert.notEqual(f.chain.resourceStamp(), resource); assert.equal(sourceCalls, 0); assert.equal(resourceCalls, 1);
  const before = reads; f.chain.nativeCurrent(f.chain.root); f.chain.hasNativeResource(f.chain.root, f.rootNative); f.rootStop(); assert.equal(reads, before); assert.equal(resourceCalls, 2);
  f.chain.retire(); assert.equal(sourceCalls, 1); assert.equal(f.chain.hasNativeResource(f.chain.root, f.rootNative), true);
});
test('reentrant physical-removal observer cannot consume a child twice or pop its retained parent', async () => {
  const f = fixture('ios'); f.rootReady(); const a = f.open(), an = f.native(a.entry); an.ready(); const b = f.open(), bn = f.native(b.entry); bn.ready(); let nested;
  f.chain.subscribe(() => { if (f.chain.isRetired(b.entry) && nested === undefined) nested = f.chain.nativeResourceRemoved(b.entry, bn.identity); });
  assert.equal(f.chain.nativeResourceRemoved(b.entry, bn.identity), true); assert.equal(nested, false); assert.deepEqual(f.chain.getSnapshot().resources, [a.entry]);
  assert.equal(f.chain.child(f.chain.root), a.entry); assert.equal(f.chain.hasNativeResource(a.entry, an.identity), true); assert.equal(await b.closed, 'retired'); f.chain.retire();
});
test('actual resource removal after native failure releases the original resource but cannot promote accepted Source close to success', async () => {
  const f = fixture('ios'); f.rootReady(); const a = f.open(), an = f.native(a.entry); an.ready(); f.chain.requestClose(a.entry); f.chain.nativeFailed(a.entry, an.identity);
  assert.equal(f.chain.nativeRemoved(a.entry, an.identity), false); assert.equal(f.chain.nativeResourceRemoved(a.entry, an.identity), true);
  assert.equal(await a.closed, 'retired'); assert.equal(f.chain.getSnapshot().resources.length, 0); f.chain.retire();
});
for (const gone of ['root', 'parent']) test(`actual early ${gone} proof is retained and consumed only after genuine descendant proofs`, async () => {
  const f = fixture('ios'); f.rootReady(); const a = f.open(), an = f.native(a.entry); an.ready(); const b = f.open(), bn = f.native(b.entry); bn.ready();
  const parent = gone === 'root' ? f.chain.root : a.entry, identity = gone === 'root' ? f.rootNative : an.identity;
  assert.equal(f.chain.nativeResourceRemoved(parent, {}), false); assert.equal(f.chain.nativeResourceRemoved(parent, identity), true);
  assert.deepEqual(f.chain.getSnapshot().resources, [a.entry, b.entry]); assert.equal(f.chain.hasNativeRemovalProof(parent, identity), true);
  assert.equal(f.chain.nativeResourceRemoved(parent, identity), false); assert.equal(f.chain.nativeShown(parent, identity), false); assert.equal(f.chain.nativeArmed(parent, identity), false);
  assert.equal(await a.closed, 'retired'); assert.equal(await b.closed, 'retired'); assert.equal(f.chain.requestClose(b.entry), false); assert.equal(f.chain.canInteract(b.entry), false);
  assert.equal(f.chain.nativeResourceRemoved(b.entry, bn.identity), true);
  if (gone === 'root') { assert.deepEqual(f.chain.getSnapshot().resources, [a.entry]); assert.equal(f.chain.getSnapshot().rootResource, 'pending'); assert.equal(f.chain.nativeResourceRemoved(a.entry, an.identity), true); assert.equal(f.chain.getSnapshot().rootResource, 'removed'); }
  else { assert.deepEqual(f.chain.getSnapshot().resources, []); assert.equal(f.chain.hasNativeResource(a.entry, an.identity), false); assert.equal(f.chain.getSnapshot().rootResource, 'pending'); f.chain.retire(); }
});
test('actual gone parent atomically cancels never-carrier queued descendants before joining only its genuine retained proof', async () => {
  const f = fixture('ios'); f.rootReady(); const a = f.open(), an = f.native(a.entry); an.ready(); const b = f.open();
  assert.equal(f.chain.nativeResourceRemoved(a.entry, an.identity), true); assert.deepEqual(f.chain.getSnapshot().resources, []);
  assert.equal(await a.closed, 'retired'); assert.equal(await b.closed, 'retired'); assert.equal(f.chain.attachNative(b.entry, {}), null); assert.equal(f.chain.nativeResourceRemoved(b.entry, {}), false); f.chain.retire();
});
test('final Source outcome publishes only after linearization, including retirement caused by an earlier removal observer', async () => {
  for (const retire of [false, true]) {
    const f = fixture('ios'); f.rootReady(); const a = f.open(), an = f.native(a.entry); an.ready(); f.chain.requestClose(a.entry); const observed = [];
    f.chain.subscribeSource(() => { const outcome = f.chain.sourceOutcome(a.entry); observed.push(outcome); if (retire && outcome === null && !f.chain.getSnapshot().resources.includes(a.entry)) f.current(false); });
    assert.equal(an.removed(), true); const expected = retire ? 'retired' : 'closed'; assert.equal(await a.closed, expected); assert.equal(observed.at(-1), expected);
    assert.equal(f.chain.sourceOutcome(a.entry), expected); if (retire) assert.equal(observed.includes('closed'), false); f.chain.retire();
  }
});
