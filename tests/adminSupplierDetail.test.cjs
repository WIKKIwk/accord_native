const assert = require('node:assert/strict');
const test = require('node:test');
const { load, strings, checked, deferred, flush } = require('./adminUsersSupport.cjs');
const strict = load('shared/camera/synchronousGuard'), uri = load('admin/dartUri');
const catalog = load('shared/catalogApi', { '../authorizedFetch': {}, '../appPreferences': {}, './mobileApiException': {}, './searchActivityStore': { SearchActivityStore: class {} } });
const model = load('admin/adminSupplierDetailModel', { '../shared/catalogApi': catalog });
const { AdminSupplierDetailController } = load('admin/adminSupplierDetailController', { '../shared/camera/synchronousGuard': strict, './dartJsonString': strings });
const value = (patch = {}) => model.adminSupplierDetailFromJson({ ref: 'resolved ref', name: 'Supplier', phone: ' original phone ', code: ' raw code ', code_locked: true, code_retry_after_sec: 3, ...patch });
function fixture(overrides = {}) {
  let current = true; const calls = [], ticks = new Set();
  const deps = { isCurrent: () => current, readOnly: false,
    read: async (guard, witness) => { guard(); assert.equal(witness(), true); calls.push('read'); return value(); },
    status: async (detail, blocked, guard) => { guard(); calls.push(['status', detail.ref, blocked]); return value({ blocked, code: 'status code', code_retry_after_sec: 88 }); },
    phone: async (detail, phone, guard) => { guard(); calls.push(['phone', detail.ref, phone]); return value({ phone, code: 'phone code', code_retry_after_sec: 99 }); },
    regenerate: async guard => { guard(); calls.push('regen'); return value({ code: 'regenerated', code_retry_after_sec: 7 }); },
    remove: async guard => { guard(); calls.push('remove'); }, copy: async (code, guard) => { guard(); calls.push(['copy', code]); },
    everySecond: callback => { ticks.add(callback); return callback; }, cancelTimer: callback => ticks.delete(callback), ...overrides };
  const controller = new AdminSupplierDetailController(deps);
  return { controller, deps, calls, ticks, retire: () => { current = false; }, restore: () => { current = true; },
    tick: () => [...ticks].forEach(callback => callback()), start: async () => { controller.start(); await flush(); } };
}
test('supplier DTO keeps source defaults, strict nullable fields and shared assigned-item parser', () => {
  assert.deepEqual(model.adminSupplierDetailFromJson({}), { ref: '', name: '', phone: '', avatar_url: '', code: '', blocked: false, removed: false, code_locked: false, code_retry_after_sec: 0, assigned_items: [] });
  const dto = value({ assigned_items: [{ code: 'C', name: 'Item', requires_dimensions: true, order_apparatus_options: { A: 42 }, order_microns: [10, '20'], customer_names: [' Customer ', ''] }] });
  assert.deepEqual(dto.assigned_items[0], catalog.supplierItemFromJson({ code: 'C', name: 'Item', requires_dimensions: true, order_apparatus_options: { A: 42 }, order_microns: [10, '20'], customer_names: [' Customer ', ''] }));
  for (const patch of [{ ref: 1 }, { blocked: 'true' }, { removed: 0 }, { code_locked: 1 }, { code_retry_after_sec: 1.2 }, { assigned_items: {} }, { assigned_items: [null] }]) assert.throws(() => value(patch), TypeError);
  assert.throws(() => model.adminSupplierDetailFromJson([]), TypeError); assert.equal(value({ code_retry_after_sec: -3 }).code_retry_after_sec, -3);
});
test('supplier initial load fills detail and countdown atomically; retry countdown is periodic and only read/regenerate resets it', async () => {
  const f = fixture(); const contents = []; f.controller.subscribe(() => { const state = f.controller.getSnapshot(); if (state.phase === 'content') contents.push(state.seconds); });
  await f.start(); assert.equal(contents[0], 3); f.tick(); assert.equal(f.controller.getSnapshot().seconds, 2);
  await f.controller.toggleBlocked(f.controller.getSnapshot().detail); assert.equal(f.controller.getSnapshot().seconds, 2);
  await f.controller.savePhone(f.controller.getSnapshot().detail, '123'); assert.equal(f.controller.getSnapshot().seconds, 2);
  await f.controller.regenerate(); assert.equal(f.controller.getSnapshot().seconds, 7);
  for (let i = 0; i < 9; i++) f.tick(); assert.equal(f.controller.getSnapshot().seconds, 0); assert.equal(f.ticks.size, 0);
});
test('phone trims only at source command boundary, skips empty input and resolves handled on failure so the local editor closes', async () => {
  const f = fixture(); await f.start(); const detail = f.controller.getSnapshot().detail;
  assert.equal(await f.controller.savePhone(detail, '\u0085 \u0085'), true); assert.deepEqual(f.calls, ['read']);
  assert.equal(await f.controller.savePhone(detail, '\u0085 123 \u0085'), true); assert.deepEqual(f.calls.at(-1), ['phone', 'resolved ref', '123']); assert.equal(f.controller.getSnapshot().changed, true);
  const failure = Error('offline'); f.deps.phone = async () => { throw failure; };
  assert.equal(await f.controller.savePhone(detail, '456'), true); assert.equal(f.controller.getSnapshot().savingPhone, false);
  assert.equal(f.controller.getSnapshot().notice.key, 'detail.phone_save_failed'); assert.equal(f.controller.getSnapshot().notice.error, failure);
  assert.equal(f.controller.getSnapshot().detail.phone, '123');
});
test('status/phone/regen/remove flags are independent and whole-DTO acknowledgments retain last-settlement source behavior', async () => {
  const status = deferred(), phone = deferred(), regen = deferred(), remove = deferred();
  const f = fixture({ status: async () => status.promise, phone: async () => phone.promise, regenerate: async () => regen.promise, remove: async () => remove.promise }); await f.start();
  const captured = f.controller.getSnapshot().detail;
  const a = f.controller.toggleBlocked(captured), b = f.controller.savePhone(captured, '123'), c = f.controller.regenerate();
  f.controller.requestRemove(); const prompt = f.controller.getSnapshot().removePrompt, d = f.controller.confirmRemove(prompt);
  assert.deepEqual(['savingStatus', 'savingPhone', 'regenerating', 'removing'].map(key => f.controller.getSnapshot()[key]), [true, true, true, true]);
  regen.resolve(value({ code: 'new code', code_retry_after_sec: 9 })); await c;
  phone.resolve(value({ code: 'old phone response code', phone: '123' })); await b;
  assert.equal(f.controller.getSnapshot().detail.code, 'old phone response code'); assert.equal(f.controller.getSnapshot().seconds, 9);
  status.resolve(value({ code: 'last status response', blocked: true })); await a; assert.equal(f.controller.getSnapshot().detail.phone, ' original phone ');
  remove.resolve(); assert.equal(await d, true); assert.equal(f.controller.getSnapshot().phase, 'removed'); assert.equal(f.controller.getSnapshot().changed, true); assert.equal(f.ticks.size, 0);
});
test('regenerate ignores code_locked and positive retry wait; no write success notices are invented', async () => {
  const f = fixture(); await f.start(); assert.equal(f.controller.getSnapshot().detail.code_locked, true); await f.controller.regenerate();
  assert.equal(f.controller.getSnapshot().detail.code, 'regenerated'); assert.equal(f.controller.getSnapshot().notice, null);
  const pending = deferred(); f.deps.regenerate = async () => pending.promise; const first = f.controller.regenerate(); await f.controller.regenerate(); pending.resolve(value()); await first;
  assert.equal(f.controller.getSnapshot().regenerating, false);
});
test('copy preserves raw code and only acknowledged copy emits a source notice; notice dismissal carries its own serial', async () => {
  const f = fixture(); await f.start(); await f.controller.copy(' raw code '); assert.deepEqual(f.calls.at(-1), ['copy', ' raw code ']);
  const first = f.controller.getSnapshot().notice; await f.controller.copy('other'); f.controller.dismissNotice(first.serial); assert.equal(f.controller.getSnapshot().notice.key, 'detail.code_copied');
  f.controller.dismissNotice(f.controller.getSnapshot().notice.serial); assert.equal(f.controller.getSnapshot().notice, null);
  const count = f.calls.length; await f.controller.copy(' '); assert.equal(f.calls.length, count);
  f.deps.copy = async () => { throw Error('clipboard'); }; await assert.rejects(f.controller.copy('code')); assert.equal(f.controller.getSnapshot().notice, null);
});
test('remove prompt identity prevents old dismissed and forged confirmations; failure leaves content/changed untouched', async () => {
  const f = fixture({ remove: async () => { throw Error('delete failed'); } }); await f.start(); f.controller.requestRemove(); const first = f.controller.getSnapshot().removePrompt;
  assert.equal(await f.controller.confirmRemove({ ...first }), false); f.controller.dismissRemove(first); f.controller.requestRemove(); const next = f.controller.getSnapshot().removePrompt;
  assert.equal(await f.controller.confirmRemove(first), false); assert.equal(f.controller.getSnapshot().removePrompt, next);
  await assert.rejects(f.controller.confirmRemove(next), /delete failed/); assert.equal(f.controller.getSnapshot().phase, 'content'); assert.equal(f.controller.getSnapshot().removing, false);
  assert.equal(f.controller.getSnapshot().changed, false); assert.equal(f.controller.getSnapshot().notice, null);
});
test('readOnly owner keeps detail visible and refuses every mutation, expansion and code-copy path', async () => {
  const f = fixture({ readOnly: true }); await f.start(); const detail = f.controller.getSnapshot().detail;
  f.controller.toggle(); await f.controller.toggleBlocked(detail); assert.equal(await f.controller.savePhone(detail, '123'), false); await f.controller.regenerate(); await f.controller.copy(detail.code); f.controller.requestRemove();
  assert.deepEqual(f.calls, ['read']); assert.equal(f.controller.getSnapshot().expanded, false); assert.equal(f.controller.getSnapshot().removePrompt, null); assert.equal(f.controller.getSnapshot().detail, detail);
});
test('source modal blocks repeated remove actions, including a synchronous publication listener', async () => {
  const f = fixture(); await f.start(); let publications = 0;
  f.controller.subscribe(() => { publications++; f.controller.requestRemove(); }); f.controller.requestRemove();
  assert.equal(publications, 1); const prompt = f.controller.getSnapshot().removePrompt; f.controller.requestRemove(); assert.equal(f.controller.getSnapshot().removePrompt, prompt);
});
test('failed read is retryable without inventing errors and retains changed/expanded after a real mutation', async () => {
  const f = fixture(); await f.start(); f.controller.toggle(); await f.controller.toggleBlocked(f.controller.getSnapshot().detail); f.deps.read = async () => { throw Error('read failed'); };
  await f.controller.reload(); assert.equal(f.controller.getSnapshot().phase, 'error'); assert.equal(f.controller.getSnapshot().changed, true); assert.equal(f.controller.getSnapshot().notice, null);
  f.deps.read = async () => value({ code_retry_after_sec: -2 }); await f.controller.reload(); assert.equal(f.controller.getSnapshot().expanded, true); assert.equal(f.controller.getSnapshot().seconds, 0);
});
test('retirement fences each awaiting effect and scrubs detail, prompt, notice and countdown without ABA revival', async () => {
  for (const operation of ['read', 'status', 'phone', 'regenerate', 'remove', 'copy']) {
    const pending = deferred(), f = fixture(); if (operation !== 'read') await f.start(); f.deps[operation] = async () => pending.promise;
    let result;
    if (operation === 'read') { f.controller.start(); result = Promise.resolve(); }
    else if (operation === 'status') result = f.controller.toggleBlocked(f.controller.getSnapshot().detail);
    else if (operation === 'phone') result = f.controller.savePhone(f.controller.getSnapshot().detail, '123');
    else if (operation === 'copy') result = f.controller.copy('code');
    else if (operation === 'remove') { f.controller.requestRemove(); result = f.controller.confirmRemove(f.controller.getSnapshot().removePrompt); }
    else result = f.controller.regenerate();
    f.retire(); pending.resolve(value()); await result.catch(() => {}); await flush();
    assert.equal(f.controller.getSnapshot().phase, 'invalidated', operation); assert.equal(f.controller.getSnapshot().detail, null); assert.equal(f.controller.getSnapshot().notice, null); assert.equal(f.ticks.size, 0);
    f.restore(); f.controller.start(); assert.equal(f.controller.getSnapshot().phase, 'invalidated');
  }
});
test('StrictMode cleanup reattachment replaces read generation and cannot install the original pending body', async () => {
  const reads = [], f = fixture({ read: (guard, witness) => { const result = deferred(); reads.push({ result, guard, witness }); return result.promise; } });
  f.controller.start(); f.controller.dispose(); f.controller.start(); assert.throws(reads[0].guard); assert.throws(reads[0].witness);
  reads[0].result.resolve(value({ name: 'Old' })); reads[1].result.resolve(value({ name: 'New' })); await flush(); assert.equal(f.controller.getSnapshot().detail.name, 'New'); f.controller.dispose();
});
test('invalid asynchronous/reentrant authority and retirement at busy publication suppress command dispatch', async () => {
  const invalid = fixture({ isCurrent: () => Promise.reject(Error('async')) }); await invalid.start(); assert.deepEqual(invalid.calls, []);
  const reentrant = fixture(); reentrant.deps.isCurrent = () => reentrant.controller.isCurrent(); await reentrant.start(); assert.deepEqual(reentrant.calls, []);
  const f = fixture(); await f.start(); const detail = f.controller.getSnapshot().detail; f.controller.subscribe(() => { if (f.controller.getSnapshot().savingStatus) f.retire(); });
  await assert.rejects(f.controller.toggleBlocked(detail)); assert.deepEqual(f.calls, ['read']); assert.equal(f.controller.getSnapshot().phase, 'invalidated');
});

