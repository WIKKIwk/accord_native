/* global __dirname */
const assert = require('node:assert/strict'), path = require('node:path'), test = require('node:test');
const { compile } = require('./adminSupplierDetailViewSupport.cjs');
const root = path.resolve(__dirname, '../modules/accord-admin-presentation/src');
const request = Object.freeze({ presentationTicket: 'original-sheet', parentTicket: 'original-parent', retirementTicket: 'original-retirement' });
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
function fixture(platform = 'ios', options = {}) {
  const calls = [], reply = (p, parent, retirement) => ({ protocol: 1, platform, presentationTicket: p, parentTicket: parent, retirementTicket: retirement, receiptID: '11111111-2222-4333-8444-555555555555', disposition: 'removed' });
  const native = { sheetCapability: async () => ({ protocol: 1, platform, guarantee: platform === 'ios' ? 'owned-uikit-presentation-and-dismissal' : 'owned-android-presentation-and-dismissal', viewName: 'AdminSheetPortal' }),
    async sheetRetirementCapability() { assert.equal(this, native); calls.push('capability'); return { protocol: 1, platform, guarantee: 'owned-original-sheet-retirement' }; },
    async retireSheet(...args) { assert.equal(this, native); calls.push(args); return reply(...args); }, ...options.native };
  let currentNative = native;
  const base = compile(path.join(root, 'AccordAdminOwnedSheet.ts'), { expo: { requireOptionalNativeModule: () => currentNative, requireNativeView: () => function ActualNativeViewBinding() {} } });
  const module = compile(path.join(root, 'AccordAdminOwnedSheetRetirement.ts'), { './AccordAdminOwnedSheet': base });
  return { ...module, base, native, calls, reply, changeNative: value => { currentNative = value; }, show: () => base.readAdminOwnedSheetCapability(platform) };
}
for (const platform of ['ios', 'android']) test(`original ${platform} retirement receipt is resource-only, opaque, scoped and frozen`, async () => {
  const f = fixture(platform), show = await f.show(), cap = await f.readAdminOwnedSheetRetirementCapability(show); assert.equal(cap.status, 'available'); assert.equal(f.isAdminOwnedSheetRetirementCapability(cap), true); assert.equal(f.isAdminOwnedSheetRetirementCapability({ ...cap }), false);
  const result = await cap.retire(request); assert.ok(Object.isFrozen(result)); assert.ok(Object.isFrozen(cap)); assert.equal(result.disposition, 'removed'); assert.equal(f.isAdminOwnedSheetRetirementReceipt(cap, result, request), true);
  assert.equal(f.isAdminOwnedSheetRetirementReceipt(cap, { ...result }, request), false); assert.equal(f.isAdminOwnedSheetRetirementReceipt(cap, JSON.parse(JSON.stringify(result)), request), false);
  assert.equal(f.isAdminOwnedSheetRetirementReceipt(cap, result, { ...request, parentTicket: 'foreign-parent' }), false); assert.equal(Object.hasOwn(result, 'closed'), false); assert.equal(Object.hasOwn(result, 'acceptedClose'), false);
  assert.deepEqual(f.calls, ['capability', [request.presentationTicket, request.parentTicket, request.retirementTicket]]);
});
test('copied, missing or foreign show capability never imports/adopts another module for cleanup', async () => {
  const f = fixture(), show = await f.show(), other = fixture();
  for (const candidate of [null, {}, { ...show }, show.NativeView, await other.show()]) assert.equal((await f.readAdminOwnedSheetRetirementCapability(candidate)).status, 'unavailable');
  assert.deepEqual(f.calls, []);
});
test('retirement capability derives from the SAME captured native module, never the latest global module', async () => {
  const f = fixture(), show = await f.show(); f.changeNative({ sheetRetirementCapability() { throw Error('foreign latest module'); } });
  const cap = await f.readAdminOwnedSheetRetirementCapability(show); assert.equal(cap.status, 'available'); assert.ok(await cap.retire(request)); assert.equal(f.calls.length, 2);
});
test('issued show binding captures cleanup functions BEFORE its first await and cannot adopt replacements afterward', async () => {
  const wait = deferred(), f = fixture('ios', { native: { sheetCapability: () => wait.promise } });
  const pendingShow = f.show(); f.native.sheetRetirementCapability = async () => { throw Error('replacement cleanup reader'); }; f.native.retireSheet = async () => { throw Error('replacement cleanup command'); };
  wait.resolve({ protocol: 1, platform: 'ios', guarantee: 'owned-uikit-presentation-and-dismissal', viewName: 'AdminSheetPortal' });
  const show = await pendingShow, cap = await f.readAdminOwnedSheetRetirementCapability(show), result = await cap.retire(request);
  assert.equal(result.disposition, 'removed'); assert.deepEqual(f.calls, ['capability', [request.presentationTicket, request.parentTicket, request.retirementTicket]]);
});
test('an old show binding never adopts a cleanup method added to that module object later', async () => {
  const f = fixture('ios', { native: { retireSheet: undefined } }), show = await f.show();
  f.native.retireSheet = async (...args) => f.reply(...args); assert.equal((await f.readAdminOwnedSheetRetirementCapability(show)).status, 'unavailable'); assert.deepEqual(f.calls, []);
});
test('both original method references are captured before awaiting capability; replacement cannot retarget pending cleanup', async () => {
  const wait = deferred(), f = fixture('ios', { native: { sheetRetirementCapability: () => wait.promise } }), show = await f.show();
  const pending = f.readAdminOwnedSheetRetirementCapability(show); f.native.retireSheet = () => { throw Error('retargeted method'); };
  wait.resolve({ protocol: 1, platform: 'ios', guarantee: 'owned-original-sheet-retirement' }); const cap = await pending; const result = await cap.retire(request); assert.equal(result.receiptID, '11111111-2222-4333-8444-555555555555'); assert.equal(f.calls.length, 1);
});
test('same show capability coalesces protocol discovery and returns the same issued cleanup capability', async () => {
  const f = fixture(), show = await f.show(), [a, b] = await Promise.all([f.readAdminOwnedSheetRetirementCapability(show), f.readAdminOwnedSheetRetirementCapability(show)]);
  assert.equal(a, b); assert.deepEqual(f.calls, ['capability']); assert.equal(await f.readAdminOwnedSheetRetirementCapability(show), a);
});
test('missing, throwing or incompatible retirement protocol remains unavailable', async () => {
  for (const native of [{ retireSheet: undefined }, { sheetRetirementCapability: undefined }, { sheetRetirementCapability: () => { throw Error('old binary'); } },
    { sheetRetirementCapability: async () => ({ protocol: 2, platform: 'ios', guarantee: 'owned-original-sheet-retirement' }) },
    { sheetRetirementCapability: async () => ({ protocol: 1, platform: 'android', guarantee: 'owned-original-sheet-retirement' }) },
    { sheetRetirementCapability: async () => ({ protocol: 1, platform: 'ios', guarantee: 'fake-cleanup' }) },
    { get sheetRetirementCapability() { throw Error('malformed native binding'); } }]) {
    // Install getters after fixture construction; its default native object is deliberately ordinary.
    const f = fixture(); Object.defineProperties(f.native, Object.getOwnPropertyDescriptors(native)); const show = await f.show(); assert.equal((await f.readAdminOwnedSheetRetirementCapability(show)).status, 'unavailable');
  }
});
test('retirement request captures exact immutable tuple and rejects malformed/duplicate identities before native', async () => {
  const f = fixture(), cap = await f.readAdminOwnedSheetRetirementCapability(await f.show());
  for (const patch of [{ retirementTicket: request.parentTicket }, { presentationTicket: request.parentTicket }, { parentTicket: '' }, { retirementTicket: 'r\n' }, { retirementTicket: 3 }]) await assert.rejects(cap.retire({ ...request, ...patch }), /invalid_original_sheet_retirement_request/);
  await assert.rejects(cap.retire({ get presentationTicket() { throw Error('bad input'); } }), /invalid_original_sheet_retirement_request/); assert.deepEqual(f.calls, ['capability']);
  const value = { ...request }; const pending = cap.retire(value); value.parentTicket = 'replacement-parent'; assert.equal((await pending).parentTicket, request.parentTicket);
});
test('same original pending R retries native guard after genuine child release; one physical receipt becomes one opaque JS receipt', async () => {
  const waits = [], f = fixture('ios', { native: { retireSheet: (...args) => { const wait = deferred(); waits.push({ ...wait, args }); return wait.promise; } } }), cap = await f.readAdminOwnedSheetRetirementCapability(await f.show());
  const first = cap.retire(request), retry = cap.retire({ ...request }); assert.equal(waits.length, 2); assert.deepEqual(waits[0].args, waits[1].args);
  const raw = f.reply(...waits[0].args); waits[1].resolve(raw); const a = await retry; waits[0].resolve({ ...raw }); const b = await first; assert.equal(a, b); assert.equal(f.isAdminOwnedSheetRetirementReceipt(cap, b, request), true);
  assert.equal(await cap.retire(request), a); assert.equal(waits.length, 2, 'Terminal receipt does not invent another native cleanup');
});
test('foreign parent/R cannot retarget an already pending original operation', async () => {
  const wait = deferred(), f = fixture('ios', { native: { retireSheet: () => wait.promise } }), cap = await f.readAdminOwnedSheetRetirementCapability(await f.show()), pending = cap.retire(request);
  await assert.rejects(cap.retire({ ...request, parentTicket: 'other-parent' }), /foreign_original/); await assert.rejects(cap.retire({ ...request, retirementTicket: 'other-retirement' }), /foreign_original/);
  await assert.rejects(cap.retire({ ...request, presentationTicket: 'other-sheet' }), /foreign_original/);
  wait.resolve(f.reply(request.presentationTicket, request.parentTicket, request.retirementTicket)); assert.equal((await pending).retirementTicket, request.retirementTicket);
});
test('an early terminal neverPresented proof is kept distinct from actual removal and Source close', async () => {
  const f = fixture('android'), normal = f.native.retireSheet; f.native.retireSheet = async function (...args) { return { ...await normal.apply(this, args), disposition: 'neverPresented', acceptedClose: 'ignored-foreign-field', closed: true }; };
  const cap = await f.readAdminOwnedSheetRetirementCapability(await f.show()), result = await cap.retire(request); assert.equal(result.disposition, 'neverPresented'); assert.equal(Object.hasOwn(result, 'closed'), false); assert.equal(Object.hasOwn(result, 'acceptedClose'), false);
});
test('malformed, foreign, nonphysical and mutable native receipts never become issued cleanup proof', async () => {
  for (const patch of [{ protocol: 2 }, { platform: 'android' }, { presentationTicket: 'other-sheet' }, { parentTicket: 'other-parent' }, { retirementTicket: 'other-retirement' },
    { receiptID: '' }, { receiptID: 'not-a-native-uuid' }, { receiptID: request.retirementTicket }, { receiptID: request.presentationTicket }, { receiptID: request.parentTicket }, { disposition: 'dismissRequested' }, { disposition: 'retired' }]) {
    const f = fixture(); f.native.retireSheet = async (...args) => ({ ...f.reply(...args), ...patch }); const cap = await f.readAdminOwnedSheetRetirementCapability(await f.show()); await assert.rejects(cap.retire(request), /invalid_original_sheet_retirement_receipt/);
  }
  const f = fixture('ios', { native: { retireSheet: async () => ({ get protocol() { throw Error('bad reply'); } }) } }), cap = await f.readAdminOwnedSheetRetirementCapability(await f.show()); await assert.rejects(cap.retire(request), /invalid_original_sheet_retirement_receipt/);
});
test('native receipt ID cannot be borrowed for a different original presentation', async () => {
  const f = fixture(), cap = await f.readAdminOwnedSheetRetirementCapability(await f.show()); await cap.retire(request);
  await assert.rejects(cap.retire({ presentationTicket: 'another-sheet', parentTicket: 'another-parent', retirementTicket: 'another-retirement' }), /foreign_original_sheet_retirement_receipt/);
});
test('one native cleanup cannot retarget its terminal receipt during out-of-order duplicate replies', async () => {
  const waits = [], f = fixture('ios', { native: { retireSheet: () => { const wait = deferred(); waits.push(wait); return wait.promise; } } }), cap = await f.readAdminOwnedSheetRetirementCapability(await f.show());
  const a = cap.retire(request), b = cap.retire(request); const bad = assert.rejects(b, /retargeted_original_sheet_retirement_receipt/); waits[0].resolve(f.reply(request.presentationTicket, request.parentTicket, request.retirementTicket)); const first = await a;
  waits[1].resolve({ ...first, receiptID: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee' }); await bad; assert.equal(await cap.retire(request), first);
});
test('native rejection is neither cleanup proof nor Source success; same original R can retry honestly', async () => {
  let reads = 0; const f = fixture(); f.native.retireSheet = async (...args) => { if (++reads === 1) throw Error('native unavailable'); return f.reply(...args); };
  const cap = await f.readAdminOwnedSheetRetirementCapability(await f.show()); await assert.rejects(cap.retire(request), /native unavailable/); const result = await cap.retire(request); assert.equal(result.disposition, 'removed'); assert.equal(reads, 2);
});
test('a receipt from another issued cleanup binding cannot acknowledge this binding even with equal native tuple', async () => {
  const f = fixture(), a = await f.readAdminOwnedSheetRetirementCapability(await f.show()), b = await f.readAdminOwnedSheetRetirementCapability(await f.show()), receipt = await a.retire(request);
  assert.notEqual(a, b); assert.equal(f.isAdminOwnedSheetRetirementReceipt(b, receipt, request), false);
});
