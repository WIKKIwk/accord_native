const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const { harness, nodes } = require('./support/workerOrderScreen.cjs');

const jsx = { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
function loadField(palette) {
  const filename = path.resolve(__dirname, '../src/components/WorkerProgressField.android.tsx'), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths;
  const field = Object.assign(() => {}, { Label: 'Label' });
  const mocks = { 'react/jsx-runtime': jsx, '@expo/ui/jetpack-compose': {
    OutlinedTextField: field, Shape: { RoundedCorner: props => ({ type: 'roundedCorner', ...props }) }, Text: 'Text',
    useNativeState: value => ({ initial: value }), useMaterialColors: options => { assert.deepEqual(options, {}); return palette; },
  }, '@expo/ui/jetpack-compose/modifiers': { fillMaxWidth: () => ({ name: 'fillMaxWidth' }) }, './BaseHost': { BaseHost: 'Host' } };
  mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText, filename);
  return { render: mod.exports.WorkerProgressField, field };
}

for (const mode of ['light', 'dark']) test(`Android ${mode} quantity fields retain labels and raw decimal input`, () => {
  const { render, field } = loadField({ surface: `${mode}-surface` }), changes = [];
  for (const label of ['Babina, kg', 'Metraj, metr', 'Og‘irlik, kg']) {
    const tree = render({ label, initialValue: '12,5', keyboardType: 'decimal-pad', onChangeText: value => changes.push(value) });
    assert.equal(tree.props.dynamicColors, true);
    const input = nodes(tree, node => node.type === field)[0];
    assert.deepEqual(input.props.value, { initial: '12,5' });
    assert.equal(input.props.keyboardOptions.keyboardType, 'decimal');
    assert.equal(input.props.colors.unfocusedContainerColor, `${mode}-surface`);
    assert.equal(input.props.shape.cornerRadii.topStart, 12);
    assert.equal(input.props.modifiers.some(mod => mod.name === 'fillMaxWidth'), true);
    assert.deepEqual(nodes(input, node => node.type === 'Text').map(node => node.props.children), [label]);
    input.props.onValueChange('34,75'); input.props.onValueChange('');
  }
  assert.deepEqual(changes, ['34,75', '', '34,75', '', '34,75', '']);
});

for (const platform of ['android', 'ios']) for (const action of ['pause', 'complete']) test(`${platform}: ${action} quantity form keeps its labels and input handlers`, () => {
  const h = harness(platform, { states: { selected: action }, control: { allowed_actions: ['pause', 'complete'], complete_requires_full_report: false },
    interaction: { mode: 'in_progress', blocking_reason_code: '' } });
  const tree = h.render(), dialog = nodes(tree, node => node.type === 'WorkerFormDialog')[0];
  assert.equal(dialog.props.progressAction, platform === 'android' ? action : undefined);
  assert.equal(dialog.props.visible, true);
  const fields = nodes(dialog, node => node.type?.name === 'Field');
  assert.equal(fields.length, 3);
  assert.deepEqual(fields.map(field => field.props.label), ['Babina, kg', 'Metraj, metr', 'Og‘irlik, kg']);
  fields[0].props.onChangeText('1'); fields[1].props.onChangeText('12,5'); fields[2].props.onChangeText('10');
  assert.deepEqual([h.values.get('bobina'), h.values.get('meter'), h.values.get('kg')], ['1', '12,5', '10']);
});

for (const [name, operation, technology] of [
  ['rangli bosma', 'print', 'rotogravure'], ['flexo bosma', 'print', 'flexographic'],
  ['laminatsiya', 'laminate', 'adhesive_lamination'], ['ekstruzion laminatsiya', 'laminate', 'extrusion_lamination'],
  ['rezka', 'cut', 'slitting'], ['kley', 'glue', 'cold_glue'], ['paket', 'package', 'bag_making'],
]) for (const action of ['pause', 'complete']) test(`Android ${name}: ${action} uses the native quantity dialog`, () => {
  const h = harness('android', { states: { selected: action }, apparatus: { operation, technology },
    control: { allowed_actions: ['pause', 'complete'], complete_requires_full_report: false },
    interaction: { mode: 'in_progress', blocking_reason_code: '' } });
  const tree = h.render(), dialog = nodes(tree, node => node.type === 'WorkerFormDialog')[0];
  if (operation === 'cut') {
    assert.equal(dialog.props.visible, false);
    const report = nodes(tree, node => node.type === 'WorkerRezkaOutputReport')[0];
    assert.equal(report.props.action, action);
  } else {
    assert.equal(dialog.props.visible, true);
    assert.equal(dialog.props.progressAction, action);
    const fields = nodes(dialog, node => node.type?.name === 'Field');
    assert.deepEqual(fields.slice(0, 3).map(field => field.props.label), ['Babina, kg', 'Metraj, metr', 'Og‘irlik, kg']);
  }
});

for (const [operation, expected] of [
  ['print', ['Babina, kg', 'Metraj, metr', 'Og‘irlik, kg', 'Jami chiqindi, kg']],
  ['glue', ['Babina, kg', 'Metraj, metr', 'Og‘irlik, kg', 'Bosmadan ortgan rulon (kg)', 'Plyonkadan ortgan rulon (kg)', 'Jami chiqindi, kg']],
  ['package', ['Babina, kg', 'Metraj, metr', 'Og‘irlik, kg', 'Jami chiqindi, kg']],
]) test(`Android ${operation}: full completion keeps every field in the same dialog`, () => {
  const h = harness('android', { states: { selected: 'complete' }, apparatus: { operation },
    control: { allowed_actions: ['pause', 'complete'], complete_requires_full_report: true },
    interaction: { mode: 'in_progress', blocking_reason_code: '' } });
  const dialog = nodes(h.render(), node => node.type === 'WorkerFormDialog')[0];
  assert.equal(dialog.props.visible, true);
  assert.equal(dialog.props.progressAction, 'complete');
  assert.deepEqual(nodes(dialog, node => node.type?.name === 'Field').map(field => field.props.label), expected);
});

test('Android astatka keeps its existing dialog and fields', () => {
  const h = harness('android', { states: { selected: 'astatka' }, apparatus: { operation: 'glue' },
    control: { allowed_actions: ['pause', 'complete'] }, interaction: { mode: 'in_progress', blocking_reason_code: '' } });
  const dialog = nodes(h.render(), node => node.type === 'WorkerFormDialog')[0];
  assert.equal(dialog.props.progressAction, undefined);
  const fields = nodes(dialog, node => node.type?.name === 'Field');
  assert.ok(fields.length > 0);
  assert.ok(fields.every(field => field.props.progress === false));
});