function api(fetch) { return load('admin/adminSupplierDetailApi', { '../authorizedFetch': { authorizedFetch: fetch }, './adminProductionRequest': checked, './adminSupplierDetailModel': model, './dartUri': uri }); }
test('supplier API sends raw refs with Dart query encoding, exact methods/payloads and scoped read witness', async () => {
  const calls = [], guard = () => {}, witness = () => true;
  const a = api(async (session, path, init, check, timeout, options) => { check(); calls.push({ session, path, init, timeout, options }); return { status: 200, json: async () => value() }; });
  const session = {}, ref = " raw~*!'()& ref ";
  await a.adminSupplierDetail(session, ref, guard, witness); await a.adminSetSupplierBlocked(session, ref, true, guard); await a.adminUpdateSupplierPhone(session, ref, ' raw phone ', guard); await a.adminRegenerateSupplierCode(session, ref, guard); await a.adminRemoveSupplier(session, ref, guard);
  const suffix = '?ref=+raw~%2A%21%27%28%29%26+ref+';
  assert.deepEqual(calls.map(c => [c.path, c.init?.method ?? 'GET']), [['/v1/mobile/admin/suppliers/detail' + suffix, 'GET'], ['/v1/mobile/admin/suppliers/status' + suffix, 'PUT'], ['/v1/mobile/admin/suppliers/phone' + suffix, 'PUT'], ['/v1/mobile/admin/suppliers/code/regenerate' + suffix, 'POST'], ['/v1/mobile/admin/suppliers/remove' + suffix, 'DELETE']]);
  assert.deepEqual(JSON.parse(calls[1].init.body), { blocked: true }); assert.deepEqual(JSON.parse(calls[2].init.body), { phone: ' raw phone ' });
  assert.equal(calls[1].init.headers['Content-Type'], 'application/json'); assert.equal(calls[3].init.body, undefined); assert.equal(calls[4].init.body, undefined);
  assert.equal(calls[0].options.readWitness, witness); assert.equal(calls[0].timeout, 10000); assert.equal(calls[1].options, undefined);
  await assert.rejects(a.adminSupplierDetail(session, ref, undefined, witness), /guard/);
});
test('supplier non200 responses retain plain source Exception failures and DELETE success never decodes a body', async () => {
  const a = api(async () => ({ status: 409, json: async () => { throw Error('must not parse failure'); } }));
  const cases = [['adminSupplierDetail', ['r'], 'detail'], ['adminSetSupplierBlocked', ['r', true], 'status'], ['adminUpdateSupplierPhone', ['r', 'p'], 'phone update'], ['adminRegenerateSupplierCode', ['r'], 'code regenerate'], ['adminRemoveSupplier', ['r'], 'remove']];
  for (const [method, args, label] of cases) await assert.rejects(a[method]({}, ...args), error => String(error) === `Exception: Admin supplier ${label} failed`);
  const b = api(async () => ({ status: 200, json: async () => { throw Error('must not parse successful DELETE'); } })); await b.adminRemoveSupplier({}, 'r');
});
test('supplier API rechecks authorization after body/model failure and rejects stale/invalid guards before sending', async () => {
  let current = true, sends = 0; const guard = () => { if (!current) throw Error('retired'); };
  const a = api(async () => { sends++; return { status: 200, json: async () => { current = false; return value(); } }; });
  await assert.rejects(a.adminSupplierDetail({}, 'r', guard, () => true), /retired/); assert.equal(sends, 1);
  await assert.rejects(a.adminSetSupplierBlocked({}, 'r', true, guard), /retired/); assert.equal(sends, 1);
  await assert.rejects(a.adminRemoveSupplier({}, 'r', () => Promise.reject(Error('async'))), /Invalid admin guard/); assert.equal(sends, 1);
  current = true; const b = api(async () => ({ status: 200, json: async () => ({ get ref() { current = false; throw Error('bad model'); } }) }));
  await assert.rejects(b.adminSupplierDetail({}, 'r', guard, () => true), /retired/);
});

