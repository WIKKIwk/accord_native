const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const jsx = { Fragment: 'Fragment', jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
function load(file, mocks) {
  const filename = path.resolve(__dirname, '../src', file), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths;
  mod.require = id => id === 'react/jsx-runtime' ? jsx : Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { fileName: filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, filename);
  return mod.exports;
}
const nodes = tree => tree && typeof tree === 'object' ? [tree, ...[tree.props?.children].flat(Infinity).flatMap(nodes)] : [];
const modifiers = new Proxy({}, { get: (_target, name) => value => ({ name, value }) });
const slot = name => Object.assign(() => {}, { Label: `${name}.Label` });
for (const platform of ['ios', 'android']) test(`${platform} native module/filter controls expose only real destinations and preserve selected apparatus`, () => {
  const calls = [], segmented = slot('SegmentedButton'), chip = slot('FilterChip');
  const native = { Button: 'Button', HStack: 'HStack', Picker: 'Picker', Text: 'NativeText', VStack: 'VStack',
    Column: 'Column', Row: 'Row', FilterChip: chip, SegmentedButton: segmented, SingleChoiceSegmentedButtonRow: 'SegmentRow' };
  const exports = load(`admin/AdminWorkMapControls.${platform}.tsx`, {
    [`@expo/ui/${platform === 'ios' ? 'swift-ui' : 'jetpack-compose'}`]: native,
    [`@expo/ui/${platform === 'ios' ? 'swift-ui' : 'jetpack-compose'}/modifiers`]: modifiers,
  });
  const a = { id: 'a', name: 'Pechat' }, b = { id: 'b', name: 'Rezka' };
  const props = { module: 'sequence', catalog: [a, b], selected: b, expanded: true,
    onModule: id => calls.push(['module', id]), onApparatus: id => calls.push(['apparatus', id]), onToggle: () => calls.push('toggle'),
    apparatusLabel: 'Apparat', unselectedLabel: 'Tanlanmagan', countText: '7 ta buyurtma' };
  const modules = nodes(exports.AdminWorkMapModules(props));
  assert.deepEqual(modules.filter(node => node.type === 'NativeText').map(node => node.props.children), ['Ketma-ketlik', 'Buyurtmalar', 'Yopilgan', 'Tekshiruv']);
  if (platform === 'ios') modules[0].props.onSelectionChange('orders');
  else modules.find(node => node.type === segmented && !node.props.selected).props.onClick();
  const filter = nodes(exports.AdminWorkMapApparatusFilter(props));
  if (platform === 'ios') {
    filter.find(node => node.type === 'Button' && node.props.label === 'Pechat').props.onPress();
    assert.ok(filter.find(node => node.type === 'Button' && node.props.label === 'Rezka').props.modifiers.some(m => m.name === 'accessibilityAddTraits'));
    filter.find(node => node.type === 'Button' && !node.props.label).props.onPress();
  } else {
    const chips = filter.filter(node => node.type === chip); assert.equal(chips[2].props.selected, true);
    chips[1].props.onClick(); chips[0].props.onClick();
  }
  assert.deepEqual(calls, [['module', 'orders'], ['apparatus', 'a'], 'toggle']);
  if (platform === 'ios') modules[0].props.onSelectionChange('closed');
  else modules.find(node => node.type === segmented && node.props.modifiers?.some(modifier => modifier.name === 'testID' && modifier.value === 'admin-work-map-module-closed')).props.onClick();
  assert.deepEqual(calls.at(-1), ['module', 'closed']);
  assert.ok(filter.some(node => node.type === 'NativeText' && node.props.children === props.countText));
  const collapsed = nodes(exports.AdminWorkMapApparatusFilter({ ...props, expanded: false }));
  assert.equal(collapsed.some(node => node.props.label === 'Pechat' || node.type === 'NativeText' && node.props.children === 'Pechat'), false);
});
