const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const jsx = { Fragment: 'Fragment', jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
function nodes(node, predicate) {
  if (!node || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap(child => nodes(child, predicate));
  return [...(predicate(node) ? [node] : []), ...nodes(node.props?.children, predicate)];
}
function load(file, mocks) {
  const filename = path.resolve(__dirname, '../src/preparation', file), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths;
  mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : id.startsWith('.') ? {} : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, filename);
  return mod.exports;
}

test('formula editing isolates the form and preserves material, row, save and cancel actions', async () => {
  const calls = [], sheets = [], material = { code: 'C1', name: 'First' }, selected = { code: 'C2', name: 'Second' };
  const state = { editing: true, editingName: null, variantName: 'Variant', rows: [{ material, percent: '100' }],
    materials: [material, selected], formulas: [], loading: false, saving: false, error: null, editorError: null, canSave: true };
  state.controller = {
    getSnapshot: () => state, clearNotice() {}, setRows: rows => { state.rows = rows; },
    closeEditor: () => { state.editing = false; calls.push('cancel'); },
    save: async () => { calls.push(['save', state.rows]); state.editing = false; return true; },
  };
  const ui = new Proxy({ usePreparationText: () => value => value, usePreparationDialogs: () => ({}) },
    { get: (object, key) => object[key] ?? key });
  const mocks = {
    'react/jsx-runtime': jsx, react: { useCallback: fn => fn, useEffect() {}, useRef: value => ({ current: value }), useState: value => [value, () => {}] },
    '@expo/ui/jetpack-compose': {}, 'expo-router': { useFocusEffect() {}, useLocalSearchParams: () => ({ data: 'route' }) },
    'react-native': { View: 'View' }, 'react-native-safe-area-context': {}, '../nativeSheet': { useNativeSheet: () => ({
      open: (content, options) => sheets.push({ content, options }), close: () => calls.push('close-picker'),
    }) },
    '../shared/appRoutes': { appRoutes: { gscaleMode: 'scale' }, canOpenRoute: () => true },
    './PreparationContext.android': { usePreparationContext: () => ({ session: {} }) },
    './PreparationFormulaEditForm.android': { PreparationFormulaEditForm: 'EditForm' },
    './PreparationSeriyoPicker': { PreparationSeriyoPicker: 'MaterialPicker' },
    './PreparationUI.android': ui, './usePreparationAndroidView.android': { usePreparationFormulaView: () => state },
    './usePreparationNotice': { usePreparationNotice: () => ({ message: '', show: value => calls.push(value) }) },
    './preparationNavigation.android': { readPreparationRouteData: () => ({ variantName: 'Variant', materialName: 'PE' }) },
    './preparationLogic': { preparationNextFormulaName: () => 'A' },
    './preparationSharePresentation': { preparationShareSummary: () => ({ total: '100', valid: true }) },
    './preparationFormulaPresentation': { preparationFormulaHeading: () => ({ context: 'PE', code: 'Order', subtitle: 'Product', estimate: null }) },
  };
  const { PreparationOrderFormulaScreen } = load('PreparationFormulaEditor.android.tsx', mocks);
  const wrapper = PreparationOrderFormulaScreen(), render = () => wrapper.type(wrapper.props);
  const form = () => nodes(render(), node => node.type === 'EditForm')[0].props;
  assert.equal(form().name, 'A');
  assert.equal(nodes(render(), node => node.props?.label === 'Ishlab chiqarishni boshlash').length, 0);
  form().add(); assert.equal(state.rows.length, 2); assert.equal(state.rows[1].material, null);
  form().choose(1);
  sheets[0].content.props.choose(selected); sheets[0].options.onDismiss();
  assert.equal(state.rows[0].material, material); assert.equal(state.rows[1].material, selected);
  form().update(1, '25'); assert.deepEqual(state.rows.map(row => row.percent), ['100', '25']);
  form().remove(0); assert.deepEqual(state.rows, [{ material: selected, percent: '25' }]);
  form().update(0, '100'); form().save(); await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(calls.find(call => Array.isArray(call) && call[0] === 'save'), ['save', [{ material: selected, percent: '100' }]]);
  assert.ok(calls.includes('Formula saqlandi'));
  assert.equal(nodes(render(), node => node.type === 'EditForm').length, 0);
  assert.equal(nodes(render(), node => node.props?.label === 'Ishlab chiqarishni boshlash').length, 1);
  state.editing = true; form().cancel(); assert.equal(state.editing, false); assert.equal(calls.at(-1), 'cancel');
});

test('native formula controls keep save locked and avoid untouched-field errors', () => {
  const calls = [];
  const modifiers = new Proxy({}, { get: (_object, key) => value => ({ [key]: value }) });
  const native = { Host: 'Host', Text: 'Text', OutlinedButton: 'OutlinedButton', LinearProgressIndicator: 'Progress',
    Row: 'Row', RNHostView: 'RNHostView', IconButton: 'IconButton', useMaterialColors: () => ({}), Shape: { RoundedCorner: () => ({}) } };
  let width = 400;
  const { PreparationFormulaEditForm } = load('PreparationFormulaEditForm.android.tsx', {
    'react/jsx-runtime': jsx, '@expo/ui/jetpack-compose': native, '@expo/ui/jetpack-compose/modifiers': modifiers,
    'expo-symbols': { SymbolView: 'SymbolView' }, 'react-native': { View: 'View', useWindowDimensions: () => ({ width, fontScale: 1 }) },
    './PreparationInventoryDetails.android': { InventorySheetButton: 'Button' },
    './PreparationUI.android': { PreparationField: 'Field', usePreparationText: () => value => value },
  });
  const props = { name: 'A', creating: true, context: 'PE', rows: [{ material: null, percent: '' }], total: null,
    error: 'Choose material', saving: false, canSave: false, choose: index => calls.push(['choose', index]),
    update: (index, value) => calls.push(['percent', index, value]), add() {}, remove() {}, save() {}, cancel() {} };
  let tree = PreparationFormulaEditForm(props);
  assert.equal(nodes(tree, node => node.props?.label === 'Saqlash')[0].props.disabled, true);
  assert.equal(nodes(tree, node => node.type === 'Text' && node.props.children === 'Choose material').length, 0);
  let row = nodes(tree, node => node.type?.name === 'IngredientRow')[0], controls = row.type(row.props);
  assert.equal(nodes(controls, node => node.type === 'Field')[0].props.enabled, false);
  nodes(controls, node => node.type === 'OutlinedButton')[0].props.onClick(); assert.deepEqual(calls.at(-1), ['choose', 0]);
  tree = PreparationFormulaEditForm({ ...props, rows: [{ material: { code: 'C1', name: 'First' }, percent: '50' }], total: '50', error: 'Total must be 100%' });
  assert.equal(nodes(tree, node => node.type === 'Text' && node.props.children === 'Total must be 100%').length, 1);
  assert.equal(nodes(tree, node => node.type === 'Progress')[0].props.progress, 0.5);
  row = nodes(tree, node => node.type?.name === 'IngredientRow')[0]; controls = row.type(row.props);
  const field = nodes(controls, node => node.type === 'Field')[0];
  assert.equal(field.props.enabled, true); field.props.onChange('100'); assert.deepEqual(calls.at(-1), ['percent', 0, '100']);
  width = 320; controls = row.type(row.props);
  assert.ok(nodes(controls, node => node.props?.style?.flexDirection === 'column').length);
});
