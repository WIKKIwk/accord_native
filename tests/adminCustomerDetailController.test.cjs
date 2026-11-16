const assert = require('node:assert/strict');
const test = require('node:test');
const { load, strings, deferred, flush } = require('./adminUsersSupport.cjs');
const strict = load('shared/camera/synchronousGuard'), mobile = load('shared/mobileApiException');
const catalog = load('shared/catalogApi', { '../authorizedFetch': {}, '../appPreferences': {}, './mobileApiException': mobile, './searchActivityStore': { SearchActivityStore: class {} } });
const model = load('admin/adminCustomerDetailModel', { '../shared/catalogApi': catalog, './dartJsonString': strings });
const { AdminCustomerDetailController } = load('admin/adminCustomerDetailController', { '../shared/catalogApi': catalog, '../shared/mobileApiException': mobile, '../shared/camera/synchronousGuard': strict,
  './adminCustomerDetailModel': model, './dartJsonString': strings });
const item = (code, name = code) => catalog.supplierItemFromJson({ code, name });
const value = (patch = {}) => model.adminCustomerDetailFromJson({ ref: 'dto ref', name: 'Customer', phone: 'old', code: ' raw code ', code_locked: true, code_retry_after_sec: 3, assigned_items: [item('A')], assigned_item_groups: ['Rulon'], assigned_warehouses: ['W1'], ...patch });
function fixture(overrides = {}) {
  let valid = true; const calls = [], ticks = new Set();
  const deps = { isCurrent: () => valid, mode: { management: true, items: true, remove: true, material: false },
    read: async (guard, witness) => { guard(); assert.equal(witness(), true); calls.push('read'); return value(); },
    phone: async (detail, phone, guard) => { guard(); calls.push(['phone', detail.ref, phone]); return value({ phone, code_retry_after_sec: 8 }); },
    regenerate: async guard => { guard(); calls.push('regen'); return value({ code: 'regenerated', code_retry_after_sec: 7 }); },
    remove: async guard => { guard(); calls.push('remove'); }, items: async (guard, witness) => { guard(); assert.equal(witness(), true); return [item('A'), item('a'), item('B')]; },
    assign: async (selected, guard) => { guard(); calls.push(['assign', selected.code]); return value({ assigned_items: [item('A'), selected], code_retry_after_sec: 99 }); },
    unassign: async (selected, guard) => { guard(); calls.push(['unassign', selected.code]); return value({ assigned_items: [], code_retry_after_sec: 99 }); },
    groups: async (guard, witness) => { guard(); assert.equal(witness(), true); calls.push('groups'); return ['Kley', ' Rulon ']; },
    updateGroups: async (detail, groups, guard, witness) => { guard(); assert.equal(witness(), true); calls.push(['groups update', detail.ref, groups]); return value({ assigned_item_groups: groups }); },
    copy: async (code, guard) => { guard(); calls.push(['copy', code]); }, everySecond: callback => { ticks.add(callback); return callback; }, cancelTimer: callback => ticks.delete(callback), ...overrides };
  const controller = new AdminCustomerDetailController(deps);
  return { controller, deps, calls, ticks, retire: () => { valid = false; }, restore: () => { valid = true; }, tick: () => [...ticks].forEach(fn => fn()), start: async () => { controller.start(); await flush(); } };
}
test('customer keeps the fallback card interactive during loading and a pending original read may replace an earlier phone acknowledgment', async () => {
  const read = deferred(), f = fixture({ read: async () => read.promise }); f.controller.start(); f.controller.toggle(); assert.equal(f.controller.getSnapshot().expanded, true);
  const fallback = value({ ref: 'widget raw ref', name: 'Loading...', phone: 'Loading...' }); await f.controller.savePhone(fallback, ' 123 ');
  assert.equal(f.controller.getSnapshot().loading, true); assert.equal(f.controller.getSnapshot().detail.phone, '123'); assert.deepEqual(f.calls[0], ['phone', 'widget raw ref', '123']);
  read.resolve(value({ name: 'Loaded last' })); await flush(); assert.equal(f.controller.getSnapshot().loading, false); assert.equal(f.controller.getSnapshot().detail.name, 'Loaded last');
});
test('customer phone resets countdown and resolves after empty input/failure so a still-mounted child editor closes', async () => {
  const f = fixture(); await f.start(); const detail = f.controller.getSnapshot().detail; f.tick(); assert.equal(f.controller.getSnapshot().seconds, 2);
  assert.equal(await f.controller.savePhone(detail, '\u0085 123 \u0085'), true); assert.equal(f.controller.getSnapshot().seconds, 8); assert.equal(f.controller.getSnapshot().changed, true);
  const before = f.calls.length; assert.equal(await f.controller.savePhone(detail, ' '), true); assert.equal(f.calls.length, before);
  f.deps.phone = async () => { throw Error('offline'); }; assert.equal(await f.controller.savePhone(detail, '456'), true); assert.equal(f.controller.getSnapshot().notice.key, 'detail.phone_save_failed'); assert.equal(f.controller.getSnapshot().savingPhone, false);
});
test('regeneration ignores locked/positive-wait values; failures preserve existing loadError and use source notice', async () => {
  const f = fixture(); await f.start(); await f.controller.regenerate(); assert.equal(f.controller.getSnapshot().seconds, 7);
  f.deps.read = async () => { throw Error('read failed'); }; await f.controller.reload(); const error = f.controller.getSnapshot().loadError; assert.ok(error);
  await f.controller.regenerate(); assert.equal(f.controller.getSnapshot().loadError, error); assert.equal(f.controller.getSnapshot().detail.code, 'regenerated');
  f.deps.regenerate = async () => { throw Error('regen failed'); }; await f.controller.regenerate(); assert.equal(f.controller.getSnapshot().notice.key, 'detail.code_update_failed'); assert.equal(f.controller.getSnapshot().regenerating, false);
});
test('phone/regenerate/item operations are independent and only phone/regenerate acknowledgments reset countdown', async () => {
  const phone = deferred(), regen = deferred(), assign = deferred(), f = fixture({ phone: async () => phone.promise, regenerate: async () => regen.promise, assign: async () => assign.promise }); await f.start();
  const detail = f.controller.getSnapshot().detail, a = f.controller.savePhone(detail, '123'), b = f.controller.regenerate(), c = f.controller.assignItem(item('B'));
  assert.deepEqual(['savingPhone', 'regenerating', 'addingItem'].map(key => f.controller.getSnapshot()[key]), [true, true, true]);
  regen.resolve(value({ code: 'regenerated', code_retry_after_sec: 6 })); await b; assign.resolve(value({ code: 'old item response', code_retry_after_sec: 99 })); await c;
  assert.equal(f.controller.getSnapshot().seconds, 6); assert.equal(f.controller.getSnapshot().detail.code, 'old item response');
  phone.resolve(value({ code: 'last phone', code_retry_after_sec: 8 })); await a; assert.equal(f.controller.getSnapshot().seconds, 8); assert.equal(f.controller.getSnapshot().detail.code, 'last phone');
});
test('source item Add excludes exact captured codes without sorting and keeps the original detail snapshot through the catalog await', async () => {
  const pending = deferred(), f = fixture({ items: async () => pending.promise }); await f.start(); const original = f.controller.getSnapshot().detail, loading = f.controller.availableItems();
  await f.controller.assignItem(item('B')); pending.resolve([item('B'), item('a'), item('A'), item('C')]); const result = await loading;
  assert.equal(result.detail, original); assert.deepEqual(result.items.map(item => item.code), ['B', 'a', 'C']); assert.equal(f.controller.getSnapshot().notice, null);
  f.deps.items = async () => [item('A'), item('B')]; assert.equal(await f.controller.availableItems(), null); assert.equal(f.controller.getSnapshot().notice.key, 'detail.no_items');
});
test('different Add rows can run concurrently and retain the original source boolean busy behavior', async () => {
  const first = deferred(), second = deferred(), f = fixture({ assign: selected => selected.code === 'B' ? first.promise : second.promise }); await f.start();
  const a = f.controller.assignItem(item('B')), b = f.controller.assignItem(item('C')); first.resolve(value({ assigned_items: [item('B')] })); assert.equal(await a, true);
  assert.equal(f.controller.getSnapshot().addingItem, false, 'source flag is cleared by first settlement while second is pending');
  second.resolve(value({ assigned_items: [item('C')] })); assert.equal(await b, true); assert.deepEqual(f.controller.getSnapshot().detail.assigned_items.map(item => item.code), ['C']);
});
test('remove customer/item authentic prompts preserve distinct failures, confirmed deletion and countdown behavior', async () => {
  const f = fixture(); await f.start(); f.controller.requestRemove(item('A')); const unlink = f.controller.getSnapshot().prompt; assert.equal(unlink.kind, 'item'); assert.equal(await f.controller.confirmRemove({ ...unlink }), false);
  assert.equal(await f.controller.confirmRemove(unlink), true); assert.deepEqual(f.calls.at(-1), ['unassign', 'A']); assert.equal(f.controller.getSnapshot().seconds, 3); assert.equal(f.controller.getSnapshot().removingItemCode, null);
  f.deps.remove = async () => { throw Error('delete failed'); }; f.controller.requestRemove(); const failed = f.controller.getSnapshot().prompt; assert.equal(await f.controller.confirmRemove(failed), false); assert.equal(f.controller.getSnapshot().notice.key, 'detail.customer_remove_failed'); assert.equal(f.controller.getSnapshot().removed, false);
  f.deps.remove = async guard => { guard(); f.calls.push('removed'); }; f.controller.requestRemove(); assert.equal(await f.controller.confirmRemove(f.controller.getSnapshot().prompt), true); assert.equal(f.controller.getSnapshot().removed, true); assert.equal(f.ticks.size, 0);
  const before = f.calls.length; await f.controller.regenerate(); await f.controller.reload(); assert.equal(f.calls.length, before);
});
test('dismissed/replaced prompts and repeated native remove events cannot authorize another operation', async () => {
  const f = fixture(); await f.start(); f.controller.requestRemove(item('A')); const old = f.controller.getSnapshot().prompt; f.controller.requestRemove(); assert.equal(f.controller.getSnapshot().prompt, old);
  f.controller.dismissPrompt(old); f.controller.requestRemove(); const latest = f.controller.getSnapshot().prompt; assert.equal(await f.controller.confirmRemove(old), false); assert.equal(f.controller.getSnapshot().prompt, latest);
});
test('material group picker merges normalized source choices, holds busy while open and confirms by reread rather than write DTO', async () => {
  const picked = deferred(), f = fixture({ mode: { management: true, items: false, remove: false, material: true } }); await f.start();
  let choices; const editing = f.controller.editGroups(async value => { choices = value; return picked.promise; }); await flush();
  assert.deepEqual(choices.available, ['Kley', 'Rulon']); assert.deepEqual(choices.selected, ['Rulon']); assert.equal(choices.isCurrent(), true); assert.equal(f.controller.getSnapshot().editingGroups, true);
  f.deps.read = async () => value({ assigned_item_groups: ['Kley', 'Rulon'], code_retry_after_sec: 11 }); picked.resolve([' RULON ', 'Kley']); await editing;
  assert.deepEqual(f.calls.at(-1), ['groups update', 'dto ref', ['Kley', 'RULON']]); assert.equal(f.controller.getSnapshot().seconds, 11); assert.equal(f.controller.getSnapshot().notice.key, 'detail.groups_saved'); assert.equal(f.controller.getSnapshot().editingGroups, false);
});
test('group cancel/unchanged/no choices skips write; confirmation mismatch preserves old detail but retains source reread countdown', async () => {
  const f = fixture({ mode: { management: true, items: false, remove: false, material: true } }); await f.start(); const original = f.controller.getSnapshot().detail;
  await f.controller.editGroups(async () => null); await f.controller.editGroups(async () => [' rulon ']); assert.equal(f.controller.getSnapshot().changed, false); assert.equal(f.calls.filter(Array.isArray).length, 0);
  f.deps.read = async () => value({ assigned_item_groups: ['wrong'], code_retry_after_sec: 12 }); await f.controller.editGroups(async () => ['Kley']);
  assert.equal(f.controller.getSnapshot().detail, original); assert.equal(f.controller.getSnapshot().changed, false); assert.equal(f.controller.getSnapshot().seconds, 12);
  const notice = f.controller.getSnapshot().notice; assert.equal(notice.key, 'detail.groups_save_failed'); assert.equal(notice.operationError, true); assert.equal(notice.error.code, 'material_item_groups_not_confirmed');
  const empty = fixture({ mode: f.deps.mode, read: async () => value({ assigned_item_groups: [] }), groups: async () => [] }); await empty.start(); let opened = false; await empty.controller.editGroups(async () => { opened = true; return []; }); assert.equal(opened, false); assert.equal(empty.controller.getSnapshot().notice.key, 'detail.no_groups');
});
test('material warehouse editor changes only the latest detail scope and loadDetail alone does not replace the parent snapshot', async () => {
  const f = fixture({ mode: { management: true, items: false, remove: false, material: true } }); await f.start(); const original = f.controller.getSnapshot().detail;
  f.deps.read = async () => value({ name: 'Server changed', assigned_warehouses: ['W2'], code_retry_after_sec: 9 }); const detail = await f.controller.loadDetail(); assert.equal(detail.name, 'Server changed'); assert.equal(f.controller.getSnapshot().detail, original);
  f.controller.warehousesChanged(detail.assigned_warehouses); assert.equal(f.controller.getSnapshot().detail.name, 'Customer'); assert.deepEqual(f.controller.getSnapshot().detail.assigned_warehouses, ['W2']); assert.equal(f.controller.getSnapshot().changed, true); assert.equal(f.controller.getSnapshot().seconds, 9);
});
test('management/item/remove/material enable rules refuse hidden commands without changing the read-only card', async () => {
  const readOnly = fixture({ mode: { management: false, items: true, remove: true, material: true } }); await readOnly.start(); const dto = readOnly.controller.getSnapshot().detail;
  readOnly.controller.toggle(); assert.equal(await readOnly.controller.savePhone(dto, '123'), false); await readOnly.controller.regenerate(); await readOnly.controller.assignItem(item('B')); readOnly.controller.requestRemove(); await readOnly.controller.copy(dto.code);
  await readOnly.controller.editGroups(async () => ['Kley']); readOnly.controller.warehousesChanged(['W2']); assert.deepEqual(readOnly.calls, ['read']); assert.equal(readOnly.controller.getSnapshot().detail, dto);
  const material = fixture({ mode: { management: true, items: false, remove: false, material: true } }); await material.start(); await material.controller.assignItem(item('B')); material.controller.requestRemove(); assert.equal(await material.controller.availableItems(), null); assert.equal(material.controller.getSnapshot().prompt, null); assert.deepEqual(material.calls, ['read']);
});
test('raw copy notice follows native acknowledgment and independently dismisses only its own serial', async () => {
  const f = fixture(); await f.start(); await f.controller.copy(' raw code '); assert.deepEqual(f.calls.at(-1), ['copy', ' raw code ']); const old = f.controller.getSnapshot().notice;
  await f.controller.copy('new'); f.controller.dismissNotice(old.serial); assert.notEqual(f.controller.getSnapshot().notice.serial, old.serial); f.controller.dismissNotice(f.controller.getSnapshot().notice.serial); assert.equal(f.controller.getSnapshot().notice, null);
});
test('genuine apparatus-card return marks its original management owner changed without modifying profile or scopes', async () => {
  const f = fixture(); await f.start(); const detail = f.controller.getSnapshot().detail; f.controller.apparatusChanged();
  assert.equal(f.controller.getSnapshot().changed, true); assert.equal(f.controller.getSnapshot().detail, detail);
  const readonly = fixture({ mode: { management: false, items: false, remove: false, material: false } }); await readonly.start(); readonly.controller.apparatusChanged(); assert.equal(readonly.controller.getSnapshot().changed, false);
  f.retire(); f.controller.apparatusChanged(); assert.equal(f.controller.getSnapshot().valid, false); assert.equal(f.controller.getSnapshot().changed, false);
});
test('15-second source load timeout expires its request witness and does not admit a late body', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] }); const pending = deferred(); let readGuard;
  const f = fixture({ read: (guard) => { readGuard = guard; return pending.promise; } }); f.controller.start(); t.mock.timers.tick(14999); await Promise.resolve(); assert.equal(f.controller.getSnapshot().loading, true);
  t.mock.timers.tick(1); await flush(); assert.equal(f.controller.getSnapshot().loading, false); assert.equal(String(f.controller.getSnapshot().loadError), 'Exception: Customer detail timeout'); assert.throws(readGuard, /settled/);
  pending.resolve(value({ name: 'Late' })); await flush(); assert.equal(f.controller.getSnapshot().detail, null); f.controller.dispose();
});
test('retirement during group picker or any command suppresses later effects and scrubs detail/prompts/timers', async () => {
  const picked = deferred(), f = fixture({ mode: { management: true, items: false, remove: false, material: true } }); await f.start(); const editing = f.controller.editGroups(() => picked.promise); await flush(); f.retire(); picked.resolve(['Kley']); await editing;
  assert.equal(f.controller.getSnapshot().valid, false); assert.equal(f.controller.getSnapshot().detail, null); assert.equal(f.ticks.size, 0); assert.equal(f.calls.some(Array.isArray), false);
  for (const operation of ['phone', 'regenerate', 'assign', 'copy', 'remove']) {
    const pending = deferred(), x = fixture(); await x.start(); x.deps[operation] = async () => pending.promise;
    const result = operation === 'phone' ? x.controller.savePhone(x.controller.getSnapshot().detail, '123') : operation === 'assign' ? x.controller.assignItem(item('B')) : operation === 'copy' ? x.controller.copy('code') : operation === 'remove' ? (x.controller.requestRemove(), x.controller.confirmRemove(x.controller.getSnapshot().prompt)) : x.controller.regenerate();
    x.retire(); pending.resolve(value()); await result.catch(() => {}); assert.equal(x.controller.getSnapshot().valid, false, operation); assert.equal(x.controller.getSnapshot().notice, null); assert.equal(x.ticks.size, 0); x.restore(); x.controller.start(); assert.equal(x.controller.getSnapshot().valid, false);
  }
});
test('dispose cancels pending load timeout and StrictMode reattachment rejects the original read lifetime', async () => {
  const reads = [], f = fixture({ read: (guard, witness) => { const pending = deferred(); reads.push({ pending, guard, witness }); return pending.promise; } });
  f.controller.start(); f.controller.dispose(); f.controller.start(); assert.throws(reads[0].guard); assert.throws(reads[0].witness); reads[0].pending.resolve(value({ name: 'Old' })); reads[1].pending.resolve(value({ name: 'New' })); await flush(); assert.equal(f.controller.getSnapshot().detail.name, 'New'); f.controller.dispose();
});
test('malformed current predicates and synchronous retirement at busy/success publication cannot send or install a stale notice', async () => {
  const bad = fixture({ isCurrent: () => Promise.reject(Error('async')) }); await bad.start(); assert.deepEqual(bad.calls, []);
  const f = fixture(); await f.start(); f.controller.subscribe(() => { if (f.controller.getSnapshot().savingPhone) f.retire(); }); await f.controller.savePhone(f.controller.getSnapshot().detail, '123'); assert.deepEqual(f.calls, ['read']); assert.equal(f.controller.getSnapshot().valid, false);
  const x = fixture({ mode: { management: true, items: false, remove: false, material: true } }); await x.start(); x.deps.read = async () => value({ assigned_item_groups: ['Kley'] });
  x.controller.subscribe(() => { if (x.controller.getSnapshot().changed) { x.retire(); x.controller.isCurrent(); } }); await x.controller.editGroups(async () => ['Kley']); assert.equal(x.controller.getSnapshot().valid, false); assert.equal(x.controller.getSnapshot().notice, null);
});
