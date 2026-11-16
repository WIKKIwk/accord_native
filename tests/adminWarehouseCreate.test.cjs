/* global __dirname */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const test = require('node:test');
const ts = require('typescript');
function load(file, mocks = {}) {
  const filename = path.resolve(__dirname, '../src', file + '.ts'), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths; mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename); return mod.exports;
}
const dart = load('admin/dartJsonString'), profile = load('shared/profileSessionGuard'), routes = load('shared/appRoutes');
const model = load('admin/adminUsersModel', { '../shared/localization': { adminText: key => key }, '../shared/appRoutes': routes,
  '../workerControlsApi': { isCanonicalApparatusId: () => true }, './dartJsonString': dart });
const search = load('shared/searchNormalizer'), engine = load('qolip/qolipSearchEngine', { '../shared/searchNormalizer': search });
const relevance = load('qolip/qolipSearchRelevance', { './qolipSearchEngine': engine });
const domain = load('admin/adminWarehouseAssignees', { '../shared/searchNormalizer': search, '../qolip/qolipSearchRelevance': relevance,
  './adminUsersModel': model, './dartJsonString': dart });
const controllers = load('admin/adminWarehouseCreateController', { '../shared/profileSessionGuard': profile,
  '../shared/camera/synchronousGuard': load('shared/camera/synchronousGuard'),
  './adminWarehouseAssignees': domain, './dartJsonString': dart });
const user = (id, fields = {}) => ({ id, name: id, phone: '', kind: 'werka', avatar_url: '', principal_role: 'werka',
  blocked: false, role_label: null, apparatus_display: '', apparatus_id: '', ...fields });
