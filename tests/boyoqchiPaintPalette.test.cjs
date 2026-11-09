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
const paletteLogic = compile('boyoqchi/boyoqchiPaintPaletteLogic.ts');
const { boyoqchiPaintCompletion } = paletteLogic;
function load(platform, translate = value => value, direction = 'leftToRight') {
  const mods = Object.fromEntries(['accessibilityHidden','background','buttonStyle','font','foregroundStyle','frame','padding']
    .map(id => [id, (...args) => ({ id, args })]));
  mods.shapes = { capsule: () => 'capsule' };
  const compose = Object.fromEntries(['Box','Button','Column','Host','RNHostView','Row','SingleChoiceSegmentedButtonRow','Spacer','Text']
    .map(id => [id, id]));
  compose.SegmentedButton = Object.assign(() => {}, { Label: 'SegmentedButton.Label' });
  return compile(`boyoqchi/BoyoqchiPaintPalette.${platform}.tsx`, {
    'react/jsx-runtime': jsx, '@expo/ui/swift-ui': { Button: 'Button', Host: 'Host', HStack: 'HStack', Image: 'Image', Text: 'Text', VStack: 'VStack', ZStack: 'ZStack' },
    '@expo/ui/swift-ui/modifiers': mods, '@expo/ui/jetpack-compose': compose,
    '@expo/ui/jetpack-compose/modifiers': Object.fromEntries(['align','fillMaxWidth','height','padding','weight'].map(id => [id, (...args) => ({ id, args })])),
    'expo-symbols': { SymbolView: 'SymbolView' }, '../workerOrderLogic': { paintOptions }, './boyoqchiPaintPaletteLogic': paletteLogic,
    './useBoyoqchiText': { useBoyoqchiText: () => translate },
    '../components/useBaseTheme': { useBaseTheme: () => ({ direction }) },
  }).BoyoqchiPaintPalette;
}
const draft = () => new ReturnedPaintDraft(() => {});
const swatch = (tree, name) => nodes(tree, node => node.type === 'Button' && ['ZStack', 'Box'].includes(node.props.children?.type) &&
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

test('Android palette reuses native controls with the same V2 groups, three columns, tones and actions', () => {
  const Palette = load('android'), selections = [], usages = [];
  const tree = Palette({ draft: draft(), usage: 'astatka', onUsage: value => usages.push(value), onSelect: value => selections.push(value) });
  assert.equal(tree.type, 'Host'); assert.deepEqual(tree.props.matchContents, { vertical: true });
  const texts = nodes(tree, node => node.type === 'Text');
  for (const title of ['Ranglar','Laklar','Erituvchilar / spirtli suyuqliklar']) assert.equal(texts.filter(n => n.props.children === title).length, 1);
  const rows = nodes(tree, node => node.type === 'Row');
  assert.deepEqual(rows.map(row => row.props.children[0].length), [3,3,3,1,1]);
  assert.deepEqual(rows.map(row => row.props.children[1].length), [0,0,0,2,2]);
  for (const row of rows) assert.deepEqual(row.props.horizontalArrangement, { spacedBy: 10 });
  const ios = load('ios')({ draft: draft(), usage: 'astatka', onUsage() {}, onSelect() {} });
  for (const { name } of paintOptions) {
    const button = swatch(tree, name), nativeTone = swatch(ios, name).props.children.props.modifiers.find(mod => mod.id === 'background').args[0];
    assert.equal(button.props.colors.containerColor, nativeTone, name);
    assert.deepEqual(button.props.modifiers, [{ id: 'weight', args: [1] }, { id: 'height', args: [64] }]);
    assert.deepEqual(button.props.contentPadding, { start: 0, top: 0, end: 0, bottom: 0 });
    assert.equal(button.props.children.props.contentAlignment, 'center'); button.props.onClick();
  }
  assert.deepEqual(selections, paintOptions.map(option => option.name));
  assert.equal(nodes(tree, node => node.type === 'SymbolView').length, 0);
  const tabs = nodes(tree, node => typeof node.type === 'function');
  assert.deepEqual(tabs.map(tab => tab.props.selected), [false, true]);
  tabs[0].props.onClick(); tabs[1].props.onClick(); assert.deepEqual(usages, ['rasxot', 'astatka']);
  const other = Palette({ draft: draft(), usage: 'rasxot', onUsage() {}, onSelect() {} });
  assert.deepEqual(nodes(other, node => typeof node.type === 'function').map(tab => tab.props.selected), [true, false]);
});

for (const platform of ['ios', 'android']) {
  test(`${platform} indicators update from restored draft values, including named and cleared fields in both usages`, () => {
    const Palette = load(platform), option = name => paintOptions.find(o => o.name === name), d = new ReturnedPaintDraft(() => {}, {
      values: { 'rasxot:Oq': ['0'], 'rasxot:Pantone Mix': ['3'], 'astatka:Mix': ['0'] },
      dynamic_field_labels: { 'rasxot:Pantone': ['Blue'], 'rasxot:Pantone Mix': ['Recipe'], 'astatka:Mix': ['Custom'] },
    });
    const render = usage => Palette({ draft: d, usage, onUsage() {}, onSelect() {} });
    const glyph = (usage, name) => {
      const image = nodes(swatch(render(usage), name), n => n.type === (platform === 'ios' ? 'Image' : 'SymbolView'))[0];
      return image ? { name: platform === 'ios' ? image.props.systemName : image.props.name.android,
        size: image.props.size, color: platform === 'ios' ? image.props.color : image.props.tintColor } : null;
    };
    const partial = platform === 'ios' ? 'star.fill' : 'star', complete = platform === 'ios' ? 'checkmark' : 'check';
    assert.deepEqual(glyph('rasxot', 'Oq'), { name: partial, size: 16, color: '#332C26' });
    assert.equal(glyph('astatka', 'Oq'), null);
    assert.deepEqual(glyph('rasxot', 'Pantone'), { name: partial, size: 16, color: '#FFFFFF' });
    d.setValue('rasxot:Pantone', 0, '2', 1);
    assert.equal(glyph('rasxot', 'Pantone').name, complete);
    d.setValue('rasxot:Pantone Mix', 0, ' ', 1); assert.equal(glyph('rasxot', 'Pantone').name, partial);
    d.setValue('rasxot:Pantone', 0, '', 1); assert.equal(glyph('rasxot', 'Pantone'), null);
    for (const name of ['Oq', 'Lak', 'Spirtlar']) {
      const fields = option(name).fields;
      fields.forEach((_, i) => d.setValue(`rasxot:${name}`, i, '0', fields.length));
      assert.equal(glyph('rasxot', name).name, complete); assert.equal(glyph('rasxot', name).size, 17);
      assert.equal(glyph('astatka', name), null);
      d.addNamedField(`rasxot:${name}`, 'Custom'); assert.equal(glyph('rasxot', name).name, partial);
      d.setValue(`rasxot:${name}`, fields.length, '1', fields.length + 1); assert.equal(glyph('rasxot', name).name, complete);
      fields.forEach((_, i) => d.setValue(`rasxot:${name}`, i, '\t ', fields.length + 1));
      d.setValue(`rasxot:${name}`, fields.length, '', fields.length + 1); assert.equal(glyph('rasxot', name), null);
    }
    assert.equal(glyph('astatka', 'Mix').name, complete); assert.equal(glyph('rasxot', 'Mix'), null);
    d.setValue('astatka:Mix', 0, '', 1); assert.equal(glyph('astatka', 'Mix'), null);
  });

  test(`${platform} translates existing V2 labels without adding completion text or mutating the draft`, () => {
    const translated = [], Palette = load(platform, value => { translated.push(value); return `translated:${value}`; }), d = draft();
    const before = JSON.stringify(d.toJson());
    const tree = Palette({ draft: d, usage: 'rasxot', onUsage() {}, onSelect() {} });
    const expected = ['Rasxot', 'Astatka', 'Ranglar', ...paintOptions.filter(o => o.category === 'colors').map(o => o.name),
      'Laklar', 'Lak', 'Erituvchilar / spirtli suyuqliklar', 'Spirtlar'];
    assert.deepEqual(translated, expected);
    assert.deepEqual(nodes(tree, node => node.type === 'Text').map(node => node.props.children).filter(Boolean), expected.map(value => `translated:${value}`));
    assert.equal(JSON.stringify(d.toJson()), before);
  });
}

test('Android completion symbols stay inside the button without becoming a second touch or accessibility target', () => {
  const d = draft(); d.setValue('rasxot:Lak', 0, '1', 2);
  const button = swatch(load('android')({ draft: d, usage: 'rasxot', onUsage() {}, onSelect() {} }), 'Lak');
  const host = nodes(button, n => n.type === 'RNHostView')[0], glyph = host.props.children;
  assert.equal(host.props.matchContents, true);
  assert.deepEqual(host.props.modifiers, [{ id: 'align', args: ['topEnd'] }, { id: 'padding', args: [0, 8, 12, 0] }]);
  assert.equal(glyph.props.pointerEvents, 'none'); assert.equal(glyph.props.accessible, false);
  assert.equal(glyph.props.importantForAccessibility, 'no-hide-descendants');
});

test('completion follows V2 nonempty text rather than numeric validation and ignores unresolved stored values', () => {
  const d = new ReturnedPaintDraft(() => {}, { values: { 'rasxot:Mix': ['old orphan value'], 'rasxot:Lak': ['invalid', '-1'] } });
  const option = name => paintOptions.find(o => o.name === name);
  assert.equal(boyoqchiPaintCompletion(d, 'rasxot', option('Mix')), null);
  assert.equal(boyoqchiPaintCompletion(d, 'rasxot', option('Pantone')), null);
  assert.equal(boyoqchiPaintCompletion(d, 'rasxot', option('Lak')), 'complete');
  d.setValue('rasxot:Lak', 1, ' ', 2); assert.equal(boyoqchiPaintCompletion(d, 'rasxot', option('Lak')), 'partial');
});

for (const direction of ['leftToRight', 'rightToLeft']) {
  test(`native palettes follow app ${direction} while retaining V2's absolute right indicator inset`, () => {
    const d = draft(); d.setValue('rasxot:Lak', 0, '1', 2);
    for (const platform of ['ios', 'android']) {
      const tree = load(platform, value => value, direction)({ draft: d, usage: 'rasxot', onUsage() {}, onSelect() {} });
      assert.equal(tree.props.layoutDirection, direction);
      const button = swatch(tree, 'Lak'), rtl = direction === 'rightToLeft';
      if (platform === 'ios') {
        assert.equal(button.props.children.props.alignment, rtl ? 'topLeading' : 'topTrailing');
        const image = nodes(button, node => node.type === 'Image')[0];
        assert.deepEqual(image.props.modifiers[0], { id: 'padding', args: [rtl ? { top: 8, leading: 12 } : { top: 8, trailing: 12 }] });
      } else {
        const host = nodes(button, node => node.type === 'RNHostView')[0];
        assert.deepEqual(host.props.modifiers, [{ id: 'align', args: [rtl ? 'topStart' : 'topEnd'] },
          { id: 'padding', args: [rtl ? 12 : 0, 8, rtl ? 0 : 12, 0] }]);
      }
    }
  });
}
