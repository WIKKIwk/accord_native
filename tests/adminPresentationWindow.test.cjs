/* global __dirname */
const assert = require('node:assert/strict'), fs = require('node:fs'), Module = require('node:module'), path = require('node:path');
const test = require('node:test'), ts = require('typescript');
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const guarantee = 'window-tree-detach', raw = (ticket = 'original', viewTag = 17, state = 'armed', handle = 'window-original') => ({ protocol: 1, guarantee, ticket, viewTag, handle, state });
function fixture(overrides = {}) {
  const calls = []; let current;
  const native = { capabilities: async () => ({ protocol: 1, guarantee, platform: 'android' }),
    arm: async (tag, ticket) => { calls.push(['arm', tag, ticket]); return raw(ticket, tag); },
    waitForDetach: async (handle, ticket) => { calls.push(['wait', handle, ticket]); return raw(ticket, 17, 'detached', handle); },
    cancelPending: async ticket => { calls.push(['pending-cancel', ticket]); return false; }, cancel: async (handle, ticket) => { calls.push(['cancel', handle, ticket]); return true; }, ...overrides };
  current = native; const filename = path.resolve(__dirname, '../src/admin/adminPresentationWindow.ts'), mod = new Module(filename, module); mod.filename = filename; mod.paths = module.paths;
  mod.require = id => id === 'expo' ? { requireOptionalNativeModule: name => { assert.equal(name, 'AccordAdminPresentation'); return current; } } : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { fileName: filename, compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return { calls, native, set: value => { current = value; }, read: mod.exports.readAdminPresentationWindowCapability };
}
async function observer(f) { const capability = await f.read('android'); assert.equal(capability.status, 'available'); assert.ok(Object.isFrozen(capability.observer)); return capability.observer; }
test('old, missing and partial native binaries remain unavailable without fabricating readiness or completion', async () => {
  const f = fixture(); for (const value of [null, undefined, {}, { capabilities: async () => ({ protocol: 1, guarantee, platform: 'android' }) }]) { f.set(value); assert.deepEqual(await f.read('android'), { status: 'unavailable' }); }
  for (const value of [null, [], {}, { protocol: 2, guarantee, platform: 'android' }, { protocol: 1, guarantee: 'animation-complete', platform: 'android' }, { protocol: 1, guarantee, platform: 'ios' }]) {
    f.set({ ...f.native, capabilities: async () => value }); assert.deepEqual(await f.read('android'), { status: 'unavailable' });
  }
  f.set({ ...f.native, capabilities: async () => { throw Error('old binary'); } }); assert.equal((await f.read('android')).status, 'unavailable'); assert.deepEqual(f.calls, []);
});
test('iOS/web never probe or use the Android-only native protocol', async () => {
  const f = fixture({ capabilities: async () => { throw Error('must not probe'); } }); assert.equal((await f.read('ios')).status, 'unavailable'); assert.equal((await f.read('web')).status, 'unavailable'); assert.deepEqual(f.calls, []);
});
test('invalid tags and opaque tickets reject before native arming', async () => {
  const f = fixture(), value = await observer(f); for (const tag of [0, -1, NaN, Infinity, 1.5, 2_147_483_648, '17', null]) await assert.rejects(value.arm(tag, 'original'), TypeError);
  for (const ticket of ['', ' leading', 'two words', '\0', 'x'.repeat(161), null, 17]) { await assert.rejects(value.arm(17, ticket), TypeError); await assert.rejects(value.cancelPending(ticket), TypeError); }
  assert.deepEqual(f.calls, []);
});
test('arming accepts only the exact original marker and real native registration receipt', async () => {
  for (const patch of [{ state: 'detached' }, { handle: '' }, { ticket: 'other' }, { viewTag: 18 }, { protocol: 2 }, { guarantee: 'react-unmount' }]) {
    const f = fixture({ arm: async () => ({ ...raw(), ...patch }) }), value = await observer(f); await assert.rejects(value.arm(17, 'original'), TypeError);
  }
  const f = fixture(), value = await observer(f), receipt = await value.arm(17, 'original'); assert.equal(Object.isFrozen(receipt), true); assert.deepEqual(receipt, raw());
});
test('native arming failure never yields a successful or reconstructed completion', async () => {
  const f = fixture({ arm: async () => { throw Error('marker_unavailable'); } }), value = await observer(f); await assert.rejects(value.arm(17, 'original'), /marker_unavailable/); await assert.rejects(value.waitForDetach(raw()), /not original/); assert.deepEqual(f.calls, []);
});
test('wait remains pending until actual native result and uses original module even if optional lookup changes', async () => {
  const detached = deferred(), f = fixture({ waitForDetach: async (handle, ticket) => { f.calls.push(['wait', handle, ticket]); return detached.promise; } }), value = await observer(f), receipt = await value.arm(17, 'original');
  let settled = false; const wait = value.waitForDetach(receipt).then(result => { settled = true; return result; }); f.set({ ...f.native, waitForDetach: async () => { throw Error('replacement module'); } }); await Promise.resolve(); assert.equal(settled, false);
  detached.resolve(raw('original', 17, 'detached')); assert.deepEqual(await wait, raw('original', 17, 'detached')); assert.deepEqual(f.calls, [['arm', 17, 'original'], ['wait', 'window-original', 'original']]); await assert.rejects(value.waitForDetach(receipt), /not original/);
});
test('only the issuing observer accepts receipt identity; shape copies and other owners cannot wait or cancel', async () => {
  const f = fixture(), first = await observer(f), second = await observer(f), receipt = await first.arm(17, 'original');
  for (const value of [second, first]) { const candidate = value === first ? { ...receipt } : receipt; await assert.rejects(value.waitForDetach(candidate), /not original/); await assert.rejects(value.cancel(candidate), /not original/); }
  assert.deepEqual(f.calls, [['arm', 17, 'original']]); await first.cancel(receipt); await assert.rejects(first.waitForDetach(receipt), /not original/);
});
test('duplicate wait cannot replace the original native waiter', async () => {
  const detached = deferred(), f = fixture({ waitForDetach: async () => detached.promise }), value = await observer(f), receipt = await value.arm(17, 'original'), first = value.waitForDetach(receipt);
  await assert.rejects(value.waitForDetach(receipt), /pending wait/); detached.resolve(raw('original', 17, 'detached')); assert.equal((await first).state, 'detached');
});
test('wrong-window/native non-detach results retire the original receipt without accepting a success', async () => {
  for (const patch of [{ handle: 'replacement' }, { ticket: 'other' }, { viewTag: 18 }, { state: 'armed' }, { guarantee: 'animation-complete' }]) {
    const f = fixture({ waitForDetach: async () => ({ ...raw('original', 17, 'detached'), ...patch }) }), value = await observer(f), receipt = await value.arm(17, 'original'); await assert.rejects(value.waitForDetach(receipt), TypeError); await assert.rejects(value.waitForDetach(receipt), /not original/);
  }
});
test('pending cancellation and armed cancellation target exact identities and reject malformed native replies', async () => {
  const f = fixture(), value = await observer(f); assert.equal(await value.cancelPending('original'), false); const receipt = await value.arm(17, 'original'); assert.equal(await value.cancel(receipt), true); assert.deepEqual(f.calls, [['pending-cancel', 'original'], ['arm', 17, 'original'], ['cancel', 'window-original', 'original']]);
  const g = fixture({ cancelPending: async () => 1, cancel: async () => undefined }), other = await observer(g); await assert.rejects(other.cancelPending('ticket'), TypeError); const armed = await other.arm(17, 'original'); await assert.rejects(other.cancel(armed), TypeError); await assert.rejects(other.waitForDetach(armed), /not original/);
});
test('local cancellation while a native event is in flight cannot later return its old detached proof', async () => {
  const detached = deferred(), f = fixture({ waitForDetach: async () => detached.promise }), value = await observer(f), receipt = await value.arm(17, 'original'), wait = value.waitForDetach(receipt);
  await value.cancel(receipt); detached.resolve(raw('original', 17, 'detached')); await assert.rejects(wait, /not original/);
});