const deferred = () => { let resolve, reject; return { promise: new Promise((yes, no) => { resolve = yes; reject = no; }), resolve: value => resolve(value), reject: error => reject(error) }; };
const tick = () => new Promise(resolve => setImmediate(resolve));
const noop = () => {};
test('assignee loading reads four roles concurrently, pages by actual count, and preserves guards/witness', async () => {
  const first = deferred(), calls = [], witness = () => true, guard = noop;
  const result = domain.loadAdminWarehouseAssignees({ users: async (role, offset, g, w) => {
    assert.equal(g, guard); assert.equal(w, witness); calls.push([role, offset]);
    if (role === 'werka' && offset === 0) { await first.promise; return { items: [user('one'), user('two')], has_more: true }; }
    return { items: role === 'werka' ? [user('three')] : [], has_more: false };
  }, assignments: async (g, w) => { assert.equal(g, guard); assert.equal(w, witness); calls.push(['assignments']); return []; } }, guard, witness);
  assert.deepEqual(calls, [['werka', 0], ['qolipchi', 0], ['material_taminotchi', 0], ['worker', 0], ['assignments']]);
  first.resolve(); assert.deepEqual((await result).map(value => value.id), ['one', 'three', 'two']); assert.deepEqual(calls.at(-1), ['werka', 2]);
});
test('assignee pagination rejects a nonadvancing page; account loss prevents the next page', async () => {
  await assert.rejects(domain.loadAdminWarehouseAssignees({ users: async () => ({ items: [], has_more: true }), assignments: async () => [] }, noop, () => true), /did not advance/);
  let valid = true; const calls = [];
  const guard = () => { if (!valid) throw new Error('expired'); };
  await assert.rejects(domain.loadAdminWarehouseAssignees({ users: async (role, offset) => { calls.push([role, offset]); valid = false; return { items: [user('a')], has_more: true }; }, assignments: async () => [] }, guard, () => valid), /expired/);
  assert.equal(calls.some(([, offset]) => offset > 0), false);
});
test('candidate filter, promotion, exact assignment refs, last-value dedup and code-unit name order match source', async () => {
  const pages = {
    werka: [user('A', { name: 'old' }), user(' a ', { name: 'z last' }), user('blocked', { blocked: true }), user('same', { name: 'Z' }), user('reject', { kind: 'supplier', principal_role: 'supplier' })],
    qolipchi: [user('same', { kind: 'qolipchi', principal_role: 'qolipchi', name: 'a direct' })],
    material_taminotchi: [user('material', { kind: 'customer', principal_role: 'material_taminotchi', name: 'Б' })],
    worker: [user('match', { kind: 'worker', principal_role: 'aparatchi', name: 'c worker', apparatus_display: 'Machine', apparatus_id: 'id' }),
      user('CASE', { kind: 'worker', principal_role: 'aparatchi' }),
      user('leader', { kind: 'worker', principal_role: 'aparatchi', role_label: '  Brigader ', name: 'b leader' }),
      user('machine-leader', { kind: 'worker', principal_role: 'aparatchi', role_label: 'Brigader', apparatus_display: 'Machine' })],
  };
  const result = await domain.loadAdminWarehouseAssignees({ users: async role => ({ items: pages[role], has_more: false }), assignments: async () => [
    { principal_ref: ' match ', principal_role: 'aparatchi', role_id: ' qolipchi ' }, { principal_ref: 'case', principal_role: 'qolipchi', role_id: '' },
  ] }, noop, () => true);
  assert.deepEqual(result.map(value => value.id), ['same', 'leader', 'match', 'same', ' a ', 'material']);
  const promoted = result.find(value => value.id === 'match'); assert.equal(promoted.kind, 'qolipchi'); assert.equal(promoted.principal_role, 'qolipchi');
  assert.equal(promoted.apparatus_display, ''); assert.equal(promoted.apparatus_id, ''); assert.equal(model.adminUserRoleLabel(promoted), 'Qolipchi');
  const leader = result.find(value => value.id === 'leader'); assert.equal(leader.kind, 'worker'); assert.equal(leader.principal_role, 'aparatchi');
  assert.equal(domain.adminWarehouseRoleForUser(leader), 'aparatchi'); assert.equal(domain.adminWarehouseRoleForUser(promoted), 'qolipchi');
  assert.equal(result.some(value => value.id === 'CASE' || value.id === 'machine-leader'), false);
});
test('role overrides precede kind and picker search includes phone/id/subtitle with source relevance', () => {
  assert.equal(domain.adminWarehouseRoleForUser(user('a', { kind: 'worker', principal_role: 'boyoqchi' })), 'boyoqchi');
  assert.equal(domain.adminWarehouseRoleForUser(user('a', { kind: 'materialTaminotchi', principal_role: 'customer' })), 'material_taminotchi');
  const users = [user('id-7', { name: 'Бахтиёр', phone: '998551234567' }), user('target', { name: 'Aziz', kind: 'qolipchi', principal_role: 'qolipchi' })];
  assert.deepEqual(domain.adminWarehouseAssigneeSearch(users, 'bahtiyor'), [users[0]]);
  assert.equal(domain.adminWarehouseAssigneeSearch(users, '998551234567').includes(users[0]), true);
  assert.equal(domain.adminWarehouseAssigneeSearch(users, 'target').includes(users[1]), true);
  assert.equal(domain.adminWarehouseAssigneeSearch(users, 'Qolipchi').includes(users[1]), true);
  assert.deepEqual(domain.adminWarehouseAssigneeSearch(users, 'nothing-quite-like-this'), []);
});
function fixture(overrides = {}) {
  let valid = true; const calls = [], users = [user('first'), user('second', { name: 'Second', kind: 'qolipchi', principal_role: 'qolipchi' })];
  const deps = { isCurrent: () => valid, users: async guard => { guard(); calls.push('users'); return users; },
    create: async (name, guard) => { guard(); calls.push(['create', name]); }, assign: async (input, guard) => { guard(); calls.push(['assign', input]); },
    onSaved: async () => { calls.push('saved'); }, onClose: () => { calls.push('close'); }, ...overrides };
  const controller = new controllers.AdminWarehouseCreateController(deps); controller.start();
  return { controller, calls, users, deps, retire: () => { valid = false; } };
}
async function selected(f) { await f.controller.openPicker(); const picker = f.controller.getSnapshot().picker; f.controller.selectUser(picker.id, f.users[0]); f.controller.changeName(' \u0085 Storage \u0085 '); }
test('form silently requires name+selection, and never introduces validation messages', async () => {
  const f = fixture(); await f.controller.save(); f.controller.changeName('warehouse'); await f.controller.save();
  await f.controller.openPicker(); f.controller.selectUser(f.controller.getSnapshot().picker.id, f.users[0]); f.controller.changeName('\u0085 '); await f.controller.save();
  assert.deepEqual(f.calls, ['users']); assert.equal(f.controller.getSnapshot().notice, null);
});
test('cached picker load resets query on reopen, cancel preserves selection and old tickets cannot select/dismiss', async () => {
  const f = fixture(); await selected(f); await f.controller.openPicker(); const old = f.controller.getSnapshot().picker.id;
  f.controller.searchPicker(old, 'Second'); assert.deepEqual(f.controller.visibleUsers(), [f.users[1]]); f.controller.dismissPicker(old);
  assert.equal(f.controller.getSnapshot().selected, f.users[0]); await f.controller.openPicker(); const fresh = f.controller.getSnapshot().picker;
  assert.equal(fresh.query, ''); assert.notEqual(fresh.id, old); f.controller.selectUser(old, f.users[1]); f.controller.dismissPicker(old);
  f.controller.selectUser(fresh.id, { ...f.users[1] }); assert.equal(f.controller.getSnapshot().selected, f.users[0]);
  assert.equal(f.controller.getSnapshot().picker.id, fresh.id); assert.equal(f.calls.filter(value => value === 'users').length, 1);
});
test('load failure resets cached future and shows source failure, empty result stays cached and shows source empty notice', async () => {
  let attempts = 0; const f = fixture({ users: async () => { if (++attempts === 1) throw new Error('fail'); return []; } });
  await f.controller.openPicker(); assert.equal(f.controller.getSnapshot().notice.key, 'warehouse.users_load_failed');
  await f.controller.openPicker(); const notice = f.controller.getSnapshot().notice; assert.equal(notice.key, 'warehouse.no_users');
  await f.controller.openPicker(); assert.equal(attempts, 2); assert.equal(f.controller.getSnapshot().loadingUsers, false);
  f.controller.dismissNotice(notice.serial); assert.notEqual(f.controller.getSnapshot().notice, null);
});
test('save captures warehouse first, reads latest assignee after create, resets before reload, then closes', async () => {
  const create = deferred(); const f = fixture({ create: async (name, guard) => { guard(); f.calls.push(['create', name]); await create.promise; } }); await selected(f);
  const pending = f.controller.save(); assert.equal(f.controller.getSnapshot().saving, true); f.controller.closeButton(); assert.equal(f.calls.includes('close'), false);
  f.controller.changeName('Edited while saving'); await f.controller.openPicker(); f.controller.selectUser(f.controller.getSnapshot().picker.id, f.users[1]);
  f.deps.onSaved = async () => { assert.equal(f.controller.getSnapshot().name, ''); assert.equal(f.controller.getSnapshot().selected, null); f.calls.push('saved'); };
  create.resolve(); await pending;
  assert.deepEqual(f.calls, ['users', ['create', 'Storage'], ['assign', { warehouse: 'Storage', principal_role: 'qolipchi', principal_ref: 'second', display_name: 'Second' }], 'saved', 'close']);
  assert.equal(f.controller.getSnapshot().phase, 'closed'); await f.controller.save(); assert.equal(f.calls.length, 5);
});
for (const failureAt of ['create', 'assign', 'saved']) test(`${failureAt} failure preserves source partial-success behavior with no rollback/message`, async () => {
  const f = fixture(); await selected(f); f.deps[failureAt === 'saved' ? 'onSaved' : failureAt] = async () => { f.calls.push(failureAt); throw new Error(failureAt); };
  await assert.rejects(f.controller.save(), new RegExp(failureAt)); const state = f.controller.getSnapshot();
  assert.equal(state.saving, false); assert.equal(state.notice, null); assert.equal(f.calls.includes('close'), false);
  assert.equal(state.name, failureAt === 'saved' ? '' : ' \u0085 Storage \u0085 '); assert.equal(state.selected, failureAt === 'saved' ? null : f.users[0]);
  if (failureAt === 'assign') { await assert.rejects(f.controller.save(), /assign/); assert.equal(f.calls.filter(call => Array.isArray(call) && call[0] === 'create').length, 2); }
});
test('duplicate save does not duplicate create, outside dismiss during create stops the second command', async () => {
  const create = deferred(), f = fixture({ create: async () => { f.calls.push('create'); return create.promise; } }); await selected(f);
  const saving = f.controller.save(), rejection = assert.rejects(saving, /session changed/); await f.controller.save(); f.controller.dismissDialog();
  create.resolve(); await rejection; assert.deepEqual(f.calls, ['users', 'create', 'close']); assert.equal(f.controller.getSnapshot().phase, 'closed');
});
test('invalidated user load cannot open a sheet or install a failure notice; dispose scrubs cached selection', async () => {
  const users = deferred(), f = fixture({ users: () => users.promise }); const pending = f.controller.openPicker(); f.retire(); users.resolve(f.users); await pending;
  assert.equal(f.controller.getSnapshot().phase, 'invalidated'); assert.equal(f.controller.getSnapshot().notice, null); assert.equal(f.controller.getSnapshot().picker, null);
  const g = fixture(); await selected(g); g.controller.dispose(); assert.equal(g.controller.getSnapshot().selected, null); assert.equal(g.controller.getSnapshot().name, '');
  g.controller.dismissDialog(); assert.equal(g.calls.includes('close'), false);
});
test('listener retirement and asynchronous current guards cannot start commands', async () => {
  const f = fixture(); await selected(f); f.controller.subscribe(() => { if (f.controller.getSnapshot().saving) f.retire(); });
  await assert.rejects(f.controller.save(), /session changed/); assert.deepEqual(f.calls, ['users']);
  const asyncOwner = fixture({ isCurrent: async () => true }); await asyncOwner.controller.openPicker(); assert.deepEqual(asyncOwner.calls, []);
});
test('close publication fences reentrant dismiss, cached picker read and save before calling parent once', async () => {
  const f = fixture(); await selected(f);
  f.controller.subscribe(() => {
    if (f.controller.getSnapshot().phase !== 'closed') return;
    f.controller.dismissDialog(); f.controller.closeButton(); void f.controller.openPicker(); void f.controller.save(); f.controller.changeName('late');
  });
  f.controller.dismissDialog(); await tick(); assert.deepEqual(f.calls, ['users', 'close']); assert.equal(f.controller.getSnapshot().phase, 'closed');
  const g = fixture(); g.controller.subscribe(() => { if (g.controller.getSnapshot().phase === 'closed') g.retire(); });
  g.controller.dismissDialog(); assert.equal(g.calls.includes('close'), false); assert.equal(g.controller.getSnapshot().phase, 'invalidated');
});
test('loaded picker publication is atomic, preventing a reentrant load-finished listener from opening twice', async () => {
  const f = fixture(); let attempts = 0;
  f.controller.subscribe(() => { const state = f.controller.getSnapshot(); if (!state.loadingUsers && !state.picker && ++attempts < 3) void f.controller.openPicker(); });
  await f.controller.openPicker(); assert.equal(attempts, 0); assert.equal(f.controller.getSnapshot().picker.id, 1); assert.deepEqual(f.calls, ['users']);
});
for (const stage of ['create', 'assign', 'saved']) test(`account loss after ${stage} blocks every subsequent write/callback and scrubs data`, async () => {
  const wait = deferred(), f = fixture(); await selected(f);
  f.deps[stage === 'saved' ? 'onSaved' : stage] = async (...args) => { args.at(-1)?.call?.(); f.calls.push(stage); await wait.promise; };
  const saving = f.controller.save(), rejection = assert.rejects(saving, /session changed/); await tick(); f.retire(); wait.resolve(); await rejection;
  assert.equal(f.controller.getSnapshot().phase, 'invalidated'); assert.equal(f.calls.includes('close'), false);
  if (stage === 'create') assert.equal(f.calls.some(call => Array.isArray(call) && call[0] === 'assign'), false);
});
function sessionFixture() {
  const session = { token: 'token', baseUrl: 'https://server.example', profile: { role: 'admin', ref: 'one' }, capabilities: ['admin.access', 'catalog.item.read'] };
  const witness = { session }; let epoch = 1, valid = true, outer = () => true;
  const { adminWarehouseCreateSession } = load('admin/adminWarehouseCreateSession', { '../auth': { activeSessionEpoch: () => epoch,
    activeSessionToken: () => session.token || null, isSessionWitnessCurrent: value => valid && value === witness }, '../sessionReadScope': load('sessionReadScope'),
    '../shared/appRoutes': routes, '../shared/profileSessionGuard': profile, './adminWarehouseAssignees': domain, './adminWarehouseCreateController': controllers,
    './adminWarehouseAssignmentApi': {}, './adminUsersApi': {}, './warehouseApi': {} });
  const owner = adminWarehouseCreateSession(session, witness, () => outer(), { onSaved: async () => {}, onClose: noop });
  return { session, owner, setEpoch: value => { epoch = value; }, retire: () => { valid = false; }, setOuter: value => { outer = value; } };
}
for (const mutation of ['scope', 'epoch', 'permission', 'witness', 'token']) test(`dialog captures and latches original ${mutation}`, () => {
  const f = sessionFixture(); assert.equal(f.owner.current(), true);
  if (mutation === 'scope') f.session.baseUrl = 'https://other.example'; if (mutation === 'epoch') f.setEpoch(2);
  if (mutation === 'permission') f.session.capabilities = []; if (mutation === 'witness') f.retire(); if (mutation === 'token') f.session.token = '';
  assert.equal(f.owner.current(), false); f.session.baseUrl = 'https://server.example'; f.setEpoch(1); f.session.capabilities = ['admin.access', 'catalog.item.read']; f.session.token = 'token'; assert.equal(f.owner.current(), false);
});
test('token refresh keeps original owner, async/reentrant current callbacks fail closed', () => {
  const f = sessionFixture(); f.session.token = 'fresh'; assert.equal(f.owner.current(), true);
  const g = sessionFixture(); g.setOuter(async () => true); assert.equal(g.owner.current(), false);
  const h = sessionFixture(); h.setOuter(() => { h.owner.current(); return true; }); assert.equal(h.owner.current(), false);
});
