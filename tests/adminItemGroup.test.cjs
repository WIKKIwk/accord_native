const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
function load(file, overrides = {}) {
  const filename = path.resolve(__dirname, '../src', file + '.ts');
  const mod = new Module(filename, module); mod.filename = filename; mod.paths = module.paths;
  mod.require = name => Object.hasOwn(overrides, name) ? overrides[name] : require(name);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return mod.exports;
}
const dart = load('admin/dartJsonString');
const model = load('admin/itemGroupModel', { './dartJsonString': dart });
function fixture() {
  const requests = [], pages = [];
  let status = 200, payload = [];
  const api = load('admin/itemGroupApi', {
    '../authorizedFetch': { authorizedFetch: async (session, url, init = {}) => {
      requests.push({ session, url, init }); return new Response(JSON.stringify(payload), { status });
    } },
    '../gscale/gscaleAdminApi': { adminItemsPage: async (session, options) => {
      requests.push({ session, options }); return pages.shift();
    } },
    '../shared/mobileApiException': load('shared/mobileApiException'),
    './itemGroupModel': model, './dartJsonString': load('admin/dartJsonString'),
  });
  return { ...api, requests, pages, setResponse: (value, code = 200) => { payload = value; status = code; } };
}
const session = { token: 'test' };
// @v2-test test/admin_item_group_customer_policy_test.dart (run against f11910bb separately)
test('finished goods require a customer along the exact parent path and terminate on cycles', () => {
  const row = (name, parent_item_group, item_group_name = name) => ({ name, item_group_name, parent_item_group, is_group: true });
  const groups = [row('All Item Groups', ''), row('Tayyor mahsulot', 'All Item Groups'),
    row('Paketlar', 'Tayyor mahsulot'), row('Yarim tayyor mahsulot', 'All Item Groups')];
  assert.equal(model.adminItemGroupRequiresCustomer('Tayyor mahsulot', groups), true);
  assert.equal(model.adminItemGroupRequiresCustomer(' paketlar ', groups), true);
  assert.equal(model.adminItemGroupRequiresCustomer('Yarim tayyor mahsulot', groups), false);
  assert.equal(model.adminItemGroupRequiresCustomer('A', [row('A', 'B'), row('B', 'A')]), false);
  assert.equal(model.adminItemGroupRequiresCustomer('Alias', [row('Alias', 'Tayyor mahsulot', 'Canonical')]), true);
  assert.equal(model.adminItemGroupRequiresCustomer('Unmatched', groups), false);
  assert.equal(model.adminItemGroupRequiresCustomer('οσ', [row('ΟΣ', 'Tayyor mahsulot')]), true);
  assert.equal(model.adminItemGroupRequiresCustomer('\u0085TAYYOR MAHSULOT\u0085', groups), true);
});

test('group parsers keep defaults and reject incorrect field types', () => {
  assert.deepEqual(model.adminItemGroupFromJson({ name: 'A', is_group: true }),
    { name: 'A', item_group_name: '', parent_item_group: '', is_group: true });
  assert.throws(() => model.adminItemGroupFromJson({ name: 1 }), TypeError);
  assert.throws(() => model.adminItemGroupFromJson({ is_group: 1 }), TypeError);
  assert.deepEqual(model.adminItemGroupBulkMoveResultFromJson({ updated_item_codes: ['A'] }),
    { item_group: '', requested_count: 0, updated_count: 0, failed_count: 0, updated_item_codes: ['A'], failed_item_codes: [] });
  assert.throws(() => model.adminItemGroupBulkMoveResultFromJson({ requested_count: 1.5 }), TypeError);
  assert.throws(() => model.adminItemGroupBulkMoveResultFromJson({ failed_item_codes: [1] }), TypeError);
});

