const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
function load(file, mocks = {}) {
  const filename = path.resolve(__dirname, '../src/preparation', file), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths;
  mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ESNext } }).outputText, filename);
  return mod.exports;
}
const { PreparationMaterialStockState } = load('preparationMaterialStockState.ts');
const summary = { available_kg: '15.750001', receipt_kg: '105.000000', issue_kg: '2.500001', available_count: 2, receipt_count: 105, issue_count: 1 };
const row = id => ({ id, barcode: `QR-${id}`, has_qr: true, kg: '10.250001', created_at: '2026-11-07T08:00:00Z',
  event_type: 'receipt_posted', actor_name: 'Master', order_code: '', width_mm: null, micron: null, length_m: null });
const page = (tab = 'available', offset = 0, overrides = {}) => ({ item_code: 'BOPP', item_name: 'BOPP', warehouse: 'Own', tab, summary,
  rows: [row(`${tab}-${offset}`)], offset, limit: 50, has_more: false, ...overrides });
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const tick = () => new Promise(resolve => setImmediate(resolve));

test('material stock uses server totals, independent tab windows and paginated rows', async () => {
  const calls = [];
  const state = new PreparationMaterialStockState(async (tab, offset) => { calls.push([tab, offset]);
    return page(tab, offset, { limit: 2, rows: [row(`${tab}-${offset}`), row(`${tab}-${offset + 1}`)], has_more: offset === 0 });
  }, () => true);
  await state.reload();
  assert.equal(state.getSnapshot().tab, 'available');
  assert.deepEqual(state.getSnapshot().summary, summary);
  state.select('receipts'); await tick();
  await state.loadMore();
  assert.deepEqual(calls, [['available', 0], ['receipts', 0], ['receipts', 2]]);
  assert.equal(state.getSnapshot().pages.receipts.rows.length, 4);
  assert.equal(state.getSnapshot().pages.available.rows.length, 2);
  assert.equal(state.getSnapshot().summary.receipt_count, 105);
  state.select('available'); await tick();
  assert.equal(calls.length, 3);
  state.select('issues'); await tick();
  assert.deepEqual(calls.at(-1), ['issues', 0]);
});

test('a newer refresh wins and account reset rejects late stock and totals', async () => {
  const pending = [];
  const state = new PreparationMaterialStockState(() => { const next = deferred(); pending.push(next); return next.promise; }, () => true);
  const old = state.reload(), newer = state.reload();
  pending[1].resolve(page('available', 0, { item_name: 'new' })); await newer;
  pending[0].resolve(page('available', 0, { item_name: 'old', summary: { ...summary, available_kg: '999' } })); await old;
  assert.equal(state.getSnapshot().itemName, 'new');
  assert.equal(state.getSnapshot().summary.available_kg, '15.750001');
  const late = state.reload(); state.invalidate();
  pending[2].resolve(page()); await late;
  assert.equal(state.getSnapshot().summary, null);
  assert.equal(state.getSnapshot().pages.available.rows.length, 0);
  assert.match(state.getSnapshot().pages.available.error, /Akkaunt/);
});

test('a failed load preserves the error and retries the same tab window', async () => {
  let fail = true;
  const state = new PreparationMaterialStockState(async (tab, offset) => { if (fail) throw new Error('offline'); return page(tab, offset); }, () => true);
  await state.reload();
  assert.equal(state.getSnapshot().pages.available.error, 'offline');
  assert.equal(state.getSnapshot().pages.available.loaded, false);
  assert.equal(state.getSnapshot().summary, null);
  fail = false; await state.load('available');
  assert.equal(state.getSnapshot().pages.available.error, null);
  assert.equal(state.getSnapshot().pages.available.loaded, true);
});

test('material stock API validates identity, exact decimal quantities and page bounds', async () => {
  let response = page(); const calls = [];
  const mocks = {
    '../authorizedFetch': { authorizedFetch: async (_session, url) => { calls.push(url); return new Response(JSON.stringify(response)); } },
    '../sessionReadScope': { sessionReadScope: () => 'account' },
    './preparationRequest': { preparationGuard: () => () => {}, preparationResponse: response => response.json(),
      withQuery: (path, values) => `${path}?${new URLSearchParams(values)}` },
  };
  const api = load('preparationMaterialStockApi.ts', mocks);
  const result = await api.preparationMaterialStock({}, 'Own', 'BOPP', 'available');
  assert.equal(result.rows[0].kg, '10.250001');
  assert.equal(result.summary.issue_kg, '2.500001');
  assert.equal(new URL(calls[0], 'https://test').searchParams.get('tab'), 'available');
  response = page('receipts');
  await assert.rejects(api.preparationMaterialStock({}, 'Own', 'BOPP', 'available'), /mos kelmadi/);
  assert.throws(() => api.materialStockPageFromJson(page('available', 0, { summary: { ...summary, available_kg: -1 } })), /quantity|text/);
  assert.throws(() => api.materialStockPageFromJson(page('available', 0, { has_more: true })), /window/);
  assert.throws(() => api.materialStockPageFromJson(page('available', 0, { rows: [row('same'), row('same')] })), /window/);
});

test('stock rows distinguish QR-less receipts, remaining quantities and signed movements', () => {
  const model = load('preparationModel.ts');
  const history = load('preparationHistoryModel.ts', { './preparationModel': model });
  const { materialStockRowPresentation } = load('preparationMaterialStockPresentation.ts', { './preparationModel': model, './preparationHistoryModel': history });
  const available = materialStockRowPresentation({ ...row('one'), has_qr: false, barcode: 'PREP-INTERNAL', width_mm: '0', micron: '20', length_m: null }, 'available', value => value);
  assert.equal(available.title, 'QR’siz kirim');
  assert.equal(available.amount, '10.250001 kg');
  assert.ok(!available.detail.includes('PREP-INTERNAL'));
  assert.ok(!available.detail.includes('0 mm'));
  assert.ok(available.detail.includes('20 μm'));
  assert.equal(materialStockRowPresentation(row('one'), 'receipts', value => value).amount, '+10.250001 kg');
  assert.equal(materialStockRowPresentation(row('one'), 'issues', value => value).amount, '−10.250001 kg');
});
