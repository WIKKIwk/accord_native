const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

function harness(platform) {
  const records = [], calls = [], letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  const state = { invalid: false, query: '', searching: false, selectedLetter: 'A', primary: null, otherResults: [], results: [],
    grid: Array.from({ length: 13 }, (_, index) => ({ label: `A${index + 1}`, excluded: index === 1 })),
    controller: { setQuery: value => calls.push(['query', value]), selectLetter: value => calls.push(['letter', value]) },
    chooseGrid: value => calls.push(['grid', value]), chooseResult: value => calls.push(['result', value]), submit: () => calls.push(['submit']) };
  const component = name => props => { records.push({ name, props }); return React.createElement('div', null, props.label ?? props.children); };
  const ui = Object.fromEntries(['Button', 'Column', 'FilledTonalButton', 'FilterChip', 'Host', 'HStack', 'IconButton', 'Image', 'OutlinedTextField',
    'RNHostView', 'Row', 'Text', 'TextField', 'VStack'].map(name => [name, component(name)]));
  ui.FilterChip.Label = component('FilterChip.Label');
  for (const slot of ['Placeholder', 'LeadingIcon', 'TrailingIcon']) ui.OutlinedTextField[slot] = component(`OutlinedTextField.${slot}`);
  let value = ''; ui.useNativeState = () => ({ get: () => value, set: next => { value = next; } });
  ui.useMaterialColors = () => ({ onSurfaceVariant: 'muted' });
  const modifier = name => (...args) => ({ name, args });
  const mods = Object.fromEntries(['accessibilityAddTraits', 'accessibilityLabel', 'background', 'buttonStyle', 'disabled', 'font', 'frame',
    'labelStyle', 'onSubmit', 'submitLabel', 'textInputAutocapitalization', 'fillMaxSize', 'fillMaxWidth', 'semantics', 'testID'].map(name => [name, modifier(name)]));
  mods.shapes = { roundedRectangle: () => 'rounded' };
  const filename = path.resolve(__dirname, `../src/qolip/QolipGridCellPicker.${platform}.tsx`), loaded = new Module(filename, module);
  const mocks = { '@expo/ui/swift-ui': ui, '@expo/ui/jetpack-compose': ui, '@expo/ui/swift-ui/modifiers': mods, '@expo/ui/jetpack-compose/modifiers': mods,
    'expo-symbols': { SymbolView: component('SymbolView') }, 'react-native': { KeyboardAvoidingView: component('KeyboardAvoidingView'),
      ScrollView: component('ScrollView'), View: component('View'), PlatformColor: name => name, useWindowDimensions: () => ({ height: 1000 }) },
    '../shared/localization': { localizedGetter: key => key }, './qolipGridLogic': { qolipGridLetters: letters },
    './useQolipGridCellPicker': { useQolipGridCellPicker: props => { calls.push(['hook', props]); return state; } },
    './useQolipText': { useQolipText: () => ({ locale: 'uz', text: (key, values) => values ? `${key}:${Object.values(values).join(',')}` : key }) } };
  loaded.require = id => id in mocks ? mocks[id] : require(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ESNext,
  } }).outputText, filename);
  const View = loaded.exports.QolipGridCellPicker, props = { boundary: {}, excludeCellLabel: 'A2', select() {} };
  const render = () => { records.length = 0; return renderToStaticMarkup(React.createElement(View, props)); };
  const buttons = () => records.filter(row => ['Button', 'FilledTonalButton', 'FilterChip', 'IconButton'].includes(row.name));
  return { render, state, calls, props, records, buttons, setInput: next => { value = next; } };
}

for (const platform of ['ios', 'android']) {
  test(`${platform} grid picker shows the source default title, letters, grid and disabled exclusion`, () => {
    const h = harness(platform), markup = h.render(); assert.deepEqual(h.calls[0][1], h.props);
    assert.match(markup, /cell_picker\.title/); assert.match(markup, /cell_picker\.row/); assert.match(markup, /cell_picker\.row_heading:A/);
    assert.equal(h.records.find(row => row.name === 'View' && row.props.style?.maxHeight).props.style.maxHeight, 880);
    const controls = h.buttons(), action = platform === 'ios' ? 'onPress' : 'onClick';
    const row = controls.find(item => platform === 'ios' ? item.props.label === 'Z' : item.name === 'FilterChip' && item.props.selected === false &&
      h.records.some(record => record.name === 'Text' && record.props.children === 'Z'));
    if (platform === 'ios') row.props[action](); else controls.filter(item => item.name === 'FilterChip').at(-1).props[action]();
    const cell = platform === 'ios' ? controls.find(item => item.props.label === 'A1') : controls.filter(item => item.name === 'FilledTonalButton')[0];
    const excluded = platform === 'ios' ? controls.find(item => item.props.label === 'A2') : controls.filter(item => item.name === 'FilledTonalButton')[1];
    cell.props[action]();
    if (platform === 'ios') assert.ok(excluded.props.modifiers.some(value => value.name === 'disabled' && value.args[0]));
    else assert.equal(excluded.props.enabled, false);
    assert.deepEqual(h.calls.slice(1), [['letter', 'Z'], ['grid', 'A1']]);
  });

  test(`${platform} search presents exact result choices, handles submit and clears without dispatch`, () => {
    const h = harness(platform); h.state.query = 'B1'; h.state.searching = true; h.state.primary = 'B1'; h.state.results = ['B1', 'B10']; h.state.otherResults = ['B10'];
    const markup = h.render(); assert.match(markup, /cell_picker\.select:B1/); assert.match(markup, /cell_picker\.other_matches/); assert.match(markup, /B10/);
    const action = platform === 'ios' ? 'onPress' : 'onClick', controls = h.buttons();
    const primary = platform === 'ios' ? controls.find(item => item.props.label === 'cell_picker.select:B1') : controls.find(item => item.name === 'Button');
    primary.props[action]();
    const field = h.records.find(item => item.name === (platform === 'ios' ? 'TextField' : 'OutlinedTextField'));
    if (platform === 'ios') { h.setInput(' B1 '); field.props.modifiers.find(value => value.name === 'onSubmit').args[0](); }
    else field.props.keyboardActions.onDone(' B1 ');
    const clear = platform === 'ios' ? controls.find(item => item.props.label === 'clearTitle') : controls.find(item => item.name === 'IconButton');
    clear.props[action](); assert.deepEqual(h.calls.slice(1), [['result', 'B1'], ['query', ' B1 '], ['submit'], ['query', '']]);
  });

  test(`${platform} no-match and invalid states do not invent controls`, () => {
    const h = harness(platform); h.state.query = 'bad'; h.state.searching = true; h.state.results = []; assert.match(h.render(), /cell_picker\.no_match/);
    assert.equal(h.buttons().length, 1, 'only the search clear control is shown'); h.state.invalid = true;
    assert.equal(h.render(), ''); assert.equal(h.records.length, 0);
  });
}