function sessionFixture(t, copy = async () => true) {
  const session = { token: 'token', profile: { role: 'admin' } }, witness = { session }, calls = [];
  let active = true, epoch = 1, scope = 'scope', allowed = true;
  const factory = load('admin/adminSupplierDetailSession', {
    'expo-clipboard': { setStringAsync: async text => { calls.push(['copy', text]); return copy(); } },
    '../auth': { activeSessionEpoch: () => active ? epoch : null, activeSessionToken: () => active ? session.token : null, isSessionWitnessCurrent: value => value === witness && active },
    '../sessionReadScope': { sessionReadScope: () => scope }, '../shared/appRoutes': { appRoutes: { adminSupplierDetail: '/detail' }, canOpenRoute: () => allowed },
    '../shared/camera/synchronousGuard': strict, './adminSupplierDetailController': { AdminSupplierDetailController }, './adminSupplierDetailApi': {
      adminSupplierDetail: async (_session, ref, guard, readWitness) => { guard(); assert.equal(readWitness(), true); calls.push(['read', ref]); return value({ code_retry_after_sec: 0 }); },
      adminSetSupplierBlocked: async (_session, ref, blocked, guard) => { guard(); calls.push(['status', ref, blocked]); return value({ blocked }); },
      adminUpdateSupplierPhone: async (_session, ref, phone, guard) => { guard(); calls.push(['phone', ref, phone]); return value({ phone }); },
      adminRegenerateSupplierCode: async (_session, ref, guard) => { guard(); calls.push(['regen', ref]); return value({ code_retry_after_sec: 0 }); },
      adminRemoveSupplier: async (_session, ref, guard) => { guard(); calls.push(['remove', ref]); },
    },
  });
  const owner = factory.createAdminSupplierDetailSession(session, witness, () => true, ' widget raw ref '); t.after(() => owner.controller.dispose());
  return { owner, calls, session, retire: () => { active = false; }, epoch: n => { epoch = n; }, scope: n => { scope = n; }, deny: () => { allowed = false; } };
}
test('real supplier factory preserves raw widget ref for read/regen/remove and captured DTO ref for phone/status', async t => {
  const f = sessionFixture(t); f.owner.controller.start(); await flush(); const detail = f.owner.controller.getSnapshot().detail;
  await f.owner.controller.savePhone(detail, '123'); await f.owner.controller.toggleBlocked(detail); await f.owner.controller.regenerate(); await f.owner.controller.copy(' raw code ');
  f.owner.controller.requestRemove(); assert.equal(await f.owner.controller.confirmRemove(f.owner.controller.getSnapshot().removePrompt), true);
  assert.deepEqual(f.calls, [['read', ' widget raw ref '], ['phone', 'resolved ref', '123'], ['status', 'resolved ref', true], ['regen', ' widget raw ref '], ['copy', ' raw code '], ['remove', ' widget raw ref ']]);
});
test('original supplier owner is sticky on epoch/scope/capability/token changes and clipboard false/stale acknowledgment fails', async t => {
  for (const change of [f => f.epoch(2), f => f.scope('other'), f => f.deny(), f => { f.session.token = 'test-mode-token'; }]) {
    const f = sessionFixture(t); f.owner.controller.start(); await flush(); change(f); assert.equal(f.owner.current(), false); f.epoch(1); f.scope('scope'); f.session.token = 'token'; assert.equal(f.owner.current(), false);
  }
  const failed = sessionFixture(t, async () => false); failed.owner.controller.start(); await flush(); await assert.rejects(failed.owner.controller.copy('code'), /Clipboard write failed/); assert.equal(failed.owner.controller.getSnapshot().notice, null);
  const pending = deferred(), stale = sessionFixture(t, async () => pending.promise); stale.owner.controller.start(); await flush(); const copying = stale.owner.controller.copy('code'); stale.retire(); pending.resolve(true); await assert.rejects(copying); assert.equal(stale.owner.controller.getSnapshot().notice, null);
});
