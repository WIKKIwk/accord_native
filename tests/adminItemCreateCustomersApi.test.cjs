const assert = require('node:assert/strict');
const test = require('node:test');
const s = require('./adminItemCreateSupport.cjs');
const customer = require('./adminUserCreateSupport.cjs').model;
const uri = s.load('admin/dartUri');
function fixture(fetch) {
  const calls = []; let valid = true;
  const guard = () => { if (!valid) throw Error('original retired'); }, witness = () => valid;
  const api = s.load('admin/adminItemCreateCustomersApi', { '../authorizedFetch': { authorizedFetch: async (...args) => { calls.push(args); return fetch(...args); } },
    './adminProductionRequest': s.checked, './adminUserCreateModel': customer, './dartJsonString': s.strings, './dartUri': uri });
  return { api, calls, guard, witness, retire: () => { valid = false; } };
}
test('customer picker read uses source path/order/Dart encoding and exact original witness with canonical raw DTO', async () => {
  const row = { ref: ' Ref ', name: ' Name ', phone: ' Phone ' }, one = fixture(async () => ({ status: 200, json: async () => [row, row] }));
  assert.deepEqual(await one.api.readAdminItemCreateCustomers({}, { query: '\u0085 ~* Name ', limit: 50, offset: 100 }, one.guard, one.witness), [row, row]);
  assert.equal(one.calls[0][1], '/v1/mobile/admin/customers/list?q=~%2A+Name&limit=50&offset=100'); assert.equal(one.calls[0][5].readWitness, one.witness); assert.equal(one.calls[0][4], 10000);
  await one.api.readAdminItemCreateCustomers({}, {}, one.guard, one.witness); assert.equal(one.calls[1][1], '/v1/mobile/admin/customers/list?limit=20');
  await one.api.readAdminItemCreateCustomers({}, { query: ' ', limit: 0, offset: -1 }, one.guard, one.witness); assert.equal(one.calls[2][1], '/v1/mobile/admin/customers/list');
});
test('exact200/nonarray/nonnull strict strings preserve source failure behavior', async () => {
  for (const status of [201, 401, 503]) { const one = fixture(async () => ({ status })); await assert.rejects(one.api.readAdminItemCreateCustomers({}, {}, one.guard, one.witness), error => String(error) === 'Exception: Admin customers failed'); }
  for (const body of [{}, [null], [{ ref: 4 }], [{ name: false }], [{ phone: [] }]]) { const one = fixture(async () => ({ status: 200, json: async () => body })); await assert.rejects(one.api.readAdminItemCreateCustomers({}, {}, one.guard, one.witness), TypeError); }
});
test('missing/async/reentrant/retired guards never send and original read witness is mandatory', async () => {
  const one = fixture(async () => { throw Error('unexpected'); });
  for (const guard of [undefined, async () => {}]) await assert.rejects(one.api.readAdminItemCreateCustomers({}, {}, guard, one.witness), TypeError);
  await assert.rejects(one.api.readAdminItemCreateCustomers({}, {}, one.guard), TypeError);
  let reentrant; reentrant = s.checked.checkedAdminGuard(() => reentrant()); await assert.rejects(one.api.readAdminItemCreateCustomers({}, {}, reentrant, one.witness), TypeError);
  one.retire(); await assert.rejects(one.api.readAdminItemCreateCustomers({}, {}, one.guard, one.witness), /original retired/); assert.equal(one.calls.length, 0);
});
test('original retirement wins at response/body/rejected body and canonical parser getter boundaries', async () => {
  for (const at of ['response', 'body', 'rejected', 'model']) {
    const one = fixture(async () => { if (at === 'response') one.retire(); return { status: 200, json: async () => {
      if (at === 'body' || at === 'rejected') one.retire(); if (at === 'rejected') throw Error('body failed');
      return [at === 'model' ? { get ref() { one.retire(); throw Error('getter failed'); } } : { ref: 'R' }];
    } }; });
    await assert.rejects(one.api.readAdminItemCreateCustomers({}, {}, one.guard, one.witness), /original retired/);
  }
});
