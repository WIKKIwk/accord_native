const assert = require('node:assert/strict'), test = require('node:test'), s = require('./adminScaffoldLayoutSupport.cjs');
function native() {
  const calls = [], listeners = new Set(), value = { calls, listeners, capability: { protocol: 1, guarantee: 'original-window-layout-snapshot', platform: 'android', rawIme: true },
    scaffoldLayoutCapability: async () => value.capability,
    bindScaffoldViewport: async (...args) => { calls.push(['viewport', ...args]); return value.viewport ?? s.receipt('viewport', args[2]); },
    bindScaffoldDock: async (...args) => { calls.push(['dock', ...args]); return value.dock ?? s.receipt('dock', args[4]); },
    bindScaffoldParts: async (...args) => { calls.push(['pair', ...args]); return value.pair ?? s.receipt('pair', args[6]); },
    releaseScaffoldLayout: async (...args) => { calls.push(['release', ...args]); return true; }, cancelScaffoldLayoutTicket: async (...args) => { calls.push(['cancel', ...args]); return true; },
    addListener(name, listener) { assert.equal(name, 'onScaffoldLayoutChange'); listeners.add(listener); return { remove: () => listeners.delete(listener) }; } }; return value;
}
test('new local capability never substitutes old Activity-only APIs, old binaries, unsupported platform or inferred legacy IME', async () => {
  for (const value of [null, {}, { readInsets: async () => assert.fail('Activity read'), isGestureNavigation: async () => assert.fail('navigation') }]) assert.equal(await s.bridge(value).readAdminScaffoldLayoutObserver('android'), null);
  const value = native(); for (const patch of [{ protocol: 2 }, { guarantee: 'Activity-only' }, { rawIme: false }, { rawIme: 1 }, { platform: 'ios' }]) { value.capability = { ...native().capability, ...patch }; assert.equal(await s.bridge(value).readAdminScaffoldLayoutObserver('android'), null); }
  assert.equal(await s.bridge(native()).readAdminScaffoldLayoutObserver('web'), null);
});
test('actual native tags/nativeIDs and original receipt/ticket flow unchanged through both registration phases', async () => {
  const value = native(), api = await s.bridge(value).readAdminScaffoldLayoutObserver('android'); const owner = await api.bindViewport({ tag: 1, nativeID: 'real-source' }, 'viewport-ticket');
  await api.bindDock(owner, { tag: 2, nativeID: 'real-dock' }, 'dock-ticket'); await api.bindParts(owner, { tag: 2, nativeID: 'real-dock' }, { tag: 3, nativeID: 'real-fixed' }, 'pair-ticket');
  assert.deepEqual(value.calls, [['viewport', 1, 'real-source', 'viewport-ticket'], ['dock', owner.handle, owner.ticket, 2, 'real-dock', 'dock-ticket'], ['pair', owner.handle, owner.ticket, 2, 'real-dock', 3, 'real-fixed', 'pair-ticket']]);
  assert.equal(Object.isFrozen(owner.initial.viewport), true); assert.equal(owner.initial.viewport.safeTop, 30); assert.equal(owner.initial.viewport.rawImeBottom, 0);
  for (const marker of [{ tag: 0, nativeID: 'real' }, { tag: 1.2, nativeID: 'real' }, { tag: 1, nativeID: '' }, { tag: 1, nativeID: 'with space' }, { tag: 1, nativeID: 'final-newline\n' }]) await assert.rejects(api.bindViewport(marker, 'new-ticket'), /Actual scaffold marker/); assert.equal(value.calls.length, 3);
});
test('strict original native events reject missing safeTop, unknown IME, cross-kind payloads, invalid frame/revision and nonfinite coordinates instead of defaulting zero', () => {
  for (const patch of [{ viewport: s.viewport({ safeTop: undefined }) }, { viewport: s.viewport({ rawImeBottom: undefined }) }, { viewport: s.viewport({ rawImeBottom: -1 }) }, { viewport: s.viewport({ safeLeft: 390 }) },
    { frame: 0 }, { revision: Number.MAX_SAFE_INTEGER + 1 }, { dock: { viewport: s.viewport(), dockHeight: 199 } }, { viewport: s.viewport({ rect: { x: 0, y: NaN, width: 400, height: 800 } }) }, { viewportHandle: 'wrong-viewport' }]) assert.throws(() => s.protocol.adminScaffoldLayoutEvent(s.event('viewport', 'viewport-1', 'ticket', patch), 'android'), TypeError);
  assert.throws(() => s.protocol.adminScaffoldLayoutEvent(s.event('viewport', 'viewport-1', 'ticket', { retired: true }), 'android'), TypeError);
});
test('malformed original ACK releases only its exact native resource and never returns guessed layout', async () => {
  const value = native(); value.viewport = s.receipt('viewport', 'viewport-ticket'); value.viewport.initial.viewport.safeTop = undefined; const api = await s.bridge(value).readAdminScaffoldLayoutObserver('android');
  await assert.rejects(api.bindViewport({ tag: 1, nativeID: 'actual' }, 'viewport-ticket'), TypeError); assert.deepEqual(value.calls.at(-1), ['release', value.viewport.handle, 'viewport-ticket']);
});
test('a native dock/fixed receipt cannot cross the original viewport window even when its payload is otherwise well formed', async () => {
  const value = native(), api = await s.bridge(value).readAdminScaffoldLayoutObserver('android'), owner = await api.bindViewport({ tag: 1, nativeID: 'actual' }, 'viewport-ticket');
  value.pair = s.receipt('pair', 'pair-ticket', { windowID: 'other-native-window' }); await assert.rejects(api.bindParts(owner, { tag: 2, nativeID: 'dock' }, { tag: 3, nativeID: 'fixed' }, 'pair-ticket'), /Cross-window/);
  assert.deepEqual(value.calls.at(-1), ['release', value.pair.handle, 'pair-ticket']);
});
test('native event subscription rejects another platform/invalid receipt and detaches only its actual listener', async () => {
  const value = native(), api = await s.bridge(value).readAdminScaffoldLayoutObserver('android'), events = [], stop = api.subscribe(event => events.push(event)); const callback = [...value.listeners][0];
  callback(s.event('viewport', 'viewport-1', 'ticket', { platform: 'ios' })); callback({}); assert.equal(events.length, 0); callback(s.event('viewport', 'viewport-1', 'ticket')); assert.equal(events.length, 1); stop(); assert.equal(value.listeners.size, 0);
});
