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
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { fileName: filename, compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return mod.exports;
}
const { adminWorkMapTemplateForOrder: select, adminWorkMapOrderWeight: weight } = load('admin/adminWorkMapOrderWeight.ts', {
  './dartJsonString': load('admin/dartJsonString.ts'),
});
const map = { id: 'zakaz-17', code: ' C ', order_number: ' 99 ', product_code: 'SKU', title: 'Film', width_mm: 100, order_kg: 0,
  nodes: [{ kind: 'end', title: 'Film' }, { kind: 'end', title: ' Roll ' }] };
const template = (values = {}) => ({ source_map_id: '', code: '', order_number: '', item_code: '', product: '', width_mm: 100, kg: 0, ...values });

test('positive stored weight wins, then the selected positive template weight, else null', () => {
  const direct = template({ source_map_id: 'zakaz-17', kg: 12.5 });
  assert.equal(weight({ ...map, order_kg: 21 }, [direct]), 21);
  for (const order_kg of [null, 0, -1]) assert.equal(weight({ ...map, order_kg }, [direct]), 12.5);
  for (const kg of [null, 0, -1, NaN]) assert.equal(weight(map, [{ ...direct, kg }]), null);
  assert.equal(weight(map, []), null);
});
test('matching source ID comes first, then order number, code or zakaz suffix, in template order', () => {
  const byCode = template({ code: 'C', kg: 1 }), byNumber = template({ order_number: '99', kg: 2 });
  const bySuffix = template({ order_number: '17', kg: 3 }), direct = template({ source_map_id: '\u0085zakaz-17\u0085', kg: 4 });
  assert.equal(select(map, [byCode, byNumber, bySuffix, direct]), direct);
  assert.equal(select(map, [byCode, byNumber, bySuffix]), byCode);
  assert.equal(select(map, [byNumber, bySuffix]), byNumber);
  assert.equal(select(map, [bySuffix]), bySuffix);
  assert.equal(select({ ...map, id: '', code: '', order_number: '' }, [template({})])?.source_map_id, '');
});
test('product fallback honors case, end-node title, half-millimeter width and linked-template priority', () => {
  const tooWide = template({ product: ' film ', width_mm: 100.50001, kg: 1 });
  const edge = template({ product: ' film ', width_mm: 100.5, kg: 2 });
  const last = template({ item_code: 'sku', width_mm: 0, kg: 3 });
  const linked = template({ product: 'roll', source_map_id: 'different', kg: 4 });
  assert.equal(select(map, [tooWide, edge, last]), last);
  assert.equal(select(map, [tooWide, edge]), edge);
  assert.equal(select(map, [edge, linked, last]), linked);
  assert.equal(select({ ...map, product_code: '', title: '', nodes: [{ kind: 'end', title: 'Roll' }] }, [linked]), linked);
  assert.equal(select({ ...map, product_code: '', title: '', nodes: [] }, [edge]), undefined);
  assert.equal(select({ ...map, title: 'İSTANBUL', product_code: '', nodes: [] }, [template({ product: 'istanbul', kg: 1 })])?.kg, 1);
  assert.equal(select({ ...map, title: 'ΟΣ', product_code: '', nodes: [] }, [template({ product: 'οσ', kg: 2 })])?.kg, 2);
});
test('a direct or order-key match is selected before width and does not search for a later positive kg', () => {
  const first = template({ source_map_id: 'zakaz-17', width_mm: 500, kg: 0 });
  const second = template({ source_map_id: 'zakaz-17', kg: 100 });
  assert.equal(select(map, [first, second]), first); assert.equal(weight(map, [first, second]), null);
  assert.equal(select(map, [template({ code: 'C', width_mm: 500 })])?.width_mm, 500);
});
