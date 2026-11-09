const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

function harness(platform) {
  const records = [], calls = [], first = { id: 'same', item_name: 'Needle', qolip_code: 'Q', size: 3, quantity: 2 },
    second = { id: 'other', item_name: '', qolip_code: 'Other', size: 4, quantity: 1 };
  const state = { invalid: false, selectionMode: false, header: { kind: 'cell', label: 'A1' }, unplacedCount: 2, movableInCount: 1,
    footerEnabled: true, rows: [first, second].map(item => ({ item, selected: false, showActions: true, actionsEnabled: true })),
    controller: { tap: item => calls.push(['tap', item]), toggle: item => calls.push(['toggle', item]) },
    moveSelected: () => calls.push(['bulk']), moveOut: item => calls.push(['move', item]), take: item => calls.push(['take', item]),
    placeUnplaced: () => calls.push(['unplaced']), moveIn: () => calls.push(['moveIn']), add: () => calls.push(['add']) };
  const component = name => props => { records.push({ name, props });
    return React.createElement(name === 'Text' ? 'span' : 'div', null, props.label ?? props.children); };
  const ui = Object.fromEntries(['Button', 'Host', 'HStack', 'Image', 'Spacer', 'Text', 'VStack', 'Column', 'FilledIconButton', 'FilledTonalButton', 'RNHostView', 'Row'].map(name => [name, component(name)]));
  ui.useMaterialColors = () => ({ primary: 'primary', onPrimary: 'onPrimary', secondaryContainer: 'selected', onSecondaryContainer: 'onSelected',
    surfaceContainerHighest: 'normal', onSurfaceVariant: 'secondary' });
  const modifier = name => (...args) => ({ name, args });
  const modifiers = Object.fromEntries(['accessibilityAddTraits', 'accessibilityIdentifier', 'accessibilityLabel', 'background', 'buttonStyle', 'contentShape',
    'disabled', 'font', 'frame', 'labelStyle', 'lineLimit', 'onLongPressGesture', 'onTapGesture', 'padding', 'clip', 'combinedClickable', 'fillMaxWidth',
    'paddingAll', 'semantics', 'testID', 'weight'].map(name => [name, modifier(name)]));
  modifiers.shapes = { rectangle: () => 'rectangle', roundedRectangle: () => 'rounded' };
  modifiers.Shapes = { RoundedCorner: () => 'rounded' };
  const filename = path.resolve(__dirname, `../src/qolip/QolipCellDetail.${platform}.tsx`), loaded = new Module(filename, module);
  const mocks = { '@expo/ui/swift-ui': ui, '@expo/ui/jetpack-compose': ui, '@expo/ui/swift-ui/modifiers': modifiers,
    '@expo/ui/jetpack-compose/modifiers': modifiers, 'expo-symbols': { SymbolView: component('SymbolView') },
    'react-native': { PlatformColor: name => name, ScrollView: component('ScrollView'), View: component('View'), useWindowDimensions: () => ({ height: 1000 }) },
    '../shared/localization': { localizedMethod: (key, locale, values) => `${key}:${locale}:${values.count}` },
    './qolipCellDetailState': { qolipCellDetailRowLabel: (item, quantity) => ({ title: item.item_name || item.qolip_code, subtitle: `${item.qolip_code} • ${item.size} • ${quantity}` }) },
    './useQolipCellDetail': { useQolipCellDetail: props => { calls.push(['hook', props]); return state; } },
    './useQolipText': { useQolipText: () => ({ locale: 'uz', text: (key, values) => values ? `${key}:${JSON.stringify(values)}` : key }) } };
  loaded.require = id => id in mocks ? mocks[id] : require(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ESNext,
  } }).outputText, filename);
  const View = loaded.exports.QolipCellDetail, props = { cellLabel: 'A1', items: [first, second], unplaced: [first, second], movableIn: [second], boundary: {}, choose() {} };
  const render = () => { records.length = 0; return renderToStaticMarkup(React.createElement(View, props)); };
  const buttons = () => records.filter(row => ['Button', 'FilledIconButton', 'FilledTonalButton'].includes(row.name));
  return { render, records, calls, state, props, first, second, buttons };
}

for (const platform of ['ios', 'android']) {
  test(`${platform} cell detail presents source order, labels and exact choice callbacks without dispatch`, () => {
    const h = harness(platform), markup = h.render(); assert.deepEqual(h.calls[0][1], h.props);
    assert.match(markup, /home\.cell/); assert.match(markup, /Needle/); assert.match(markup, /Other/);
    assert.match(markup, /Q • 3 • qolipCount:uz:2/); assert.match(markup, /Other • 4 • qolipCount:uz:1/);
    assert.equal(h.records.find(row => row.name === 'View').props.style.maxHeight, 820);
    const rows = h.records.filter(row => (row.name === 'HStack' || row.name === 'Row') && row.props.modifiers?.some(value => value.name === (platform === 'ios' ? 'onLongPressGesture' : 'combinedClickable')));
    assert.equal(rows.length, 2);
    if (platform === 'ios') {
      rows[0].props.modifiers.find(value => value.name === 'onTapGesture').args[0]();
      rows[0].props.modifiers.find(value => value.name === 'onLongPressGesture').args[0]();
    } else {
      const gestures = rows[0].props.modifiers.find(value => value.name === 'combinedClickable').args[0]; gestures.onClick(); gestures.onLongClick();
    }
    const buttons = h.buttons(), action = platform === 'ios' ? 'onPress' : 'onClick';
    for (const button of buttons) button.props[action]();
    assert.deepEqual(h.calls.slice(1), [['tap', h.first], ['toggle', h.first], ['move', h.first], ['take', h.first],
      ['move', h.second], ['take', h.second], ['unplaced'], ['moveIn'], ['add']]);
  });

  test(`${platform} cell detail selection hides selected actions, disables alternatives and exposes bulk move`, () => {
    const h = harness(platform); h.state.selectionMode = true; h.state.header = { kind: 'selection', count: 1 }; h.state.footerEnabled = false;
    h.state.rows[0] = { ...h.state.rows[0], selected: true, showActions: false, actionsEnabled: false };
    h.state.rows[1] = { ...h.state.rows[1], actionsEnabled: false }; const markup = h.render();
    assert.match(markup, /qolipCount:uz:1/); const buttons = h.buttons(); assert.equal(buttons.length, 6);
    const action = platform === 'ios' ? 'onPress' : 'onClick'; buttons[0].props[action](); assert.deepEqual(h.calls.slice(1), [['bulk']]);
    for (const button of buttons.slice(1)) {
      if (platform === 'ios') assert.ok(button.props.modifiers.some(value => value.name === 'disabled' && value.args[0] === true));
      else assert.equal(button.props.enabled, false);
    }
    h.state.invalid = true; assert.equal(h.render(), ''); assert.equal(h.records.length, 0);
  });

  test(`${platform} empty lists add no invented message or alternative control`, () => {
    const h = harness(platform); h.state.rows = []; h.state.unplacedCount = 0; h.state.movableInCount = 0;
    const markup = h.render(); assert.match(markup, /home\.cell/); assert.match(markup, /home\.add_here/);
    assert.doesNotMatch(markup, /home\.unplaced_molds|home\.move_from_other|noRecords|empty/);
    assert.equal(h.buttons().length, 1);
  });
}
