const assert = require('node:assert/strict');
const test = require('node:test');
const { load } = require('./adminUsersSupport.cjs');
const domain = load('admin/adminItemCreateCache');
const item = code => ({ code, name: `Name ${code}` });
test('catalog cache preserves original query/group/full accumulated items/hasMore without caching selection or expiring by time', () => {
  const cache = new domain.AdminItemCreateMemoryCache(), first = item('A'), second = item('B');
  cache.writeList(cache.ticket('revision1'), { query: 'Raw Query', group: ' Raw Group ', items: [first, second], hasMore: true });
  const restored = cache.readList('revision1'); assert.deepEqual(restored, { query: 'Raw Query', group: ' Raw Group ', items: [first, second], hasMore: true });
  assert.equal(restored.items[0], first); assert.ok(Object.isFrozen(restored.items)); assert.equal('selectedCodes' in restored, false); assert.equal(cache.readList('revision2'), null);
});
test('source has a single catalog slot; another original namespace cannot restore or clear the current account slot', () => {
  const cache = new domain.AdminItemCreateMemoryCache(); cache.writeList(cache.ticket('old'), { query: 'old', group: '', items: [], hasMore: false });
  cache.writeList(cache.ticket('new'), { query: 'new', group: '', items: [], hasMore: false }); assert.equal(cache.readList('old'), null);
  cache.clearList('old'); assert.equal(cache.readList('new').query, 'new');
});
test('source customer picker caches its latest nonempty blank-query page, preserving raw order/duplicate DTO identity and hasMore', () => {
  const cache = new domain.AdminItemCreateMemoryCache(), customer = { ref: ' ref ', name: ' Name ', phone: ' phone ' };
  cache.writeCustomers(cache.ticket('one', 'customers'), { items: [customer, customer], hasMore: true });
  assert.equal(cache.readCustomers('one').items[1], customer); assert.equal(cache.readCustomers('one').items.length, 2);
  cache.writeCustomers(cache.ticket('one', 'customers'), { items: [{ ...customer, ref: 'page2' }], hasMore: false }); assert.equal(cache.readCustomers('one').items[0].ref, 'page2');
  cache.writeCustomers(cache.ticket('one', 'customers'), { items: [], hasMore: false }); assert.equal(cache.readCustomers('one').items[0].ref, 'page2');
});
test('customer-create clear expires old customer writers but neither deletes catalog data nor invalidates a catalog read', () => {
  const cache = new domain.AdminItemCreateMemoryCache(), customer = { ref: 'R', name: 'N', phone: '' }, oldCustomer = cache.ticket('one', 'customers'), listRead = cache.ticket('one');
  cache.writeCustomers(oldCustomer, { items: [customer], hasMore: false }); cache.clearCustomers('one'); assert.equal(cache.readCustomers('one'), null);
  cache.writeCustomers(oldCustomer, { items: [customer], hasMore: false }); assert.equal(cache.readCustomers('one'), null);
  cache.writeList(listRead, { query: '', group: '', items: [], hasMore: true }); assert.equal(cache.readList('one').hasMore, true);
  cache.writeCustomers(cache.ticket('one', 'customers'), { items: [customer], hasMore: false }); assert.equal(cache.readCustomers('one').items[0], customer);
});
test('catalog clear expires old list writers without deleting the separate customer picker cache', () => {
  const cache = new domain.AdminItemCreateMemoryCache(), ticket = cache.ticket('one'), customer = { ref: 'R', name: 'N', phone: '' };
  cache.writeCustomers(cache.ticket('one', 'customers'), { items: [customer], hasMore: true }); cache.clearList('one');
  cache.writeList(ticket, { query: 'late', group: '', items: [], hasMore: false }); assert.equal(cache.readList('one'), null); assert.equal(cache.readCustomers('one').items[0], customer);
});
test('auth reset scrubs both completed caches and fences old writers even if a namespace is reused', async () => {
  let reset; const runtime = load('admin/adminItemCreateRuntime', { '../auth': { registerSessionResetHook: callback => { reset = callback; } }, './adminItemCreateCache': domain });
  const cache = runtime.adminItemCreateMemoryCache, before = cache.ticket('one', 'customers'), customer = { ref: 'R', name: 'N', phone: '' };
  cache.writeCustomers(before, { items: [customer], hasMore: true }); cache.writeList(cache.ticket('one'), { query: 'private', group: '', items: [], hasMore: false });
  await reset(); assert.equal(cache.readCustomers('one'), null); assert.equal(cache.readList('one'), null);
  cache.writeCustomers(before, { items: [customer], hasMore: true }); assert.equal(cache.readCustomers('one'), null);
  cache.writeCustomers(cache.ticket('one', 'customers'), { items: [customer], hasMore: false }); runtime.clearAdminItemCreateCustomerCache('one'); assert.equal(cache.readCustomers('one'), null);
});
test('namespace captures exact original revision/epoch/readscope and rejects a replaced witness rather than recapturing it', () => {
  let epoch = 7, valid = true, scope = 'base-role-ref-caps-assignments'; const session = {}, witness = { session, generation: 3 };
  const factory = load('admin/adminItemCreateCacheNamespace', { '../auth': { activeSessionEpoch: () => epoch, isSessionWitnessCurrent: candidate => candidate === witness && valid }, '../sessionReadScope': { sessionReadScope: () => scope } });
  const captured = factory.adminItemCreateCacheNamespace(session, witness); assert.equal(captured, JSON.stringify([7, 3, scope]));
  scope = 'another-server'; assert.notEqual(factory.adminItemCreateCacheNamespace(session, witness), captured); epoch++; assert.notEqual(factory.adminItemCreateCacheNamespace(session, witness), captured);
  valid = false; assert.equal(factory.adminItemCreateCacheNamespace(session, witness), null); valid = true; assert.equal(factory.adminItemCreateCacheNamespace({}, witness), null);
  epoch = null; assert.equal(factory.adminItemCreateCacheNamespace(session, witness), null);
});
