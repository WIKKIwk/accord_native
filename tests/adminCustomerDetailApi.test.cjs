const assert = require('node:assert/strict');
const test = require('node:test');
const { load, strings, checked, model: users } = require('./adminUsersSupport.cjs');
const mobile = load('shared/mobileApiException'), uri = load('admin/dartUri');
const controls = load('workerControlsApi', { './authorizedFetch': {}, './sessionReadScope': {} });
const catalog = load('shared/catalogApi', { '../authorizedFetch': {}, '../appPreferences': {}, './mobileApiException': mobile, './searchActivityStore': { SearchActivityStore: class {} } });
const models = load('admin/adminCustomerDetailModel', { '../shared/catalogApi': catalog, './dartJsonString': strings });
const errors = load('admin/adminApiError', { '../shared/mobileApiException': mobile });
const itemErrors = load('admin/itemGroupApi', { '../authorizedFetch': {}, '../gscale/gscaleAdminApi': {}, '../shared/mobileApiException': mobile, './dartJsonString': strings, './itemGroupModel': {} });
const assignmentModel = load('admin/adminWarehouseAssignmentApi', { '../authorizedFetch': {}, './adminApiError': errors, './adminProductionRequest': checked, './adminUsersModel': users, './dartJsonString': strings });
const dto = (patch = {}) => ({ ref: 'actual', name: 'Customer', phone: '123', code: 'code', assigned_item_groups: ['Group'], assigned_warehouses: ['Warehouse'], ...patch });
const ok = body => ({ status: 200, json: async () => body });
function api(fetch) {
  const auth = { authorizedFetch: fetch };
  const roles = load('admin/adminUsersApi', { '../authorizedFetch': auth, './adminProductionRequest': checked, './adminUsersModel': users, './dartJsonString': strings });
  const assignments = load('admin/adminWarehouseSettingsApi', { '../authorizedFetch': auth, '../shared/catalogApi': catalog, '../shared/mobileApiException': mobile,
    './adminApiError': errors, './adminProductionRequest': checked, './adminWarehouseAssignmentApi': assignmentModel, './dartJsonString': strings });
  return load('admin/adminCustomerDetailApi', { '../authorizedFetch': auth, '../shared/catalogApi': catalog, '../shared/mobileApiException': mobile, '../workerControlsApi': controls,
    './adminApiError': errors, './adminCustomerDetailModel': models, './adminProductionRequest': checked, './adminUsersApi': roles, './adminUsersModel': users,
    './adminWarehouseSettingsApi': assignments, './dartJsonString': strings, './dartUri': uri, './itemGroupApi': itemErrors });
}
const guard = () => {}, witness = () => true;
test('customer DTO retains strict fields and source stringification for scopes instead of role-assignment string casts', () => {
  assert.deepEqual(models.adminCustomerDetailFromJson({}), { ref: '', name: '', phone: '', avatar_url: '', code: '', code_locked: false, code_retry_after_sec: 0, assigned_items: [], assigned_item_groups: [], assigned_warehouses: [] });
  const value = models.adminCustomerDetailFromJson({ assigned_item_groups: [null, true, 1, { a: 'b' }], assigned_warehouses: ['  raw  ', ['x']] });
  assert.deepEqual(value.assigned_item_groups, ['null', 'true', '1', '{a: b}']); assert.deepEqual(value.assigned_warehouses, ['  raw  ', '[x]']);
  for (const patch of [{ ref: 2 }, { code_locked: 1 }, { code_retry_after_sec: 1.5 }, { assigned_item_groups: 'x' }, { assigned_items: [null] }]) assert.throws(() => models.adminCustomerDetailFromJson(patch), TypeError);
});
test('customer scope normalization preserves first spelling and case-insensitive set comparison; operation errors follow source Exception suppression', () => {
  assert.deepEqual(models.adminCustomerScopeValues([' Rulon ', 'kley', 'RULON', '\u0085 ABC \u0085', '', 'Kley']), ['ABC', 'kley', 'Rulon']);
  assert.equal(models.adminCustomerSameScope([' Rulon ', 'Kley', 'Kley'], ['kley', 'RULON']), true); assert.equal(models.adminCustomerSameScope(['A'], ['B']), false);
  assert.equal(models.adminCustomerOperationError('Failed', { toString: () => 'Exception: offline' }), 'Failed');
  assert.equal(models.adminCustomerOperationError('Failed', { toString: () => 'failed' }), 'Failed');
  assert.equal(models.adminCustomerOperationError('Failed', new mobile.MobileApiException({ code: 'x', message: 'Server rejected' })), 'Failed: Server rejected');
});
test('customer API retains raw ref/item query and exact methods, bodies, read witness and empty delete acknowledgment', async () => {
  const calls = [], a = api(async (_session, path, init, check, timeout, options) => { check?.(); calls.push({ path, init, timeout, options }); return ok(dto()); });
  const ref = ' raw~* ', suffix = '?ref=+raw~%2A+';
  await a.adminCustomerDetail({}, ref, guard, witness); await a.adminUpdateCustomerPhone({}, ref, ' phone ', guard); await a.adminRegenerateCustomerCode({}, ref, guard);
  await a.adminRemoveCustomer({}, ref, guard); await a.adminAssignCustomerItem({}, ref, ' item ', guard); await a.adminRemoveCustomerItem({}, ref, ' item~* ', guard);
  assert.deepEqual(calls.map(c => [c.path, c.init?.method ?? 'GET']), [['/v1/mobile/admin/customers/detail' + suffix, 'GET'], ['/v1/mobile/admin/customers/phone' + suffix, 'PUT'],
    ['/v1/mobile/admin/customers/code/regenerate' + suffix, 'POST'], ['/v1/mobile/admin/customers/remove' + suffix, 'DELETE'], ['/v1/mobile/admin/customers/items/add' + suffix, 'POST'], ['/v1/mobile/admin/customers/items/remove' + suffix + '&item_code=+item~%2A+', 'DELETE']]);
  assert.deepEqual(JSON.parse(calls[1].init.body), { phone: ' phone ' }); assert.deepEqual(JSON.parse(calls[4].init.body), { item_code: ' item ' }); assert.equal(calls[0].options.readWitness, witness);
  assert.equal(calls[0].timeout, 10000); assert.equal(calls[1].options, undefined); assert.equal(calls[3].init.body, undefined);
  await api(async () => ({ status: 200, json: async () => { throw Error('DELETE must not decode'); } })).adminRemoveCustomer({}, 'r', guard);
});
test('customer plain failures and item mutation failures retain distinct source message rules', async () => {
  const failed = api(async () => ({ status: 409, json: async () => ({ error: 'item not found' }) }));
  for (const [method, args, failure] of [['adminCustomerDetail', ['r'], 'detail'], ['adminUpdateCustomerPhone', ['r', 'p'], 'phone update'], ['adminRegenerateCustomerCode', ['r'], 'code regenerate'], ['adminRemoveCustomer', ['r'], 'remove']]) {
    await assert.rejects(failed[method]({}, ...args), error => String(error) === `Exception: Admin customer ${failure} failed`);
  }
  await assert.rejects(failed.adminAssignCustomerItem({}, 'r', 'i', guard), error => error.code === 'item not found' && String(error) === 'Item topilmadi');
  const forbidden = api(async () => ({ status: 403, json: async () => ({ error: 'unknown' }) })); await assert.rejects(forbidden.adminRemoveCustomerItem({}, 'r', 'i', guard), error => String(error) === 'Bu amal uchun admin huquqi kerak');
  const invalidJson = api(async () => ({ status: 500, json: async () => { throw Error('nonJSON'); } })); await assert.rejects(invalidJson.adminAssignCustomerItem({}, 'r', 'i'), error => error.code === 'item_customer_add_failed' && error.message === 'Customer itemga ulanmadi');
});
test('customer Add list reads every200-row source page and stops at the first short page without sorting', async () => {
  const calls = [], a = api(async (_session, path, _init, check, timeout, options) => { check(); assert.equal(options.readWitness, witness); assert.equal(timeout, 10000); calls.push(path);
    return ok(Array.from({ length: calls.length === 1 ? 200 : 2 }, (_, i) => ({ code: `${calls.length}-${i}`, name: `Name ${i}` }))); });
  const result = await a.readAdminCustomerAvailableItems({}, guard, witness); assert.equal(result.length, 202); assert.equal(result[200].code, '2-0');
  assert.deepEqual(calls, ['/v1/mobile/admin/items?limit=200', '/v1/mobile/admin/items?limit=200&offset=200']);
});
test('material detail hydrates missing scopes sequentially from first matching role and normalized warehouse assignments', async () => {
  const calls = [], a = api(async (_session, path, _init, check, _timeout, options) => { check(); calls.push(path); assert.equal(options.readWitness, witness);
    if (path.startsWith('/v1/mobile/admin/material-taminotchilar/detail')) return ok({ ref: 'REF', name: 'Material' });
    if (path.endsWith('/role-assignments')) return ok([{ principal_role: 'customer', principal_ref: 'REF', assigned_item_groups: ['wrong'] }, { principal_role: 'material_taminotchi', principal_ref: ' ref ', assigned_item_groups: [' Rulon ', 'kley', 'RULON'] }, { principal_role: 'material_taminotchi', principal_ref: 'REF', assigned_item_groups: ['not second'] }]);
    return ok([{ principal_role: 'material_taminotchi', principal_ref: ' ref ', warehouse: ' W2 ' }, { principal_role: 'material_taminotchi', principal_ref: 'REF', warehouse: 'w2' }, { principal_role: 'material_taminotchi', principal_ref: 'REF', warehouse: 'W1' }, { principal_role: 'customer', principal_ref: 'REF', warehouse: 'wrong' }]);
  });
  const result = await a.adminMaterialTaminotchiDetail({}, ' REF ', guard, witness); assert.deepEqual(result.assigned_item_groups, ['kley', 'Rulon']); assert.deepEqual(result.assigned_warehouses, ['W1', 'W2']);
  assert.deepEqual(calls, ['/v1/mobile/admin/material-taminotchilar/detail?ref=+REF+', '/v1/mobile/admin/role-assignments', '/v1/mobile/admin/warehouses/assignments']);
});
test('material payload fields present but null deliberately skip old-backend fallback reads', async () => {
  let calls = 0; const a = api(async () => { calls++; return ok({ ref: 'r', assigned_item_groups: null, assigned_warehouses: null }); });
  const result = await a.adminMaterialTaminotchiDetail({}, 'r', guard, witness); assert.equal(calls, 1); assert.deepEqual(result.assigned_item_groups, []); assert.deepEqual(result.assigned_warehouses, []);
});
test('material phone/regenerate keep legacy mutation transport but hydrate any missing fields with the original scoped reader', async () => {
  const calls = [], a = api(async (_session, path, init, check, _timeout, options) => { check(); calls.push({ path, init, options });
    return path.endsWith('/role-assignments') ? ok([]) : ok({ ref: 'r', assigned_warehouses: [] }); });
  await a.adminUpdateMaterialTaminotchiPhone({}, ' raw ', 'p', guard, witness); await a.adminRegenerateMaterialTaminotchiCode({}, ' raw ', guard, witness);
  assert.equal(calls[0].options, undefined); assert.deepEqual(JSON.parse(calls[0].init.body), { phone: 'p' }); assert.equal(calls[1].options.readWitness, witness);
  assert.equal(calls[2].init.method, 'POST'); assert.equal(calls[2].init.body, undefined); assert.equal(calls[3].options.readWitness, witness);
});
test('material group update normalizes source groups, trims only its write ref, and rehydrates response', async () => {
  const calls = [], a = api(async (_session, path, init, check) => { check(); calls.push({ path, init }); return ok(dto()); });
  await a.adminUpdateMaterialTaminotchiItemGroups({}, ' raw ', [' Rulon ', 'Kley', 'RULON'], guard, witness);
  assert.equal(calls[0].path, '/v1/mobile/admin/material-taminotchilar/item-groups?ref=raw'); assert.deepEqual(JSON.parse(calls[0].init.body), { assigned_item_groups: ['Kley', 'Rulon'] });
  await assert.rejects(a.adminUpdateMaterialTaminotchiItemGroups({}, 'r', [' '], guard, witness), error => error.code === 'material_item_groups_required'); assert.equal(calls.length, 1);
});
test('material404 fallback keeps first role id/apparatus, saves normalized scope then rereads raw detail ref', async () => {
  const calls = [], a = api(async (_session, path, init, check) => { check(); calls.push({ path, init });
    if (path.includes('/item-groups?')) return { status: 404 };
    if (path.endsWith('/role-assignments')) return init?.method === 'PUT' ? ok(JSON.parse(init.body)) : ok([
      { principal_role: 'material_taminotchi', principal_ref: ' ref ', role_id: ' custom role ', assigned_apparatus: ['apparatus:default:press'] },
      { principal_role: 'material_taminotchi', principal_ref: 'REF', role_id: 'later role' }]);
    return ok(dto({ assigned_item_groups: ['New'] }));
  });
  await a.adminUpdateMaterialTaminotchiItemGroups({}, ' REF ', ['New'], guard, witness);
  assert.deepEqual(calls.map(c => c.path), ['/v1/mobile/admin/material-taminotchilar/item-groups?ref=REF', '/v1/mobile/admin/role-assignments', '/v1/mobile/admin/role-assignments', '/v1/mobile/admin/material-taminotchilar/detail?ref=+REF+']);
  assert.deepEqual(JSON.parse(calls[2].init.body), { principal_role: 'material_taminotchi', principal_ref: 'REF', role_id: ' custom role ', assigned_apparatus: ['apparatus:default:press'], assigned_item_groups: ['New'] });
});
test('material404 without existing role uses source default role and omits empty assigned_apparatus', async () => {
  const calls = [], a = api(async (_session, path, init, check) => { check(); calls.push({ path, init }); if (path.includes('/item-groups?')) return { status: 404 };
    if (path.endsWith('/role-assignments')) return init?.method === 'PUT' ? ok(JSON.parse(init.body)) : ok([]); return ok(dto()); });
  await a.adminUpdateMaterialTaminotchiItemGroups({}, 'r', ['Group'], guard, witness);
  assert.deepEqual(JSON.parse(calls[2].init.body), { principal_role: 'material_taminotchi', principal_ref: 'r', role_id: 'material_taminotchi', assigned_item_groups: ['Group'] });
});
test('role-upsert validates canonical apparatus before send and handles source known/unknown admin errors', async () => {
  let calls = 0; const a = api(async () => { calls++; return { status: 409, json: async () => ({ error: 'server says no' }) }; });
  const assignment = { principal_role: 'material_taminotchi', principal_ref: 'r', role_id: 'role', assigned_apparatus: ['old name'], assigned_item_groups: [] };
  await assert.rejects(a.adminCustomerUpsertRoleAssignment({}, assignment, guard), error => error.code === 'apparatus_id_invalid'); assert.equal(calls, 0);
  await assert.rejects(a.adminCustomerUpsertRoleAssignment({}, { ...assignment, assigned_apparatus: [] }, guard), error => error.message === 'server says no'); assert.equal(calls, 1);
});
test('material fallback plain read failures remain source Exceptions for group error-message suppression', async () => {
  const a = api(async (_session, path) => path.includes('/detail?') ? ok({}) : { status: 500 });
  await assert.rejects(a.adminMaterialTaminotchiDetail({}, 'r', guard, witness), error => String(error) === 'Exception: Admin role assignments failed');
});
test('retirement during each material fallback and item-error body cannot issue subsequent effects', async () => {
  let current = true; const check = () => { if (!current) throw Error('retired'); }, calls = [];
  const a = api(async (_session, path) => { calls.push(path); if (path.includes('/detail?')) return ok({}); return { status: 200, json: async () => { current = false; return []; } }; });
  await assert.rejects(a.adminMaterialTaminotchiDetail({}, 'r', check, () => current), /retired/); assert.equal(calls.length, 2);
  current = true; const b = api(async () => ({ status: 409, json: async () => { current = false; return { error: 'item not found' }; } })); await assert.rejects(b.adminAssignCustomerItem({}, 'r', 'i', check), /retired/);
  const before = calls.length; await assert.rejects(a.adminUpdateMaterialTaminotchiItemGroups({}, 'r', ['Group'], check, () => current), /retired/); assert.equal(calls.length, before);
});
