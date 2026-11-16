const assert = require('node:assert/strict'), test = require('node:test');
const { flush, core } = require('./adminRootPresentationSupport.cjs');
const { nativeFixture, nodes } = require('./adminRootPresentationNativeSupport.cjs');

test('actual Android Root carrier has no constructor/membership/layout/onShow readiness fallback', async () => {
  const f = await nativeFixture('android'); f.render(); assert.equal(f.chain.getSnapshot().rootReady, false); assert.equal(f.open('blocked'), null);
  f.modals()[0].props.onShow(); f.render(); assert.equal(f.chain.getSnapshot().rootReady, false); f.layout(0); assert.equal(f.chain.getSnapshot().rootReady, false);
  await f.ack(0); assert.equal(f.chain.getSnapshot().rootReady, true); assert.ok(f.open('actual')); f.cleanup(); await flush();
});
test('Android child content is really nested in the original parent outlet and awaits onShow plus original arm ACK', async () => {
  const f = await nativeFixture('android'); await f.readyRoot(); const a = f.open('original'), b = f.open('next'); f.render(); assert.equal(f.modals().length, 2);
  const rootBody = nodes(f.tree(), node => node.type === 'RealBody' && node.props.name === 'root')[0]; assert.equal(nodes(rootBody, node => node.type === 'Modal').length, 1);
  const firstTicket = f.layout(1); await f.ack(1); assert.equal(f.chain.canInteract(a.entry), false); assert.equal(f.modals().length, 2); f.modals()[1].props.onShow(); f.render(); assert.equal(f.modals().length, 3);
  const firstBody = nodes(f.tree(), node => node.type === 'RealBody' && node.props.name === 'original')[0]; assert.equal(nodes(firstBody, node => node.type === 'Modal').length, 1);
  f.layout(2); await f.ack(2); f.modals()[2].props.onShow(); f.render(); assert.equal(f.chain.canInteract(b.entry), true); assert.equal(f.chain.canInteract(a.entry), false);
  assert.equal(f.calls.filter(value => Array.isArray(value) && value[0] === 'arm' && value[2] === firstTicket).length, 1); f.cleanup(); await flush();
});
test('Android accepted close hides only after arm/onShow and resolves only actual original root detach', async () => {
  const f = await nativeFixture('android'); await f.readyRoot(); const a = f.open('dialog'); f.render(); const ticket = f.layout(1); f.chain.requestClose(a.entry); f.render(); assert.equal(f.modals()[1].props.visible, true);
  await f.ack(1); assert.equal(f.modals()[1].props.visible, true); f.modals()[1].props.onShow(); f.render(); assert.equal(f.modals()[1].props.visible, false);
  let result; a.closed.then(value => { result = value; }); await flush(); assert.equal(result, undefined); await f.detach(ticket); assert.equal(await a.closed, 'closed'); assert.equal(f.modals().length, 1); f.cleanup(); await flush();
});
test('actual iOS Root/child readiness is onShow and accepted close completion is onDismiss, not React hide', async () => {
  const f = await nativeFixture('ios'); f.render(); assert.equal(f.chain.getSnapshot().rootReady, false); f.modals()[0].props.onShow(); f.render(); assert.equal(f.chain.getSnapshot().rootReady, true);
  const a = f.open('real-child'); f.render(); assert.equal(f.chain.canInteract(a.entry), false); f.modals()[1].props.onShow(); f.render(); assert.equal(f.chain.canInteract(a.entry), true);
  const modal = f.modals()[1]; assert.equal(modal.props.allowSwipeDismissal, false); f.chain.requestClose(a.entry); f.render(); assert.equal(f.modals()[1].props.visible, false);
  let result; a.closed.then(value => { result = value; }); await flush(); assert.equal(result, undefined); modal.props.onDismiss(); f.render(); assert.equal(await a.closed, 'closed'); assert.equal(f.modals().length, 1); f.cleanup(); await flush();
});
test('actual iOS retained parent stays same original modal/body while child closes; no new-child timing claim', async () => {
  const f = await nativeFixture('ios'); await f.readyRoot(); const a = f.open('parent'); f.render(); const parentModal = f.modals()[1]; parentModal.props.onShow(); f.render(); const b = f.open('child'); f.render(); const childModal = f.modals()[2]; childModal.props.onShow(); f.render();
  f.chain.requestClose(a.entry); f.render(); assert.equal(f.modals()[1].props.visible, true); const body = nodes(f.tree(), node => node.type === 'RealBody' && node.props.name === 'parent')[0]; assert.equal(body.props.state.retained, true); assert.equal(body.props.state.interactive, false); assert.equal(f.open('unsupported'), null);
  f.chain.requestClose(b.entry); f.render(); childModal.props.onDismiss(); f.render(); assert.equal(await b.closed, 'closed'); assert.equal(f.modals()[1].props.visible, false); parentModal.props.onDismiss(); f.render(); assert.equal(await a.closed, 'closed'); f.cleanup(); await flush();
});
test('already-open actual Android windows survive StrictMode lease replay without arm/cancel duplication', async () => {
  const f = await nativeFixture('android'); await f.readyRoot(); const a = f.open('child'); f.render(); f.layout(1); await f.ack(1); f.modals()[1].props.onShow(); f.render(); const before = f.calls.filter(value => value[0] === 'arm').length;
  f.replay(); await flush(); f.render(); assert.equal(f.chain.canInteract(a.entry), true); assert.equal(f.calls.filter(value => value[0] === 'arm').length, before); assert.equal(f.calls.some(value => value[0] === 'cancel' || value[0] === 'pending-cancel'), false); f.cleanup(); await flush();
});
test('real Android original arm failure holds completion and cancels exact original pending resources on unmount', async () => {
  const f = await nativeFixture('android'); await f.readyRoot(); const a = f.open('failed'); f.render(); const ticket = f.layout(1); f.native.get(ticket).arm.reject(Error('no real window')); await flush(); f.render();
  f.chain.requestClose(a.entry); f.render(); assert.equal(f.modals()[1].props.visible, true); assert.equal(f.chain.canInteract(a.entry), false); let result; a.closed.then(value => { result = value; }); await flush(); assert.equal(result, undefined); f.cleanup(); await flush(); assert.equal(await a.closed, 'retired');
});
test('retired account and stale native events cannot complete or retarget replacement iOS carriers', async () => {
  const f = await nativeFixture('ios'); await f.readyRoot(); const a = f.open('old'); f.render(); const old = f.modals()[1]; old.props.onShow(); f.render(); f.current(false); f.render(); assert.equal(await a.closed, 'retired'); old.props.onDismiss(); old.props.onShow(); assert.equal(f.chain.getSnapshot().retired, true);
  const fresh = await nativeFixture('ios'); await fresh.readyRoot(); const b = fresh.open('fresh'); fresh.render(); fresh.modals()[1].props.onShow(); fresh.render(); old.props.onDismiss(); assert.equal(fresh.chain.canInteract(b.entry), true); f.cleanup(); fresh.cleanup(); await flush();
});
test('Root render callback/observer remain original and missing actual outlet never presents a registered child', async () => {
  const f = await nativeFixture('android'); f.props({ renderContent: () => ({ type: 'RealRootWithoutOutlet', props: {} }) }); await f.readyRoot(); assert.ok(f.open('registered')); f.render(); assert.equal(f.modals().length, 1);
  f.props({ renderContent: () => { throw Error('new callback cannot replace original'); }, windowObserver: { arm: () => { throw Error('new observer'); }, waitForDetach() {}, cancelPending() {}, cancel() {} } }); f.render(); assert.equal(f.modals().length, 1); assert.equal(f.chain.canInteract(f.chain.top()), false); f.cleanup(); await flush();
});
test('Android old/partial observer, invalid original Root identity and malformed native props fail before native presentation', async () => {
  const f = await nativeFixture('android'); for (const changes of [{ windowObserver: undefined }, { windowObserver: {} }, { rootIdentity: {} }, { presentation: { animationType: 'none' } }, { renderContent: null }]) {
    assert.throws(() => f.component.AdminRootPresentationRootCarrier({ chain: f.chain, rootIdentity: f.rootIdentity, presentation: { transparent: false, animationType: 'none', presentationStyle: 'fullScreen' }, renderContent: () => ({}), onRequestClose() {}, windowObserver: f.observer, ...changes }), TypeError);
  } f.cleanup(); await flush();
});
test('late Android arm acknowledgment after original Root unmount is cancelled without touching a new native Root', async () => {
  const old = await nativeFixture('android'); old.render(); old.modals()[0].props.onShow(); const ticket = old.layout(0), pending = old.native.get(ticket); old.cleanup(); await flush();
  const fresh = await nativeFixture('android'); await fresh.readyRoot(); pending.arm.resolve(pending.value); await flush();
  assert.equal(old.chain.getSnapshot().retired, true); assert.equal(old.calls.some(value => value[0] === 'cancel' && value[2] === ticket), true); assert.equal(fresh.chain.getSnapshot().rootReady, true); assert.equal(fresh.calls.some(value => value[0] === 'cancel'), false); fresh.cleanup(); await flush();
});
test('actual iOS StrictMode replay keeps the original shown carrier and stale native Back cannot invoke a newer callback', async () => {
  const f = await nativeFixture('ios'); await f.readyRoot(); const a = f.open('original'); f.render(); const original = f.modals()[1]; original.props.onShow(); f.render(); f.replay(); await flush(); f.render(); assert.equal(f.chain.canInteract(a.entry), true);
  f.chain.requestClose(a.entry); f.render(); original.props.onDismiss(); f.render(); assert.equal(await a.closed, 'closed'); const b = f.open('replacement'); f.render(); f.modals()[1].props.onShow(); f.render(); original.props.onRequestClose(); original.props.onDismiss();
  assert.equal(f.chain.canInteract(b.entry), true); assert.equal(f.calls.some(value => Array.isArray(value) && value[0] === 'close'), false); f.cleanup(); await flush();
});
test('new Root chain forces a new carrier component/ticket and late original native onShow cannot ready its replacement', async () => {
  const f = await nativeFixture('android'); await f.readyRoot(); const old = f.modals()[0], oldTicket = f.layout(0), rootIdentity = {}, next = new core.AdminRootPresentationChain({ platform: 'android', rootIdentity, isCurrent: () => true });
  f.props({ chain: next, rootIdentity }); f.render(); const nextTicket = f.layout(0); assert.notEqual(nextTicket, oldTicket); await f.ack(0); assert.equal(next.getSnapshot().rootReady, false);
  old.props.onShow(); assert.equal(next.getSnapshot().rootReady, false); f.modals()[0].props.onShow(); f.render(); assert.equal(next.getSnapshot().rootReady, true); assert.equal(f.chain.getSnapshot().retired, true); f.cleanup(); await flush();
});
for (const platform of ['android', 'ios']) test(`actual ${platform} duplicate Root host cannot render/arm/dispatch from another original carrier lease`, async () => {
  const f = await nativeFixture(platform); await f.readyRoot(); const before = f.calls.filter(value => Array.isArray(value) && value[0] === 'arm').length;
  f.copies(2); f.render(); await flush(); f.render(); assert.equal(f.modals().length, 1); assert.equal(f.chain.getSnapshot().rootReady, true);
  assert.equal(f.calls.filter(value => Array.isArray(value) && value[0] === 'arm').length, before); f.modals()[0].props.onRequestClose(); assert.equal(f.calls.filter(value => value === 'root-back').length, 1); f.cleanup(); await flush();
});
test('captured real-body live guards reject queued native events through blur/closing while retaining original read authority', async () => {
  const f = await nativeFixture('ios'); await f.readyRoot(); const a = f.open('origin'); f.render(); f.modals()[1].props.onShow(); f.render(); const state = nodes(f.tree(), node => node.type === 'RealBody' && node.props.name === 'origin')[0].props.state;
  assert.equal(state.interactive, true); assert.equal(state.canInteract(), true); const b = f.open('covering'); f.render(); f.modals()[2].props.onShow(); f.render();
  assert.equal(state.canInteract(), false); assert.equal(state.isCurrent(), true); f.chain.requestClose(b.entry); const modal = f.modals()[2]; f.render(); modal.props.onDismiss(); f.render(); assert.equal(state.canInteract(), true);
  f.chain.requestClose(a.entry); assert.equal(state.canInteract(), false); assert.equal(state.isCurrent(), true); f.chain.cancel(a.entry); assert.equal(state.isCurrent(), false); f.cleanup(); await flush();
});
