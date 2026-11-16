const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
function load(file, mocks = {}) {
  const filename = path.resolve(__dirname, '../src', file), mod = new Module(filename, module); mod.filename = filename; mod.paths = module.paths;
  mod.require = name => Object.hasOwn(mocks, name) ? mocks[name] : name === 'expo/fetch' ? require('./support/expoFetch.cjs') : require(name);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename); return mod.exports;
}
const dart = load('admin/dartJsonString.ts'), uri = load('admin/dartUri.ts'), exception = load('shared/mobileApiException.ts');
const strict = load('shared/camera/synchronousGuard.ts'), scope = load('sessionReadScope.ts');
const flags = { warehouseScoped: false, adminScoped: true };
const tick = () => new Promise(resolve => setImmediate(resolve));
function deferred() { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
const response = (value, options = {}) => new Response(value === undefined ? undefined : JSON.stringify(value), { status: 200, ...options });
function fixture(t, profile = {}) {
  const original = global.fetch; t.after(() => { global.fetch = original; });
  let current = true, refreshes = 0, requests = [], handler = async () => response([]);
  const session = { token: 'first', baseUrl: 'https://server.example', profile: { role: 'admin', ref: 'owner', display_name: 'Owner', ...profile }, capabilities: ['admin.access'], assigned_apparatus: [], assigned_apparatus_labels: [] };
  const witness = () => current, guard = () => { if (!current) throw new Error('retired'); };
  const auth = { activeSessionToken: () => session.token, refreshSession: async () => { throw new Error('Guarded reads cannot refresh independently'); },
    joinRefreshForGuardedRead: async () => { refreshes++; return false; } };
  const transport = load('authorizedFetch.ts', { './auth': auth });
  const controls = load('workerControlsApi.ts', { './authorizedFetch': transport, './sessionReadScope': scope });
  const request = load('admin/adminProductionRequest.ts', { '../authorizedFetch': transport, '../shared/mobileApiException': exception, '../workerControlsApi': controls });
  const apparatus = load('apparatusApi.ts', { './authorizedFetch': transport, './workerControlsApi': controls });
  const raw = load('workerRawMaterials.ts', { './authorizedFetch': transport, './workerControlsApi': controls });
  const inventory = load('inventoryModels.ts', { './workerControlsApi': controls });
  const qolip = load('qolipCatalogApi.ts', { './auth': auth, './authorizedFetch': transport, './workerControlsApi': controls });
  const print = load('shared/printApi.ts', { '../authorizedFetch': transport, './mobileApiException': exception, '../workerPrintJob': {} });
  const users = load('admin/adminUsersModel.ts', { '../shared/localization': {}, '../shared/appRoutes': {}, '../workerControlsApi': controls, './dartJsonString': dart });
  const assignments = load('admin/adminWarehouseAssignmentApi.ts', { '../authorizedFetch': transport, './adminApiError': {}, './adminProductionRequest': request, './adminUsersModel': users, './dartJsonString': dart });
  const warehouse = load('admin/warehouseApi.ts', { '../authorizedFetch': transport, '../gscale/gscaleAdminApi': {}, '../shared/mobileApiException': exception, './adminApiError': {}, './dartJsonString': dart, './adminProductionRequest': request });
  const stock = load('admin/warehouseStockApi.ts', { '../authorizedFetch': transport, './dartJsonString': dart });
  const api = load('admin/adminWarehouseMainRead.ts', { '../auth': auth, '../authorizedFetch': transport, '../apparatusApi': apparatus,
    '../inventoryModels': inventory, '../qolipCatalogApi': qolip, '../sessionReadScope': scope, '../shared/camera/synchronousGuard': strict,
    '../shared/mobileApiException': exception, '../shared/printApi': print, '../workerControlsApi': controls, '../workerRawMaterials': raw,
    './adminProductionRequest': request, './adminWarehouseAssignmentApi': assignments, './dartJsonString': dart, './dartUri': uri,
    './warehouseApi': warehouse, './warehouseStockApi': stock });
  global.fetch = async (url, init) => { const input = { url: new URL(url), init }; requests.push(input); return handler(input); };
  return { session, api, guard, witness, transport, requests, handler: fn => { handler = fn; }, retire: () => { current = false; },
    refresh: fn => { auth.joinRefreshForGuardedRead = async () => { refreshes++; return fn(); }; }, refreshes: () => refreshes };
}
function pathHandler(routes) { return ({ url }) => { const value = routes[url.pathname]; if (value === undefined) throw new Error(`Unexpected ${url}`); return response(value); }; }
const material = (barcode, extra = {}) => ({ apparatus_id: 'apparatus:test:one', barcode, order_id: barcode, ...extra });
const asset = (ref, location = 'loc-A', extra = {}) => ({ asset_ref: ref, physical_location: { id: location, kind: 'warehouse' }, ...extra });

test('summary500 and Qolip assignments launch together and preserve source section order and first unique Qolip names', async t => {
  const f = fixture(t), summaries = deferred(), assignments = deferred();
  f.handler(({ url }) => url.pathname.endsWith('/summary') ? summaries.promise : assignments.promise);
  const pending = f.api.loadAdminWarehouseMainSummary(f.session, flags, f.guard, f.witness); await tick();
  assert.deepEqual(f.requests.map(row => row.url.pathname), ['/v1/mobile/admin/warehouses/summary', '/v1/mobile/admin/warehouses/assignments']);
  assert.equal(f.requests[0].url.searchParams.get('limit'), '500'); assert.equal(f.requests[1].url.search, '');
  assignments.resolve(response([{ warehouse: ' Qolip ', principal_role: 'qolipchi' }, { warehouse: 'qolip', principal_role: 'qolipchi' }, { warehouse: 'Other', principal_role: 'werka' }]));
  summaries.resolve(response([{ warehouse: 'Z', product_count: 3 }, { warehouse: 'A' }])); const result = await pending;
  assert.deepEqual(result.sections.map(row => row.warehouse), ['Z', 'A']); assert.deepEqual(result.qolipWarehouseNames, ['Qolip']);
});
test('scoped summary prefers assigned profile warehouses and fallback matches original role plus ref OR display name', async t => {
  const f = fixture(t, { role: 'werka', ref: 'Ref', display_name: 'Owner' }); f.session.assigned_warehouses = [' A ', 'a'];
  f.handler(pathHandler({ '/v1/mobile/admin/warehouses/summary': [{ warehouse: 'a' }, { warehouse: 'B' }] }));
  const result = await f.api.loadAdminWarehouseMainSummary(f.session, { warehouseScoped: true, adminScoped: false }, f.guard, f.witness);
  assert.deepEqual(result.sections.map(row => row.warehouse), ['a']); assert.equal(f.requests.length, 1);
  f.session.assigned_warehouses = []; f.handler(pathHandler({ '/v1/mobile/admin/warehouses/summary': [{ warehouse: 'A' }, { warehouse: 'B' }, { warehouse: 'C' }],
    '/v1/mobile/admin/warehouses/assignments': [{ warehouse: 'A', principal_role: 'omborchi', principal_ref: ' ref ', display_name: 'Different' },
      { warehouse: 'B', principal_role: 'werka', principal_ref: 'Other', display_name: ' OWNER ' }, { warehouse: 'C', principal_role: 'qolipchi', principal_ref: 'Ref' }] }));
  assert.deepEqual((await f.api.loadAdminWarehouseMainSummary(f.session, { warehouseScoped: true, adminScoped: false }, f.guard, f.witness)).sections.map(row => row.warehouse), ['A', 'B']);
});
test('detail composes physical asset references then reservation barcodes while preserving source order', async t => {
  const f = fixture(t); f.handler(pathHandler({
    '/v1/mobile/admin/raw-material-assignments': [material(' B2 '), material('b1'), material('other')],
    '/v1/mobile/admin/raw-material-stock': [{ id: ' S1 ', barcode: ' B1 ' }, { id: 'S2', barcode: 'b2' }, { id: 'S3', barcode: 'Other' }],
    '/v1/mobile/admin/inventory/locations': [null, { id: 'loc-A', kind: 'warehouse', name: ' A ', warehouse_id: 'WH1', active: false }, { id: 'second', kind: 'warehouse', name: 'a', warehouse_id: 'WH2' }],
    '/v1/mobile/admin/apparatus': [], '/v1/mobile/admin/inventory/assets': [asset('s2'), asset('s1'), asset('s3', 'other'), asset('s3', 'loc-A', { physical_location: { id: 'loc-A', kind: 'state' } })],
  }));
  const result = await f.api.loadAdminWarehouseMainDetail(f.session, 'A', flags, f.guard, f.witness);
  assert.deepEqual(result.rawStock.map(row => row.id), [' S1 ', 'S2']); assert.deepEqual(result.reservations.map(row => row.barcode), [' B2 ', 'b1']);
  assert.equal(f.requests.length, 5); const requests = Object.fromEntries(f.requests.map(row => [row.url.pathname, row.url]));
  assert.equal(requests['/v1/mobile/admin/apparatus'].searchParams.get('limit'), '10000');
  assert.equal(requests['/v1/mobile/admin/raw-material-stock'].searchParams.get('limit'), '500');
  assert.equal(requests['/v1/mobile/admin/inventory/assets'].searchParams.get('warehouse_id'), 'WH1');
  assert.equal(requests['/v1/mobile/admin/inventory/assets'].searchParams.get('asset_kind'), 'raw_material');
  assert.equal(requests['/v1/mobile/admin/inventory/assets'].searchParams.get('limit'), '500');
});
test('empty raw stock still performs all four reads and returns apparatus without requesting assets', async t => {
  const f = fixture(t); f.handler(() => response([]));
  assert.deepEqual(await f.api.loadAdminWarehouseMainDetail(f.session, 'A', flags, f.guard, f.witness), { rawStock: [], reservations: [], apparatus: [] });
  assert.equal(f.requests.length, 4); assert.ok(f.requests.some(row => row.url.pathname.endsWith('/locations')));
});
test('a missing warehouse inventory location fails after the four reads; unauthorized scoped detail sends none', async t => {
  const f = fixture(t); f.handler(({ url }) => response(url.pathname.endsWith('/raw-material-stock') ? [{ id: 'S' }] : []));
  await assert.rejects(f.api.loadAdminWarehouseMainDetail(f.session, ' A ', flags, f.guard, f.witness), error => error.name === 'StateError' && String(error) === 'Bad state: Inventory warehouse location not found:  A '); assert.equal(f.requests.length, 4);
  f.session.assigned_warehouses = ['B']; const count = f.requests.length;
  assert.equal(await f.api.loadAdminWarehouseMainDetail(f.session, 'A', { warehouseScoped: true, adminScoped: false }, f.guard, f.witness), null); assert.equal(f.requests.length, count);
});
test('parallel summary and detail failures are all consumed after the visible request fails', async t => {
  for (const operation of ['summary', 'detail']) {
    const f = fixture(t), late = [];
    f.handler(({ url }) => {
      if (url.pathname.endsWith('/summary') || url.pathname.endsWith('/raw-material-stock')) return new Response(undefined, { status: 500 });
      const pending = deferred(); late.push(pending); return pending.promise;
    });
    const pending = operation === 'summary' ? f.api.loadAdminWarehouseMainSummary(f.session, flags, f.guard, f.witness) : f.api.loadAdminWarehouseMainDetail(f.session, 'A', flags, f.guard, f.witness);
    await assert.rejects(pending); assert.equal(late.length, operation === 'summary' ? 1 : 3);
    late.forEach(read => read.reject(new TypeError('late failure'))); await tick(); await tick();
  }
});
test('the physical asset request remains under the same witness and blank warehouseId preserves source global query', async t => {
  const f = fixture(t), assets = deferred(); f.handler(({ url }) => {
    if (url.pathname.endsWith('/raw-material-stock')) return response([{ id: 'S' }]);
    if (url.pathname.endsWith('/locations')) return response([{ id: 'loc', name: 'A', kind: 'warehouse' }]);
    if (url.pathname.endsWith('/assets')) return assets.promise;
    return response([]);
  });
  const pending = f.api.loadAdminWarehouseMainDetail(f.session, 'A', flags, f.guard, f.witness), rejected = assert.rejects(pending); await tick(); await tick();
  const request = f.requests.find(row => row.url.pathname.endsWith('/assets')); assert.ok(request); assert.equal(request.url.searchParams.has('warehouse_id'), false);
  f.retire(); assets.resolve(response([asset('S', 'loc')])); await rejected; assert.equal(f.requests.length, 5);
});
test('items use source80 query/offset and Qolip uses the full products envelope20000 without warehouse filtering', async t => {
  const f = fixture(t); f.handler(({ url }) => response(url.pathname.endsWith('/products') ? { products: [{ code: 'A', qolip_code: 'Q' }] } : [{ code: 'A' }]));
  await f.api.readAdminWarehouseMainItemsPage(f.session, ' A ', ' Need ', 80, f.guard, f.witness);
  const items = f.requests[0].url; assert.equal(items.searchParams.get('warehouse'), 'A'); assert.equal(items.searchParams.get('q'), 'Need'); assert.equal(items.searchParams.get('limit'), '80'); assert.equal(items.searchParams.get('offset'), '80');
  assert.equal((await f.api.readAdminWarehouseMainQolipProducts(f.session, ' Q ', f.guard, f.witness))[0].qolip_code, 'Q'); const qolip = f.requests[1].url;
  assert.equal(qolip.searchParams.get('q'), 'Q'); assert.equal(qolip.searchParams.get('limit'), '20000'); assert.equal(qolip.searchParams.get('with_qolip'), 'true'); assert.equal(qolip.searchParams.has('warehouse'), false);
});
test('Qolip complete snapshot always revalidates by ETag, retains304 data and evicts a failed baseline', async t => {
  const f = fixture(t); let reads = 0; f.handler(({ init }) => { reads++; if (reads === 1) return response({ products: [{ code: 'A' }] }, { headers: { etag: 'v1' } });
    if (reads === 2) { assert.equal(init.headers.get('If-None-Match'), 'v1'); return new Response(undefined, { status: 304 }); }
    if (reads === 3) return new Response(undefined, { status: 500 });
    assert.equal(init.headers.get('If-None-Match'), null); return response({ products: [] }); });
  assert.equal((await f.api.readAdminWarehouseMainQolipProducts(f.session, '', f.guard, f.witness))[0].code, 'A');
  assert.equal((await f.api.readAdminWarehouseMainQolipProducts(f.session, '', f.guard, f.witness))[0].code, 'A');
  await assert.rejects(f.api.readAdminWarehouseMainQolipProducts(f.session, '', f.guard, f.witness), /Qolip products failed/);
  assert.deepEqual(await f.api.readAdminWarehouseMainQolipProducts(f.session, '', f.guard, f.witness), []); assert.equal(reads, 4);
});
test('Qolip search cannot replace the full baseline, and concurrent write epoch triggers an original-witness reread', async t => {
  const f = fixture(t); let reads = 0; f.handler(({ init, url }) => { reads++; if (reads === 1) return response({ products: [{ code: 'Full' }] }, { headers: { etag: 'base' } });
    if (url.searchParams.has('q')) return response({ products: [{ code: 'Search' }] });
    assert.equal(init.headers.get('If-None-Match'), 'base'); f.transport.invalidateQueueSnapshotReads(); return response({ products: [{ code: 'Old' }] }); });
  await f.api.readAdminWarehouseMainQolipProducts(f.session, '', f.guard, f.witness); await f.api.readAdminWarehouseMainQolipProducts(f.session, 'Q', f.guard, f.witness);
  let last = false; f.handler(({ init }) => { if (!last) { last = true; assert.equal(init.headers.get('If-None-Match'), 'base'); f.transport.invalidateQueueSnapshotReads(); return response({ products: [{ code: 'Old' }] }); }
    assert.equal(init.headers.get('If-None-Match'), null); return response({ products: [{ code: 'Fresh' }] }); });
  assert.equal((await f.api.readAdminWarehouseMainQolipProducts(f.session, '', f.guard, f.witness))[0].code, 'Fresh');
});
test('Qolip shares only identical operation authority; a retired old read cannot clear a newer full baseline', async t => {
  const f = fixture(t), first = deferred(), second = deferred(); let firstCurrent = true;
  const firstGuard = () => { f.guard(); if (!firstCurrent) throw new Error('old operation'); }, nextGuard = () => f.guard();
  f.handler(() => f.requests.length === 1 ? first.promise : second.promise);
  const old = f.api.readAdminWarehouseMainQolipProducts(f.session, '', firstGuard, f.witness), oldRejected = assert.rejects(old, /old operation|expired/);
  const shared = f.api.readAdminWarehouseMainQolipProducts(f.session, '', firstGuard, f.witness), sharedRejected = assert.rejects(shared);
  const next = f.api.readAdminWarehouseMainQolipProducts(f.session, '', nextGuard, f.witness); await tick(); assert.equal(f.requests.length, 2);
  firstCurrent = false; first.resolve(response({ products: [{ code: 'Old' }] })); second.resolve(response({ products: [{ code: 'New' }] }, { headers: { etag: 'new' } }));
  await oldRejected; await sharedRejected; assert.equal((await next)[0].code, 'New');
  f.handler(({ init }) => { assert.equal(init.headers.get('If-None-Match'), 'new'); return new Response(undefined, { status: 304 }); });
  assert.equal((await f.api.readAdminWarehouseMainQolipProducts(f.session, '', f.guard, f.witness))[0].code, 'New');
});
test('Qolip cooperative parse slices keep order and recheck the original operation before parsing the next slice', async t => {
  const f = fixture(t), originalDate = Date.now, originalTimeout = global.setTimeout; let now = 0, resume, secondParsed = false;
  Date.now = () => now += 3;
  global.setTimeout = (callback, delay, ...args) => delay === 0 ? (resume = callback, {}) : originalTimeout(callback, delay, ...args);
  try {
    f.handler(() => { const result = response({ products: [] }); result.json = async () => ({ products: [{ code: 'First' }, { get code() { secondParsed = true; return 'Second'; } }] }); return result; });
    const pending = f.api.readAdminWarehouseMainQolipProducts(f.session, '', f.guard, f.witness), rejected = assert.rejects(pending, /retired|expired/);
    for (let attempt = 0; !resume && attempt < 8; attempt++) await tick();
    assert.equal(typeof resume, 'function'); assert.equal(secondParsed, false); f.retire(); resume(); await rejected; assert.equal(secondParsed, false);
  } finally { Date.now = originalDate; global.setTimeout = originalTimeout; }
});
for (const status of [302, 401]) test(`original witness rejects a retired${status} continuation before redirect or retry`, async t => {
  const f = fixture(t), sent = deferred(); f.handler(() => sent.promise);
  const pending = f.api.readAdminWarehouseMainSummaries(f.session, f.guard, f.witness), rejected = assert.rejects(pending); await tick(); f.retire();
  sent.resolve(new Response(undefined, { status, headers: status === 302 ? { location: '/v1/mobile/other' } : {} })); await rejected; assert.equal(f.requests.length, 1); assert.equal(f.refreshes(), 0);
});
test('a valid guarded read joins one token-only refresh and sends the same original witness on retry', async t => {
  const f = fixture(t); f.refresh(() => { f.session.token = 'second'; return true; }); f.handler(() => f.requests.length === 1 ? new Response(undefined, { status: 401 }) : response([]));
  await f.api.readAdminWarehouseMainSummaries(f.session, f.guard, f.witness);
  assert.deepEqual(f.requests.map(row => row.init.headers.get('Authorization')), ['Bearer first', 'Bearer second']); assert.equal(f.refreshes(), 1);
});
test('successful, rejected and invalid model bodies recheck authority before returning or reporting their error', async t => {
  for (const failure of ['body', 'model', 'errorBody']) {
    const f = fixture(t); f.handler(() => { const result = response([], { status: failure === 'errorBody' ? 403 : 200 });
      result.json = async () => { if (failure === 'model') return [{ get warehouse() { f.retire(); return 'A'; } }]; f.retire(); throw new SyntaxError('bad body'); }; return result; });
    const pending = failure === 'errorBody' ? f.api.readAdminWarehouseMainLocations(f.session, f.guard, f.witness) : f.api.readAdminWarehouseMainSummaries(f.session, f.guard, f.witness);
    await assert.rejects(pending, /retired|expired/);
  }
});
test('rejected asynchronous guards and witnesses fail closed without sending or leaking a rejection', async t => {
  const f = fixture(t);
  await assert.rejects(f.api.readAdminWarehouseMainSummaries(f.session, () => Promise.reject(new Error('async guard')), f.witness));
  await assert.rejects(f.api.readAdminWarehouseMainSummaries(f.session, f.guard, () => Promise.reject(new Error('async witness'))));
  await tick(); assert.equal(f.requests.length, 0);
});
