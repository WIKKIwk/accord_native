const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const jsx = { Fragment: 'Fragment', jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
function nodes(node, predicate) {
  if (!node || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap(child => nodes(child, predicate));
  return [...(predicate(node) ? [node] : []), ...nodes(node.props?.children, predicate)];
}
function load(file, mocks = {}) {
  const filename = path.resolve(__dirname, '../src', file), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths;
  mod.require = id => id === 'react/jsx-runtime' ? jsx : Object.hasOwn(mocks, id) ? mocks[id] : id.startsWith('.') ? {} : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { fileName: filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText, filename);
  return mod.exports;
}
const l10n = load('shared/localization/index.ts', { './catalog.json': require('../src/shared/localization/catalog.json') });
const dart = load('admin/dartJsonString.ts');
const text = load('admin/factoryLocationRenameText.ts', { '../shared/localization': l10n });
const editorGolden = require('./contracts/f11910bb/admin_factory_editor_l10n_probe.json');
const location = { id: 'state:example', name: 'Original', active: true, apparatus: [] };
const ticket = location => ({ owner: Symbol('owner'), epoch: 1, location });
// The editor probe passed independently at f119 before the later SQLite hash failure.
// Rename title itself is source-inspected, not separately executed in that oracle.
test('rename title follows source and common labels match the prior f119 editor oracle', () => {
  assert.equal(text.factoryLocationRenameText('uz').title, 'State nomini o‘zgartirish');
  assert.equal(text.factoryLocationRenameText('en').title, 'Rename factory state');
  assert.equal(text.factoryLocationRenameText('ru').title, 'Переименовать производственную зону');
  for (const [locale, golden] of Object.entries(editorGolden.locales)) {
    const actual = text.factoryLocationRenameText(locale);
    assert.equal(actual.title, l10n.adminText('factory.state_name_edit', locale));
    assert.equal(actual.name, golden.text['factory.state_name']);
    assert.equal(actual.save, golden.text['action.save']); assert.equal(actual.cancel, golden.text['action.cancel']);
  }
});
function harness(initialTicket) {
  const slots = [], events = []; let cursor = 0, cleanup;
  const react = { useState(initial) { const index = cursor++; if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial;
    return [slots[index], value => { slots[index] = typeof value === 'function' ? value(slots[index]) : value; }]; },
    useRef(initial) { const index = cursor++; if (!(index in slots)) slots[index] = { current: initial }; return slots[index]; },
    useLayoutEffect(effect, deps) { const index = cursor++, old = slots[index];
      if (!old || deps.some((value, i) => value !== old.deps[i])) { old?.cleanup?.(); cleanup = effect(); slots[index] = { deps, cleanup }; } } };
  const hook = load('admin/useFactoryLocationRename.ts', { react, './dartJsonString': dart, './factoryLocationRenameText': text });
  const props = { ticket: initialTicket, onSubmit: (...args) => events.push(['submit', ...args]), onCancel: () => events.push('cancel') };
  return { props, events, render: () => { cursor = 0; return hook.useFactoryLocationRename(props, 'en'); }, unmount: () => cleanup() };
}
test('empty Dart-trimmed names keep the dialog open, valid names close once with the original ticket', () => {
  const original = ticket(location), h = harness(original); let view = h.render(); view.setName('\u0085  \u0085'); view = h.render();
  view.submit(); assert.deepEqual(h.events, []); view.setName('\u0085 Renamed \u0085'); view = h.render(); view.submit(); view.submit(); view.cancel();
  assert.deepEqual(h.events, [['submit', original, 'Renamed']]);
});
test('unchanged names still return from the dialog for the controller to skip the update', () => {
  const original = ticket(location), h = harness(original); h.render().submit(); assert.deepEqual(h.events, [['submit', original, 'Original']]);
});
test('cancel is delivered once, and missing location cannot rename', () => {
  const h = harness(ticket(location)); const view = h.render(); view.cancel(); view.cancel(); view.submit(); assert.deepEqual(h.events, ['cancel']);
  const missing = harness(ticket(null)); const invalid = missing.render(); assert.equal(invalid.stale, true); invalid.submit(); invalid.cancel(); assert.deepEqual(missing.events, []);
});
test('old callbacks cannot submit after the ticket switches or the dialog unmounts', () => {
  const h = harness(ticket(location)), old = h.render(); h.props.ticket = ticket({ ...location, id: 'second', name: 'Other' });
  assert.equal(h.render().stale, true); old.setName('ignored'); old.submit(); old.cancel(); assert.deepEqual(h.events, []);
  const k = harness(ticket(location)), captured = k.render(); k.unmount(); captured.setName('ignored'); captured.submit(); captured.cancel(); assert.deepEqual(k.events, []);
});
test('a synchronous host exception unlocks submit so it may be retried', () => {
  const h = harness(ticket(location)); let count = 0; h.props.onSubmit = () => { if (++count === 1) throw new Error('host failed'); };
  const view = h.render(); assert.throws(() => view.submit(), /host failed/); view.submit(); assert.equal(count, 2);
});
test('content reuses native field and buttons with focus, labels and cancel-before-save order', () => {
  const calls = [], current = ticket(location), value = text.factoryLocationRenameText('en');
  const state = { text: value, stale: false, setName: name => calls.push(['name', name]), submit: () => calls.push('save'), cancel: () => calls.push('cancel') };
  const mocks = { react: { useSyncExternalStore: (_subscribe, get) => get() },
    '@expo/ui': { Host: 'Host', TextInput: 'TextInput', useNativeState: value => ({ value }) },
    'react-native': { View: 'View', Text: 'Text', StyleSheet: { create: value => value } },
    '../components/useWorkerColors': { useWorkerColors: () => ({ muted: 'muted' }) },
    '../components/WorkerSheetButton': { WorkerSheetButton: 'WorkerSheetButton' },
    '../shared/localization/runtime': { localeController: { locale: 'en', addListener() {} } },
    './useFactoryLocationRename': { useFactoryLocationRename: () => state } };
  const Content = load('admin/FactoryLocationRenameContent.tsx', mocks).FactoryLocationRenameContent;
  const props = { ticket: current, onSubmit() {}, onCancel() {} }, tree = Content(props), input = nodes(tree, n => n.type === 'TextInput')[0];
  assert.equal(input.props.value.value, 'Original'); assert.equal(input.props.autoFocus, true); assert.equal(input.props.accessibilityLabel, value.name);
  input.props.onChangeText('New'); const buttons = nodes(tree, n => n.type === 'WorkerSheetButton');
  assert.deepEqual(buttons.map(n => n.props.label), ['Cancel', 'Save']); buttons[0].props.onPress(); buttons[1].props.onPress();
  assert.deepEqual(calls, [['name', 'New'], 'cancel', 'save']); state.stale = true; assert.equal(Content(props), null);
});
