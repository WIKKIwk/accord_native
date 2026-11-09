const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

function load(relative, dependencies = {}) {
  const filename = path.resolve(__dirname, '../src', relative), loaded = new Module(filename, module);
  loaded.require = name => name in dependencies ? dependencies[name] : require(name);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ESNext },
  }).outputText, filename);
  return loaded.exports;
}
const { MobileApiException } = load('shared/mobileApiException.ts');
const common = load('qolip/qolipApiCommon.ts', { '../shared/mobileApiException': { MobileApiException } });
const json = (value, status = 200) => new Response(JSON.stringify(value), { status });
function harness(response, options = {}) {
  const calls = [], session = { token: 'token', profile: { ref: 'clerk' }, baseUrl: 'https://example.test' };
  let invalidations = 0;
  const api = load('qolip/qolipCheckoutApi.ts', {
    '../auth': { activeSessionToken: value => value.token || null },
    '../sessionReadScope': { sessionReadScope: value => JSON.stringify([value.baseUrl, value.profile.ref]) },
    '../shared/qolipCatalogRuntime': { qolipCatalogRuntimeFor: () => ({ invalidateDetails: () => { invalidations++; } }) },
    './qolipApiCommon': common,
    '../authorizedFetch': { authorizedFetch: async (value, target, init = {}) => {
      calls.push({ session: value, target, init });
      const result = typeof response === 'function' ? response(calls.length, init) : response;
      options.afterResponse?.(session);
      return result;
    } },
  });
  return { api, calls, session, invalidations: () => invalidations };
}
const checkout = (overrides = {}) => ({ id: 'c1', location_id: 'l1', block: 'A', warehouse: 'W', item_code: 'I',
  item_name: 'Mold', qolip_code: 'Q-1', size: 42, quantity: 1, row_letter: 'A', column_number: 2,
  location_label: 'A2', issued_to_name: 'Worker', status: 'open', issued_at: '2026-10-01', ...overrides });

test('checkout model preserves V2 defaults, numeric conversion and open status', () => {
  const { api } = harness(json({}));
  assert.deepEqual(api.qolipCheckoutFromJson({ id: 7, status: ' OPEN ', size: 42.9 }), {
    id: '7', location_id: '', block: '', warehouse: '', item_code: '', item_name: '', qolip_code: '',
    size: 42, quantity: 0, row_letter: '', column_number: null, location_label: '', issued_to_name: '',
    status: ' OPEN ', issued_at: '', is_open: true,
  });
  assert.equal(api.qolipCheckoutFromJson({ status: 'returned' }).is_open, false);
  assert.throws(() => api.qolipCheckoutFromJson({ quantity: '1' }));
  assert.throws(() => api.qolipWorkerFromJson(null));
});

test('worker reader sends only the trimmed query and fixed limit', async () => {
  const { api, calls, session } = harness(() => json({ workers: [{ id: 'w1', name: 'Ali', level: 'Master' }] }));
  assert.deepEqual(await api.qolipWorkers(session, ' Ali '), [{ id: 'w1', name: 'Ali', level: 'Master' }]);
  assert.equal(calls[0].target, '/v1/mobile/qolip/workers?q=Ali&limit=100');
  await api.qolipWorkers(session, ' ');
  assert.equal(calls[1].target, '/v1/mobile/qolip/workers?limit=100');
  const bad = harness(json({ workers: 'bad' }));
  await assert.rejects(bad.api.qolipWorkers(bad.session), /Invalid Qolip workers/);
});

test('checkout list uses V2 defaults, optional query parameters and nullable list', async () => {
  const { api, calls, session } = harness(index => json(index === 1 ? { checkouts: [checkout()] } : {}));
  const rows = await api.qolipCheckouts(session);
  assert.equal(rows[0].is_open, true);
  assert.equal(calls[0].target, '/v1/mobile/qolip/checkouts?status=open&limit=100');
  assert.deepEqual(await api.qolipCheckouts(session, { block: ' A blok ', status: ' ', limit: 0 }), []);
  assert.equal(calls[1].target, '/v1/mobile/qolip/checkouts?block=A+blok&limit=0');
  const bad = harness(json({ checkouts: {} }));
  await assert.rejects(bad.api.qolipCheckouts(bad.session), /Invalid Qolip checkouts/);
});

test('issue sends selected worker and invalidates the current catalog after a successful response', async () => {
  const { api, calls, session, invalidations } = harness(json({ checkout: checkout() }));
  const result = await api.qolipIssueCheckout(session, { locationId: ' l1 ', quantity: 2, workerId: ' w1 ' });
  assert.equal(result.id, 'c1');
  assert.equal(calls[0].target, '/v1/mobile/qolip/checkouts');
  assert.equal(calls[0].init.method, 'POST');
  assert.deepEqual(JSON.parse(calls[0].init.body), { location_id: 'l1', quantity: 2, worker_id: 'w1' });
  assert.equal(invalidations(), 1);
});

test('return includes optional uppercase cell coordinates and invalidates catalog', async () => {
  const { api, calls, session, invalidations } = harness(() => json({ checkout: checkout({ status: 'returned' }) }));
  assert.equal((await api.qolipReturnCheckout(session, ' c1 ', { rowLetter: ' z ', columnNumber: 3 })).is_open, false);
  assert.deepEqual(JSON.parse(calls[0].init.body), { checkout_id: 'c1', row_letter: 'Z', column_number: 3 });
  await api.qolipReturnCheckout(session, 'c1', { rowLetter: ' ', columnNumber: 0 });
  assert.deepEqual(JSON.parse(calls[1].init.body), { checkout_id: 'c1', column_number: 0 });
  assert.equal(invalidations(), 2);
});

test('account changes do not invalidate another account catalog', async () => {
  const { api, session, invalidations } = harness(json({ checkout: checkout() }), {
    afterResponse: value => { value.profile.ref = 'other'; },
  });
  assert.equal((await api.qolipIssueCheckout(session, { locationId: 'l1', quantity: 1, workerId: 'w1' })).id, 'c1');
  assert.equal(invalidations(), 0);
});

test('errors preserve server codes and do not invalidate catalog', async () => {
  const { api, session, invalidations } = harness(json({ error: 'checkout_not_returnable', message: ' Qaytarib bo‘lmaydi ' }, 409));
  await assert.rejects(api.qolipReturnCheckout(session, 'c1'), error => error instanceof MobileApiException &&
    error.code === 'checkout_not_returnable' && error.statusCode === 409 && error.message === 'Qaytarib bo‘lmaydi');
  assert.equal(invalidations(), 0);
});

test('test mode cannot send a checkout request to the backend', async () => {
  const { api, calls, session } = harness(json({ checkouts: [] }));
  session.token = 'test-mode-token';
  await assert.rejects(api.qolipCheckouts(session), /test mode is not yet ported/);
  assert.equal(calls.length, 0);
});
