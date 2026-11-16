const assert = require('node:assert/strict');
const test = require('node:test');
const { controller: { AdminWorkerDetailController }, detail, profile, entry, tick, deferred, scheduler } = require('./adminWorkerDetailSupport.cjs');
function fixture({ kind = 'worker', role = 'aparatchi', readOnly = false, ...overrides } = {}) {
  let current = true; const calls = [], clock = scheduler();
  const deps = { entry: entry(kind, role), readOnly, isCurrent: () => current, timeout: async (promise, message) => { calls.push(['timeout', message]); return promise; },
    detail: async guard => { guard(); calls.push('detail'); return detail(); }, profile: async guard => { guard(); calls.push('profile'); return profile(); },
    apparatus: async guard => { guard(); calls.push('apparatus'); return []; }, warehouses: async guard => { guard(); calls.push('warehouses'); return ['Warehouse']; },
    responsibilities: async guard => { guard(); calls.push('responsibilities'); return [{ material_id: 'material', material_name: 'Material', estimated_kg: null }]; },
    savePhone: async (captured, phone, guard) => { guard(); calls.push(['phone', captured, phone]); return 'ack-phone'; }, regenerate: async guard => { guard(); calls.push('regenerate'); return detail({ code: 'fresh-code' }); },
    copy: async value => { calls.push(['copy', value]); }, schedule: clock.set, cancel: clock.clear, ...overrides };
  const controller = new AdminWorkerDetailController(deps); return { controller, calls, deps, clock, retire: () => { current = false; } };
}
async function ready(options) { const f = fixture(options); f.controller.start(); await tick(); return f; }
const effects = calls => calls.filter(value => !Array.isArray(value) || value[0] !== 'timeout');
function edit(f, value = ' \u0085 edited \u0085 ') { f.controller.expand(true, detail()); f.controller.editPhone(); f.controller.changePhone(value); }
test('normal detail loads first then parallel profile+canonical apparatus, each with source15second timeout', async () => {
  const f = await ready(); assert.deepEqual(effects(f.calls), ['detail', 'profile', 'apparatus']);
  assert.deepEqual(f.calls.filter(Array.isArray), [['timeout', 'Profil yuklash vaqti tugadi'], ['timeout', 'Ish faoliyati yuklash vaqti tugadi']]);
  const s = f.controller.getSnapshot(); assert.equal(s.loading, false); assert.equal(s.loadError, false); assert.ok(s.profile); assert.equal(s.profileLoading, false); assert.equal(s.changed, false);
});
test('Metalayzer is a system detail with warehouse reload but no activity profile; readonly removes warehouse load', async () => {
  const f = await ready({ kind: 'metalayzer', role: 'metalayzer' }); assert.deepEqual(effects(f.calls), ['detail', 'warehouses']); assert.deepEqual(f.controller.getSnapshot().warehouses, ['Warehouse']);
  const g = await ready({ kind: 'metalayzer', role: 'metalayzer', readOnly: true }); assert.deepEqual(effects(g.calls), ['detail']); assert.deepEqual(g.controller.getSnapshot().warehouses, []);
});
test('Tayyorlov detail loads warehouses then responsibilities in sequence, including read-only responsibilities', async () => {
  const f = await ready({ kind: 'tayyorlovMasteri', role: 'tayyorlov_masteri' }); assert.deepEqual(effects(f.calls), ['detail', 'warehouses', 'responsibilities']);
  const g = await ready({ kind: 'tayyorlovMasteri', role: 'tayyorlov_masteri', readOnly: true }); assert.deepEqual(effects(g.calls), ['detail', 'responsibilities']);
});
test('main load failure preserves last detail and shows both source error states; profile-only failure does not fail profile header', async () => {
  const f = await ready(); f.deps.detail = async () => { throw new Error('detail'); }; await f.controller.reload();
  assert.equal(f.controller.getSnapshot().detail.code, '123'); assert.equal(f.controller.getSnapshot().loadError, true); assert.equal(f.controller.getSnapshot().profileError, true);
  assert.equal(f.controller.getSnapshot().profile, null); assert.equal(f.controller.getSnapshot().profileLoading, false);
  const g = await ready({ profile: async () => { throw new Error('profile'); } }); assert.equal(g.controller.getSnapshot().loadError, false); assert.equal(g.controller.getSnapshot().profileError, true);
});
test('phone editor has silent empty validation, stays editable while saving, and uses acknowledged phone', async () => {
  const wait = deferred(), f = await ready({ savePhone: async (captured, phone, guard) => { guard(); f.calls.push(['phone', captured, phone]); return wait.promise; } });
  edit(f, '\u0085 '); assert.equal(await f.controller.savePhone(detail()), false); assert.equal(f.controller.getSnapshot().phoneEditing, true);
  f.controller.changePhone(' \u0085 edited \u0085 '); const pending = f.controller.savePhone(detail()); assert.equal(f.controller.getSnapshot().savingPhone, true);
  f.controller.changePhone('typed later'); assert.equal(f.controller.getSnapshot().phoneDraft, 'typed later'); wait.resolve('ack'); assert.equal(await pending, true);
  assert.equal(f.calls.find(value => value[0] === 'phone')[2], 'edited'); assert.equal(f.controller.getSnapshot().detail.phone, 'ack'); assert.equal(f.controller.getSnapshot().changed, true);
  assert.equal(f.controller.getSnapshot().phoneEditing, false); assert.equal(f.controller.getSnapshot().savingPhone, false);
});
test('concurrent phone acknowledgment copies captured detail and can overwrite a later regenerated code exactly like source', async () => {
  const wait = deferred(), f = await ready({ savePhone: () => wait.promise }); edit(f); const pending = f.controller.savePhone(detail());
  await f.controller.regenerate(); assert.equal(f.controller.getSnapshot().detail.code, 'fresh-code'); wait.resolve('new-phone'); await pending;
  assert.equal(f.controller.getSnapshot().detail.code, '123'); assert.equal(f.controller.getSnapshot().detail.phone, 'new-phone');
});
test('keyboard phone submission can occur again while busy; source has no inner save mutex', async () => {
  const first = deferred(), second = deferred(); let sends = 0; const f = await ready({ savePhone: () => ++sends === 1 ? first.promise : second.promise }); edit(f);
  const one = f.controller.savePhone(detail()), two = f.controller.savePhone(detail()); assert.equal(sends, 2); second.resolve('second'); await two; first.resolve('first'); await one;
  assert.equal(f.controller.getSnapshot().detail.phone, 'first');
});
test('closing/reopening admin panel resets local phone editing and synchronizes latest phone; read-only refuses controls', async () => {
  const f = await ready(); edit(f, 'unsaved'); f.controller.expand(false, detail()); assert.equal(f.controller.getSnapshot().phoneEditing, false);
  f.controller.expand(true, detail()); assert.equal(f.controller.getSnapshot().phoneDraft, 'phone');
  const g = await ready({ readOnly: true }); edit(g); await g.controller.regenerate(); await g.controller.copy('code'); assert.equal(await g.controller.savePhone(detail()), false);
  assert.equal(g.controller.getSnapshot().expanded, false); assert.equal(effects(g.calls).some(call => Array.isArray(call) && ['copy', 'phone'].includes(call[0])), false);
});
test('phone acknowledgment from a disposed panel still updates parent detail but cannot close/edit the newly mounted phone editor', async () => {
  const wait = deferred(); let sends = 0;
  const f = await ready({ savePhone: () => ++sends === 1 ? wait.promise : Promise.resolve('second ack') }); edit(f, 'old editor');
  const oldGeneration = f.controller.phoneInteractionGeneration, pending = f.controller.savePhone(detail());
  // A second keyboard submission can settle first and re-enable the source phone icon.
  await f.controller.savePhone(detail());
  f.controller.expand(false, detail()); f.controller.expand(true, detail()); f.controller.editPhone(); f.controller.changePhone('new editor draft');
  assert.notEqual(f.controller.phoneInteractionGeneration, oldGeneration); wait.resolve('ack from old panel'); await pending;
  assert.equal(f.controller.getSnapshot().detail.phone, 'ack from old panel'); assert.equal(f.controller.getSnapshot().phoneEditing, true);
  assert.equal(f.controller.getSnapshot().phoneDraft, 'new editor draft'); assert.equal(f.controller.getSnapshot().changed, true);
});
test('phone and code failures use only source notice keys/error interpolation and preserve earlier changed result', async () => {
  const f = await ready(); edit(f); await f.controller.savePhone(detail()); f.deps.savePhone = async () => { throw new Error('phone failure'); };
  f.controller.editPhone(); await f.controller.savePhone(detail()); assert.equal(f.controller.getSnapshot().notice.key, 'detail.phone_save_failed'); assert.equal(f.controller.getSnapshot().notice.values.error.message, 'phone failure');
  f.deps.regenerate = async () => { throw new Error('code failure'); }; await f.controller.regenerate(); assert.equal(f.controller.getSnapshot().notice.key, 'detail.code_update_failed');
  assert.equal(f.controller.getSnapshot().changed, true); assert.equal(f.controller.getSnapshot().regeneratingCode, false);
});
test('code_locked and retry seconds do not disable source regenerate; countdown keeps immutable detail wait value static', async () => {
  const f = await ready({ detail: async () => detail({ code_locked: true, code_retry_after_sec: 3 }) }); f.controller.expand(true, detail());
  f.clock.advance(1000); assert.equal(f.controller.getSnapshot().retryAfterSec, 2); assert.equal(f.controller.getSnapshot().detail.code_retry_after_sec, 3);
  await f.controller.regenerate(); assert.ok(f.calls.includes('regenerate')); assert.equal(f.clock.size(), 0); f.controller.dispose();
});
test('copy writes raw source code and shows copied notice only after clipboard completion under original authority', async () => {
  const wait = deferred(), f = await ready({ copy: value => { f.calls.push(['copy', value]); return wait.promise; } }); f.controller.expand(true, detail());
  const pending = f.controller.copy(' raw\ncode '); assert.equal(f.controller.getSnapshot().notice, null); wait.resolve(true); await pending;
  assert.deepEqual(f.calls.at(-1), ['copy', ' raw\ncode ']); assert.equal(f.controller.getSnapshot().notice.key, 'detail.code_copied');
  const bad = await ready({ copy: async () => { throw new Error('clipboard'); } }); bad.controller.expand(true, detail()); await assert.rejects(bad.controller.copy('code'), /clipboard/); assert.equal(bad.controller.getSnapshot().notice, null);
  const failed = await ready({ copy: async () => false }); failed.controller.expand(true, detail()); await assert.rejects(failed.controller.copy('code'), /Clipboard write failed/); assert.equal(failed.controller.getSnapshot().notice, null);
});
for (const stage of ['detail', 'warehouses', 'responsibilities', 'profile', 'phone', 'regenerate', 'copy']) test(`retirement during ${stage} scrubs all detail secrets and blocks stale success/continuation`, async () => {
  const wait = deferred(), f = fixture({ kind: stage === 'warehouses' || stage === 'responsibilities' ? 'tayyorlovMasteri' : 'worker', role: stage === 'warehouses' || stage === 'responsibilities' ? 'tayyorlov_masteri' : 'aparatchi' });
  let pending;
  if (['detail', 'warehouses', 'responsibilities', 'profile'].includes(stage)) { f.deps[stage] = () => wait.promise; f.controller.start(); await tick(); }
  else { f.controller.start(); await tick(); edit(f); f.deps[stage === 'phone' ? 'savePhone' : stage] = () => wait.promise; pending = stage === 'phone' ? f.controller.savePhone(detail()) : stage === 'regenerate' ? f.controller.regenerate() : f.controller.copy('code'); }
  const rejection = stage === 'copy' ? assert.rejects(pending, /session changed/) : null; f.retire(); wait.resolve(stage === 'detail' || stage === 'regenerate' ? detail() : stage === 'profile' ? profile() : stage === 'phone' ? 'ack' : []);
  if (rejection) await rejection; else if (pending) await pending; await tick();
  const state = f.controller.getSnapshot(); assert.equal(state.phase, 'invalidated'); assert.equal(state.detail, null); assert.equal(state.phoneDraft, ''); assert.equal(state.notice, null); assert.deepEqual(state.warehouses, []);
});
test('retry countdown publication can retire synchronously before secret install, profile reads or timer scheduling', async () => {
  const f = fixture({ detail: async () => detail({ code_retry_after_sec: 4 }) }); f.controller.subscribe(() => { if (f.controller.getSnapshot().retryAfterSec > 0) f.retire(); });
  f.controller.start(); await tick(); assert.equal(f.controller.getSnapshot().phase, 'invalidated'); assert.equal(f.controller.getSnapshot().detail, null); assert.equal(f.clock.size(), 0);
  assert.equal(f.calls.includes('profile'), false);
});
test('dispose/restart invalidates old completion and restarts same owner; original retirement remains sticky', async () => {
  const wait = deferred(), f = fixture({ detail: () => wait.promise }); f.controller.start(); const generation = f.controller.interactionGeneration;
  f.controller.dispose(); f.deps.detail = async () => detail({ code: 'fresh' }); f.controller.start(); await tick(); wait.resolve(detail({ code: 'old' })); await tick();
  assert.notEqual(f.controller.interactionGeneration, generation); assert.equal(f.controller.getSnapshot().detail.code, 'fresh');
  f.retire(); await f.controller.reload(); f.controller.dispose(); f.controller.start(); assert.equal(f.controller.isCurrent(), false);
});
for (const operation of ['detail', 'profile']) test(`source15second ${operation} timeout expires original read guard/witness and rejects late body continuation`, async () => {
  const waiting = deferred(); let guard, witness;
  const f = fixture({ timeout: undefined, [operation]: (check, readWitness) => { guard = check; witness = readWitness; return waiting.promise; } });
  f.controller.start(); await tick(); assert.equal(witness(), true); f.clock.advance(14_999); await tick(); assert.equal(witness(), true);
  f.clock.advance(1); await tick(); assert.throws(guard, /load changed/); assert.throws(witness, /load changed/);
  assert.equal(f.controller.getSnapshot()[operation === 'detail' ? 'loadError' : 'profileError'], true);
  waiting.resolve(operation === 'detail' ? detail({ code: 'late' }) : profile()); await tick();
  if (operation === 'detail') assert.equal(f.controller.getSnapshot().detail, null); else assert.equal(f.controller.getSnapshot().profile, null);
  assert.equal(f.clock.size(), 0);
});
test('successful load and profile settlement expire their captured read guard/witness', async () => {
  const guards = [], witnesses = [], f = fixture({ detail: async (guard, witness) => { guards.push(guard); witnesses.push(witness); return detail(); },
    profile: async (guard, witness) => { guards.push(guard); witnesses.push(witness); return profile(); } });
  f.controller.start(); await tick(); assert.equal(guards.length, 2); for (const guard of [...guards, ...witnesses]) assert.throws(guard, /load changed/);
});
for (const stop of ['dispose', 'invalidate']) test(`${stop} cancels and settles pending15second waits immediately while preserving rejection observation`, async () => {
  const wait = deferred(), f = fixture({ timeout: undefined, detail: () => wait.promise }); f.controller.start(); assert.equal(f.clock.size(), 1);
  f.controller[stop](); assert.equal(f.clock.size(), 0); await tick();
  if (stop === 'dispose') { f.deps.detail = async () => detail({ code: 'new' }); f.controller.start(); await tick(); assert.equal(f.controller.getSnapshot().detail.code, 'new'); }
  wait.reject(Error('late body failure')); await tick(); assert.equal(f.clock.size(), 0); assert.equal(f.controller.getSnapshot().notice, null);
});
