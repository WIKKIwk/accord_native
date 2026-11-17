const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const test = require('node:test');
const ts = require('typescript');
const root = path.resolve(__dirname, '../src');
const cache = new Map();
function load(name) {
  if (name === 'shared/localization.ts') return { extensionText: (_family, key) => key, localizedMethod: (_name, _locale, values) => values.raw };
  if (cache.has(name)) return cache.get(name).exports;
  const filename = path.join(root, name), m = new Module(filename, module); cache.set(name, m);
  m.require = key => key.startsWith('.') ? load(`${path.relative(root, path.resolve(path.dirname(filename), key))}.ts`) : require(key);
  m._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ESNext } }).outputText, filename);
  return m.exports;
}
const { QolipProductsState } = load('qolip/qolipProductsState.ts');
const { QolipCatalogStore } = load('shared/qolipCatalogStore.ts');
const pdf = load('qolip/qolipProductPdfModel.ts');
const { qolipLimitGraphemes } = load('qolip/qolipGraphemes.ts');
const { qolipCatalogEditorCanSave, qolipCatalogInteger, qolipCatalogIntegerDecimal } = load('qolip/qolipCatalogEditorLogic.ts');
const { finishQolipProductPdf } = load('qolip/qolipProductPdfMetadata.ts');
const { PDFDocument } = require('pdf-lib');
const tick = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const product = (code, qolip_code, extra = {}) => ({ code, qolip_code, name: code, item_group: '', warehouse: 'W', customer_names: [], size: 10,
  color: '', set_id: 'S', qolip_set_id: 'S', first_qolip_code: '', is_extension: false, is_in_use: false, is_in_rework: false, has_qolip_spec: true, order_image_order_id: '', ...extra });
function harness(reads = {}) {
  let valid = true; const listeners = new Set();
  const boundary = { current: () => valid, subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener); } };
  const state = new QolipProductsState(boundary, { page: async () => ({ items: [{ id: 'A', name: 'Alpha', order_image_order_id: '' }], next_cursor: null }),
    details: async () => [product('A', 'Q1'), product('A', 'Q2')], reworks: async () => [], ...reads });
  return { state, invalidate() { valid = false; for (const listener of listeners) listener(); } };
}

test('search immediately retires an older detail response, before the 250ms reload', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const detail = deferred(), calls = [], h = harness({ page: async ({ query }) => { calls.push(query); return { items: [{ id: 'A', name: 'Alpha', order_image_order_id: '' }], next_cursor: null }; }, details: () => detail.promise });
  h.state.activate(); await tick(); const pending = h.state.ensureDetails(h.state.getSnapshot().containers[0]);
  h.state.setSearch('new'); detail.resolve([product('A', 'stale')]); await pending;
  assert.deepEqual(h.state.getSnapshot().containers[0].children, []); assert.deepEqual(calls, ['']);
  t.mock.timers.tick(250); await tick(); assert.deepEqual(calls, ['', 'new']); h.state.dispose();
});

test('container and individual selection are exclusive and reject in-use or away molds', async () => {
  const h = harness(); h.state.activate(); await tick(); const row = h.state.getSnapshot().containers[0];
  await h.state.toggleContainer(row); assert.equal(h.state.getSnapshot().selectionMode, 'containers'); assert.equal(h.state.getSnapshot().selectedCodes.size, 2);
  h.state.toggleMold(product('A', 'Q3')); assert.equal(h.state.getSnapshot().selectedCodes.size, 2);
  h.state.cancelSelection(); h.state.toggleMold(product('A', 'Q3', { is_in_use: true })); assert.equal(h.state.getSnapshot().selectedCodes.size, 0);
  h.state.toggleMold(product('A', 'Q1')); assert.equal(h.state.getSnapshot().selectionMode, 'qolips');
  h.state.reworkAccepted([{ qolip_code: 'Q1' }]); assert.equal(h.state.getSnapshot().selectionMode, null);
  h.state.toggleMold(product('A', 'Q1')); assert.equal(h.state.getSnapshot().selectedCodes.size, 0); h.state.dispose();
});

test('original account invalidation discards pending pages and clears old selected rows', async () => {
  const page = deferred(), h = harness({ page: () => page.promise }); h.state.activate(); h.invalidate();
  page.resolve({ items: [{ id: 'old', name: 'Old', order_image_order_id: '' }], next_cursor: null }); await tick();
  assert.equal(h.state.getSnapshot().invalid, true); assert.deepEqual(h.state.getSnapshot().containers, []);
});

