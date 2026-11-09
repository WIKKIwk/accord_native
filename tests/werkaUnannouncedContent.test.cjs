// Mocked partial content only. No picker, account, mutation, route or device is exercised.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const catalog = require('../src/shared/localization/catalog.json');
function compile(file, mocks = {}) {
  const filename = path.resolve(__dirname, '../src', file), module = new Module(filename);
  module.filename = filename; module.paths = require.main.paths;
  module.require = name => Object.hasOwn(mocks, name) ? mocks[name] : require(name);
  module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText, filename);
  return module.exports;
}
const localization = compile('shared/localization/index.ts', { './catalog.json': catalog });
const model = compile('werka/werkaUnannouncedPresentation.ts', { '../shared/localization': localization });
const jsx = { Fragment: 'Fragment', jsx: (type, props, key) => ({ type, props, key }),
  jsxs: (type, props, key) => ({ type, props, key }) };
function nodes(node, type) {
  if (!node || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap(value => nodes(value, type));
  return [...(node.type === type ? [node] : []), ...nodes(node.props?.children, type)];
}
const supplier = { ref: 's', name: 'Supplier' }, item = { code: 'i', name: 'Item', uom: 'kg' };
function setup(platform, patch = {}) {
  const calls = [], props = { supplier: null, item: null, initialQuantity: '1', quantityFieldKey: 1,
    submitting: false, locale: 'uz', onPickSupplier: () => calls.push('supplier'), onPickItem: () => calls.push('item'),
    onQuantityChange: value => calls.push(['quantity', value]), onRequestSubmit: () => calls.push('submit'), ...patch };
  const mocks = { 'react/jsx-runtime': jsx, './werkaUnannouncedPresentation': model,
    '@expo/ui/swift-ui': Object.fromEntries(['Button', 'RNHostView', 'Section', 'Text', 'VStack'].map(name => [name, name])),
    '@expo/ui/swift-ui/modifiers': { disabled: value => ({ disabled: value }) },
    'react-native': { ScrollView: 'ScrollView' },
    '../components/WorkerFormField': { WorkerFormField: 'WorkerFormField' },
    '../components/WorkerSheetButton': { WorkerSheetButton: 'WorkerSheetButton' },
    '../preparation/PreparationUI.ios': { PreparationList: 'PreparationList' },
    '../preparation/PreparationUI.android': { PreparationField: 'PreparationField', PreparationText: 'PreparationText' } };
  const { WerkaUnannouncedContent } = compile(`werka/WerkaUnannouncedContent.${platform}.tsx`, mocks);
  return { tree: WerkaUnannouncedContent(props), calls };
}
test('unannounced source button enablement and localized labels follow supplied state', () => {
  const base = { supplier: null, item: null, submitting: false, locale: 'uz' };
  const empty = model.werkaUnannouncedPresentation(base);
  assert.equal(empty.showItem, false); assert.equal(empty.showQuantity, false);
  assert.equal(empty.canPickSupplier, true); assert.equal(empty.canPickItem, false); assert.equal(empty.canSubmit, false);
  assert.equal(empty.supplierName, localization.localizedGetter('selectSupplier', 'uz'));
  const selected = model.werkaUnannouncedPresentation({ ...base, supplier, item, locale: 'en' });
  assert.equal(selected.supplierName, 'Supplier'); assert.equal(selected.itemName, 'Item');
  assert.equal(selected.quantityLabel, localization.localizedGetter('amountLabel', 'en'));
  assert.equal(selected.showItem, true); assert.equal(selected.showQuantity, true);
  assert.equal(selected.canPickItem, true); assert.equal(selected.canSubmit, true);
  const busy = model.werkaUnannouncedPresentation({ ...base, supplier, item, submitting: true });
  assert.equal(busy.canPickSupplier, false); assert.equal(busy.canPickItem, false); assert.equal(busy.canSubmit, false);
  assert.equal(busy.submitLabel, localization.localizedGetter('pinSaving', 'uz'));
});
for (const platform of ['ios', 'android']) {
  const button = platform === 'ios' ? 'Button' : 'WorkerSheetButton';
  const field = platform === 'ios' ? 'WorkerFormField' : 'PreparationField';
  test(`${platform} unannounced partial body reuses native components and only requests actions`, () => {
    const empty = setup(platform), emptyButtons = nodes(empty.tree, button);
    assert.equal(emptyButtons.length, 2); assert.equal(nodes(empty.tree, field).length, 0);
    emptyButtons[0].props.onPress(); emptyButtons[1].props.onPress();
    assert.deepEqual(empty.calls, ['supplier']);
    const supplierOnly = setup(platform, { supplier }), supplierButtons = nodes(supplierOnly.tree, button);
    assert.equal(supplierButtons.length, 3); assert.equal(nodes(supplierOnly.tree, field).length, 0);
    supplierButtons[1].props.onPress(); supplierButtons[2].props.onPress();
    assert.deepEqual(supplierOnly.calls, ['item']);
    const full = setup(platform, { supplier, item, initialQuantity: '2.5', quantityFieldKey: 'prefill-2' });
    const fullButtons = nodes(full.tree, button), input = nodes(full.tree, field)[0];
    assert.equal(input.key, 'prefill-2');
    assert.equal(platform === 'ios' ? input.props.initialValue : input.props.initial, '2.5');
    assert.equal(platform === 'ios' ? input.props.keyboardType : input.props.decimal, platform === 'ios' ? 'decimal-pad' : true);
    if (platform === 'android') assert.equal(input.props.suffix, 'kg');
    else assert.ok(nodes(full.tree, 'Text').some(node => node.props.children === 'kg'));
    (input.props.onChangeText ?? input.props.onChange)('3');
    fullButtons[0].props.onPress(); fullButtons[1].props.onPress(); fullButtons[2].props.onPress();
    assert.deepEqual(full.calls, [['quantity', '3'], 'supplier', 'item', 'submit']);
  });
  test(`${platform} submitting blocks picker and submit callbacks but keeps quantity editable`, () => {
    const busy = setup(platform, { supplier, item, submitting: true });
    for (const element of nodes(busy.tree, button)) element.props.onPress();
    const input = nodes(busy.tree, field)[0];
    (input.props.onChangeText ?? input.props.onChange)('4');
    assert.deepEqual(busy.calls, [['quantity', '4']]);
  });
}
