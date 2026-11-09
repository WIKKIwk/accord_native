const assert = require('node:assert/strict'), fs = require('node:fs'), Module = require('node:module'), path = require('node:path');
const test = require('node:test'), ts = require('typescript'), React = require('react'), { renderToStaticMarkup } = require('react-dom/server');
const catalog = require('../src/shared/localization/catalog.json');
function load(file, mocks = {}) {
  const filename = path.resolve(__dirname, '../src/qolip', file), m = new Module(filename, module); m.require = id => id in mocks ? mocks[id] : require(id);
  m._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ESNext, jsx: ts.JsxEmit.ReactJSX } }).outputText, filename); return m.exports;
}
const text = key => catalog.production[`qolip.${key}`].uz;
function setup(platform, patch = {}) {
  const captured = {}, calls = [], native = []; let slot = 0, active = true;
  const node = name => props => { (captured[name] ??= []).push(props); return React.createElement('div', null, props.label, props.children); };
  const names = ['Button', 'CircularProgressIndicator', 'Column', 'DropdownMenuItem', 'ExposedDropdownMenu', 'ExposedDropdownMenuBox', 'Host', 'OutlinedTextField', 'Picker', 'ProgressView', 'Text', 'TextField', 'VStack', 'KeyboardAvoidingView', 'ScrollView'];
  const nodes = Object.fromEntries(names.map(name => [name, node(name)])); nodes.OutlinedTextField.Label = node('FieldLabel'); nodes.DropdownMenuItem.Text = node('ItemText');
  const useNativeState = initial => { const index = slot++; return native[index] ??= { value: initial, get() { return this.value; }, set(value) { this.value = value; } }; };
  const modifiers = Object.fromEntries(['buttonStyle', 'disabled', 'frame', 'pickerStyle', 'submitLabel', 'tag', 'textInputAutocapitalization', 'fillMaxWidth', 'menuAnchor', 'size', 'testID'].map(name => [name, (...args) => ({ name, args })]));
  const state = { invalid: false, name: '', warehouse: 'W', saving: false, canSave: false, showWarehouseField: true, warehouses: ['W', 'B'],
    controller: { canAct: () => active, setName: value => calls.push(['name', value]), setWarehouse: value => calls.push(['warehouse', value]) },
    save: () => calls.push(['save']), ...patch };
  const view = load(`QolipBlockCreateSheet.${platform}.tsx`, { '@expo/ui/swift-ui': { ...nodes, useNativeState }, '@expo/ui/jetpack-compose': { ...nodes, useNativeState },
    '@expo/ui/swift-ui/modifiers': modifiers, '@expo/ui/jetpack-compose/modifiers': modifiers, 'react-native': nodes,
    react: { ...React, useState: () => [false, value => calls.push(['expanded', value])] }, './useQolipText': { useQolipText: () => ({ text }) },
    './useQolipBlockCreate': { useQolipBlockCreate: props => { captured.input = props; return state; } } }).QolipBlockCreateSheet;
  const props = { session: {}, boundary: {}, warehouses: ['W', 'B'], saved: value => calls.push(['saved', value]) };
  const render = () => { slot = 0; for (const key in captured) delete captured[key]; return renderToStaticMarkup(React.createElement(view, props)); };
  return { state, captured, calls, props, native, render, invalidate: () => { active = false; } };
}
for (const platform of ['ios', 'android']) {
  test(`${platform} block-create content keeps exact source title, warehouse/name/save order and adds no cancel or error message`, () => {
    const h = setup(platform), html = h.render();
    const order = ['home.block_add_title', 'blocks.warehouse', 'blocks.name', 'action.save'].map(key => html.indexOf(text(key)));
    assert.ok(order.every(value => value >= 0)); assert.deepEqual(order, [...order].sort((a, b) => a - b)); assert.equal(html.includes(text('action.cancel')), false);
    assert.deepEqual(h.calls, []); assert.deepEqual(h.captured.input, h.props);
    assert.ok(h.captured.KeyboardAvoidingView); assert.ok(h.captured.ScrollView); assert.equal(h.captured.ScrollView[0].contentContainerStyle.paddingBottom, 20);
    const button = h.captured.Button[0]; if (platform === 'android') assert.equal(button.enabled, false);
    else assert.equal(button.modifiers.find(mod => mod.name === 'disabled').args[0], true);
  });
  test(`${platform} saving disables only the button, keeps warehouse/name editable and shows native progress`, () => {
    const h = setup(platform, { saving: true, canSave: true }); const html = h.render(); assert.equal(html.includes(text('action.save')), false);
    assert.ok(h.captured[platform === 'ios' ? 'ProgressView' : 'CircularProgressIndicator']);
    const field = h.captured[platform === 'ios' ? 'TextField' : 'OutlinedTextField'].at(-1); assert.notEqual(field.enabled, false); assert.notEqual(field.disabled, true);
    const picker = h.captured[platform === 'ios' ? 'Picker' : 'ExposedDropdownMenuBox'][0]; assert.notEqual(picker.enabled, false); assert.notEqual(picker.disabled, true);
    if (platform === 'ios') picker.onSelectionChange('B'); else h.captured.DropdownMenuItem[1].onClick();
    assert.ok(h.calls.some(call => call[0] === 'warehouse' && call[1] === 'B'));
  });
  test(`${platform} Done is a keyboard hint only; capitalization is not a string transform and Save reads the current native text`, () => {
    const h = setup(platform, { canSave: true }); h.render();
    const field = h.captured[platform === 'ios' ? 'TextField' : 'OutlinedTextField'].at(-1);
    if (platform === 'ios') {
      assert.ok(field.modifiers.some(mod => mod.name === 'textInputAutocapitalization' && mod.args[0] === 'characters'));
      assert.ok(field.modifiers.some(mod => mod.name === 'submitLabel' && mod.args[0] === 'done'));
      assert.equal(field.onSubmit, undefined); field.onTextChange('mixed');
    } else { assert.deepEqual(field.keyboardOptions, { capitalization: 'characters', imeAction: 'done' }); assert.equal(field.keyboardActions, undefined); field.onValueChange('mixed'); }
    assert.deepEqual(h.calls, [['name', 'mixed']]); h.native[0].set('native last edit'); const button = h.captured.Button[0]; (button.onPress ?? button.onClick)();
    assert.deepEqual(h.calls.slice(-2), [['name', 'native last edit'], ['save']]);
  });
  test(`${platform} hidden warehouse mode removes only the field; invalidated form removes the entire old content`, () => {
    const h = setup(platform, { showWarehouseField: false }); h.render(); assert.equal(h.captured.Picker, undefined); assert.equal(h.captured.ExposedDropdownMenuBox, undefined);
    h.state.invalid = true; assert.equal(h.render(), ''); assert.equal(h.captured.Host, undefined);
  });
}

