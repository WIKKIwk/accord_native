const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
function screen(platform, inspection = false, supplied = {}) {
  const captured = {}, calls = [], translations = [];
  const stub = name => function Component(props) { (captured[name] ??= []).push(props); return React.createElement('div', null, name === 'Menu' ? props.label : null, props.children ?? props.label ?? null); };
  const nodes = Object.fromEntries(['Button', 'OutlinedButton', 'TextButton', 'IconButton', 'Host', 'HStack', 'VStack', 'Image', 'Menu', 'Text', 'Modal',
    'Pressable', 'View', 'ScrollView', 'Column', 'RNHostView', 'ExposedDropdownMenuBox', 'ExposedDropdownMenu', 'SymbolView'].map(name => [name, stub(name)]));
  for (const [parent, slots] of Object.entries({ AlertDialog: ['Title', 'Text', 'ConfirmButton', 'DismissButton'],
    OutlinedTextField: ['Label'], DropdownMenuItem: ['Text'], InputChip: ['Label', 'TrailingIcon'] })) {
    nodes[parent] = stub(parent); for (const slot of slots) nodes[parent][slot] = stub(`${parent}.${slot}`);
  }
  const modifiers = Object.fromEntries(['buttonStyle', 'disabled', 'frame', 'testID', 'accessibilityIdentifier', 'accessibilityLabel', 'labelStyle',
    'fillMaxWidth', 'menuAnchor', 'semantics', 'verticalScroll'].map(name => [name, (...args) => ({ name, args })]));
  const state = { invalid: false, warehouse: null, canSubmit: false, warehouses: ['W', 'X'], scanning: false,
    found: ['A'], missing: ['B'], unexpected: ['Z'], codes: [{ key: 'a', value: 'A' }], ...supplied };
  for (const action of ['dismiss', 'submit', 'choose', 'cancel', 'save', 'scan', 'remove']) state[action] = (...args) => calls.push([action, ...args]);
  const filename = path.resolve(__dirname, `../src/qolip/${inspection ? 'QolipInspectionDialog' : 'QolipPaddonCreateDialog'}.${platform}.tsx`);
  const mod = new Module(filename, module), nativeState = { get: () => state.warehouse ?? '', set() {} };
  const deps = { '@expo/ui/swift-ui': nodes, '@expo/ui/jetpack-compose': { ...nodes, useNativeState: () => nativeState },
    '@expo/ui/swift-ui/modifiers': modifiers, '@expo/ui/jetpack-compose/modifiers': modifiers, 'expo-symbols': { SymbolView: nodes.SymbolView },
    'react-native': { ...nodes, StyleSheet: { create: value => value, absoluteFill: {} }, useWindowDimensions: () => ({ width: 390, height: 800 }) },
    '../components/useWorkerColors': { useWorkerColors: () => ({ surface: 'white' }) },
    '../shared/localization': { extensionText: (method, key) => { translations.push([method, key]); return `storage:${key}`; } },
    './useQolipStorageForms': { useQolipPaddonCreate: () => state, useQolipInspection: () => state }, './useQolipText': { useQolipText: () => ({ locale: 'uz' }) } };
  mod.require = key => key in deps ? deps[key] : require(key);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ESNext } }).outputText, filename);
  const html = renderToStaticMarkup(React.createElement(mod.exports[inspection ? 'QolipInspectionDialog' : 'QolipPaddonCreateDialog'], {}));
  return { captured, calls, translations, state, html };
}
for (const platform of ['ios', 'android']) {
  test(`${platform}: create dialog has only the warehouse field and create-before-cancel source action order`, () => {
    const h = screen(platform); assert.match(h.html, /storage:warehouse/);
    assert.ok(h.html.indexOf('storage:create') < h.html.lastIndexOf('storage:cancel'));
    const actions = Object.values(h.captured).flat().filter(p => p.onPress === h.state.submit || p.onClick === h.state.submit);
    assert.equal(actions.length, 1); const action = actions[0];
    if (platform === 'ios') assert.ok(action.modifiers.some(m => m.name === 'disabled' && m.args[0] === true)); else assert.equal(action.enabled, false);
    assert.ok(h.translations.every(([method]) => method === 'qolipStorageText'));
    assert.deepEqual(new Set(h.translations.map(([, key]) => key)), new Set(['create', 'warehouse', 'cancel']));
  });
  test(`${platform}: create returns only via its real hook and ordinary dialog dismissal`, () => {
    const h = screen(platform, false, { warehouse: 'W', canSubmit: true });
    const action = Object.values(h.captured).flat().find(p => p.onPress === h.state.submit || p.onClick === h.state.submit);
    (action.onPress ?? action.onClick)();
    if (platform === 'ios') { h.captured.Modal[0].onRequestClose(); h.captured.Button.find(p => p.label === 'X').onPress(); }
    else { h.captured.AlertDialog[0].onDismissRequest(); h.captured.DropdownMenuItem[1].onClick(); }
    assert.deepEqual(h.calls, [['submit'], ['dismiss'], ['choose', 'X']]);
  });
  test(`${platform}: inspection preserves source count and scanned-code ordering`, () => {
    const h = screen(platform, true);
    const positions = ['storage:inspect_hint', 'storage:scan', 'storage:found (1): A', 'storage:missing (1): B', 'storage:unexpected (1): Z'].map(text => h.html.indexOf(text));
    assert.ok(positions.every((p, i) => p >= 0 && (i === 0 || p > positions[i - 1])));
    const remove = platform === 'ios' ? h.captured.Button.find(p => p.systemImage === 'xmark.circle.fill').onPress : h.captured.IconButton[0].onClick;
    remove(); assert.deepEqual(h.calls, [['remove', 'a']]);
    if (platform === 'android') assert.equal(h.captured.InputChip[0].onClick, undefined, 'only the remove icon deletes a chip');
  });
  test(`${platform}: pending inspection disables scan/cancel/save but retains system/outside dismissal`, () => {
    const h = screen(platform, true, { scanning: true });
    const actions = Object.values(h.captured).flat().filter(p => [h.state.scan, h.state.cancel, h.state.save].includes(p.onPress ?? p.onClick));
    assert.equal(actions.length, 3);
    for (const action of actions) {
      if (platform === 'ios') assert.ok(action.modifiers.some(m => m.name === 'disabled' && m.args[0] === true)); else assert.equal(action.enabled, false);
    }
    if (platform === 'ios') { h.captured.Modal[0].onRequestClose(); h.captured.Pressable[0].onPress(); }
    else h.captured.AlertDialog[0].onDismissRequest();
    assert.ok(h.calls.every(([action]) => action === 'dismiss'));
  });
  test(`${platform}: expired storage dialogs render no old-account controls`, () => {
    assert.equal(screen(platform, false, { invalid: true }).html, ''); assert.equal(screen(platform, true, { invalid: true }).html, '');
  });
}