test('a source catalog mutation updates visible cards and cached reload makes no new request', async () => {
  let requests = 0;
  const store = new QolipCatalogStore({ scope: () => 'scope', requestScope: () => 'scope', parseProduct: value => value,
    page: async () => { requests++; return { items: [{ id: 'A', name: 'Alpha', order_image_order_id: '' }], next_cursor: null }; }, details: async () => [product('A', 'Q1')] });
  const h = harness(), state = new QolipProductsState({ current: () => true, subscribe: () => () => {} }, { page: async () => { throw Error('wrong reader'); }, details: async () => [], reworks: async () => [] }, store);
  state.activate(); await tick(); await state.ensureDetails(state.getSnapshot().containers[0]);
  store.applyResponse({ catalog_delta: { upserts: [{ id: 'A', name: 'Updated', products: [product('A', 'Q2')] }], removed_ids: [] } }, 'scope');
  assert.equal(state.getSnapshot().containers[0].name, 'Updated'); assert.equal(state.getSnapshot().containers[0].children[0].qolip_code, 'Q2');
  await state.reload(false, 'A'); assert.equal(requests, 1); assert.equal(state.getSnapshot().expanded, 'A'); state.dispose(); h.state.dispose();
});

test('PDF keeps source set/code ordering, extensions last, exact UTC label and escapes catalog content', () => {
  const html = pdf.qolipProductPdfHtml({ productCode: 'A', productName: '<Product & name>', locale: 'uz', exportedAt: new Date('2026-11-17T05:06:00Z'),
    molds: [product('A', 'extra', { is_extension: true }), product('A', 'B', { set_id: 'S2' }), product('A', 'Z', { set_id: 'S1' }), product('A', 'A', { set_id: 'S1' })] },
  { regular: '', bold: '', arabic: '', logo: '' });
  assert.ok(html.includes('&lt;Product &amp; name&gt;')); assert.ok(html.includes('17.11.2026  05:06 UTC'));
  assert.ok(html.indexOf('set_id: S1') < html.indexOf('set_id: S2')); assert.ok(html.indexOf('>A</td>') < html.indexOf('>Z</td>'));
  assert.ok(html.indexOf('>B</td>') < html.indexOf('>extra</td>')); assert.ok(html.includes('size:A4'));
  assert.throws(() => pdf.qolipProductPdfHtml({ productCode: 'A', productName: '', molds: [product('B', 'Q')], locale: 'uz' }, {}), /one exact catalog product/);
});

test('PDF filename and grapheme limits preserve source Unicode boundaries', () => {
  assert.equal(pdf.qolipProductPdfFilename(' ../A:B * C?. ', 'ITEM'), 'qoliplar-A-B---C.pdf');
  assert.equal(pdf.qolipProductPdfFilename(' '.repeat(4), 'ITEM'), 'qoliplar-ITEM.pdf');
  const family = '👨‍👩‍👧‍👦', value = family.repeat(159) + 'e\u0301' + '🇺🇿';
  assert.equal(qolipLimitGraphemes(value, 160), family.repeat(159) + 'e\u0301');
  assert.equal(qolipLimitGraphemes('🇺🇿🇷🇺', 1), '🇺🇿');
});

test('native PDF postprocessing retains pages and applies source Unicode document metadata and per-page footer streams', async () => {
  const native = await PDFDocument.create(); native.addPage([595.28, 841.89]); native.addPage([595.28, 841.89]);
  const bytes = await finishQolipProductPdf(await native.save(), { productCode: 'A', productName: 'Қолип 🧰', molds: [product('A', 'Q')], locale: 'uz' });
  const parsed = await PDFDocument.load(bytes);
  assert.equal(parsed.getPageCount(), 2); assert.equal(parsed.getTitle(), 'Қолип 🧰 — title');
  assert.equal(parsed.getAuthor(), 'Accord'); assert.equal(parsed.getCreator(), 'Accord Mobile'); assert.equal(parsed.getSubject(), 'title · A');
  assert.ok(parsed.getPages().every(page => page.node.Contents()?.size() > 0));
});

test('mold versus spec/set save enable rules follow source validation, including hexadecimal int.tryParse', () => {
  const state = { request: { kind: 'mold' }, code: 'Q', size: '-2', colors: ['#E53935'], suggestions: [], saved: [], saving: false, existing: false, product: null };
  assert.equal(qolipCatalogEditorCanSave(state), false);
  assert.equal(qolipCatalogEditorCanSave({ ...state, size: '0x2A' }), true);
  assert.equal(qolipCatalogInteger('\u0085 +42 \u0085'), 42); assert.equal(qolipCatalogInteger('42.5'), null);
  assert.equal(qolipCatalogIntegerDecimal('9223372036854775807'), '9223372036854775807');
  assert.equal(qolipCatalogIntegerDecimal('9223372036854775808'), null);
  assert.equal(qolipCatalogEditorCanSave({ ...state, existing: true }), true);
  assert.equal(qolipCatalogEditorCanSave({ ...state, suggestions: [{}] }), true);
  assert.equal(qolipCatalogEditorCanSave({ ...state, request: { kind: 'spec' } }), false);
  assert.equal(qolipCatalogEditorCanSave({ ...state, request: { kind: 'spec' }, product: product('A', '') }), true);
  assert.equal(qolipCatalogEditorCanSave({ ...state, request: { kind: 'set' }, code: 'Q-0' }), false);
  assert.equal(qolipCatalogEditorCanSave({ ...state, request: { kind: 'edit' }, code: '', size: '' }), true);
});
