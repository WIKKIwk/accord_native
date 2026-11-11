const assert = require('node:assert/strict'), fs = require('node:fs'), Module = require('node:module'), path = require('node:path'), test = require('node:test'), ts = require('typescript');
const jsx = { jsx: (type, props) => ({ type, props: props ?? {} }), jsxs: (type, props) => ({ type, props: props ?? {} }) };
function compile(file, mocks) {
  const filename = path.resolve(__dirname, '../src', file), mod = new Module(filename, module); mod.paths = module.paths;
  mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, filename);
  return mod.exports;
}
const { paintOptions } = compile('workerOrderLogic.ts', { './workerControlsApi': {} });
function nodes(tree, predicate) {
  if (!tree || typeof tree !== 'object') return [];
  if (Array.isArray(tree)) return tree.flatMap(child => nodes(child, predicate));
  return [...(predicate(tree) ? [tree] : []), ...nodes(tree.props?.children, predicate)];
}
function fixture(usage = 'rasxot', translate = text => text) {
  const usages = [], selected = [];
  const { WorkerPaintPalette } = compile('components/WorkerPaintPalette.ios.tsx', {
    'react/jsx-runtime': jsx, '@expo/ui/swift-ui': { Button: 'Button', Host: 'Host', HStack: 'HStack', Picker: 'Picker', Text: 'Text', VStack: 'VStack' },
    '@expo/ui/swift-ui/modifiers': new Proxy({ shapes: { capsule: () => 'capsule' } }, { get: (target, key) => target[key] ?? ((...args) => ({ name: key, args })) }),
    '../workerOrderLogic': { paintOptions }, './useWorkerOrderText': { useWorkerOrderText: () => ({ t: translate }) },
  });
  return { usages, selected, tree: WorkerPaintPalette({ usage, onUsage: value => usages.push(value), onSelect: name => selected.push(name) }) };
}

// Source-derived: returned_paint_sheet.dart:228-234.
test('iOS worker palette renders source categories and each matching option in source order', () => {
  const { tree } = fixture(), groups = nodes(tree, row => row.type === 'VStack' && nodes(row, child => child.type === 'Text' && ['Ranglar', 'Laklar', 'Erituvchilar / spirtli suyuqliklar'].includes(child.props.children)).length === 1);
  assert.equal(tree.type, 'Host'); assert.equal(tree.props.matchContents.vertical, true);
  assert.equal(groups.length, 3);
  assert.deepEqual(groups.map(group => nodes(group, row => row.type === 'Text')[0].props.children), ['Ranglar', 'Laklar', 'Erituvchilar / spirtli suyuqliklar']);
  for (const [index, category] of ['colors', 'lacquers', 'solvents'].entries()) {
    const names = nodes(groups[index], row => row.type === 'Button').map(button => nodes(button, child => child.type === 'Text')[0].props.children);
    assert.deepEqual(names, paintOptions.filter(option => option.category === category).map(option => option.name));
    for (const row of nodes(groups[index], child => child.type === 'HStack')) {
      assert.equal(nodes(row, child => child.type === 'Button').length + nodes(row, child => child.type === 'Text' && child.props.children === '').length, 3);
    }
  }
});

test('native usage tags keep the selected usage and reject malformed callback values', () => {
  for (const initial of ['rasxot', 'astatka']) {
    const h = fixture(initial), picker = nodes(h.tree, row => row.type === 'Picker')[0];
    assert.equal(picker.props.selection, initial);
    assert.deepEqual(nodes(picker, row => row.type === 'Text').map(row => [row.props.children, row.props.modifiers[0]]), [
      ['Rasxot', { name: 'tag', args: ['rasxot'] }], ['Astatka', { name: 'tag', args: ['astatka'] }],
    ]);
    for (const invalid of [null, undefined, '', 0, 'unknown', { selection: 'rasxot' }]) picker.props.onSelectionChange(invalid);
    assert.deepEqual(h.usages, []);
    picker.props.onSelectionChange('astatka'); picker.props.onSelectionChange('rasxot');
    assert.deepEqual(h.usages, ['astatka', 'rasxot']); assert.deepEqual(h.selected, []);
  }
});

test('translated swatch labels still submit canonical paint names without changing usage', () => {
  const h = fixture('astatka', text => `translated:${text}`), buttons = nodes(h.tree, row => row.type === 'Button');
  assert.equal(buttons.length, paintOptions.length);
  buttons.forEach((button, index) => {
    assert.equal(nodes(button, row => row.type === 'Text')[0].props.children, `translated:${paintOptions[index].name}`);
    button.props.onPress();
  });
  assert.deepEqual(h.selected, paintOptions.map(option => option.name)); assert.deepEqual(h.usages, []);
});
