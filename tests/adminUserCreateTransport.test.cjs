const assert = require('node:assert/strict');
const test = require('node:test');
const { load, model, strings, exception, deferred, tick } = require('./adminUserCreateSupport.cjs');
const workerModel = require('./adminWorkerDetailSupport.cjs').workerModel;
const customerModel = load('admin/adminCustomerDetailModel', { '../shared/catalogApi': { supplierItemFromJson: value => value }, './dartJsonString': strings });
const originalFetch = global.fetch;
function fixture(t) {
  t.after(() => { global.fetch = originalFetch; }); let current = true, handler = async () => new Response('{}'), refresh = async () => true, join = async () => false;
  const session = { baseUrl: 'https://server.example', token: 'token' }, calls = [];
  const auth = { activeSessionToken: () => session.token, refreshSession: () => refresh(), joinRefreshForGuardedRead: (...args) => join(...args) }, transport = load('authorizedFetch', { './auth': auth });
  const controls = load('workerControlsApi', { './authorizedFetch': transport, './sessionReadScope': {} }), request = load('admin/adminProductionRequest', { '../authorizedFetch': transport, '../shared/mobileApiException': exception, '../workerControlsApi': controls });
  const api = load('admin/adminUserCreateApi', { '../authorizedFetch': transport, './adminApiError': load('admin/adminApiError', { '../shared/mobileApiException': exception }), './adminProductionRequest': request,
    './adminUserCreateModel': model, './adminWorkerDetailModel': workerModel, './adminCustomerDetailModel': customerModel, './dartJsonString': strings });
  global.fetch = async (url, init) => { const call = { url: new URL(url), init }; calls.push(call); return handler(call); };
  const guard = () => { if (!current) throw Error('original expired'); }, witness = () => { guard(); return true; };
  return { session, api, calls, guard, witness, retire: () => { current = false; }, handler: value => { handler = value; }, refresh: value => { refresh = value; }, join: value => { join = value; } };
}
const operations = {
  roles: f => f.api.readAdminUserCreateRoles(f.session, f.guard, f.witness), customer: f => f.api.createAdminUserCreateCustomer(f.session, ' Name ', ' Phone ', f.guard),
  supplier: f => f.api.createAdminUserCreateSupplier(f.session, ' Name ', ' Phone ', f.guard), material: f => f.api.createAdminUserCreateMaterial(f.session, ' Name ', ' Phone ', ['Kley'], f.guard),
  system: f => f.api.createAdminUserCreateSystem(f.session, 'metalayzer', ' Name ', ' Phone ', f.guard),
};
const payload = name => name === 'roles' ? [{ id: 'metalayzer', base_role: 'metalayzer', label: 'Metal', capability_codes: [], system: true }] : name === 'system' ? { id: 'ID', role: 'metalayzer', name: ' Name ', phone: ' Phone ' } : { ref: ' Ref ', name: ' Name ', phone: ' Phone ', code: 'CODE' };
test('real create adapters retain source routes/payloads and existing system/customer DTO projection', async t => {
  const f = fixture(t);
  for (const name of Object.keys(operations)) { f.handler(async () => new Response(JSON.stringify(payload(name)))); const result = await operations[name](f); assert.ok(result); }
  assert.deepEqual(f.calls.map(call => [call.init.method, call.url.pathname]), [['GET', '/v1/mobile/admin/roles'], ['POST', '/v1/mobile/admin/customers'], ['POST', '/v1/mobile/admin/suppliers'], ['POST', '/v1/mobile/admin/material-taminotchilar'], ['POST', '/v1/mobile/admin/system-users']]);
  assert.deepEqual(JSON.parse(f.calls[1].init.body), { name: ' Name ', phone: 'Phone' }); assert.deepEqual(JSON.parse(f.calls[2].init.body), { name: ' Name ', phone: ' Phone ' });
  assert.deepEqual(JSON.parse(f.calls[3].init.body), { name: ' Name ', phone: ' Phone ', assigned_item_groups: ['Kley'] }); assert.deepEqual(JSON.parse(f.calls[4].init.body), { role: 'metalayzer', name: ' Name ', phone: ' Phone ' });
  f.handler(async () => new Response('{}')); await f.api.createAdminUserCreateCustomer(f.session, 'N', '\u0085 \u0085', f.guard); assert.deepEqual(JSON.parse(f.calls.at(-1).init.body), { name: 'N' });
  await assert.rejects(f.api.createAdminUserCreateSystem(f.session, 'customer', 'N', '', f.guard), /Unsupported/); assert.equal(f.calls.length, 6);
});
test('source API customer/material errors expose server code while supplier/system preserve generic failure', async t => {
  const f = fixture(t); f.handler(async () => new Response(JSON.stringify({ error: ' invalid phone ' }), { status: 400 }));
  await assert.rejects(operations.customer(f), error => error instanceof exception.MobileApiException && error.code === 'invalid phone' && error.message === 'invalid phone');
  await assert.rejects(operations.material(f), error => error.code === 'invalid phone'); await assert.rejects(operations.supplier(f), error => !(error instanceof exception.MobileApiException) && error.message === 'Admin supplier create failed');
  await assert.rejects(operations.system(f), /Admin system user create failed/);
});
for (const name of Object.keys(operations)) {
  for (const status of name === 'customer' || name === 'material' ? [200, 400] : [200]) test(`${name} rejects retired successful or failed body settlement before returning a stale model/error${status}`, async t => {
    const f = fixture(t), body = deferred(); f.handler(async () => ({ status, json: () => body.promise })); const pending = operations[name](f); await tick(); f.retire(); body.resolve(status === 200 ? payload(name) : { error: 'forbidden' }); await assert.rejects(pending, /original expired/); assert.equal(f.calls.length, 1);
  });
  test(`${name} original scope blocks stale redirect/auth continuation`, async t => {
    const f = fixture(t), first = deferred(); f.handler(async () => first.promise); const pending = operations[name](f); await tick(); f.retire(); first.resolve(new Response('{}', { status: 302, headers: { location: '/next' } })); await assert.rejects(pending, /original expired/); assert.equal(f.calls.length, 1);
  });
}
test('scoped role read joins independent refresh without changing original read witness; write refresh is fenced too', async t => {
  const f = fixture(t); let count = 0; f.handler(async () => ++count === 1 ? new Response('{}', { status: 401 }) : new Response(JSON.stringify(payload('roles'))));
  f.join(async (_session, _failed, guard) => { guard(); f.session.token = 'new'; guard(); return true; }); const result = await operations.roles(f); assert.equal(result[0].base_role, 'metalayzer'); assert.equal(f.calls.length, 2);
  f.handler(async () => new Response('{}', { status: 401 })); f.refresh(async () => { f.retire(); f.session.token = 'newer'; return true; }); await assert.rejects(operations.customer(f), /original expired/); assert.equal(f.calls.length, 3);
});
test('body parse rejection, parser side effects and accidental async command guards all fail closed', async t => {
  const f = fixture(t), body = deferred(); f.handler(async () => ({ status: 200, json: () => body.promise })); const pending = operations.customer(f); await tick(); f.retire(); body.reject(Error('parse failed')); await assert.rejects(pending, /original expired/);
  const g = fixture(t), value = { ref: 'R', name: 'N' }; Object.defineProperty(value, 'phone', { get() { g.retire(); return ''; } }); g.handler(async () => ({ status: 200, json: async () => value })); await assert.rejects(operations.customer(g), /original expired/);
  const h = fixture(t); await assert.rejects(h.api.createAdminUserCreateCustomer(h.session, 'N', '', () => Promise.reject(Error('async'))), /Invalid admin guard/); assert.deepEqual(h.calls, []); await tick();
});
