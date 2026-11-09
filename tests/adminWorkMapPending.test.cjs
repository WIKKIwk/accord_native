const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const jsx = { Fragment: 'Fragment', jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
function load(file, mocks = {}) {
  const filename = path.resolve(__dirname, '../src', file), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths;
  mod.require = id => id === 'react/jsx-runtime' ? jsx : Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { fileName: filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, filename);
  return mod.exports;
}
const number = load('admin/adminDartDouble.ts');
const present = load('admin/adminWorkMapPendingPresentation.ts', { './adminDartDouble': number }).adminWorkMapPendingPresentation;
const template = { order_number: '17', customer: 'Ana', product: 'Film', status: 'Rulon', kg: 100,
  frame_product_size_mm: 60.5, frame_count: 2, production_options: { print_method: 'flexo', cold_glue: true, diameter_mm: 120 },
  effective_layers: [{ material: 'PE', micron: '30' }, { material: 'PET', micron: '12' }] };
test('hydrated pending detail preserves all source labels, values and order', () => {
  const view = present(template, 'Manager');
  assert.equal(view.title, '№17 · Chala buyurtma');
  assert.deepEqual(view.rows.map(({ label, value }) => [label, value]), [
    ['Mijoz', 'Ana'], ['Mahsulot', 'Film'], ['Holat', 'Rulon'], ['Bosma', 'Flexo'], ['Holodniy kley', 'Ha'], ['Diametr', '120.0 mm'],
    ['Tiraj', '100.0 kg'], ['1 kadrdagi o‘lcham', '60.5 mm'], ['Kadr soni', '2.0 ta'], ['Material', 'PE 30 + PET 12'], ['Menejer', 'Manager'],
  ]);
});
test('pending detail follows exact optional production options, empty rows and Dart double interpolation', () => {
  const noOptions = present({ ...template, order_number: '', customer: '', product: '', status: '', production_options: null,
    effective_layers: [], kg: -0, frame_product_size_mm: 0, frame_count: 0 }, '');
  assert.equal(noOptions.title, '№ · Chala buyurtma');
  assert.deepEqual(noOptions.rows.map(row => row.label), ['Mijoz', 'Mahsulot', 'Holat', 'Tiraj', '1 kadrdagi o‘lcham', 'Kadr soni', 'Material', 'Menejer']);
  assert.equal(noOptions.rows.find(row => row.label === 'Tiraj').value, '-0.0 kg');
  assert.equal(noOptions.rows.find(row => row.label === 'Material').value, '');
  const other = present({ ...template, production_options: { print_method: 'Flexo', cold_glue: false, diameter_mm: null } }, '');
  assert.equal(other.rows.find(row => row.label === 'Bosma').value, 'Temir');
  assert.equal(other.rows.find(row => row.label === 'Holodniy kley').value, 'Yo‘q');
  assert.equal(other.rows.some(row => row.label === 'Diametr'), false);
  const zeroDiameter = present({ ...template, production_options: { print_method: 'metal', cold_glue: false, diameter_mm: 0 } }, '');
  assert.equal(zeroDiameter.rows.find(row => row.label === 'Diametr').value, '0.0 mm');
});
test('Dart double rendering keeps source zero, exponent and large-value spelling', () => {
  for (const [value, expected] of [[0, '0.0'], [-0, '-0.0'], [1e-6, '0.000001'], [1e-7, '1e-7'],
    [1e21, '1e+21'], [1000000000000000100, '1000000000000000100.0'], [Infinity, 'Infinity'], [NaN, 'NaN']]) {
    assert.equal(number.adminDartDouble(value), expected);
  }
});
test('the actual pending-order/template decoders feed the passive details and manager name', () => {
  const saved = load('workerProductionMapSaved.ts', { './workerControlsApi': { isCanonicalApparatusId: () => true } });
  const parser = load('workerOpenedOrderEditApi.ts', { './authorizedFetch': {}, './workerControlsApi': {}, './workerProductionMapSaved': saved });
  const pending = load('pendingOrderApi.ts', { './authorizedFetch': {}, './workerControlsApi': {}, './workerOpenedOrderEditApi': parser });
  const actual = pending.pendingOrderFromJson({ id: 'p', manager_name: 'Manager', template: { ...template, layers: template.effective_layers } });
  const view = present(actual.template, actual.manager_name);
  assert.equal(view.title, '№17 · Chala buyurtma'); assert.equal(view.rows.find(row => row.label === 'Menejer').value, 'Manager');
  assert.equal(view.rows.find(row => row.label === 'Material').value, 'PE 30 + PET 12');
  const legacy = pending.pendingOrderFromJson({ id: 'legacy', template: { order_number: 'L', width_mm: 100, first_layer_material: 'PE', first_layer_micron: '30', kg: 5 } });
  const legacyView = present(legacy.template, legacy.manager_name);
  assert.equal(legacyView.rows.find(row => row.label === '1 kadrdagi o‘lcham').value, '85.0 mm');
  assert.equal(legacyView.rows.find(row => row.label === 'Kadr soni').value, '1.0 ta');
  assert.equal(legacyView.rows.find(row => row.label === 'Material').value, 'PE 30');
  assert.equal(legacyView.rows.find(row => row.label === 'Menejer').value, '');
});
const nodes = tree => tree && typeof tree === 'object' ? [tree, ...[tree.props?.children].flat(Infinity).flatMap(nodes)] : [];
for (const platform of ['ios', 'android']) test(`${platform} pending content renders every passive row in order and no action`, () => {
  const view = present(template, 'Manager');
  const View = load(`admin/AdminWorkMapPending.${platform}.tsx`, { '@expo/ui': { ListItem: 'ListItem' },
    [`@expo/ui/${platform === 'ios' ? 'swift-ui' : 'jetpack-compose'}`]: { Text: 'NativeText', VStack: 'VStack', Column: 'Column' },
  }).AdminWorkMapPending;
  const tree = nodes(View({ rows: view.rows })), items = tree.filter(row => row.type === 'ListItem');
  assert.deepEqual(items.map(row => row.props.supportingText), view.rows.map(row => row.value));
  assert.deepEqual(items.map(row => row.props.children.props.children), view.rows.map(row => row.label));
  assert.equal(tree.some(row => row.props.onPress || row.props.onClick || row.props.onSubmit), false);
});
