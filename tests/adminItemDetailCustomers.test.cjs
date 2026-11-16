const assert = require('node:assert/strict');
const test = require('node:test');
const s = require('./adminItemDetailDecisionSupport.cjs');
const pageFixture = (overrides = {}) => s.fixture(overrides, s.detail({ is_finished_goods: true, order_image_order_id: 'original image' }));
function customerFixture(overrides = {}, initial = s.detail()) {
  let current = true, interact = true; const calls = [], notices = [];
  const deps = { isCurrent: () => current, canInteract: () => interact,
    load: async (query, guard, witness) => { guard(); assert.equal(witness(), true); calls.push(['load', query]); return [{ ref: 'A', name: 'Alpha', phone: '' }, { ref: 'B', name: 'Beta', phone: '' }]; },
    setAssigned: async (customer, assigned) => { calls.push(['set', customer, assigned]); return s.detail({ customers: assigned ? [customer] : [] }); }, notice: error => notices.push(error), ...overrides };
  const owner = new s.customers.AdminItemDetailCustomersController(initial, deps);
  return { owner, deps, calls, notices, start: async () => { owner.start(); await s.flush(); }, retire: () => { current = false; }, cover: () => { interact = false; }, uncover: () => { interact = true; } };
}
test('picker waits for genuine native activation, submits search manually and reads one captured query at a time', async () => {
  const f = pageFixture(); await f.start(); const id = f.owner.requestCustomers(f.initial); assert.deepEqual(f.calls, []);
  assert.equal(f.owner.activateCustomers(id), true); await s.flush(); const child = f.dialog(id).owner; assert.deepEqual(f.calls, [['customers', '']]);
  child.changeSearch(' Query \u0085 '); assert.deepEqual(f.calls, [['customers', '']]); await child.load(); assert.deepEqual(f.calls, [['customers', ''], ['customers', 'Query']]);
  const current = child.getSnapshot().customers; const row = child.row(current[0]); assert.ok(row); assert.equal(child.row({ ...current[0] }), null);
});
test('source customer merge retains selected empty refs, loaded replacement spelling and name sort without changing selected identity', async () => {
  const selected = [{ ref: ' a ', name: 'Old', phone: 'old' }, { ref: '', name: 'Empty', phone: '' }], initial = s.detail({ customers: selected });
  const f = customerFixture({ load: async () => [{ ref: 'A', name: 'New', phone: 'new' }, { ref: ' ', name: 'Ignored', phone: '' }, { ref: 'B', name: 'Beta', phone: '' }] }, initial); await f.start();
  assert.deepEqual(f.owner.getSnapshot().customers.map(value => value.name), ['Beta', 'Empty', 'New']); assert.deepEqual(f.owner.getSnapshot().selectedRefs, ['a', '']);
  const empty = f.owner.row(f.owner.getSnapshot().customers[1]); await f.owner.toggle(empty, true); assert.deepEqual(f.calls, []);
});
test('overlapping manual directory loads follow source last settlement and merge the latest assignment state at settlement', async () => {
  const first = s.deferred(), second = s.deferred(); let count = 0;
  const f = customerFixture({ load: async () => ++count === 1 ? first.promise : second.promise }); f.owner.start(); f.owner.changeSearch('second'); const reload = f.owner.load();
  second.resolve([{ ref: 'B', name: 'Second', phone: '' }]); await reload; assert.equal(f.owner.getSnapshot().customers[0].name, 'Second');
  first.resolve([{ ref: 'A', name: 'First', phone: '' }]); await s.flush(); assert.equal(f.owner.getSnapshot().customers[0].name, 'First');
  const catalog = s.deferred(), assignment = s.deferred(); let loads = 0;
  const g = customerFixture({ load: async () => ++loads === 1 ? [{ ref: 'A', name: 'Alpha', phone: '' }] : catalog.promise, setAssigned: async () => assignment.promise }); await g.start();
  const row = g.owner.row(g.owner.getSnapshot().customers[0]), saving = g.owner.toggle(row, true), pendingLoad = g.owner.load();
  assignment.resolve(s.detail({ customers: [{ ref: 'A', name: 'Selected while loading', phone: '' }] })); await saving;
  catalog.resolve([]); await pendingLoad; assert.equal(g.owner.getSnapshot().customers[0].name, 'Selected while loading');
});
test('one pending customer disables all rows and Done while original selected source DTO changes only on real acknowledgment', async () => {
  const pending = s.deferred(), f = customerFixture({ setAssigned: async (customer, assigned) => { f.calls.push(['set', customer, assigned]); return pending.promise; } }); await f.start();
  const [a, b] = f.owner.getSnapshot().customers, aRow = f.owner.row(a), bRow = f.owner.row(b); const saving = f.owner.toggle(aRow, true);
  assert.equal(f.owner.getSnapshot().pendingRef, 'a'); await f.owner.toggle(bRow, true); assert.equal(f.calls.filter(value => value[0] === 'set').length, 1); assert.equal(f.owner.prepareClose(true), false);
  const updated = s.detail({ customers: [{ ref: ' a ', name: 'Acknowledged', phone: '' }] }); pending.resolve(updated); await saving;
  assert.equal(f.owner.getSnapshot().detail, updated); assert.deepEqual(f.owner.getSnapshot().selectedRefs, ['a']); assert.equal(f.owner.getSnapshot().customers[0], a); assert.equal(f.owner.getSnapshot().pendingRef, null);
  assert.equal(f.owner.prepareClose(true), updated); assert.equal(f.owner.row(a), null);
});
test('picker cancellation after dispatch lets original parent acknowledgment update changed/detail but cannot mutate a later picker', async () => {
  const pending = s.deferred(), f = pageFixture({ setCustomer: async (detail, customer, assigned, guard, witness) => { guard(); assert.equal(witness(), true); f.calls.push(['customer', detail, customer, assigned]); return pending.promise; } }); await f.start();
  const id = f.owner.requestCustomers(f.initial); f.owner.activateCustomers(id); await s.flush(); const child = f.dialog(id).owner, customer = child.getSnapshot().customers[0]; const saving = child.toggle(child.row(customer), true);
  assert.equal(f.owner.prepareClose(id, true), null); const closing = f.owner.prepareClose(id, false); assert.ok(closing); await f.owner.completeClose(closing);
  const newerId = f.owner.requestCustomers(f.initial); f.owner.activateCustomers(newerId); await s.flush(); const newer = f.dialog(newerId).owner;
  pending.resolve(s.detail({ customers: [customer] })); await saving;
  assert.equal(f.calls.find(value => value[0] === 'customer')[1], f.initial); assert.equal(f.owner.getSnapshot().changed, true); assert.equal(f.owner.getSnapshot().detail.order_image_order_id, 'original image');
  assert.deepEqual(newer.getSnapshot().selectedRefs, []); assert.equal(child.isCurrent(), false);
});
test('native hide fences queued child and parent inputs immediately, while Done return does not invent changed or follow-up reads', async () => {
  const f = pageFixture(); await f.start(); const id = f.owner.requestCustomers(f.initial); f.owner.activateCustomers(id); await s.flush(); const child = f.dialog(id).owner; let reentrant = 'unseen';
  child.subscribe(() => { if (child.getSnapshot().closing) reentrant = f.owner.requestEdit(f.initial); });
  const ticket = f.owner.prepareClose(id, true); assert.ok(ticket); assert.equal(reentrant, null); child.changeSearch('poison'); await child.load();
  assert.deepEqual(await f.owner.completeClose(ticket), { changed: false, removed: false }); assert.equal(f.owner.getSnapshot().detail, f.initial); assert.deepEqual(f.reads, ['Code']); assert.equal(f.calls.filter(value => value[0] === 'customers').length, 1);
});
test('covered/stale rows deny new writes, while source failures keep exact original error and release global pending flag', async () => {
  const error = { toString: () => 'Exception: raw ' }, f = customerFixture({ setAssigned: async () => { throw error; } }); await f.start(); const row = f.owner.row(f.owner.getSnapshot().customers[0]);
  f.cover(); await f.owner.toggle(row, true); assert.deepEqual(f.notices, []); f.uncover(); await f.owner.load(); await f.owner.toggle(row, true); assert.deepEqual(f.notices, []);
  await f.owner.toggle(f.owner.row(f.owner.getSnapshot().customers[0]), true); assert.deepEqual(f.notices, [error]); assert.equal(f.owner.getSnapshot().pendingRef, null); assert.deepEqual(f.owner.getSnapshot().selectedRefs, []);
});
test('retired native picker read and in-flight assignment cannot publish its response or notice into another account', async () => {
  const pending = s.deferred(), f = customerFixture({ load: () => pending.promise }); f.owner.start(); f.retire(); pending.resolve([{ ref: 'private', name: 'Secret', phone: '' }]); await s.flush(); assert.equal(f.owner.isCurrent(), false); assert.deepEqual(f.owner.getSnapshot().customers, []);
  const write = s.deferred(), g = pageFixture({ setCustomer: () => write.promise }); await g.start(); const id = g.owner.requestCustomers(g.initial); g.owner.activateCustomers(id); await s.flush(); const child = g.dialog(id).owner;
  const saving = child.toggle(child.row(child.getSnapshot().customers[0]), true); g.retire(); write.resolve(s.detail({ name: 'Secret' })); await saving;
  assert.equal(g.owner.getSnapshot().phase, 'invalidated'); assert.equal(g.owner.getSnapshot().detail, null); assert.equal(g.owner.getSnapshot().notice, null);
});
test('late original customer acknowledgment after a rename preserves source DTO/image settlement without retargeting the next read code', async () => {
  const pending = s.deferred(), f = pageFixture({ setCustomer: async (detail, customer) => { f.calls.push(['captured', detail, customer]); return pending.promise; } }); await f.start();
  const id = f.owner.requestCustomers(f.initial); f.owner.activateCustomers(id); await s.flush(); const child = f.dialog(id).owner, customer = child.getSnapshot().customers[0];
  const assigning = child.toggle(child.row(customer), true); await f.close(id, false);
  const edit = f.owner.requestEdit(f.initial); f.owner.changeEdit(edit, 'code', 'New'); await f.close(edit, true);
  assert.equal(f.owner.getSnapshot().itemCode, 'New'); assert.equal(f.owner.getSnapshot().detail.code, 'New'); assert.equal(f.owner.getSnapshot().detail.order_image_order_id, '');
  pending.resolve(s.detail({ customers: [customer], is_finished_goods: true, order_image_order_id: '' })); await assigning;
  assert.equal(f.calls.find(value => value[0] === 'captured')[1], f.initial); assert.equal(f.owner.getSnapshot().detail.code, 'Code'); assert.equal(f.owner.getSnapshot().itemCode, 'New');
  assert.equal(f.owner.getSnapshot().detail.order_image_order_id, 'original image'); assert.deepEqual(f.reads, ['Code']);
  await f.owner.reload(); assert.deepEqual(f.reads, ['Code', 'New']);
});
test('source overlapping search success does not clear an error set by another completed load until a new search starts', async () => {
  const first = s.deferred(), second = s.deferred(); let count = 0; const error = Error('Second request failed');
  const f = customerFixture({ load: async () => ++count === 1 ? first.promise : count === 2 ? second.promise : [] }); f.owner.start(); const loading = f.owner.load();
  second.reject(error); await loading; first.resolve([{ ref: 'A', name: 'First request', phone: '' }]); await s.flush();
  assert.equal(f.owner.getSnapshot().customers[0].name, 'First request'); assert.equal(f.owner.getSnapshot().error, error); assert.equal(f.owner.row(f.owner.getSnapshot().customers[0]), null);
  await f.owner.load(); assert.equal(f.owner.getSnapshot().error, null);
});
