const assert = require('node:assert/strict');
const test = require('node:test');
const s = require('./adminItemCreateSupport.cjs');
const customers = require('./adminUserCreateSupport.cjs').model;
const errors = s.load('shared/mobileApiException'), uri = s.load('admin/dartUri');
function fixture(t) {
  const original = global.fetch; t.after(() => { global.fetch = original; }); const calls = []; let current = true, handler = async () => new Response('[]'), joins = 0;
  const session = { token: 'old', baseUrl: 'https://erp.example' }, guard = () => { if (!current) throw Error('original expired'); }, witness = () => { guard(); return true; };
  const transport = s.load('authorizedFetch', { './auth': { activeSessionToken: () => session.token, refreshSession: async () => { throw Error('legacy refresh must not run for this read'); },
    joinRefreshForGuardedRead: async (_session, _token, current) => { joins++; current(); session.token = 'new'; current(); return true; } } });
  const controls = s.load('workerControlsApi', { './authorizedFetch': transport, './sessionReadScope': {} }), checked = s.load('admin/adminProductionRequest', { '../authorizedFetch': transport, '../shared/mobileApiException': errors, '../workerControlsApi': controls });
  const api = s.load('admin/adminItemCreateCustomersApi', { '../authorizedFetch': transport, './adminProductionRequest': checked, './adminUserCreateModel': customers, './dartJsonString': s.strings, './dartUri': uri });
  global.fetch = async (url, init) => { calls.push([String(url), init]); return handler(url, init); };
  return { session, guard, witness, calls, api, retire: () => { current = false; }, handler: value => { handler = value; }, joins: () => joins, read: () => api.readAdminItemCreateCustomers(session, { query: ' name ', limit: 50 }, guard, witness) };
}
test('real customer reader sends source GET/auth/manual redirect and joins independent refresh under original read witness', async t => {
  const f = fixture(t); f.handler(async () => f.calls.length === 1 ? new Response('{}', { status: 401 }) : new Response('[{"ref":"Raw Ref","name":"Raw Name","phone":" Raw Phone "}]'));
  assert.deepEqual(await f.read(), [{ ref: 'Raw Ref', name: 'Raw Name', phone: ' Raw Phone ' }]); assert.equal(f.joins(), 1);
  assert.deepEqual(f.calls.map(([, init]) => new Headers(init.headers).get('authorization')), ['Bearer old', 'Bearer new']);
  assert.equal(f.calls[0][0], 'https://erp.example/v1/mobile/admin/customers/list?q=name&limit=50'); assert.equal(f.calls[0][1].redirect, 'manual');
});
for (const status of [302, 401]) test(`retired original customer request cannot redirect, refresh or send again after ${status}`, async t => {
  const f = fixture(t); f.handler(async () => { f.retire(); return new Response('{}', { status, headers: status === 302 ? { location: '/next' } : {} }); });
  await assert.rejects(f.read(), /original expired/); assert.equal(f.calls.length, 1); assert.equal(f.joins(), 0);
});
test('real reader rejects retired pending success/error response bodies and never returns another owner DTO', async t => {
  for (const reject of [false, true]) {
    const f = fixture(t), body = s.deferred(); f.handler(async () => ({ status: 200, json: () => body.promise })); const pending = f.read(); await s.tick(); f.retire();
    if (reject) body.reject(Error('body parse')); else body.resolve([{ ref: 'private', name: 'private', phone: '' }]); await assert.rejects(pending, /original expired/); assert.equal(f.calls.length, 1);
  }
});
