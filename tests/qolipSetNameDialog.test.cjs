const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
function screen(platform, saving = false) {
  const captures = {}, calls = [], expected = { name: 'Saved', set: { id: 'S' } };
  const state = { saving, error: null, controller: { getSnapshot: () => state, setName: value => calls.push(['name', value]),
    save: async () => { calls.push(['save']); return expected; } } };
  const component = name => function Stub(props) { (captures[name] ??= []).push(props);
    return React.createElement('div', null, props.children ?? props.label ?? null); };
  const names = ['Button', 'Host', 'ProgressView', 'Text', 'TextField', 'VStack', 'Column', 'TextButton', 'OutlinedTextField',
    'CircularProgressIndicator', 'KeyboardAvoidingView', 'Modal', 'Pressable', 'View'];
  const nodes = Object.fromEntries(names.map(name => [name, component(name)]));
  const Dialog = component('AlertDialog'); for (const key of ['Title', 'Text', 'DismissButton', 'ConfirmButton']) Dialog[key] = component(`AlertDialog.${key}`);
  nodes.OutlinedTextField.Label = component('OutlinedTextField.Label');
  const ui = { ...nodes, AlertDialog: Dialog, useNativeState: value => ({ get: () => value }) };
  const mods = { disabled: value => ({ disabled: value }), onSubmit: callback => ({ callback }), submitLabel: () => ({}),
    textInputAutocapitalization: () => ({}), fillMaxWidth: () => ({}), size: () => ({}), testID: () => ({}) };
  const deps = { '@expo/ui/swift-ui': ui, '@expo/ui/jetpack-compose': ui,
    '@expo/ui/swift-ui/modifiers': mods, '@expo/ui/jetpack-compose/modifiers': mods,
    'react-native': { ...nodes, StyleSheet: { create: value => value, absoluteFill: {} }, PlatformColor: () => 'white',
      useWindowDimensions: () => ({ width: 400, height: 800 }) },
    '../components/useWorkerColors': { useWorkerColors: () => ({ surface: 'white' }) },
    '../shared/localization': { extensionText: (_method, key) => key }, './qolipErrorMessage': { qolipErrorMessage: () => 'ERROR' },
    './useQolipSetName': { useQolipSetName: () => state }, './useQolipText': { useQolipText: () => ({ locale: 'uz', text: key => key }) } };
  const filename = path.resolve(__dirname, `../src/qolip/QolipSetNameDialog.${platform}.tsx`), m = new Module(filename, module);
  m.require = key => key in deps ? deps[key] : require(key);
  m._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS,
    jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ESNext } }).outputText, filename);
  const entry = { name: 'Old', set: { id: 'S' } };
  const render = () => renderToStaticMarkup(React.createElement(m.exports.QolipSetNameDialog, { session: {}, entry,
    close: () => calls.push(['close']), saved: result => calls.push(['saved', result]) }));
  return { captures, calls, state, expected, render };
}
for (const platform of ['ios', 'android']) {
  test(`${platform} dialog prefills the entry and returns only a successful server result`, async () => {
    const h = screen(platform); h.render();
    const field = h.captures[platform === 'ios' ? 'TextField' : 'OutlinedTextField'][0];
    assert.equal((field.text ?? field.value).get(), 'Old');
    if (platform === 'ios') assert.equal(field.maxLength, 160);
    const save = platform === 'ios' ? h.captures.Button.find(x => x.label === 'action.save').onPress
      : h.captures.TextButton.find(x => x.children?.props?.children === 'action.save').onClick;
    save(); await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(h.calls, [['name', 'Old'], ['save'], ['saved', h.expected]]);
  });
  test(`${platform} dialog blocks dismissal and input during save`, () => {
    const h = screen(platform, true); h.render();
    (platform === 'ios' ? h.captures.Modal[0].onRequestClose : h.captures.AlertDialog[0].onDismissRequest)();
    assert.deepEqual(h.calls, []);
    if (platform === 'ios') assert.ok(h.captures.ProgressView);
    else { assert.equal(h.captures.OutlinedTextField[0].enabled, false); assert.ok(h.captures.CircularProgressIndicator); }
  });
}
