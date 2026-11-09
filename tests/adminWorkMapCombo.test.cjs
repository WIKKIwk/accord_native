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
const locale = load('shared/localization/index.ts', { './catalog.json': require('../src/shared/localization/catalog.json') });
const model = load('admin/adminWorkMapComboPresentation.ts', { '../shared/localization': locale, './adminDartDouble': load('admin/adminDartDouble.ts') });
const combo = { name: 'Combo name', item_code: 'SKU', revision: 7 }, products = [
  { product: 'Film', item_code: 'P1', frame_product_size_mm: 50, frame_count: 2 },
  { product: 'Bag', item_code: 'P2', frame_product_size_mm: 12.5, frame_count: 3 },
];
test('embedded combo copies revision, name, code and products in source order', () => {
  const view = model.adminWorkMapComboPresentation(combo, products, 'uz');
  assert.equal(view.title, locale.adminText('calculate.combo_details', 'uz'));
  assert.equal(view.version, `${locale.adminText('calculate.combo', 'uz')} · v7`);
  assert.equal(view.name, combo.name); assert.equal(view.code, combo.item_code);
  assert.deepEqual(view.products, ['Film · P1 · 50.0 mm × 2', 'Bag · P2 · 12.5 mm × 3']);
  assert.equal(model.adminWorkMapComboWidth(-0), '-0.0'); assert.equal(model.adminWorkMapComboWidth(1e21), '1e+21');
});
test('the canonical saved-map decoder feeds the embedded combo without a catalog request', () => {
  const decoder = load('workerProductionMapSaved.ts', { './workerControlsApi': { isCanonicalApparatusId: () => true } });
  const parsed = decoder.productionMapDefinitionFromJson({ id: 'o', combo, products, nodes: [], edges: [] });
  const view = model.adminWorkMapComboPresentation(parsed.combo, parsed.products, 'uz');
  assert.equal(view.name, 'Combo name'); assert.equal(view.code, 'SKU'); assert.equal(view.products[0], 'Film · P1 · 50.0 mm × 2');
});
test('combo expansion starts collapsed and repeated toggles alternate', () => {
  let state = false; const hook = load('admin/useAdminWorkMapCombo.ts', { react: { useState: () => [state, update => { state = update(state); }] } }).useAdminWorkMapCombo;
  assert.equal(hook().expanded, false); hook().toggle(); assert.equal(hook().expanded, true); hook().toggle(); assert.equal(hook().expanded, false);
});
const nodes = tree => tree && typeof tree === 'object' ? [tree, ...[tree.props?.children].flat(Infinity).flatMap(nodes)] : [];
for (const platform of ['ios', 'android']) test(`${platform} embedded combo exposes only the source toggle and ordered passive values`, () => {
  let expanded = false, toggles = 0;
  const view = model.adminWorkMapComboPresentation(combo, products, 'uz');
  const View = load(`admin/AdminWorkMapCombo.${platform}.tsx`, { '@expo/ui': { ListItem: 'ListItem' },
    [`@expo/ui/${platform === 'ios' ? 'swift-ui' : 'jetpack-compose'}`]: { Text: 'NativeText', VStack: 'VStack', Column: 'Column', Image: 'Image', RNHostView: 'RNHostView' },
    '@expo/ui/swift-ui/modifiers': { accessibilityHidden: () => ({}), font: value => value }, 'expo-symbols': { SymbolView: 'SymbolView' },
    './useAdminWorkMapCombo': { useAdminWorkMapCombo: () => ({ expanded, toggle: () => { expanded = !expanded; toggles++; } }) },
  }).AdminWorkMapCombo;
  const collapsed = nodes(View({ model: view })); assert.equal(collapsed.some(node => node.props.children === view.version), false);
  collapsed.find(node => node.props.testID === 'admin-work-map-combo').props.onPress(); assert.equal(toggles, 1);
  const open = nodes(View({ model: view })).filter(node => node.type === 'NativeText').map(node => node.props.children);
  assert.deepEqual(open, [view.title, view.version, view.name, view.code, view.componentsTitle, ...view.products]);
});
