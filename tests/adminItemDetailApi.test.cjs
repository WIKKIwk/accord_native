const assert = require('node:assert/strict');
const test = require('node:test');
const s = require('./adminItemDetailSupport.cjs');
function fixture(handler) {
  let valid = true; const calls = [], session = { token: 't', baseUrl: 'https://erp.example' }, guard = () => { if (!valid) throw Error('retired'); }, witness = () => { guard(); return true; };
  const api = s.api({ authorizedFetch: async (...args) => { calls.push(args); return handler(...args); } });
  return { session, calls, api, guard, witness, retire: () => { valid = false; }, read: (code = ' Code ', options = { includeImage: true }) => api.adminItemDetail(session, code, options, guard, witness) };
}
const success = (value = {}) => ({ status: 200, json: async () => value });
test('detail read, rename and delete retain exact source query/body/200 schemas and read witness boundaries', async () => {
  const f = fixture(async (_session, path, init) => path.includes('include_image') ? success({ code: 'Loaded' }) : init?.method === 'DELETE' ? { status: 200, json: () => { throw Error('must not decode'); } } : success({ code: 'Updated' }));
  assert.equal((await f.read(' \u0085 Code ~* ', { includeImage: true })).code, 'Loaded');
  assert.equal(f.calls[0][1], '/v1/mobile/admin/items/detail?code=Code+~%2A&include_image=true'); assert.equal(f.calls[0][5].readWitness, f.witness);
  await f.read('Code', {}); assert.equal(f.calls[1][1], '/v1/mobile/admin/items/detail?code=Code');
  await f.api.adminUpdateItemDetail(f.session, { originalCode: ' Old \u0085', code: ' New ', name: ' Name ' }, f.guard);
  assert.equal(f.calls[2][2].method, 'PUT'); assert.deepEqual(JSON.parse(f.calls[2][2].body), { original_code: 'Old', code: 'New', name: 'Name' }); assert.equal(f.calls[2][5], undefined);
  await f.api.adminDeleteItemDetail(f.session, ' Code ~* ', f.guard); assert.equal(f.calls[3][1], '/v1/mobile/admin/items/detail?code=Code+~%2A'); assert.equal(f.calls[3][2].method, 'DELETE');
});
test('detail errors preserve source empty error distinction, exact mappings, malformed body fallback and403 wording', async () => {
  for (const [status, value, code, message] of [[404, { error: ' item not found\u0085' }, 'item not found', 'Item topilmadi'],
    [409, { error: 'item code already exists' }, 'item code already exists', 'Bu item code allaqachon mavjud'], [400, { error: 'item name is required' }, 'item name is required', 'Item nomini kiriting'],
    [500, { error: '' }, '', 'Item ma’lumotlari saqlanmadi'], [500, { error: 7 }, 'item_update_failed', 'Item ma’lumotlari saqlanmadi'], [403, {}, 'item_update_failed', 'Itemni tahrirlash uchun admin huquqi kerak']]) {
    const f = fixture(async () => ({ status, json: async () => value }));
    await assert.rejects(f.read(), error => error instanceof s.exception.MobileApiException && error.code === code && error.message === message && error.statusCode === status);
  }
  const f = fixture(async () => ({ status: 500, json: async () => { throw SyntaxError('bad JSON'); } })); await assert.rejects(f.read(), error => error.code === 'item_update_failed');
});
test('delete reuses canonical backend dependency mappings and source nonempty mutation error fallback', async () => {
  for (const [status, error, code, message] of [[409, 'item has active stock', 'item has active stock', 'Item bo‘yicha faol ombor qoldig‘i bor. Avval qoldiqni yakunlang'],
    [403, ' unknown ', 'unknown', 'Bu amal uchun admin huquqi kerak'], [500, '', 'item_delete_failed', 'Item o‘chirilmadi']]) {
    const f = fixture(async () => ({ status, json: async () => ({ error }) }));
    await assert.rejects(f.api.adminDeleteItemDetail(f.session, 'Code', f.guard), problem => problem.code === code && problem.message === message);
  }
});
test('group mutation validates real bulk acknowledgment and only then re-reads without include_image', async () => {
  const f = fixture(async (_session, _path, init) => init?.method === 'POST' ? success({ failed_count: 0, updated_item_codes: [' code '] }) : success({ code: 'Code', item_group: 'Group' }));
  const row = await f.api.adminUpdateItemDetailGroup(f.session, ' Code ', ' Group ', f.guard, f.witness); assert.equal(row.item_group, 'Group');
  assert.equal(f.calls[0][1], '/v1/mobile/admin/items/bulk-move-group'); assert.deepEqual(JSON.parse(f.calls[0][2].body), { item_codes: ['Code'], item_group: 'Group' });
  assert.equal(f.calls[1][1], '/v1/mobile/admin/items/detail?code=Code'); assert.equal(f.calls[1][5].readWitness, f.witness);
  for (const ack of [{ failed_count: 1, updated_item_codes: ['Code'] }, { failed_count: 0, updated_item_codes: ['Other'] }]) {
    const g = fixture(async () => success(ack)); await assert.rejects(g.api.adminUpdateItemDetailGroup(g.session, 'Code', 'Group', g.guard, g.witness), error => error.code === 'item_group_update_failed'); assert.equal(g.calls.length, 1);
  }
});
test('customer assignment/unassignment parses actual customer acknowledgment then performs original-witness item read', async () => {
  for (const assigned of [true, false]) {
    const f = fixture(async () => success({ code: 'Code' }));
    await f.api.adminSetItemDetailCustomerAssigned(f.session, ' Code ', { ref: ' Customer ~* ' }, assigned, f.guard, f.witness);
    assert.equal(f.calls[0][1], assigned ? '/v1/mobile/admin/customers/items/add?ref=Customer+~%2A' : '/v1/mobile/admin/customers/items/remove?ref=Customer+~%2A&item_code=Code');
    assert.equal(f.calls[0][2].method, assigned ? 'POST' : 'DELETE'); if (assigned) assert.deepEqual(JSON.parse(f.calls[0][2].body), { item_code: 'Code' });
    assert.equal(f.calls[1][1], '/v1/mobile/admin/items/detail?code=Code'); assert.equal(f.calls[1][5].readWitness, f.witness);
  }
  const bad = fixture(async () => success({ phone: 7 })); await assert.rejects(bad.api.adminSetItemDetailCustomerAssigned(bad.session, 'Code', { ref: 'C' }, true, bad.guard, bad.witness), TypeError); assert.equal(bad.calls.length, 1);
});
test('pickers reuse canonical DTOs, full group read and explicit single200 customer page without extra pagination', async () => {
  const f = fixture(async (_session, path) => success(path.includes('item-groups') ? [' Group ', '', 7] : [{ ref: ' Raw ', name: 'Name', phone: ' Phone ' }]));
  assert.deepEqual(await f.api.adminItemDetailGroups(f.session, f.guard, f.witness), [' Group ', '', '7']);
  assert.deepEqual(await f.api.adminItemDetailCustomers(f.session, ' name ~*\u0085 ', f.guard, f.witness), [{ ref: ' Raw ', name: 'Name', phone: ' Phone ' }]);
  assert.equal(f.calls[1][1], '/v1/mobile/admin/customers/list?q=name+~%2A&limit=200'); assert.equal(f.calls[1][5].readWitness, f.witness);
  await f.api.adminItemDetailCustomers(f.session, ' ', f.guard, f.witness); assert.equal(f.calls[2][1], '/v1/mobile/admin/customers/list?limit=200');
  for (const [method, text] of [['adminItemDetailGroups', 'Admin item groups failed'], ['adminItemDetailCustomers', 'Admin customers failed']]) {
    const g = fixture(async () => ({ status: 500 })); await assert.rejects(method === 'adminItemDetailGroups' ? g.api[method](g.session, g.guard, g.witness) : g.api[method](g.session, '', g.guard, g.witness), error => String(error) === `Exception: ${text}`);
  }
});
test('invalid source mutation inputs, required original guards and witnesses never send', async () => {
  const f = fixture(async () => { throw Error('unexpected request'); });
  await assert.rejects(f.api.adminDeleteItemDetail(f.session, ' \u0085 ', f.guard), error => error.code === 'item code is required');
  await assert.rejects(f.api.adminUpdateItemDetailGroup(f.session, 'Code', ' ', f.guard, f.witness), error => error.code === 'item_group_update_invalid');
  await assert.rejects(f.api.adminSetItemDetailCustomerAssigned(f.session, 'Code', { ref: ' ' }, true, f.guard, f.witness), error => error.code === 'item_customer_update_invalid');
  for (const guard of [undefined, async () => {}, () => true]) await assert.rejects(f.api.adminUpdateItemDetail(f.session, { originalCode: 'C', code: 'C', name: 'N' }, guard), TypeError);
  await assert.rejects(f.api.adminItemDetail(f.session, 'Code', {}, f.guard), TypeError); assert.equal(f.calls.length, 0);
});
test('success/error body, parsing and transport retirement always override the later owner result or error', async () => {
  for (const status of [200, 500]) for (const when of ['response', 'body', 'body-reject', 'model', 'transport']) {
    if (status !== 200 && when === 'model') continue;
    let f; f = fixture(async () => {
      if (when === 'transport') { f.retire(); throw Error('offline'); } if (when === 'response') f.retire();
      return { status, json: async () => { if (when.startsWith('body')) f.retire(); if (when === 'body-reject') throw Error('bad body');
        return when === 'model' ? { get code() { f.retire(); return 'private'; } } : { code: 'Code', error: 'item not found' }; } };
    });
    await assert.rejects(f.read(), /retired/);
  }
});
test('retirement during group/customer acknowledgment blocks the second step even if it is successful', async () => {
  for (const kind of ['group', 'customer']) {
    let f; f = fixture(async () => ({ status: 200, json: async () => { f.retire(); return { failed_count: 0, updated_item_codes: ['Code'] }; } }));
    await assert.rejects(kind === 'group' ? f.api.adminUpdateItemDetailGroup(f.session, 'Code', 'G', f.guard, f.witness)
      : f.api.adminSetItemDetailCustomerAssigned(f.session, 'Code', { ref: 'C' }, true, f.guard, f.witness), /retired/); assert.equal(f.calls.length, 1);
  }
});
