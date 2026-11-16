const assert = require('node:assert/strict');
const test = require('node:test');
const s = require('./adminItemDetailDecisionSupport.cjs');
function fixture() {
  const session = { token: 'original', baseUrl: 'https://erp.example', profile: { role: 'admin', ref: 'original' } }, witness = { session }, calls = [];
  const original = s.detail({ code: ' DTO code ', is_finished_goods: true, order_image_order_id: 'image' });
  let epoch = 1, scope = 'scope', account = session, issued = true, allowed = true, external = () => true, read = async () => original;
  const api = {};
  const specs = { adminItemDetail: 3, adminUpdateItemDetail: 2, adminDeleteItemDetail: 2, adminItemDetailGroups: 1, adminUpdateItemDetailGroup: 3, adminItemDetailCustomers: 2, adminSetItemDetailCustomerAssigned: 4 };
  for (const [name, guardIndex] of Object.entries(specs)) api[name] = async (...args) => {
    assert.equal(args[0], session); args[guardIndex](); if (typeof args[guardIndex + 1] === 'function') assert.equal(args[guardIndex + 1](), true);
    calls.push([name, ...args.slice(1, guardIndex)]);
    if (name === 'adminItemDetail') return read(); if (name === 'adminItemDetailGroups') return ['Group', 'Kraska'];
    if (name === 'adminItemDetailCustomers') return [{ ref: ' Customer raw ', name: 'Customer', phone: '' }];
    if (name === 'adminUpdateItemDetail') return s.detail({ ...original, ...args[1], code: args[1].code, name: args[1].name, order_image_order_id: '' });
    if (name === 'adminUpdateItemDetailGroup') return s.detail({ ...original, item_group: args[2] });
    return original;
  };
  const factory = s.load('admin/adminItemDetailDecisionSession', { '../auth': { activeSessionEpoch: value => value === account ? epoch : null, activeSessionToken: value => value === account ? value.token : null,
    isSessionWitnessCurrent: value => issued && value === witness }, '../sessionReadScope': { sessionReadScope: () => scope },
    '../shared/appRoutes': { appRoutes: { adminItemDetail: '/detail' }, canOpenRoute: () => allowed }, '../shared/camera/synchronousGuard': s.sync,
    './adminItemDetailApi': api, './adminItemDetailDecisionController': s.decisions });
  const binding = factory.createAdminItemDetailDecisionSession(session, witness, () => external(), ' Widget code ');
  return { ...binding, original, session, witness, calls, epoch: value => { epoch = value; }, scope: value => { scope = value; }, account: value => { account = value; }, issued: value => { issued = value; }, allowed: value => { allowed = value; }, external: value => { external = value; }, read: value => { read = value; },
    start: async () => { binding.controller.start(); await s.flush(); }, close: (id, confirm) => { const ticket = binding.controller.prepareClose(id, confirm); assert.ok(ticket); return binding.controller.completeClose(ticket); } };
}
test('real session composition binds source initial route read, captured DTO rename/group/delete and genuine child search/assignment', async () => {
  const f = fixture(); await f.start(); assert.deepEqual(f.calls[0], ['adminItemDetail', 'Widget code', { includeImage: true }]);
  const childId = f.controller.requestCustomers(f.original); f.controller.activateCustomers(childId); await s.flush(); const child = f.controller.getSnapshot().dialogs.at(-1).owner;
  child.changeSearch(' Query '); await child.load(); const row = child.row(child.getSnapshot().customers[0]); await child.toggle(row, true); await f.close(childId, true);
  assert.deepEqual(f.calls.find(value => value[0] === 'adminItemDetailCustomers'), ['adminItemDetailCustomers', '']);
  assert.deepEqual(f.calls.filter(value => value[0] === 'adminItemDetailCustomers')[1], ['adminItemDetailCustomers', 'Query']);
  const assignment = f.calls.find(value => value[0] === 'adminSetItemDetailCustomerAssigned'); assert.equal(assignment[1], ' DTO code '); assert.equal(assignment[2], row.customer); assert.equal(assignment[3], true);
  const group = await f.controller.requestGroup(f.controller.getSnapshot().detail); f.controller.selectGroup(group, 'Group'); await f.close(group, true);
  assert.deepEqual(f.calls.find(value => value[0] === 'adminUpdateItemDetailGroup'), ['adminUpdateItemDetailGroup', ' DTO code ', 'Group']);
  const edit = f.controller.requestEdit(f.controller.getSnapshot().detail); f.controller.changeEdit(edit, 'code', ' New code '); f.controller.changeEdit(edit, 'name', ' New name '); await f.close(edit, true);
  assert.deepEqual(f.calls.find(value => value[0] === 'adminUpdateItemDetail'), ['adminUpdateItemDetail', { originalCode: ' DTO code ', code: 'New code', name: 'New name' }]);
  await f.close(f.controller.requestDelete(f.controller.getSnapshot().detail), true); assert.deepEqual(f.calls.at(-1), ['adminDeleteItemDetail', 'New code']);
});
test('source original session authority persists through token refresh and retires on epoch/scope/account/witness/capability changes', async () => {
  const f = fixture(); await f.start(); f.session.token = 'refreshed'; assert.equal(f.current(), true);
  for (const change of [g => g.epoch(2), g => g.scope('another'), g => g.account({ ...g.session }), g => g.issued(false), g => g.allowed(false),
    g => { g.session.token = 'test-mode-token'; }, g => g.external(() => Promise.reject(Error('async'))), g => g.external(() => g.current())]) {
    const g = fixture(); assert.equal(g.current(), true); change(g); assert.equal(g.current(), false); g.epoch(1); g.scope('scope'); g.account(g.session); g.issued(true); g.allowed(true); g.session.token = 'original'; g.external(() => true); assert.equal(g.current(), false);
  }
});
test('actual reused read controller fences retired/superseded native owner cleanup and never installs an older pending result', async () => {
  const pending = s.deferred(), f = fixture(); f.read(() => pending.promise); f.controller.start(); const generation = f.controller.interactionGeneration;
  f.controller.dispose(); f.read(async () => f.original); f.controller.start(); await s.flush(); pending.resolve(s.detail({ name: 'Old owner secret' })); await s.flush();
  assert.equal(f.controller.isCurrent(generation), false); assert.equal(f.controller.getSnapshot().detail, f.original); assert.equal(f.calls.filter(value => value[0] === 'adminItemDetail').length, 2);
});
