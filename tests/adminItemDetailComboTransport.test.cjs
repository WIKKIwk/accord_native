const assert = require('node:assert/strict');
const test = require('node:test');
const s = require('./adminItemDetailComboSupport.cjs');
function fixture(t) {
  const previous = global.fetch; t.after(() => { global.fetch = previous; });
  const session = { token: 'old', baseUrl: 'https://erp.example', profile: { role: 'admin', ref: 'account' }, capabilities: ['admin.access'] }, witness = { session }, calls = [];
  let current = true, epoch = 1, issued = true, joins = 0, onJoin = () => {}, handler = async url => String(url).includes('/combos?')
    ? new Response(JSON.stringify({ combo: { item_code: ' Raw ' }, template: { products: [{ item_code: 'SKU' }, { item_code: 'SKU' }, { item_code: 'Known', product: 'Known name' }] } }))
    : new Response('{"name":"Resolved"}');
  const auth = { activeSessionToken: () => current ? session.token : null, activeSessionEpoch: () => current ? epoch : null, isSessionWitnessCurrent: value => issued && value === witness,
    refreshSession: async () => { throw Error('read must not initiate legacy refresh'); },
    joinRefreshForGuardedRead: async (_session, _token, check) => { joins++; check(); onJoin(); session.token = 'new'; check(); return true; } };
  const transport = s.load('authorizedFetch', { './auth': auth }), api = s.api(transport);
  const factory = s.load('admin/adminItemDetailComboSession', { '../auth': auth, '../sessionReadScope': s.load('sessionReadScope'), '../shared/appRoutes': s.routes,
    '../shared/camera/synchronousGuard': s.sync, './adminItemDetailComboApi': api, './adminItemDetailComboController': s.controllers });
  global.fetch = async (url, init) => { calls.push([String(url), init]); return handler(url, init); };
  const owner = factory.createAdminItemDetailComboSession(session, witness, () => current, ' Raw ');
  return { owner, session, calls, api, handler: value => { handler = value; }, joins: () => joins, onJoin: value => { onJoin = value; }, retire: () => { current = false; issued = false; epoch++; },
    start: async () => { owner.controller.start(); await s.flush(); } };
}
test('real session/catalog plus actual row factories preserve raw catalog code and per-row include_imagefalse GETs without dedupe', async t => {
  const f = fixture(t); await f.start(); assert.equal(f.calls[0][0], 'https://erp.example/v1/mobile/admin/combos?item_code=+Raw+');
  const products = f.owner.controller.getSnapshot().entry.template.products;
  assert.equal(f.owner.productName({ ...products[0] }, () => true), null);
  const names = products.map(product => f.owner.productName(product, () => true)); names.forEach(owner => owner.start()); await s.flush();
  assert.equal(f.calls.length, 3); assert.deepEqual(f.calls.slice(1).map(([url]) => url), ['https://erp.example/v1/mobile/admin/items/detail?code=SKU', 'https://erp.example/v1/mobile/admin/items/detail?code=SKU']);
  assert.deepEqual(names.map(owner => owner.getSnapshot().name), ['Resolved', 'Resolved', 'Known name']);
});
test('actual catalog native cleanup/retry retires original row readers and cannot install old name in a replacement entry', async t => {
  const f = fixture(t); await f.start(); const original = f.owner.controller.getSnapshot().entry, product = original.template.products[0], pending = s.deferred();
  f.handler(async url => String(url).includes('/combos?') ? new Response(JSON.stringify({ combo: { item_code: ' Raw ' }, template: { products: [{ item_code: 'New' }] } })) : { status: 200, json: () => pending.promise });
  const name = f.owner.productName(product, () => true); name.start(); await s.tick(); await f.owner.controller.reload(); pending.resolve({ name: 'Old private name' }); await s.flush();
  assert.equal(name.getSnapshot().phase, 'invalidated'); assert.equal(name.getSnapshot().name, null); assert.equal(f.owner.productName(product, () => true), null);
  f.owner.controller.dispose(); assert.equal(f.owner.productName(f.owner.controller.getSnapshot().entry?.template.products[0], () => true), null);
});
for (const status of [302, 401]) test(`actual original combo catalog read cannot continue after account retirement at${status}`, async t => {
  const f = fixture(t); f.handler(async () => { f.retire(); return new Response('', { status, headers: status === 302 ? { location: '/next' } : {} }); });
  await f.start(); assert.equal(f.calls.length, 1); assert.equal(f.joins(), 0); assert.equal(f.owner.controller.getSnapshot().phase, 'invalidated');
});
test('guarded combo catalog uses independent token recovery and account retirement during recovery prevents retry', async t => {
  const f = fixture(t); f.handler(async () => f.calls.length === 1 ? new Response('', { status: 401 }) : new Response('{"combo":{"item_code":" Raw "},"template":{}}'));
  await f.start(); assert.equal(f.owner.controller.getSnapshot().phase, 'content'); assert.equal(f.joins(), 1); assert.deepEqual(f.calls.map(([, init]) => new Headers(init.headers).get('authorization')), ['Bearer old', 'Bearer new']);
  f.handler(async () => new Response('', { status: 401 })); f.onJoin(f.retire); const count = f.calls.length; await f.owner.controller.reload(); assert.equal(f.calls.length, count + 1); assert.equal(f.owner.controller.getSnapshot().phase, 'invalidated');
});
