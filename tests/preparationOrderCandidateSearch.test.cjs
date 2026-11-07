const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

function load(file) {
  const filename = path.resolve(__dirname, '../src', file.endsWith('.ts') ? file : `${file}.ts`);
  const mod = new Module(filename, module); mod.filename = filename; mod.paths = module.paths;
  mod.require = id => {
    if (id === '../authorizedFetch') return {};
    if (id === '../shared/mobileApiException') return { MobileApiException: class extends Error {} };
    return id.startsWith('.') ? load(path.resolve(path.dirname(filename), id)) : require(id);
  };
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return mod.exports;
}

const { preparationOrderCandidateLabel, preparationOrderPickerResults } = load('preparation/preparationOrderCandidateSearch');
const candidate = (id, values = {}) => ({ order: { map: {
  id, code: '', order_number: '', title: '', product_code: '', ...values,
} }, apparatus_options: ['apparatus:print:1'] });

test('order picker uses V2 code and title fallbacks', () => {
  assert.equal(preparationOrderCandidateLabel(candidate('id', { code: ' 0004 ', order_number: '77', title: ' Paket ' })), '0004 · Paket');
  assert.equal(preparationOrderCandidateLabel(candidate(' id ', { order_number: ' 77 ' })), '77 · Buyurtma');
  assert.equal(preparationOrderCandidateLabel(candidate(' id ')), 'id · Buyurtma');
});

test('order picker searches V2 order fields with normalized matching', () => {
  const rows = [candidate('zakaz-0004', { code: '0004', order_number: 'N-19', title: 'Yangi g‘isht', product_code: 'P-PET123' }),
    candidate('zakaz-0005', { code: '0005', title: 'Boshqa mahsulot', product_code: 'P-OTHER' })];
  for (const query of ['0004', 'n-19', 'yangi gis', 'p-pet123']) {
    assert.deepEqual(preparationOrderPickerResults(rows, query, 50).items.map(item => item.order.map.id), ['zakaz-0004']);
  }
  assert.ok(preparationOrderPickerResults(rows, 'zakaz-0004', 50).items.some(item => item.order.map.id === 'zakaz-0004'));
  assert.deepEqual(preparationOrderPickerResults(rows, 'zzzzzzzz', 50).items, []);
});

test('order picker pages before applying V2 relevance ordering', () => {
  const rows = Array.from({ length: 52 }, (_, index) => candidate(`id-${index}`, { code: `X${index}`, title: 'Kley' }));
  rows[51].order.map.code = 'KLEY';
  const first = preparationOrderPickerResults(rows, 'kley', 50);
  assert.equal(first.items.length, 50); assert.equal(first.hasMore, true);
  assert.equal(first.items.some(item => item.order.map.id === 'id-51'), false);
  const next = preparationOrderPickerResults(rows, 'kley', 100);
  assert.equal(next.items[0].order.map.id, 'id-51'); assert.equal(next.hasMore, false);
});
