const assert = require('node:assert/strict');
const test = require('node:test');
const { load, strings, checked } = require('./adminUsersSupport.cjs');
const errors = load('shared/mobileApiException'), uri = load('admin/dartUri');
const catalog = load('shared/catalogApi', { '../authorizedFetch': {}, '../appPreferences': {}, './mobileApiException': errors, './searchActivityStore': { SearchActivityStore: class {} } });
const groups = load('admin/itemGroupModel', { './dartJsonString': strings });
const mutations = load('admin/itemGroupApi', { '../authorizedFetch': {}, '../gscale/gscaleAdminApi': {}, '../shared/mobileApiException': errors, './dartJsonString': strings, './itemGroupModel': groups });
function api(fetch) {
  return load('admin/adminItemCatalogApi', { '../authorizedFetch': { authorizedFetch: fetch }, '../shared/catalogApi': catalog,
    './adminProductionRequest': checked, './dartJsonString': strings, './dartUri': uri, './itemGroupApi': mutations, './itemGroupModel': groups });
}
function fixture(handler) {
  let valid = true; const calls = [], session = { token: 't', baseUrl: 'https://erp.example' }, witness = () => valid;
  const guard = () => { if (!valid) throw Error('retired'); };
  const a = api(async (...args) => { calls.push(args); return handler(...args); });
  return { a, session, calls, guard, witness, retire: () => { valid = false; } };
}
const input = () => ({ code: ' code\u0085 ', name: ' raw name ', uom: ' kg ', itemGroup: ' raw group ', customerRef: ' customer\u0085 ' });
const item = { code: 'created', name: 'Created', order_microns: [12, null, '3'], customer_names: [' One ', ''] };
test('scoped catalog reads preserve source query order, Dart trim/encoding, optional positive paging and original witness', async () => {
  const f = fixture(async () => ({ status: 200, json: async () => [item] }));
  const rows = await f.a.adminCatalogItemsPage(f.session, { query: '\u0085 ~* name ', group: ' G~* ', limit: 80, offset: 160 }, f.guard, f.witness);
  const [session, path, init, check, timeout, options] = f.calls[0]; check();
  assert.equal(session, f.session); assert.equal(path, '/v1/mobile/admin/items?q=~%2A+name&group=G~%2A&limit=80&offset=160');
  assert.deepEqual(init, {}); assert.equal(timeout, 10000); assert.equal(options.readWitness, f.witness);
  assert.deepEqual(rows, [catalog.supplierItemFromJson(item)]); assert.equal(Object.isFrozen(rows), true);
  await f.a.adminCatalogItemsPage(f.session, {}, f.guard, f.witness); assert.equal(f.calls[1][1], '/v1/mobile/admin/items?limit=50');
  await f.a.adminCatalogItemsPage(f.session, { query: ' ', group: '\u0085', limit: 0, offset: -1 }, f.guard, f.witness); assert.equal(f.calls[2][1], '/v1/mobile/admin/items');
});
test('UOM read retains string-only filtering, source trim, duplicates/order and empty success without inventing a default', async () => {
  const f = fixture(async () => ({ status: 200, json: async () => [' kg ', null, 7, 'KG', ' kg ', '\u0085', 'm\u0085'] }));
  assert.deepEqual(await f.a.adminCatalogItemUoms(f.session, f.guard, f.witness), ['kg', 'KG', 'kg', 'm']);
  assert.equal(f.calls[0][1], '/v1/mobile/admin/items/uoms');
  const empty = fixture(async () => ({ status: 200, json: async () => [] }));
  assert.deepEqual(await empty.a.adminCatalogItemUoms(empty.session, empty.guard, empty.witness), []);
});
test('source create trims/omits only code and customer_ref, retains raw other fields and captures before pending response', async () => {
  let resolve; const body = new Promise(yes => { resolve = yes; }), f = fixture(async () => ({ status: 200, json: () => body })), value = input();
  const pending = f.a.createAdminCatalogItem(f.session, value, f.guard); value.name = 'new'; resolve(item);
  assert.deepEqual(await pending, catalog.supplierItemFromJson(item));
  const [, path, init, check, timeout, options] = f.calls[0]; check();
  assert.equal(path, '/v1/mobile/admin/items'); assert.equal(init.method, 'POST'); assert.equal(init.headers['Content-Type'], 'application/json');
  assert.deepEqual(JSON.parse(init.body), { code: 'code', name: ' raw name ', uom: ' kg ', item_group: ' raw group ', customer_ref: 'customer' });
  assert.equal(timeout, undefined); assert.equal(options, undefined);
  await f.a.createAdminCatalogItem(f.session, { ...input(), code: '\u0085 ', customerRef: ' ' }, f.guard);
  assert.deepEqual(JSON.parse(f.calls[1][2].body), { name: ' raw name ', uom: ' kg ', item_group: ' raw group ' });
});
test('bulk move sends original ordered codes including duplicates and raw destination, decodes actual partial-result DTO', async () => {
  const result = { item_group: 'G', requested_count: 3, updated_count: 1, failed_count: 2, updated_item_codes: [' A '], failed_item_codes: ['B', 'B'] };
  const f = fixture(async () => ({ status: 200, json: async () => result })), codes = [' A ', 'B', 'B'];
  assert.deepEqual(await f.a.moveAdminCatalogItems(f.session, codes, ' raw G ', f.guard), groups.adminItemGroupBulkMoveResultFromJson(result));
  assert.equal(f.calls[0][1], '/v1/mobile/admin/items/bulk-move-group');
  assert.deepEqual(JSON.parse(f.calls[0][2].body), { item_codes: codes, item_group: ' raw G ' });
});
test('missing, async, reentrant or initially retired command guards never dispatch; reads additionally require witness', async () => {
  const f = fixture(async () => { throw Error('unexpected send'); });
  for (const guard of [undefined, async () => {}]) {
    await assert.rejects(f.a.createAdminCatalogItem(f.session, input(), guard), TypeError);
    await assert.rejects(f.a.moveAdminCatalogItems(f.session, ['A'], 'G', guard), TypeError);
    await assert.rejects(f.a.adminCatalogItemUoms(f.session, guard, f.witness), TypeError);
  }
  await assert.rejects(f.a.adminCatalogItemsPage(f.session, {}, f.guard), TypeError);
  let recursive; recursive = checked.checkedAdminGuard(() => recursive());
  await assert.rejects(f.a.createAdminCatalogItem(f.session, input(), recursive), TypeError);
  f.retire(); await assert.rejects(f.a.createAdminCatalogItem(f.session, input(), f.guard), /retired/); assert.equal(f.calls.length, 0);
});
test('non200 reads preserve source plain Exception text rather than introducing a MobileApiException or retry', async () => {
  const f = fixture(async () => ({ status: 503 }));
  await assert.rejects(f.a.adminCatalogItemUoms(f.session, f.guard, f.witness), error => String(error) === 'Exception: Admin item UOMs failed');
  await assert.rejects(f.a.adminCatalogItemsPage(f.session, {}, f.guard, f.witness), error => String(error) === 'Exception: Admin items failed');
  assert.equal(f.calls.length, 2);
});
test('create/move use the real source shared mutation mappings, including trim, nonstring fallback,403 and exact200', async () => {
  for (const [status, value, code, message] of [[409, { error: ' item code already exists\u0085' }, 'item code already exists', 'Bu item code allaqachon mavjud'],
    [403, { error: 'unknown' }, 'unknown', 'Bu amal uchun admin huquqi kerak'], [500, { error: 7 }, 'item_create_failed', 'Item yaratilmadi'],
    [201, { error: ' ' }, 'item_create_failed', 'Item yaratilmadi']]) {
    const f = fixture(async () => ({ status, json: async () => value }));
    await assert.rejects(f.a.createAdminCatalogItem(f.session, input(), f.guard), error => error instanceof errors.MobileApiException && error.code === code && error.message === message && error.statusCode === status);
  }
  const f = fixture(async () => ({ status: 500, json: async () => { throw SyntaxError('bad'); } }));
  await assert.rejects(f.a.moveAdminCatalogItems(f.session, ['A'], 'G', f.guard), error => error.code === 'item_group_bulk_move_failed' && error.message === 'Mahsulotlar groupga ko‘chirilmadi');
});
test('all read/write response, body rejection and model getter boundaries preserve original retirement over later errors', async () => {
  for (const method of ['uoms', 'items', 'create', 'move']) for (const when of ['response', 'body', 'body-error', 'model']) {
    if (method === 'uoms' && when === 'model') continue;
    let f; f = fixture(async () => { if (when === 'response') f.retire(); return { status: 200, json: async () => {
      if (when.startsWith('body')) f.retire(); if (when === 'body-error') throw Error('body failed');
      const value = when === 'model' ? { get code() { f.retire(); throw Error('bad getter'); }, get item_group() { f.retire(); throw Error('bad getter'); } } : item;
      return method === 'uoms' ? ['kg'] : method === 'items' ? [value] : value;
    } }; });
    const promise = method === 'uoms' ? f.a.adminCatalogItemUoms(f.session, f.guard, f.witness) : method === 'items' ? f.a.adminCatalogItemsPage(f.session, {}, f.guard, f.witness)
      : method === 'create' ? f.a.createAdminCatalogItem(f.session, input(), f.guard) : f.a.moveAdminCatalogItems(f.session, ['A'], 'G', f.guard);
    await assert.rejects(promise, /retired/);
  }
});
test('error-body retirement and transport retirement take precedence over source mutation/network failures', async () => {
  for (const method of ['create', 'move']) for (const when of ['transport', 'error-body', 'malformed-error-body']) {
    let f; f = fixture(async () => {
      if (when === 'transport') { f.retire(); throw Error('offline'); }
      return { status: 500, json: async () => { f.retire(); if (when === 'malformed-error-body') throw Error('bad'); return { error: 'item code is required' }; } };
    });
    await assert.rejects(method === 'create' ? f.a.createAdminCatalogItem(f.session, input(), f.guard) : f.a.moveAdminCatalogItems(f.session, ['A'], 'G', f.guard), /retired/);
  }
});
