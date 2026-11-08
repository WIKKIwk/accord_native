const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const jsx = { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
function nodes(node, predicate) {
  if (!node || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap(child => nodes(child, predicate));
  return [...(predicate(node) ? [node] : []), ...nodes(node.props?.children, predicate)];
}
function load(platform) {
  const filename = path.resolve(__dirname, `../src/boyoqchi/BoyoqchiPaintPalette.${platform}.tsx`), loaded = new Module(filename, module);
  const sourcePath = path.resolve(__dirname, '../src/workerOrderLogic.ts'), source = new Module(sourcePath, module);
  source.filename = sourcePath; source.paths = module.paths;
  source.require = id => id === './workerControlsApi' ? {} : require(id);
  source._compile(ts.transpileModule(fs.readFileSync(sourcePath, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText, sourcePath);
  const { paintOptions } = source.exports;
  const mods = Object.fromEntries(['background','buttonStyle','font','foregroundStyle','frame'].map(id => [id, (...args) => ({ id, args })]));
  mods.shapes = { capsule: () => 'capsule' };
  const mocks = { 'react/jsx-runtime': jsx, '@expo/ui/swift-ui': { Button: 'Button', Host: 'Host', HStack: 'HStack', Text: 'Text', VStack: 'VStack' },
    '@expo/ui/swift-ui/modifiers': mods, '../workerOrderLogic': { paintOptions },
    './useBoyoqchiText': { useBoyoqchiText: () => value => value }, '../components/WorkerPaintPalette': { WorkerPaintPalette: 'WorkerPaintPalette' } };
  loaded.filename = filename; loaded.paths = module.paths;
  loaded.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, filename);
  return loaded.exports.BoyoqchiPaintPalette;
}

test('iOS palette groups native swatches in three columns with exact V2 colors and usable choices', () => {
  const Palette = load('ios'), selections = [], usages = [];
  const tree = Palette({ usage: 'rasxot', onUsage: value => usages.push(value), onSelect: value => selections.push(value) });
  const texts = nodes(tree, node => node.type === 'Text');
  for (const title of ['Ranglar','Laklar','Erituvchilar / spirtli suyuqliklar']) assert.equal(texts.filter(n => n.props.children === title).length, 1);
  const expected = { Mix: '#8A6A4A', Pantone: '#8E6BBE', Oq: '#F8F7F2', Sariq: '#FFD54F', Qizil: '#E53935',
    'Ko‘k': '#1E88E5', Tilla: '#D4A72C', Kumush: '#C7CDD3', Qora: '#202124', Lak: '#B7BCC2', Spirtlar: '#E4B77A' };
  const rows = nodes(tree, node => node.type === 'HStack').filter(row => nodes(row, node => node.type === 'Button').some(button => expected[button.props.children?.props?.children]));
  assert.deepEqual(rows.map(row => row.props.children[0].length), [3,3,3,1,1]);
  for (const [name, color] of Object.entries(expected)) {
    const button = nodes(tree, node => node.type === 'Button' && node.props.children?.props?.children === name)[0];
    assert.ok(button, name);
    assert.equal(button.props.children.props.modifiers.find(mod => mod.id === 'background').args[0], color);
    assert.equal(button.props.children.props.modifiers.find(mod => mod.id === 'background').args[1], 'capsule');
    button.props.onPress();
  }
  assert.deepEqual(selections, Object.keys(expected));
  const buttons = nodes(tree, node => node.type === 'Button');
  assert.equal(buttons[0].props.modifiers.find(m => m.id === 'buttonStyle').args[0], 'borderedProminent');
  assert.equal(buttons[1].props.modifiers.find(m => m.id === 'buttonStyle').args[0], 'bordered');
  buttons[1].props.onPress(); assert.deepEqual(usages, ['astatka']);
  const other = Palette({ usage: 'astatka', onUsage() {}, onSelect() {} });
  const otherButtons = nodes(other, node => node.type === 'Button');
  assert.equal(otherButtons[0].props.modifiers.find(m => m.id === 'buttonStyle').args[0], 'bordered');
  assert.equal(otherButtons[1].props.modifiers.find(m => m.id === 'buttonStyle').args[0], 'borderedProminent');
});

test('Android delegates to the existing Worker palette with the unchanged callbacks', () => {
  const Palette = load('android'), props = { usage: 'astatka', onUsage() {}, onSelect() {} };
  const tree = Palette(props); assert.equal(tree.type, 'WorkerPaintPalette'); assert.deepEqual(tree.props, props);
});