// No matching V2 HTTP recording was found. These mock requests are derived from the f119 source.
test('group and unit reads keep V2 paths, conversion and failure behavior', async () => {
  const api = fixture();
  api.setResponse(['Group A', null, 42, ['x', 'y'], { key: true }]);
  assert.deepEqual(await api.adminItemGroups(session), ['Group A', 'null', '42', '[x, y]', '{key: true}']);
  api.setResponse([{ name: 'A', parent_item_group: 'Root', is_group: true }, {}]);
  assert.deepEqual(await api.adminItemGroupTree(session), [
    { name: 'A', item_group_name: '', parent_item_group: 'Root', is_group: true },
    { name: '', item_group_name: '', parent_item_group: '', is_group: false },
  ]);
  api.setResponse([' kg ', '', 12, 'm', ' \u0085kg\u0085 ']);
  assert.deepEqual(await api.adminItemUoms(session), ['kg', 'm', 'kg']);
  assert.deepEqual(api.requests.map(call => call.url), ['/v1/mobile/admin/item-groups', '/v1/mobile/admin/item-groups/tree', '/v1/mobile/admin/items/uoms']);
  api.setResponse({}, 403);
  await assert.rejects(api.adminItemGroups(session), /Admin item groups failed/);
  await assert.rejects(api.adminItemGroupTree(session), /Admin item group tree failed/);
  await assert.rejects(api.adminItemUoms(session), /Admin item UOMs failed/);
});

test('group create and parent move send V2 fields without trimming', async () => {
  const api = fixture();
  api.setResponse({ name: 'N', item_group_name: 'N', parent_item_group: 'P', is_group: true });
  assert.equal((await api.adminCreateItemGroup(session, ' N ', ' P ', true)).name, 'N');
  assert.equal((await api.adminMoveItemGroupParent(session, ' N ', ' P ')).parent_item_group, 'P');
  assert.deepEqual(api.requests.map(call => [call.url, call.init.method, call.init.headers, JSON.parse(call.init.body)]), [
    ['/v1/mobile/admin/item-groups', 'POST', { 'Content-Type': 'application/json' }, { name: ' N ', parent: ' P ', is_group: true }],
    ['/v1/mobile/admin/item-groups', 'PUT', { 'Content-Type': 'application/json' }, { name: ' N ', parent: ' P ' }],
  ]);
  api.setResponse({ error: 'item not found' }, 409);
  await assert.rejects(api.adminMoveItemGroupParent(session, 'N', 'P'), e => e.code === 'item not found' && e.message === 'Item topilmadi' && e.statusCode === 409);
  api.setResponse({ error: '' }, 403);
  await assert.rejects(api.adminMoveItemGroupParent(session, 'N', 'P'), e => e.code === 'item_group_parent_move_failed' && e.message === 'Bu amal uchun admin huquqi kerak');
  await assert.rejects(api.adminCreateItemGroup(session, 'N', 'P', false), /Admin item group create failed/);
});

test('bulk group move keeps codes, counts, response parsing and error fallback', async () => {
  const api = fixture();
  api.setResponse({ item_group: 'New', requested_count: 2, updated_count: 1, failed_count: 1,
    updated_item_codes: ['A'], failed_item_codes: ['B'] });
  assert.deepEqual(await api.adminMoveItemsToGroup(session, [' A ', 'B'], ' New '), {
    item_group: 'New', requested_count: 2, updated_count: 1, failed_count: 1, updated_item_codes: ['A'], failed_item_codes: ['B'],
  });
  assert.equal(api.requests[0].url, '/v1/mobile/admin/items/bulk-move-group');
  assert.equal(api.requests[0].init.method, 'POST');
  assert.deepEqual(JSON.parse(api.requests[0].init.body), { item_codes: [' A ', 'B'], item_group: ' New ' });
  api.setResponse({ error: 'unknown' }, 500);
  await assert.rejects(api.adminMoveItemsToGroup(session, [], ''), e => e.code === 'unknown' && e.message === 'Mahsulotlar groupga ko‘chirilmadi' && e.statusCode === 500);
  api.setResponse({ error: 'constructor' }, 500);
  await assert.rejects(api.adminMoveItemsToGroup(session, [], ''), e => e.code === 'constructor' && e.message === 'Mahsulotlar groupga ko‘chirilmadi');
});

test('adminItems reuses item page reader in 200-record increments including an empty last page', async () => {
  const api = fixture(); api.pages.push(Array(200).fill({ code: 'A' }), [{ code: 'B' }]);
  const items = await api.adminItems(session, ' q ', ' group ');
  assert.equal(items.length, 201);
  assert.deepEqual(api.requests.map(call => call.options), [
    { query: ' q ', group: ' group ', limit: 200, offset: 0 }, { query: ' q ', group: ' group ', limit: 200, offset: 200 },
  ]);
  const next = fixture(); next.pages.push(Array(200).fill({}), []);
  assert.equal((await next.adminItems(session)).length, 200);
  assert.equal(next.requests.length, 2);
});
