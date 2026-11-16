const assert = require('node:assert/strict');
const test = require('node:test');
const s = require('./adminItemDetailSupport.cjs');
function fixture(t) {
  const original = global.fetch; t.after(() => { global.fetch = original; });
  const session = { token: 'old', baseUrl: 'https://erp.example' }, calls = []; let valid = true, joins = 0, refreshes = 0, onJoin = () => {}, onRefresh = () => {}, handler = async () => new Response('{"code":"Code"}');
  const guard = () => { if (!valid) throw Error('original expired'); }, witness = () => { guard(); return true; };
  const transport = s.load('authorizedFetch', { './auth': { activeSessionToken: () => session.token,
    refreshSession: async () => { refreshes++; onRefresh(); session.token = 'new'; return true; },
    joinRefreshForGuardedRead: async (_session, _token, check) => { joins++; check(); onJoin(); session.token = 'new'; check(); return true; } } });
  const api = s.api(transport); global.fetch = async (url, init) => { calls.push([String(url), init]); return handler(url, init); };
  return { session, guard, witness, calls, api, retire: () => { valid = false; }, handler: value => { handler = value; }, onJoin: value => { onJoin = value; }, onRefresh: value => { onRefresh = value; },
    joins: () => joins, refreshes: () => refreshes, read: () => api.adminItemDetail(session, ' Code ', { includeImage: true }, guard, witness),
    rename: () => api.adminUpdateItemDetail(session, { originalCode: 'Code', code: 'New', name: 'Name' }, guard) };
}
test('actual detail transport keeps GET/auth/manual redirect and same-owner independent refresh under its original witness', async t => {
  const f = fixture(t); f.handler(async () => f.calls.length === 1 ? new Response('{}', { status: 401 }) : new Response('{"code":"Code"}'));
  assert.equal((await f.read()).code, 'Code'); assert.equal(f.joins(), 1); assert.equal(f.refreshes(), 0);
  assert.equal(f.calls[0][0], 'https://erp.example/v1/mobile/admin/items/detail?code=Code&include_image=true'); assert.equal(f.calls[0][1].redirect, 'manual');
  assert.deepEqual(f.calls.map(([, init]) => new Headers(init.headers).get('authorization')), ['Bearer old', 'Bearer new']);
});
for (const status of [302, 401]) test(`retired original detail ${status} response cannot redirect, refresh or send again`, async t => {
  const f = fixture(t); f.handler(async () => { f.retire(); return new Response('{}', { status, headers: status === 302 ? { location: '/next' } : {} }); });
  await assert.rejects(f.read(), /original expired/); assert.equal(f.calls.length, 1); assert.equal(f.joins(), 0);
});
test('retirement during independent token recovery prevents retry and retired pending bodies never escape', async t => {
  const f = fixture(t); f.handler(async () => new Response('{}', { status: 401 })); f.onJoin(f.retire);
  await assert.rejects(f.read(), /original expired|read_witness_expired/); assert.equal(f.calls.length, 1); assert.equal(f.joins(), 1);
  for (const rejected of [false, true]) {
    const g = fixture(t), pending = s.deferred(); g.handler(async () => ({ status: 200, json: () => pending.promise })); const reading = g.read(); await s.tick(); g.retire();
    if (rejected) pending.reject(Error('bad JSON')); else pending.resolve({ code: 'private' }); await assert.rejects(reading, /original expired/);
  }
});
test('real rename transport never follows write redirects, retries valid same-owner401 and denies stale retry', async t => {
  const f = fixture(t); f.handler(async () => new Response('{}', { status: 302, headers: { location: '/next' } })); await assert.rejects(f.rename()); assert.equal(f.calls.length, 1);
  const g = fixture(t); g.handler(async () => g.calls.length === 1 ? new Response('{}', { status: 401 }) : new Response('{"code":"New"}'));
  assert.equal((await g.rename()).code, 'New'); assert.equal(g.refreshes(), 1); assert.equal(g.joins(), 0);
  assert.deepEqual(g.calls.map(([, init]) => new Headers(init.headers).get('authorization')), ['Bearer old', 'Bearer new']);
  const h = fixture(t); h.handler(async () => new Response('{}', { status: 401 })); h.onRefresh(h.retire); await assert.rejects(h.rename(), /original expired/); assert.equal(h.calls.length, 1);
});
test('real group/customer adapters perform exactly one mutation then guarded follow-up detail read', async t => {
  for (const kind of ['group', 'customer']) {
    const f = fixture(t); f.handler(async () => f.calls.length === 1 ? new Response(kind === 'group' ? '{"failed_count":0,"updated_item_codes":["Code"]}' : '{}') : new Response('{"code":"Code"}'));
    await (kind === 'group' ? f.api.adminUpdateItemDetailGroup(f.session, ' Code ', ' Group ', f.guard, f.witness)
      : f.api.adminSetItemDetailCustomerAssigned(f.session, ' Code ', { ref: ' Customer ' }, true, f.guard, f.witness));
    assert.equal(f.calls.length, 2); assert.equal(f.calls[0][1].method, 'POST'); assert.equal(f.calls[1][1].method, 'GET');
    assert.equal(f.calls[1][0], 'https://erp.example/v1/mobile/admin/items/detail?code=Code');
  }
});
