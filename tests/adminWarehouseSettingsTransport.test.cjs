const assert = require('node:assert/strict');
const test = require('node:test');
const { load, strings, model, checked } = require('./adminUsersSupport.cjs');
const exception = load('shared/mobileApiException'), errors = load('admin/adminApiError', { '../shared/mobileApiException': exception });
const assignmentApi = load('admin/adminWarehouseAssignmentApi', { '../authorizedFetch': {}, './adminApiError': errors, './adminProductionRequest': checked, './adminUsersModel': model, './dartJsonString': strings });
const input = () => ({ warehouse: '\u0085 Storage ', principal_role: 'qolipchi', principal_ref: ' ref \u0085' });
const wire = () => ({ warehouse: 'Storage', principal_role: 'qolipchi', principal_ref: 'ref', display_name: 'Name' });
function fixture() {
  let valid = true, refreshes = 0, joins = 0; const legacy = [], session = { token: 'first', baseUrl: 'https://server.example' };
  const guard = () => { if (!valid) throw new Error('expired'); }, witness = () => { guard(); return true; };
  const transport = load('authorizedFetch', { './auth': { activeSessionToken: () => session.token, refreshSession: async () => { refreshes++; session.token = 'fresh'; return true; },
    joinRefreshForGuardedRead: async () => { joins++; session.token = 'fresh'; return true; } } });
  const api = load('admin/adminWarehouseSettingsApi', { '../authorizedFetch': transport, '../shared/catalogApi': { adminWarehouseAssignments: async (...args) => { legacy.push(args); return ['legacy']; } },
    '../shared/mobileApiException': exception, './adminApiError': errors, './adminProductionRequest': checked, './adminWarehouseAssignmentApi': assignmentApi, './dartJsonString': strings });
  const warehouse = load('admin/warehouseApi', { '../authorizedFetch': transport, '../gscale/gscaleAdminApi': {}, '../shared/mobileApiException': exception,
    './adminApiError': errors, './adminProductionRequest': checked, './dartJsonString': strings });
  return { session, api, warehouse, guard, witness, legacy, retire: () => { valid = false; }, counts: () => ({ refreshes, joins }),
    read: () => api.adminWarehouseSettingsAssignments(session, input().warehouse, guard, witness),
    unassign: () => api.adminUnassignWarehouse(session, input(), guard), delete: () => warehouse.adminDeleteWarehouse(session, input().warehouse, true, guard) };
}
test('unguarded assignment adapter delegates unchanged shared API; guarded GET matches query and unassign uses exact source DELETE envelope', async t => {
  const original = global.fetch; t.after(() => { global.fetch = original; }); const f = fixture(), calls = [];
  assert.deepEqual(await f.api.adminWarehouseSettingsAssignments(f.session, ' raw \u0085 '), ['legacy']); assert.deepEqual(f.legacy, [[f.session, ' raw \u0085 ']]);
  global.fetch = async (url, init) => { calls.push({ url, method: init.method ?? 'GET', body: init.body ? JSON.parse(init.body) : null });
    return new Response(JSON.stringify(init.method === 'DELETE' ? { assignment: wire() } : [wire()])); };
  assert.deepEqual(await f.read(), [wire()]); assert.deepEqual(await f.unassign(), wire());
  assert.deepEqual(calls, [{ url: 'https://server.example/v1/mobile/admin/warehouses/assignments?warehouse=Storage', method: 'GET', body: null },
    { url: 'https://server.example/v1/mobile/admin/warehouses/assignments', method: 'DELETE', body: { warehouse: 'Storage', principal_role: 'qolipchi', principal_ref: 'ref' } }]);
});
test('unassign validates source input and envelope; invalid opt-in guard/witness cannot dispatch', async t => {
  const original = global.fetch; t.after(() => { global.fetch = original; }); const f = fixture(); let calls = 0; global.fetch = async () => { calls++; return new Response('{}'); };
  await assert.rejects(f.api.adminUnassignWarehouse(f.session, { ...input(), principal_ref: '\u0085 ' }), problem => problem.code === 'warehouse_assignment_input_required' && problem.message === 'Ombor assignment ma’lumoti to‘liq emas');
  await assert.rejects(f.api.adminUnassignWarehouse(f.session, input(), async () => {}), /Invalid admin guard/);
  await assert.rejects(f.api.adminWarehouseSettingsAssignments(f.session, '', undefined, () => true), /require a guard/); assert.equal(calls, 0);
  await assert.rejects(f.unassign(), /Invalid warehouse assignment/); f.retire(); await assert.rejects(f.read()); await assert.rejects(f.unassign()); await assert.rejects(f.delete()); assert.equal(calls, 1);
});
for (const kind of ['read', 'unassign', 'delete']) {
  for (const status of [302, 401]) test(`${kind} captured authority blocks stale ${status} continuation and a second dispatch`, async t => {
    const original = global.fetch; t.after(() => { global.fetch = original; }); const f = fixture(); let sends = 0;
    global.fetch = async () => { sends++; f.retire(); return new Response('', { status, headers: status === 302 ? { location: '/v1/mobile/next' } : {} }); };
    await assert.rejects(f[kind]()); assert.equal(sends, 1);
    assert.deepEqual(f.counts(), { refreshes: kind !== 'read' && status === 401 ? 1 : 0, joins: 0 });
  });
  test(`${kind} guards asynchronous response-body errors and stale network errors`, async t => {
    const original = global.fetch; t.after(() => { global.fetch = original; }); const f = fixture();
    global.fetch = async () => { const response = new Response('{}', { status: kind === 'delete' ? 400 : 200 }); response.json = async () => { f.retire(); throw new Error('body'); }; return response; };
    await assert.rejects(f[kind](), /expired/);
    const g = fixture(); global.fetch = async () => { g.retire(); throw new Error('network'); }; await assert.rejects(g[kind](), /expired/);
  });
}
test('assignment guarded GET joins independent refresh and preserves original guard through successful body parsing', async t => {
  const original = global.fetch; t.after(() => { global.fetch = original; }); const f = fixture(), tokens = [];
  global.fetch = async (_url, init) => { tokens.push(new Headers(init.headers).get('authorization')); return tokens.length === 1 ? new Response('', { status: 401 }) : new Response(JSON.stringify([wire()])); };
  await f.read(); assert.deepEqual(tokens, ['Bearer first', 'Bearer fresh']); assert.deepEqual(f.counts(), { refreshes: 0, joins: 1 });
  const g = fixture(); global.fetch = async () => { const response = new Response('[]'); response.json = async () => { g.retire(); return []; }; return response; }; await assert.rejects(g.read(), /expired/);
});
test('DELETE legacy defaults and source adminApiException fallback remain unchanged', async t => {
  const original = global.fetch; t.after(() => { global.fetch = original; }); const f = fixture(), calls = [];
  global.fetch = async (url, init) => { calls.push([url, JSON.parse(init.body)]); return new Response('broken', { status: 400 }); };
  await assert.rejects(f.api.adminUnassignWarehouse(f.session, input()), problem => problem.code === 'warehouse_assignment_remove_failed' && problem.message === 'Ombor assignmenti olib tashlanmadi (HTTP 400)');
  await assert.rejects(f.warehouse.adminDeleteWarehouse(f.session, ' Storage ', false), problem => problem.code === 'warehouse_delete_failed' && problem.message === 'Ombor o‘chirilmadi (HTTP 400)');
  assert.deepEqual(calls.at(-1)[1], { warehouse: 'Storage', delete_products: false });
});