test('block-create hook consumes the real injected session/boundary, activates after commit and returns only current success', async () => {
  const effects = [], calls = [], saved = []; let current = true, result = { name: 'A', warehouse: 'W' };
  const controller = { subscribe: () => () => {}, getSnapshot: () => ({ saving: false, invalid: false }), canSave: true, showWarehouseField: true, warehouses: ['W'],
    activate: () => calls.push('activate'), suspend: () => calls.push('suspend'), canAct: () => current, save: async () => result };
  const hook = load('useQolipBlockCreate.ts', { react: { useMemo: fn => fn(), useLayoutEffect: fn => effects.push(fn), useSyncExternalStore: (_s, get) => get() },
    './qolipBlockCreateState': { QolipBlockCreateState: { forSession: (session, boundary, options) => { calls.push([session, boundary, options]); return controller; } } } }).useQolipBlockCreate;
  const props = { session: {}, boundary: {}, warehouses: ['W'], saved: value => saved.push(value) }, view = hook(props); assert.deepEqual(calls, [[props.session, props.boundary, props]]);
  const cleanup = effects[0](); view.save(); await new Promise(resolve => setImmediate(resolve)); assert.deepEqual(saved, [result]);
  current = false; view.save(); await new Promise(resolve => setImmediate(resolve)); assert.equal(saved.length, 1);
  current = true; result = null; view.save(); await new Promise(resolve => setImmediate(resolve)); assert.equal(saved.length, 1); cleanup(); assert.deepEqual(calls.slice(-2), ['activate', 'suspend']);
});
