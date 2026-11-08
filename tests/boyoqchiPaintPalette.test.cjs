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
function compile(relative, mocks = {}) {
  const filename = path.resolve(__dirname, `../src/${relative}`), loaded = new Module(filename, module);
  loaded.filename = filename; loaded.paths = module.paths;
  loaded.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, filename);
  return loaded.exports;
}
const { paintOptions } = compile('workerOrderLogic.ts', { './workerControlsApi': {} });
const { ReturnedPaintDraft } = compile('boyoqchi/returnedPaintDraft.ts', { './returnedPaintModel': {} });
const { boyoqchiPaintCompletion } = compile('boyoqchi/boyoqchiPaintPaletteLogic.ts');
function load(platform) {
  const mods = Object.fromEntries(['accessibilityHidden','background','buttonStyle','font','foregroundStyle','frame','padding']
    .map(id => [id, (...args) => ({ id, args })]));
  mods.shapes = { capsule: () => 'capsule' };
  return compile(`boyoqchi/BoyoqchiPaintPalette.${platform}.tsx`, {
    'react/jsx-runtime': jsx, '@expo/ui/swift-ui': { Button: 'Button', Host: 'Host', HStack: 'HStack', Image: 'Image', Text: 'Text', VStack: 'VStack', ZStack: 'ZStack' },
    '@expo/ui/swift-ui/modifiers': mods, '../workerOrderLogic': { paintOptions }, './boyoqchiPaintPaletteLogic': { boyoqchiPaintCompletion },
    './useBoyoqchiText': { useBoyoqchiText: () => value => value }, '../components/WorkerPaintPalette': { WorkerPaintPalette: 'WorkerPaintPalette' },
  }).BoyoqchiPaintPalette;
}
const draft = () => new ReturnedPaintDraft(() => {});
const swatch = (tree, name) => nodes(tree, node => node.type === 'Button' && node.props.children?.type === 'ZStack' &&
  nodes(node.props.children, child => child.type === 'Text' && child.props.children === name).length)[0];

test('iOS palette groups native swatches in three columns with exact V2 colors and usable choices', () => {
  const Palette = load('ios'), selections = [], usages = [], paintDraft = draft();
  const tree = Palette({ draft: paintDraft, usage: 'rasxot', onUsage: value => usages.push(value), onSelect: value => selections.push(value) });
  const texts = nodes(tree, node => node.type === 'Text');
  for (const title of ['Ranglar','Laklar','Erituvchilar / spirtli suyuqliklar']) assert.equal(texts.filter(n => n.props.children === title).length, 1);
  const expected = { Mix: '#8A6A4A', Pantone: '#8E6BBE', Oq: '#F8F7F2', Sariq: '#FFD54F', Qizil: '#E53935',
    'Ko‘k': '#1E88E5', Tilla: '#D4A72C', Kumush: '#C7CDD3', Qora: '#202124', Lak: '#B7BCC2', Spirtlar: '#E4B77A' };
  const rows = nodes(tree, node => node.type === 'HStack').filter(row => nodes(row, node => node.type === 'ZStack').length);
  assert.deepEqual(rows.map(row => row.props.children[0].length), [3,3,3,1,1]);
  for (const [name, color] of Object.entries(expected)) {
    const button = swatch(tree, name); assert.ok(button, name);
    assert.equal(button.props.children.props.modifiers.find(mod => mod.id === 'background').args[0], color);
    assert.equal(button.props.children.props.modifiers.find(mod => mod.id === 'background').args[1], 'capsule');
    button.props.onPress();
  }
  assert.deepEqual(selections, Object.keys(expected));
  const buttons = nodes(tree, node => node.type === 'Button');
  assert.equal(buttons[0].props.modifiers.find(m => m.id === 'buttonStyle').args[0], 'borderedProminent');
  assert.equal(buttons[1].props.modifiers.find(m => m.id === 'buttonStyle').args[0], 'bordered');
  buttons[1].props.onPress(); assert.deepEqual(usages, ['astatka']);
  const other = Palette({ draft: paintDraft, usage: 'astatka', onUsage() {}, onSelect() {} });
  const otherButtons = nodes(other, node => node.type === 'Button');
  assert.equal(otherButtons[0].props.modifiers.find(m => m.id === 'buttonStyle').args[0], 'bordered');
  assert.equal(otherButtons[1].props.modifiers.find(m => m.id === 'buttonStyle').args[0], 'borderedProminent');
});

test('iOS completion indicators reflect real draft fields, Pantone Mix and selected usage', () => {
  const Palette = load('ios'), d = draft(), option = name => paintOptions.find(o => o.name === name);
  const render = usage => Palette({ draft: d, usage, onUsage() {}, onSelect() {} });
  const glyph = (usage, name) => nodes(swatch(render(usage), name), n => n.type === 'Image')[0]?.props.systemName ?? null;
  assert.equal(glyph('rasxot', 'Oq'), null); assert.equal(glyph('rasxot', 'Pantone'), null);
  d.setValue('rasxot:Oq', 0, '0', option('Oq').fields.length);
  assert.equal(glyph('rasxot', 'Oq'), 'star.fill'); assert.equal(glyph('astatka', 'Oq'), null);
  option('Oq').fields.forEach((_, i) => d.setValue('rasxot:Oq', i, '1', option('Oq').fields.length));
  assert.equal(glyph('rasxot', 'Oq'), 'checkmark');
  d.addNamedField('rasxot:Pantone', 'Blue'); d.addNamedField('rasxot:Pantone Mix', 'Recipe');
  d.setValue('rasxot:Pantone', 0, '2', 1); assert.equal(glyph('rasxot', 'Pantone'), 'star.fill');
  d.setValue('rasxot:Pantone Mix', 0, '3', 1); assert.equal(glyph('rasxot', 'Pantone'), 'checkmark');
  d.setValue('rasxot:Pantone Mix', 0, ' ', 1); assert.equal(glyph('rasxot', 'Pantone'), 'star.fill');
  d.addNamedField('astatka:Mix', 'Custom'); d.setValue('astatka:Mix', 0, '4', 1);
  assert.equal(glyph('astatka', 'Mix'), 'checkmark'); assert.equal(glyph('rasxot', 'Mix'), null);
});

test('Android delegates to the existing Worker palette with unchanged callbacks and no fabricated badge', () => {
  const Palette = load('android'), props = { draft: draft(), usage: 'astatka', onUsage() {}, onSelect() {} };
  const tree = Palette(props); assert.equal(tree.type, 'WorkerPaintPalette');
  assert.deepEqual(tree.props, { usage: props.usage, onUsage: props.onUsage, onSelect: props.onSelect });
});
