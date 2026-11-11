const assert = require('node:assert/strict'), fs = require('node:fs'), Module = require('node:module'), path = require('node:path'), test = require('node:test'), ts = require('typescript');
function nodes(tree, predicate) { if (!tree || typeof tree !== 'object') return []; if (Array.isArray(tree)) return tree.flatMap(child => nodes(child, predicate)); return [...(predicate(tree) ? [tree] : []), ...nodes(tree.props?.children, predicate)]; }
function render(warehouses) {
  const selected = [], surface = { valid: true, loading: false, rows: [], transfers: [], empty: 'Bo‘sh', alert: null, dismissAlert() {},
    t: text => `translated:${text}`, state: { selected: new Set(), busy: new Set(), scanning: false, tab: 'assets', warehouse: warehouses[0]?.warehouse_id ?? '', error: '', notice: '' },
    owner: { warehouses, selectWarehouse: value => selected.push(value) } };
  const file = path.resolve(__dirname, '../src/components/WorkerInventoryScreen.ios.tsx'), mod = new Module(file, module); mod.paths = module.paths;
  const mocks = {
    'react/jsx-runtime': { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) },
    '@expo/ui/swift-ui': new Proxy({}, { get: (_target, key) => key }),
    '@expo/ui/swift-ui/modifiers': new Proxy({}, { get: (_target, key) => (...args) => ({ name: key, args }) }),
    'expo-router': { Stack: { Screen: 'Screen' } }, 'react-native': { View: 'View' },
    './WorkerAlert': { WorkerAlert: 'Alert' }, './WorkerInventoryScanner': {}, './WorkerInventorySheet': { WorkerInventorySheet: 'Sheet' },
    './useWorkerInventorySurface': { useWorkerInventorySurface: () => surface }, './useWorkerInventory': { useWorkerInventoryKey: () => 'worker' },
  };
  mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, file);
  const wrapper = mod.exports.WorkerInventoryScreen({ session: {}, onBack() {} }), tree = wrapper.type(wrapper.props);
  return { selected, picker: nodes(tree, node => node.type === 'Picker' && node.props.label === 'translated:Ombor')[0] };
}

// Source-derived: inventory_movements_screen__InventoryMovementsScreenState_methods_03.dart:330-358.
test('an empty assigned warehouse list displays the translated source fallback without adding a selectable empty warehouse', () => {
  const h = render([]), options = nodes(h.picker, node => node.type === 'Text');
  assert.equal(h.picker.props.selection, '');
  assert.ok(h.picker.props.modifiers.some(mod => mod.name === 'disabled' && mod.args[0] === true));
  assert.equal(options.length, 1); assert.equal(options[0].props.children, 'translated:Tanlanmagan');
  assert.deepEqual(options[0].props.modifiers, [{ name: 'tag', args: [''] }, { name: 'disabled', args: [true] }]);
  for (const value of ['', 'unknown', null, 0]) h.picker.props.onSelectionChange(value);
  assert.deepEqual(h.selected, []);
});

test('available warehouse names remain literal and only an actual warehouse tag reaches the owner', () => {
  const h = render([{ warehouse_id: 'w1', name: 'Assigned warehouse' }, { warehouse_id: 'w2', name: 'Second warehouse' }]);
  assert.equal(h.picker.props.selection, 'w1');
  assert.deepEqual(nodes(h.picker, node => node.type === 'Text').map(node => node.props.children), ['Assigned warehouse', 'Second warehouse']);
  assert.ok(h.picker.props.modifiers.some(mod => mod.name === 'disabled' && mod.args[0] === false));
  for (const value of ['', 'unknown', null, 0]) h.picker.props.onSelectionChange(value);
  h.picker.props.onSelectionChange('w2'); assert.deepEqual(h.selected, ['w2']);
});
