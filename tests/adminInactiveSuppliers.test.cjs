const assert = require('node:assert/strict');
const test = require('node:test');
const { load, checked, deferred, flush } = require('./adminUsersSupport.cjs');
const createModel = load('admin/adminUserCreateModel', { '../qolip/qolipSearchRelevance': {}, '../shared/mobileApiException': {}, './adminUsersModel': {}, './dartJsonString': {} });
const supplierModel = load('admin/adminSupplierDetailModel', { '../shared/catalogApi': { supplierItemFromJson: value => value } });
const { AdminInactiveSuppliersController } = load('admin/adminInactiveSuppliersController');
const item = (ref, patch = {}) => createModel.adminUserCreateSupplierFromJson({ ref, name: `Supplier ${ref}`, ...patch });
function apiFixture(response) {
  const calls = [], session = { baseUrl: 'https://example.invalid', token: 'test' };
  const detail = load('admin/adminSupplierDetailApi', { '../authorizedFetch': { authorizedFetch: async (...args) => { calls.push(args); args[3]?.(); return response(); } },
    './adminProductionRequest': checked, './adminSupplierDetailModel': supplierModel, './dartUri': load('admin/dartUri') });
  const inactive = load('admin/adminInactiveSuppliersApi', { '../authorizedFetch': { authorizedFetch: async (...args) => { calls.push(args); args[3](); return response(); } },
    './adminProductionRequest': checked, './adminSupplierDetailApi': detail, './adminUserCreateModel': createModel });
  return { session, calls, ...detail, ...inactive };
}
test('inactive GET keeps source URL, status and the existing supplier DTO defaults', async () => {
  const f = apiFixture(() => ({ status: 200, json: async () => [{ ref: ' a ', removed: true }, { ref: 'b', blocked: true, assigned_item_codes: [' x '] }] }));
  const result = await f.adminInactiveSuppliers(f.session, () => {}, () => true);
  assert.deepEqual(result, [item(' a ', { removed: true, name: '' }), item('b', { blocked: true, name: '', assigned_item_codes: [' x '] })]);
  assert.equal(f.calls[0][1], '/v1/mobile/admin/suppliers/inactive'); assert.equal(f.calls[0][2], undefined);
  assert.equal(f.calls[0][5].readWitness(), true);
  for (const status of [201, 401, 500]) {
    const failed = apiFixture(() => ({ status }));
    await assert.rejects(failed.adminInactiveSuppliers(failed.session, () => {}, () => true), error => String(error) === 'Exception: Admin inactive suppliers failed');
  }
});
test('inactive list rejects source-invalid envelopes, fields and late account results', async () => {
  for (const value of [{ items: [] }, [null], [{ assigned_item_codes: [null] }], [{ assigned_item_count: 1.5 }], [{ removed: 1 }]]) {
    const f = apiFixture(() => ({ status: 200, json: async () => value }));
    await assert.rejects(f.adminInactiveSuppliers(f.session, () => {}, () => true), TypeError);
  }
  let current = true;
  const f = apiFixture(() => ({ status: 200, json: async () => { current = false; return []; } }));
  await assert.rejects(f.adminInactiveSuppliers(f.session, () => { if (!current) throw Error('retired'); }, () => current), /retired/);
});
test('restore POST has the original untrimmed ref, no body/content type and shares detail parsing', async () => {
  const f = apiFixture(() => ({ status: 200, json: async () => ({ ref: ' original ', assigned_items: [], blocked: true }) }));
  assert.equal((await f.adminRestoreSupplier(f.session, ' original +&', () => {})).blocked, true);
  assert.equal(f.calls[0][1], '/v1/mobile/admin/suppliers/restore?ref=+original+%2B%26');
  assert.deepEqual(f.calls[0][2], { method: 'POST' });
  const failed = apiFixture(() => ({ status: 400 }));
  await assert.rejects(failed.adminRestoreSupplier(failed.session, 'x', () => {}), error => String(error) === 'Exception: Admin supplier restore failed');
});
function fixture(overrides = {}) {
  let current = true;
  const rows = [item('removed', { removed: true, blocked: true }), item('blocked', { blocked: true }), item('ordinary')], calls = [];
  const deps = { isCurrent: () => current, read: async (guard, witness) => { guard(); assert.equal(witness(), true); calls.push('read'); return rows; },
    restore: async (ref, guard) => { guard(); calls.push(['restore', ref]); }, unblock: async (ref, guard) => { guard(); calls.push(['unblock', ref]); }, ...overrides };
  const controller = new AdminInactiveSuppliersController(deps);
  return { controller, rows, calls, deps, retire: () => { current = false; controller.invalidate(); }, start: async () => { controller.start(); await flush(); } };
}
test('source actions restore removed rows, unblock only nonremoved blocked rows and reload on success', async () => {
  const f = fixture(); await f.start();
  await f.controller.unblock(f.rows[0]); await f.controller.restore(f.rows[1]); await f.controller.unblock(f.rows[2]);
  assert.deepEqual(f.calls, ['read']);
  await f.controller.restore(f.rows[0]); await f.controller.unblock(f.rows[1]);
  assert.deepEqual(f.calls, ['read', ['restore', 'removed'], 'read', ['unblock', 'blocked'], 'read']);
  assert.equal(f.controller.getSnapshot().busyRef, null); assert.equal(f.controller.getSnapshot().phase, 'content');
});
test('a new source FutureBuilder read replaces content with loading; latest future wins', async () => {
  const f = fixture(); await f.start(); const first = deferred(), second = deferred();
  let count = 0; f.deps.read = async () => (++count === 1 ? first : second).promise;
  const a = f.controller.reload(), b = f.controller.reload(); assert.equal(f.controller.getSnapshot().phase, 'loading');
  second.resolve([f.rows[1]]); await b; first.resolve([f.rows[0]]); await a;
  assert.deepEqual(f.controller.getSnapshot().items, [f.rows[1]]);
});
test('the single source busyRef disables its own row while allowing other row commands', async () => {
  const first = deferred(), second = deferred();
  const f = fixture({ restore: async () => first.promise, unblock: async () => second.promise }); await f.start();
  const a = f.controller.restore(f.rows[0]); assert.equal(f.controller.getSnapshot().busyRef, 'removed');
  await f.controller.restore(f.rows[0]); const b = f.controller.unblock(f.rows[1]); assert.equal(f.controller.getSnapshot().busyRef, 'blocked');
  first.resolve(); await a; assert.equal(f.controller.getSnapshot().busyRef, null);
  second.resolve(); await b; assert.equal(f.controller.getSnapshot().phase, 'content');
});
test('mutation failure keeps the list, clears busy state and does not reload or invent notice', async () => {
  const f = fixture({ restore: async () => { throw Error('source failure'); } }); await f.start();
  await assert.rejects(f.controller.restore(f.rows[0]), /source failure/);
  assert.deepEqual(f.calls, ['read']); assert.equal(f.controller.getSnapshot().phase, 'content');
  assert.equal(f.controller.getSnapshot().busyRef, null); assert.equal('notice' in f.controller.getSnapshot(), false);
  f.deps.read = async () => { throw Error('offline'); };
  await assert.rejects(f.controller.reload(), /offline/); assert.equal(f.controller.getSnapshot().phase, 'error');
});
test('retirement rejects late mutation reload/publication; StrictMode replay gets a new read generation', async () => {
  const request = deferred(), f = fixture({ restore: async () => request.promise }); await f.start();
  const saving = f.controller.restore(f.rows[0]); f.retire(); request.resolve(); await assert.rejects(saving, /scope changed/);
  assert.equal(f.controller.getSnapshot().phase, 'invalidated'); assert.deepEqual(f.calls, ['read']);
  const a = deferred(), b = deferred(); let count = 0;
  const replay = fixture({ read: () => (++count === 1 ? a : b).promise });
  replay.controller.start(); replay.controller.stop(); replay.controller.start();
  b.resolve([replay.rows[1]]); await flush(); a.resolve([replay.rows[0]]); await flush();
  assert.deepEqual(replay.controller.getSnapshot().items, [replay.rows[1]]);
});
