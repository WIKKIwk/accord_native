/* global __dirname */
const assert = require('node:assert/strict'), path = require('node:path'), test = require('node:test');
const { compile } = require('./adminSupplierDetailViewSupport.cjs');
const filename = path.resolve(__dirname, '../modules/accord-admin-presentation/src/AccordAdminOwnedSheet.ts');
const original = Object.freeze({ presentationTicket: 'original-sheet', parentTicket: 'original-parent', parentViewTag: 31, parentNativeID: 'original-parent-marker', heightPoints: 520, cornerRadius: 24 });
const guarantees = { ios: 'owned-uikit-presentation-and-dismissal', android: 'owned-android-presentation-and-dismissal' };
function fixture(platform = 'ios', options = {}) {
  const calls = [], NativeView = options.NativeView ?? function ActualNativeViewBinding() {};
  const native = options.native === undefined ? { async sheetCapability() { assert.equal(this, native); calls.push('capability'); return options.reply ?? { protocol: 1, platform, guarantee: guarantees[platform], viewName: 'AdminSheetPortal' }; } } : options.native;
  const module = compile(filename, { expo: { requireOptionalNativeModule: name => { calls.push(['module', name]); if (options.moduleError) throw Error('module unavailable'); return native; },
    requireNativeView: (...args) => { calls.push(['view', ...args]); if (options.viewError) throw Error('view unavailable'); return NativeView; } } });
  return { ...module, calls, native, NativeView };
}
for (const platform of ['ios', 'android']) test(`actual ${platform} module/view binding is captured, opaque and never a native-window readiness claim`, async () => {
  const f = fixture(platform), capability = await f.readAdminOwnedSheetCapability(platform); assert.equal(capability.status, 'available'); assert.equal(capability.platform, platform); assert.equal(capability.NativeView, f.NativeView); assert.ok(Object.isFrozen(capability));
  assert.equal(f.isAdminOwnedSheetCapability(capability), true); assert.equal(f.isAdminOwnedSheetCapability({ ...capability }), false); assert.equal(fixture(platform).isAdminOwnedSheetCapability(capability), false);
  assert.deepEqual(f.calls, [['module', 'AccordAdminPresentation'], 'capability', ['view', 'AccordAdminPresentation', 'AdminSheetPortal']]); assert.equal(Object.hasOwn(capability, 'ready'), false);
});
test('unsupported platform never attempts a native import or supplies a substitute sheet', async () => {
  const f = fixture(); assert.equal((await f.readAdminOwnedSheetCapability('web')).status, 'unavailable'); assert.deepEqual(f.calls, []);
});
test('missing old module/method, failed module/view and malformed capability stay unavailable without a native view import', async () => {
  for (const options of [{ native: null }, { native: {} }, { moduleError: true }, { native: { sheetCapability: async () => { throw Error('old binary'); } } },
    { reply: { protocol: 1, platform: 'android', guarantee: guarantees.ios, viewName: 'AdminSheetPortal' } }, { reply: { protocol: 2, platform: 'ios', guarantee: guarantees.ios, viewName: 'AdminSheetPortal' } },
    { reply: { protocol: 1, platform: 'ios', guarantee: guarantees.ios, viewName: 'OtherPortal' } }, { reply: { get protocol() { throw Error('malformed'); } } }]) {
    const f = fixture('ios', options); assert.equal((await f.readAdminOwnedSheetCapability('ios')).status, 'unavailable'); assert.equal(f.calls.some(call => Array.isArray(call) && call[0] === 'view'), false);
  }
  for (const options of [{ viewError: true }, { NativeView: {} }]) assert.equal((await fixture('ios', options).readAdminOwnedSheetCapability('ios')).status, 'unavailable');
});
test('native configuration captures only exact original identities and genuine finite geometry', () => {
  const f = fixture(), input = { ...original, barrierOpacity: .32 }, ios = f.captureAdminOwnedSheetConfiguration('ios', input), android = f.captureAdminOwnedSheetConfiguration('android', input);
  assert.deepEqual(ios, original); assert.deepEqual(android, input); assert.ok(Object.isFrozen(android)); input.heightPoints = 999; assert.equal(android.heightPoints, 520);
  assert.equal(f.captureAdminOwnedSheetConfiguration('android', original), null, 'No guessed Android dim default');
  for (const patch of [{ presentationTicket: original.parentTicket }, { parentViewTag: 0 }, { parentViewTag: 1.2 }, { parentViewTag: 0x80000000 }, { parentNativeID: '' },
    { presentationTicket: 'a\n' }, { heightPoints: NaN }, { heightPoints: Infinity }, { heightPoints: 0 }, { cornerRadius: -1 }, { barrierOpacity: -0.1 }, { barrierOpacity: 1.1 }]) assert.equal(f.captureAdminOwnedSheetConfiguration('android', { ...original, barrierOpacity: .32, ...patch }), null);
  assert.equal(f.captureAdminOwnedSheetConfiguration('ios', { get parentTicket() { throw Error('bad original'); } }), null);
});
test('Source accepted-close capture permits independent null intent and exact transaction, never a foreign/reused identity', () => {
  const f = fixture(), intent = { presentationTicket: original.presentationTicket, closeTicket: 'accepted-source-close', transaction: null };
  assert.deepEqual(f.captureAdminOwnedSheetAcceptedClose(original, intent), intent); assert.ok(Object.isFrozen(f.captureAdminOwnedSheetAcceptedClose(original, intent)));
  assert.deepEqual(f.captureAdminOwnedSheetAcceptedClose(original, { ...intent, transaction: 'native-gesture' }), { ...intent, transaction: 'native-gesture' });
  for (const patch of [{ presentationTicket: 'other-sheet' }, { closeTicket: original.parentTicket }, { closeTicket: original.presentationTicket }, { transaction: intent.closeTicket }, { transaction: original.parentTicket }, { transaction: undefined }]) assert.equal(f.captureAdminOwnedSheetAcceptedClose(original, { ...intent, ...patch }), null);
});
function event(kind, patch = {}) {
  return { protocol: 1, kind, sequence: 1, presentationTicket: original.presentationTicket, parentTicket: original.parentTicket,
    transaction: ['willDismiss', 'cancelled', 'didDismiss', 'closeAccepted', 'closeJoined'].includes(kind) ? 'original-native-transaction' : null,
    acceptedClose: ['closeAccepted', 'closeJoined'].includes(kind) ? 'accepted-source-close' : null, reason: kind === 'failed' ? 'original_parent_unavailable' : null, ...patch };
}
for (const kind of ['shown', 'attempt', 'willDismiss', 'cancelled', 'didDismiss', 'closeAccepted', 'closeJoined', 'failed', 'retired']) test(`native ${kind} remains its exact distinct original fact, without inferring a Source close or another event`, () => {
  const f = fixture(), raw = event(kind), result = f.parseAdminOwnedSheetEvent(raw, original); assert.ok(result); assert.equal(result.kind, kind); assert.equal(result.sequence, 1); assert.equal(result.transaction, raw.transaction); assert.equal(result.acceptedClose, raw.acceptedClose); assert.equal(result.layout, null); assert.ok(Object.isFrozen(result));
  raw.sequence = 99; assert.equal(result.sequence, 1);
});
test('native shown can honestly carry an already accepted closing transaction and never rewrites it as interaction-ready', () => {
  const result = fixture().parseAdminOwnedSheetEvent(event('shown', { transaction: 'original-native-transaction', acceptedClose: 'accepted-source-close' }), original);
  assert.ok(result); assert.equal(result.acceptedClose, 'accepted-source-close'); assert.equal(Object.hasOwn(result, 'canInteract'), false);
});
test('native layout normalizes omitted nullable keys while retaining only actual positive measured dimensions', () => {
  const f = fixture(), raw = event('layout', { width: 393.5, height: 519.75 }); delete raw.transaction; delete raw.acceptedClose; delete raw.reason;
  const result = f.parseAdminOwnedSheetEvent(raw, original); assert.deepEqual(result.layout, { width: 393.5, height: 519.75 }); assert.ok(Object.isFrozen(result.layout)); assert.equal(result.transaction, null);
  assert.ok(f.parseAdminOwnedSheetEvent({ ...raw, transaction: 'original-native-transaction', acceptedClose: 'accepted-source-close' }, original));
  for (const patch of [{ width: 0 }, { height: -1 }, { width: Infinity }, { height: NaN }, { width: '393.5' }]) assert.equal(f.parseAdminOwnedSheetEvent({ ...raw, ...patch }, original), null);
});
test('foreign parent/presentation, duplicate identity, malformed sequence and incompatible wire payload cannot become an original event', () => {
  const f = fixture();
  for (const patch of [{ parentTicket: 'other-parent' }, { presentationTicket: 'other-sheet' }, { protocol: 2 }, { sequence: 0 }, { sequence: 1.5 }, { sequence: Infinity },
    { sequence: Number.MAX_SAFE_INTEGER + 1 }, { transaction: original.parentTicket }, { transaction: 'a\n' }, { kind: 'onAppear' }, { reason: 'unexpected' }]) assert.equal(f.parseAdminOwnedSheetEvent(event('shown', patch), original), null);
  assert.equal(f.parseAdminOwnedSheetEvent(event('closeJoined', { acceptedClose: 'original-native-transaction' }), original), null);
  assert.equal(f.parseAdminOwnedSheetEvent({ get protocol() { throw Error('bad native event'); } }, original), null);
});
test('required transaction/Source-acceptance fields cannot be inferred from an attempt, cancellation or bare actual dismissal', () => {
  const f = fixture();
  for (const kind of ['willDismiss', 'cancelled', 'didDismiss', 'closeAccepted', 'closeJoined']) assert.equal(f.parseAdminOwnedSheetEvent(event(kind, { transaction: null }), original), null);
  for (const kind of ['closeAccepted', 'closeJoined']) assert.equal(f.parseAdminOwnedSheetEvent(event(kind, { acceptedClose: null }), original), null);
  for (const kind of ['attempt', 'willDismiss', 'cancelled']) assert.equal(f.parseAdminOwnedSheetEvent(event(kind, { acceptedClose: 'accepted-source-close' }), original), null);
  assert.equal(f.parseAdminOwnedSheetEvent(event('failed', { reason: null }), original), null); assert.equal(f.parseAdminOwnedSheetEvent(event('attempt', { transaction: 'original-native-transaction' }), original), null);
});
