const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
function load(file, mocks = {}) {
  const filename = path.resolve(__dirname, '../src', file), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths;
  mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return mod.exports;
}
const dart = load('admin/dartJsonString.ts');
const header = load('admin/adminWorkMapDetailHeader.ts', { './dartJsonString': dart }).adminWorkMapDetailHeader;
const row = { kind: 'order', id: 'zakaz- 17 ', code: '', title: '', customer: ' List customer ' };
test('provisional header uses V2 code suffix, localized product fallback and list customer', () => {
  assert.deepEqual(header(row, null, row.customer, 'Order'), { code: '17', label: 'List customer • Order' });
  assert.deepEqual(header({ ...row, id: 'plain' }, null, '', 'Order'), { code: '-', label: 'Order' });
});
test('hydrated code and title are authoritative, with Dart trimming and customer before product', () => {
  const map = { id: 'zakaz-8', code: '\u0085 55 \u0085', order_number: '22', title: '\u0085 Film \u0085', customer_name: 'old', nodes: [] };
  assert.deepEqual(header(row, map, ' Buyer ', 'Order'), { code: '55', label: 'Buyer • Film' });
  assert.deepEqual(header(row, { ...map, code: '', order_number: ' 22 ' }, '', 'Order'), { code: '22', label: 'Film' });
  assert.deepEqual(header(row, { ...map, code: '', order_number: '', id: 'plain' }, null, 'Order'), { code: '-', label: 'old • Film' });
});
test('empty hydrated title uses the first nonblank end product and never reuses stale list text', () => {
  const map = { id: 'zakaz-7', code: '', title: ' ', nodes: [{ kind: 'apparatus', title: 'Machine' }, { kind: 'end', title: ' ' },
    { kind: 'end', title: ' Roll ' }, { kind: 'end', title: 'Second' }] };
  assert.deepEqual(header({ ...row, title: 'Stale list title' }, map, '', 'Order'), { code: '7', label: 'Roll' });
  assert.deepEqual(header({ ...row, title: 'Stale list title' }, { ...map, nodes: [] }, '', 'Order'), { code: '7', label: 'Order' });
});
