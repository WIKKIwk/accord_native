const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

function loadTs(file, overrides = {}) {
  const filename = path.resolve(__dirname, '../src', file);
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = module.paths;
  loaded.require = name => Object.hasOwn(overrides, name) ? overrides[name] : require(name);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText, filename);
  return loaded.exports;
}

function fixture(body = [], status = 200) {
  const calls = [];
  const fetch = async (session, route, init) => {
    calls.push({ session, route, init });
    return { status, json: async () => body };
  };
  const catalog = loadTs('shared/catalogApi.ts', {
    '../authorizedFetch': { authorizedFetch: fetch },
    '../appPreferences': { appPreferences: {} },
    './searchActivityStore': { SearchActivityStore: class {} },
    './mobileApiException': { MobileApiException: class extends Error {} },
  });
  const notifications = loadTs('shared/notificationApi.ts', { '../authorizedFetch': { authorizedFetch: fetch } });
  const api = loadTs('supplier/supplierApi.ts', {
    '../authorizedFetch': { authorizedFetch: fetch },
    '../shared/catalogApi': catalog,
    '../shared/notificationApi': notifications,
  });
  return { ...api, catalog, notifications, calls, session: { token: 'test' } };
}

// Source-derived tests: V2 has no recorded contract or logic tests for these Supplier methods.
test('history and detail reuse the DispatchRecord decoder and preserve the V2 request', async () => {
  const row = { id: 'one', status: ' ACCEPTED ', sent_qty: 12.5, accepted_qty: 10, item_code: 'A' };
  const f = fixture([row]);
  const history = await f.supplierHistory(f.session);
  const details = await f.supplierStatusDetails(f.session, 'returned', 'A +/');
  assert.deepEqual(f.calls.map(call => call.route), [
    '/v1/mobile/supplier/history', '/v1/mobile/supplier/status-details?kind=returned&item_code=A+%2B%2F',
  ]);
  assert.ok(f.calls.every(call => call.session === f.session && call.init === undefined));
  assert.deepEqual(history, details);
  assert.deepEqual(history[0], f.notifications.dispatchRecordFromJson(row));
  assert.equal(history[0].status, 'accepted');
  assert.equal(history[0].sent_qty, 12.5);
  assert.equal(history[0].item_name, '');
});

test('summary and breakdown preserve model defaults, values and strict field types', async () => {
  const f = fixture({ pending_count: 3, submitted_count: 2 });
  assert.deepEqual(await f.supplierSummary(f.session), { pendingCount: 3, submittedCount: 2, returnedCount: 0 });
  assert.equal(f.calls[0].route, '/v1/mobile/supplier/summary');
  const b = fixture([{ item_code: 'I', receipt_count: 2, total_sent_qty: 5.5, total_returned_qty: 1 }]);
  assert.deepEqual(await b.supplierStatusBreakdown(b.session, 'returned'), [{
    item_code: 'I', item_name: '', receipt_count: 2, total_sent_qty: 5.5, total_accepted_qty: 0,
    total_returned_qty: 1, uom: '',
  }]);
  assert.equal(b.calls[0].route, '/v1/mobile/supplier/status-breakdown?kind=returned');
  assert.throws(() => f.supplierSummaryFromJson({ pending_count: 1.5 }), TypeError);
  assert.throws(() => f.supplierSummaryFromJson({ returned_count: '1' }), TypeError);
  assert.throws(() => b.supplierStatusBreakdownEntryFromJson({ receipt_count: 1.5 }), TypeError);
  assert.throws(() => b.supplierStatusBreakdownEntryFromJson({ total_sent_qty: '5' }), TypeError);
  assert.throws(() => b.supplierStatusBreakdownEntryFromJson({ item_code: false }), TypeError);
});

test('item search sends the untrimmed nonempty V2 query and reuses SupplierItem parsing', async () => {
  const row = { code: 'X', order_microns: [3, 'bad'], customer_names: [' C ', '', null],
    order_apparatus_options: { a: 2 }, requires_dimensions: true };
  const f = fixture([row]);
  const items = await f.supplierItems(f.session, ' X +/ ');
  await f.supplierItems(f.session, '   ');
  assert.deepEqual(f.calls.map(call => call.route), ['/v1/mobile/supplier/items?q=+X+%2B%2F+', '/v1/mobile/supplier/items']);
  assert.deepEqual(items, [f.catalog.supplierItemFromJson(row)]);
  assert.deepEqual(items[0], { code: 'X', name: '', uom: '', warehouse: '', item_group: '', requires_dimensions: true,
    order_apparatus_options: { a: '2' }, order_microns: [3], customer_names: ['C', 'null'] });
});

test('dispatch sends the V2 JSON fields and rejects non-finite quantities before sending', async () => {
  const f = fixture({ id: 'receipt', status: 'draft', sent_qty: 12.25 });
  const record = await f.createDispatch(f.session, 'A +/', 12.25);
  assert.equal(f.calls[0].route, '/v1/mobile/supplier/dispatch');
  assert.equal(f.calls[0].init.method, 'POST');
  assert.deepEqual(f.calls[0].init.headers, { 'Content-Type': 'application/json' });
  assert.deepEqual(JSON.parse(f.calls[0].init.body), { item_code: 'A +/', qty: 12.25 });
  assert.equal(record.status, 'draft');
  await assert.rejects(f.createDispatch(f.session, 'A', NaN), TypeError);
  await assert.rejects(f.createDispatch(f.session, 'A', Infinity), TypeError);
  assert.equal(f.calls.length, 1);
  // The API itself has no positive-quantity guard; that rule belongs to the V2 quantity screen.
  await f.createDispatch(f.session, 'A', -1);
  assert.deepEqual(JSON.parse(f.calls[1].init.body), { item_code: 'A', qty: -1 });
});

test('every Supplier endpoint requires status 200 and keeps the V2 explicit error text', async () => {
  const methods = [
    ['supplierHistory', [], 'Supplier history failed'],
    ['supplierSummary', [], 'Supplier summary failed'],
    ['supplierStatusBreakdown', ['pending'], 'Supplier status breakdown failed'],
    ['supplierStatusDetails', ['returned', 'A'], 'Supplier status details failed'],
    ['supplierItems', [], 'Supplier items failed'],
    ['createDispatch', ['A', 2], 'Dispatch create failed'],
  ];
  for (const [method, args, message] of methods) {
    for (const status of [201, 400, 401, 403, 500]) {
      const f = fixture({}, status);
      await assert.rejects(f[method](f.session, ...args), error => error.message === message && String(error) === `Exception: ${message}`);
    }
  }
});

test('array endpoints and record fields reject wrong JSON shapes', async () => {
  for (const [method, args] of [
    ['supplierHistory', []], ['supplierStatusBreakdown', ['pending']],
    ['supplierStatusDetails', ['pending', 'A']], ['supplierItems', []],
  ]) {
    const f = fixture({ items: [] });
    await assert.rejects(f[method](f.session, ...args), TypeError);
  }
  await assert.rejects(fixture([{ sent_qty: '4' }]).supplierHistory({}), TypeError);
  await assert.rejects(fixture([{ code: 1 }]).supplierItems({}), TypeError);
  await assert.rejects(fixture({ id: 1 }).createDispatch({}, 'A', 1), TypeError);
  assert.throws(() => fixture().notifications.dispatchRecordFromJson(null), TypeError);
  assert.equal(fixture().notifications.dispatchRecordFromJson({ status: 'unknown' }).status, 'pending');
});
