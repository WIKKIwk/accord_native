const assert = require('node:assert/strict');
const test = require('node:test');
const s = require('./adminUserCreateSupport.cjs');
function fixture(mode = 'general') {
  const session = { baseUrl: 'https://server.example', token: 'first', profile: { role: 'admin', ref: 'Original' }, capabilities: ['party.customer.manage'], assigned_apparatus: [], assigned_item_groups: [] };
  const witness = { session, generation: 4 }, listeners = new Set(), calls = [], services = {}, captures = []; let valid = true, epoch = 1, outer = () => true;
  const auth = { activeSessionEpoch: () => epoch, activeSessionToken: () => session.token || null, isSessionWitnessCurrent: value => valid && value === witness,
    subscribeSessionWitness: fn => { listeners.add(fn); return () => listeners.delete(fn); } };
  const cacheNamespace = s.load('admin/adminItemCreateCacheNamespace', { '../auth': auth, '../sessionReadScope': s.load('sessionReadScope') }), runtime = s.load('admin/adminItemCreateRuntime', {
    '../auth': { registerSessionResetHook() {} }, './adminItemCreateCache': s.load('admin/adminItemCreateCache') });
  const run = async (name, args, value) => { const guard = args.at(-1); guard(); calls.push([name, ...args.slice(0, -1)]); return services[name] ? services[name](...args) : value; };
  const module = s.load('admin/adminUserCreateSession', { 'expo-clipboard': { setStringAsync: async value => { calls.push(['clipboard', value]); return true; } }, '../apparatusApi': { adminApparatus: async (_session, options) => { captures.push(options.readWitness); options.beforeSend(); return []; } },
    '../auth': auth, '../sessionReadScope': s.load('sessionReadScope'), '../shared/appRoutes': s.routes, '../shared/profileSessionGuard': s.load('shared/profileSessionGuard'),
    './adminCustomerDetailApi': { adminCustomerUpsertRoleAssignment: (_session, value, guard) => run('assign', [value, guard]), adminRegenerateCustomerCode: (_session, ref, guard) => run('customer-code', [ref, guard], { code: 'CUS' }) },
    './adminSettings': { adminSettings: (_session, guard, readWitness) => { captures.push(readWitness); return run('settings', [guard], s.settings()); }, updateAdminSettings: (_session, value, guard) => run('settings-save', [value, guard], s.settings()) },
    './adminUsersRuntime': { adminUsersCache: { invalidate: () => calls.push(['invalidate']) } }, './adminItemCreateCacheNamespace': cacheNamespace, './adminItemCreateRuntime': runtime,
    './adminWerkaApi': { adminRegenerateWerkaCode: (_session, guard) => run('werka-code', [guard], s.settings()) },
    './adminWorkerDetailApi': { adminWorkerDetailRegenerateSystemCode: (_session, id, guard) => run('system-code', [id, guard], { code: 'SYS' }) }, './itemGroupApi': { adminItemGroups: (_session, guard, readWitness) => { captures.push(readWitness); return run('groups', [guard], []); } },
    './adminUserCreateApi': { readAdminUserCreateRoles: (_session, guard, readWitness) => { captures.push(readWitness); return run('roles', [guard], []); },
      createAdminUserCreateCustomer: (_session, name, phone, guard) => run('customer', [name, phone, guard], { ref: 'Ref', name: 'Created', phone }), createAdminUserCreateSupplier: (_session, name, phone, guard) => run('supplier', [name, phone, guard], { ref: 'Ref', name, phone, code: 'SUP' }),
      createAdminUserCreateMaterial: (_session, name, phone, groups, guard) => run('material', [name, phone, groups, guard], { code: 'MAT' }), createAdminUserCreateSystem: (_session, role, name, phone, guard) => run('system', [role, name, phone, guard], { id: 'ID' }) },
    './adminUserCreateController': { AdminUserCreateController: s.AdminUserCreateController } });
  const returned = [], props = { mode, session, witness, isCurrent: () => outer(), initialName: 'Initial' };
  const create = (callback = value => returned.push(value), givenProps = props) => module.createAdminUserCreateSession(givenProps, callback);
  return { session, witness, auth, calls, services, captures, props, returned, create, cacheNamespace, runtime,
    retire: () => { valid = false; listeners.forEach(fn => fn()); }, restore: () => { valid = true; }, epoch: value => { epoch = value; }, outer: value => { outer = value; } };
}
for (const boundary of ['scope', 'epoch', 'witness', 'permission', 'token', 'role']) test(`UserCreate captures original${boundary} and never revives retired authority`, () => {
  const f = fixture(), owner = f.create(); assert.equal(owner.current(), true);
  const undo = boundary === 'scope' ? (() => { f.session.assigned_item_groups.push('changed'); return () => { f.session.assigned_item_groups = []; }; })() : boundary === 'epoch' ? (() => { f.epoch(2); return () => f.epoch(1); })() :
    boundary === 'witness' ? (() => { f.retire(); return f.restore; })() : boundary === 'permission' ? (() => { f.session.capabilities = []; return () => { f.session.capabilities = ['party.customer.manage']; }; })() :
    boundary === 'token' ? (() => { f.session.token = ''; return () => { f.session.token = 'first'; }; })() : (() => { f.session.profile.role = 4; return () => { f.session.profile.role = 'admin'; }; })();
  assert.equal(owner.current(), false); undo(); assert.equal(owner.current(), false); owner.controller.start(); assert.equal(owner.controller.getSnapshot().valid, false); assert.deepEqual(f.calls, []);
});
test('customerOnly and sales-manager source variants skip every unrelated read; only explicit customer mode returns DTO', async () => {
  const f = fixture('customer'), owner = f.create(); owner.controller.start(); await s.flush(); assert.deepEqual(f.calls, []); assert.equal(owner.controller.currentFields.name, 'Initial'); owner.controller.change(owner.controller.getSnapshot().formId, 'name', 'Customer'); await owner.controller.save(owner.controller.getSnapshot().formId); assert.equal(f.returned[0].ref, 'Ref'); owner.controller.dispose();
  const g = fixture(); g.session.profile.role = 'sales_manager'; const sales = g.create(); sales.controller.start(); await s.flush(); assert.deepEqual(g.calls, []); assert.equal(sales.options.customerOnly, true); assert.equal(sales.options.returnCustomer, false); sales.controller.dispose();
});
test('original owner accepts token-only refresh but async/reentrant current cannot read or create', async () => {
  const f = fixture(), owner = f.create(); f.session.token = 'refreshed'; assert.equal(owner.current(), true);
  const g = fixture(); g.outer(() => Promise.reject(Error('async'))); const denied = g.create(); denied.controller.start(); await s.flush(); assert.equal(denied.controller.getSnapshot().valid, false); assert.deepEqual(g.calls, []);
  const h = fixture(); let nested; h.outer(() => { nested.current(); return true; }); nested = h.create(); assert.equal(nested.current(), false); await s.tick();
});
test('successful CustomerOnly creation clears the genuine scoped picker before return and expires late blank-page writers only', async () => {
  const f = fixture('customer'), cache = f.runtime.adminItemCreateMemoryCache, namespace = f.cacheNamespace.adminItemCreateCacheNamespace(f.session, f.witness);
  const ticket = cache.ticket(namespace, 'customers'), list = { query: 'old', group: '', items: [], hasMore: false };
  cache.writeCustomers(ticket, { items: [{ ref: 'Old', name: 'Old', phone: '' }], hasMore: true }); cache.writeList(cache.ticket(namespace), list);
  let atReturn; const owner = f.create(value => { atReturn = cache.readCustomers(namespace); f.returned.push(value); }); owner.controller.start(); await s.flush();
  await owner.controller.save(owner.controller.getSnapshot().formId);
  assert.equal(atReturn, null); assert.equal(f.returned.length, 1); assert.deepEqual(cache.readList(namespace), list);
  cache.writeCustomers(ticket, { items: [{ ref: 'Late', name: 'Late', phone: '' }], hasMore: false }); assert.equal(cache.readCustomers(namespace), null);
  owner.controller.dispose();
});
test('retired customer acknowledgement cannot invalidate a fresh owner picker; fresh success clears its own captured namespace', async () => {
  const f = fixture('customer'), cache = f.runtime.adminItemCreateMemoryCache, pending = s.deferred(); f.services.customer = async () => pending.promise;
  const old = f.create(); old.controller.start(); await s.flush(); const save = old.controller.save(old.controller.getSnapshot().formId);
  f.epoch(2); const namespace = f.cacheNamespace.adminItemCreateCacheNamespace(f.session, f.witness), ticket = cache.ticket(namespace, 'customers');
  const page = { items: [{ ref: 'New', name: 'New', phone: '' }], hasMore: true }; cache.writeCustomers(ticket, page);
  const fresh = f.create(); fresh.controller.start(); await s.flush(); pending.resolve({ ref: 'Late', name: 'Late', phone: '' }); await save;
  assert.deepEqual(cache.readCustomers(namespace), page); assert.deepEqual(f.returned, []); assert.equal(f.calls.some(value => value[0] === 'invalidate'), false);
  f.services.customer = async () => ({ ref: 'Fresh', name: 'Fresh', phone: '' }); await fresh.controller.save(fresh.controller.getSnapshot().formId);
  assert.equal(f.returned[0].ref, 'Fresh'); assert.equal(cache.readCustomers(namespace), null); cache.writeCustomers(ticket, page); assert.equal(cache.readCustomers(namespace), null);
  old.controller.dispose(); fresh.controller.dispose();
});
function hookFixture(t, mode = 'general', platform = 'android') {
  const f = fixture(mode); let focused = true, allowed = true, cursor = 0, pending = [], owner; const slots = [], handlers = new Set(), backs = [], owned = [];
  const same = (l, r) => !!l && !!r && l.length === r.length && l.every((value, i) => value === r[i]);
  const memo = (fn, deps) => { const index = cursor++, old = slots[index]; if (!old || !same(old.deps, deps)) slots[index] = { deps, value: fn() }; return slots[index].value; };
  const effect = (fn, deps) => { const index = cursor++, old = slots[index]; if (!old || !same(old.deps, deps)) { const next = { deps, create: fn, cleanup: old?.cleanup }; slots[index] = next; pending.push(() => { next.cleanup?.(); next.cleanup = fn(); }); } };
  const react = { useMemo: memo, useCallback: (fn, deps) => memo(() => fn, deps), useRef: value => memo(() => ({ current: value }), []), useSyncExternalStore: (_subscribe, get) => get(), useEffect: effect, useLayoutEffect: effect };
  const hook = s.load('admin/useAdminUserCreate', { react, 'expo-router': { useIsFocused: () => focused, useFocusEffect: fn => effect(fn, [fn]) },
    'react-native': { Platform: { OS: platform }, Keyboard: { dismiss: () => f.calls.push(['keyboard']) }, BackHandler: { addEventListener: (_event, fn) => { handlers.add(fn); return { remove: () => handlers.delete(fn) }; } } },
    '../auth': f.auth, '../shared/localization': s.l10n, '../shared/localization/runtime': { localeController: { locale: 'uz', addListener() { return () => {}; } } }, '../shared/profileSessionGuard': s.load('shared/profileSessionGuard'),
    './AdminOwnedBackContext': { useAdminOwnedBack: fn => { owned.push(fn); } }, './adminUserCreateModel': s.model, './dartJsonString': s.strings,
    './adminUserCreateSession': { createAdminUserCreateSession: (props, callback) => { owner = f.create(callback, props); return owner; } } }).useAdminUserCreate;
  const props = { ...f.props, canInteract: () => allowed, onCreated: value => f.returned.push(value), onBack: () => backs.push('back'), footer: null };
  const render = () => { let value; for (let i = 0; i < 6; i++) { cursor = 0; pending = []; value = hook(props); pending.splice(0).forEach(fn => fn()); if (value.state === owner.controller.getSnapshot()) return value; } throw Error('hook did not settle'); };
  const cleanup = () => slots.forEach(value => value?.cleanup?.()), replay = () => { cleanup(); slots.forEach(value => { if (value?.create) value.cleanup = value.create(); }); };
  t.after(() => { cleanup(); owner?.controller.dispose(); });
  return { ...f, props, render, cleanup, replay, handlers, backs, owned, owner: () => owner, focus: value => { focused = value; }, allowed: value => { allowed = value; } };
}
test('actual hook preserves accepted creation while owned POP gate rejects queued native fields/header/save', async t => {
  const f = hookFixture(t, 'customer'), pending = s.deferred(); f.services.customer = async () => pending.promise; let value = f.render(); await s.flush(); value = f.render(); value.changeName('Original'); value.save();
  f.allowed(false); const closing = f.render(), before = [...f.calls]; value.changeName('stale'); value.changePhone('stale'); value.rolePicker(); value.save(); value.copy(); value.regenerate(); value.back(); closing.back(); assert.deepEqual(f.calls, before); assert.deepEqual(f.backs, []);
  pending.resolve({ ref: 'Created', name: 'Created', phone: '' }); await s.flush(); assert.equal(f.returned[0].ref, 'Created'); assert.equal(f.owner().controller.currentFields.name, 'Original'); assert.equal(value.current(), true);
});
test('actual hook background read/issued save authority survives blur, then returns before focus without permitting new events', async t => {
  const f = hookFixture(t, 'customer'), pending = s.deferred(); f.services.customer = async () => pending.promise; f.render(); await s.flush(); const value = f.render(); value.changeName('Draft'); value.save(); f.focus(false); f.render(); const count = f.calls.length; value.changeName('Hidden'); value.save(); value.back(); assert.equal(f.calls.length, count);
  pending.resolve({ ref: 'Ref', name: 'Name', phone: '' }); await s.flush(); assert.equal(f.returned.length, 1); assert.equal(value.current(), true); f.focus(true); f.render().back(); assert.deepEqual(f.backs, ['back']);
});
test('accepted roles open on blur immediately and exact top modal callbacks work without authorizing hidden page events', async t => {
  const f = hookFixture(t), roles = s.deferred(); f.services.roles = async () => roles.promise; let value = f.render(); value.rolePicker();
  f.focus(false); f.allowed(false); f.render(); roles.resolve([]); await s.flush(); value = f.render(); const picker = value.state.picker; assert.ok(picker); assert.equal(value.nativeCurrent(), false);
  value.pickerSearch(picker.id, 'Supplier'); assert.equal(f.owner().controller.getSnapshot().picker.query, 'Supplier');
  const choice = value.state.choices.find(value => value.kind === 'supplier'); value.chooseRole(picker.id, choice); assert.equal(f.owner().controller.getSnapshot().picker.closing, true);
  value.completePicker(picker.id); value = f.render(); assert.equal(value.state.choice, choice); value.changeName('hidden'); value.save(); assert.deepEqual(f.calls.map(value => value[0]), ['roles', 'keyboard']);
  f.retire(); value.pickerSearch(picker.id, 'stale'); value.completePicker(picker.id); assert.equal(f.owner().controller.getSnapshot().valid, false);
});
test('issued code acknowledgement during blur opens immediately and retains original overlay authority until real dismissal', async t => {
  const f = hookFixture(t), pending = s.deferred(); f.services.supplier = async () => pending.promise; f.render(); await s.flush(); let value = f.render(); value.rolePicker(); await s.flush(); value = f.render();
  const picker = value.state.picker; value.chooseRole(picker.id, value.state.choices.find(value => value.kind === 'supplier')); value.completePicker(picker.id); value = f.render(); value.changeName('Supplier'); value.save();
  f.focus(false); f.allowed(false); f.render(); pending.resolve({ ref: 'Ref', name: 'Supplier', phone: '', code: 'ISSUED' }); await s.flush(); value = f.render(); const code = value.state.issuedCode;
  assert.equal(code.value, 'ISSUED'); assert.equal(value.state.saving, true); assert.equal(value.nativeCurrent(), false); value.copyIssued(code.id); await s.flush(); assert.ok(f.calls.some(value => value[0] === 'clipboard' && value[1] === 'ISSUED')); assert.equal(f.owner().controller.getSnapshot().issuedCode.id, code.id);
  value.dismissCode(code.id); assert.equal(f.owner().controller.getSnapshot().issuedCode.closing, true); value.copyIssued(code.id); value.completeCode(code.id); await s.flush(); assert.equal(f.owner().controller.getSnapshot().saving, false);
  const before = f.calls.length; value.copyIssued(code.id); value.dismissCode(code.id); assert.equal(f.calls.length, before);
});
test('issued native modal callbacks captured before account retirement cannot copy, revive or settle a successor', async t => {
  const f = hookFixture(t); f.render(); await s.flush(); let value = f.render(); value.rolePicker(); await s.flush(); value = f.render();
  const picker = value.state.picker; value.chooseRole(picker.id, value.state.choices.find(value => value.kind === 'supplier')); value.completePicker(picker.id); value = f.render(); value.save(); await s.flush(); value = f.render(); const code = value.state.issuedCode;
  f.retire(); const before = f.calls.length; value.copyIssued(code.id); value.dismissCode(code.id); value.completeCode(code.id); await s.flush(); assert.equal(f.calls.length, before); assert.equal(f.owner().controller.getSnapshot().issuedCode, null); assert.equal(value.current(), false);
});
test('actual hook StrictMode cleanup and original-account retirement prevent stale completion, saved returns and native events', async t => {
  const f = hookFixture(t, 'customer'), pending = s.deferred(); f.services.customer = async () => pending.promise; f.render(); await s.flush(); const old = f.render(); old.changeName('Original'); old.save(); f.replay(); await s.flush(); const fresh = f.render(); assert.equal(old.current(), false); assert.equal(fresh.current(), true);
  pending.resolve({ ref: 'stale', name: 'stale', phone: '' }); await s.flush(); assert.deepEqual(f.returned, []); old.save(); old.changeName('stale'); old.back(); assert.equal(f.owner().controller.currentFields.name, 'Initial');
  f.retire(); fresh.save(); fresh.back(); assert.equal(f.owner().controller.getSnapshot().valid, false); assert.deepEqual(f.returned, []); assert.deepEqual(f.backs, []);
});
test('actual hook hardware/owned back closes the real overlay before parent and outer async binding never authorizes', async t => {
  const f = hookFixture(t); f.render(); await s.flush(); let value = f.render(); value.rolePicker(); await s.flush(); value = f.render(); assert.equal(f.handlers.size, 1); [...f.handlers][0](); assert.equal(f.owner().controller.getSnapshot().picker.closing, true); assert.deepEqual(f.backs, []);
  value.completePicker(value.state.picker.id); f.render(); f.owned.at(-1)(); assert.deepEqual(f.backs, ['back']); f.props.canInteract = () => Promise.reject(Error('async')); value = f.render(); assert.equal(value.nativeCurrent(), false); value.back(); assert.deepEqual(f.backs, ['back']); await s.tick();
  const ios = hookFixture(t, 'customer', 'ios'); ios.render(); await s.flush(); ios.render(); assert.equal(ios.handlers.size, 0);
});
test('actual hook notice lifetime uses source5s replacement and stale timers cannot clear a newer notice', async t => {
  const set = global.setTimeout, clear = global.clearTimeout, timers = new Map(); let serial = 0; global.setTimeout = (fn, delay) => { const id = ++serial; timers.set(id, { fn, delay }); return id; }; global.clearTimeout = id => timers.delete(id);
  t.after(() => { global.setTimeout = set; global.clearTimeout = clear; }); const f = hookFixture(t, 'customer'); f.render(); await s.flush(); let value = f.render(); value.changeName(''); value.save(); value = f.render(); assert.equal([...timers.values()][0].delay, 5000); const first = [...timers.values()][0];
  value.save(); value = f.render(); const latest = value.state.notice.id; first.fn(); assert.equal(f.owner().controller.getSnapshot().notice.id, latest); [...timers.values()][0].fn(); assert.equal(f.owner().controller.getSnapshot().notice, null);
});
