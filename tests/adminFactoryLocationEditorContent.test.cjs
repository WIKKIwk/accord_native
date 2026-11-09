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
const golden = require('./contracts/f11910bb/admin_factory_editor_l10n_probe.json');
const l10n = load('shared/localization/index.ts', { './catalog.json': require('../src/shared/localization/catalog.json') });
const dart = load('admin/dartJsonString.ts');
const model = load('admin/factoryLocationEditorModel.ts', { './dartJsonString': dart });
const text = load('admin/factoryLocationEditorText.ts', { '../shared/localization': l10n });
const a = { id: 'apparatus:default:a', name: 'Print 7', sort_order: 7 }, b = { id: 'apparatus:default:b', name: 'Print 2', sort_order: 2 };
const location = { id: 'state:example', name: 'Original', active: true, apparatus: [a, { id: 'hidden', name: 'Hidden' }] };
const ticket = location => ({ owner: Symbol('owner'), epoch: 1, location });
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
// Locally authored source-derived f119 oracle; Material tooltips use installed Flutter 3.47.8.
test('editor labels, ID interpolation and Material delete tooltips match the f119 oracle', () => {
  assert.equal(golden.baseline, fs.readFileSync(path.resolve(__dirname, '../docs/port/V2_BASELINE'), 'utf8').trim());
  for (const [locale, value] of Object.entries(golden.locales)) {
    for (const [key, expected] of Object.entries(value.text)) assert.equal(l10n.adminText(key, locale), expected, `${locale} ${key}`);
    assert.equal(text.factoryLocationEditorText(locale, location).note, value.idNote);
    assert.equal(text.factoryLocationEditorText(locale, location).deleteTooltip, value.deleteTooltip);
    assert.equal(text.factoryLocationEditorText(locale, null).title, value.text['factory.state_create']);
    assert.equal(text.factoryLocationEditorText(locale, location).title, value.text['factory.state_edit']);
  }
  assert.equal(text.factoryLocationEditorText('constructor', null).deleteTooltip, 'Delete');
});
function harness(initialTicket, openPicker = async () => null) {
  const slots = [], events = []; let cursor = 0, cleanup, stateUpdates = 0;
  const react = { useState(initial) { const index = cursor++; if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial;
    return [slots[index], value => { stateUpdates++; slots[index] = typeof value === 'function' ? value(slots[index]) : value; }]; },
    useRef(initial) { const index = cursor++; if (!(index in slots)) slots[index] = { current: initial }; return slots[index]; },
    useLayoutEffect(effect, deps) { const index = cursor++, old = slots[index];
      if (!old || deps.some((value, i) => value !== old.deps[i])) { old?.cleanup?.(); cleanup = effect(); slots[index] = { deps, cleanup }; } } };
  const hook = load('admin/useFactoryLocationEditor.ts', { react, './dartJsonString': dart,
    './factoryLocationEditorModel': model, './factoryLocationEditorText': text });
  const props = { ticket: initialTicket, apparatus: [b, a], openPicker, onSubmit: (...args) => events.push(['submit', ...args]),
    onCancel: () => events.push('cancel'), showInvalidName: message => events.push(['invalid', message]) };
  return { props, events, render: () => { cursor = 0; return hook.useFactoryLocationEditor(props, 'en'); },
    unmount: () => cleanup(), stateUpdates: () => stateUpdates };
}
test('create validates without closing, trims Dart whitespace and submits only once with the original ticket', () => {
  const original = ticket(null), h = harness(original); let view = h.render(); view.submit();
  assert.deepEqual(h.events, [['invalid', 'Enter a factory state name']]); view.setName('\u0085 New \u0085'); view = h.render();
  view.submit(); view.submit(); assert.equal(h.events.length, 2);
  assert.equal(h.events[1][0], 'submit'); assert.equal(h.events[1][1], original); assert.equal(h.events[1][2], 'New');
  assert.deepEqual([...h.events[1][3]], []);
});
test('edit keeps the name read-only, removes only chosen known IDs and retains hidden IDs', () => {
  const original = ticket(location), h = harness(original); let view = h.render();
  assert.equal(view.text.note, 'Linking equipment does not change the ID or name: state:example');
  assert.deepEqual(view.visibleSelected.map(item => item.id), [a.id]); view.setName('Different'); view.remove(a.id); view = h.render();
  assert.equal(view.name, 'Original'); assert.deepEqual([...view.selected], ['hidden']); view.submit();
  assert.equal(h.events[0][1], original); assert.equal(h.events[0][2], 'Original'); assert.deepEqual([...h.events[0][3]], ['hidden']);
});
test('picker cancellation preserves draft, confirmation replaces it and no input alias is kept', async () => {
  const first = deferred(), second = deferred(); let opened = 0, args = [];
  const h = harness(ticket(location), selected => { args.push(selected); return opened++ === 0 ? first.promise : second.promise; });
  let view = h.render(); const pending = view.openPicker(); view = h.render(); assert.equal(view.pickerOpen, true);
  view.setName('ignored'); view.submit(); assert.deepEqual(h.events, []); first.resolve(null); await pending; view = h.render();
  assert.deepEqual([...view.selected], [a.id, 'hidden']); assert.equal(view.pickerOpen, false);
  const next = view.openPicker(); const selection = new Set([b.id, 'hidden']); second.resolve(selection); await next; selection.clear(); view = h.render();
  assert.deepEqual([...view.selected], [b.id, 'hidden']); assert.notEqual(args[0], view.selected);
});
test('a picker result after unmount cannot update the old editor', async () => {
  const pending = deferred(), h = harness(ticket(null), () => pending.promise); let view = h.render(); const job = view.openPicker();
  const before = h.stateUpdates(); h.unmount(); pending.resolve(new Set([a.id])); await job; assert.equal(h.stateUpdates(), before);
});
test('a failed picker releases the busy gate and cancel is delivered once', async () => {
  let count = 0; const h = harness(ticket(null), async () => { count++; throw new Error('picker failed'); }); let view = h.render();
  await assert.rejects(view.openPicker(), /picker failed/); view = h.render(); assert.equal(view.pickerOpen, false);
  await assert.rejects(view.openPicker(), /picker failed/); assert.equal(count, 2); view = h.render(); view.cancel(); view.cancel();
  assert.deepEqual(h.events, ['cancel']);
});
function renderContent(editing, busy = false) {
  const calls = [], current = ticket(editing ? location : null), label = text.factoryLocationEditorText('en', current.location);
  const editor = { text: label, stale: false, pickerOpen: busy, visibleSelected: editing ? [a] : [], setName: value => calls.push(['name', value]),
    openPicker: async () => { calls.push('picker'); }, remove: id => calls.push(['remove', id]), submit: () => calls.push('submit'), cancel: () => calls.push('cancel') };
  const mocks = { react: { useSyncExternalStore: (_subscribe, get) => get() },
    '@expo/ui': { Host: 'Host', TextInput: 'TextInput', useNativeState: value => ({ value }) }, 'expo-symbols': { SymbolView: 'SymbolView' },
    'react-native': { View: 'View', Text: 'Text', Pressable: 'Pressable', StyleSheet: { create: value => value } },
    '../components/useWorkerColors': { useWorkerColors: () => ({ muted: 'muted', field: 'field', text: 'text' }) },
    '../components/WorkerSheetButton': { WorkerSheetButton: 'WorkerSheetButton' },
    '../shared/localization/runtime': { localeController: { locale: 'en', addListener() {} } },
    './useFactoryLocationEditor': { useFactoryLocationEditor: () => editor } };
  const Content = load('admin/FactoryLocationEditorContent.tsx', mocks).FactoryLocationEditorContent;
  return { tree: Content({ ticket: current, apparatus: [b, a], openPicker: async () => null, onSubmit() {}, onCancel() {}, showInvalidName() {} }), calls, label };
}
test('content reuses native field and sheet buttons, with correct create/edit controls and callbacks', () => {
  const create = renderContent(false), input = nodes(create.tree, n => n.type === 'TextInput')[0];
  assert.equal(input.props.editable, true); assert.equal(input.props.autoFocus, true); input.props.onChangeText('abc');
  assert.ok(nodes(create.tree, n => n.type === 'Text' && n.props.children === create.label.empty).length);
  const buttons = nodes(create.tree, n => n.type === 'WorkerSheetButton'); assert.deepEqual(buttons.map(n => n.props.label), ['Attach equipment', 'Save', 'Cancel']);
  buttons[0].props.onPress(); buttons[1].props.onPress(); buttons[2].props.onPress();
  assert.deepEqual(create.calls, [['name', 'abc'], 'picker', 'submit', 'cancel']);
  const edit = renderContent(true), editInput = nodes(edit.tree, n => n.type === 'TextInput')[0];
  assert.equal(editInput.props.editable, false); assert.equal(editInput.props.autoFocus, false);
  assert.ok(nodes(edit.tree, n => n.type === 'Text' && n.props.children === edit.label.note).length);
  const remove = nodes(edit.tree, n => n.type === 'Pressable')[0]; assert.equal(remove.props.accessibilityLabel, 'Delete'); remove.props.onPress();
  assert.deepEqual(edit.calls, [['remove', a.id]]);
});
test('content disables editing and all actions while picker is open', () => {
  const { tree } = renderContent(false, true); assert.equal(nodes(tree, n => n.type === 'TextInput')[0].props.editable, false);
  assert.ok(nodes(tree, n => n.type === 'WorkerSheetButton').every(button => button.props.disabled));
});

test('a changed editor ticket hides stale data and invalidates an outstanding picker result', async () => {
  const pending = deferred(), h = harness(ticket(location), () => pending.promise); let view = h.render();
  const job = view.openPicker(); h.props.ticket = ticket({ ...location, id: 'other', name: 'Other' }); view = h.render();
  assert.equal(view.stale, true); const before = h.stateUpdates(); pending.resolve(new Set([b.id])); await job;
  assert.equal(h.stateUpdates(), before); view.submit(); view.cancel(); assert.deepEqual(h.events, []);
});

test('an undefined picker result is treated as cancellation rather than clearing equipment', async () => {
  const h = harness(ticket(location), async () => undefined); let view = h.render(); await view.openPicker(); view = h.render();
  assert.deepEqual([...view.selected], [a.id, 'hidden']);
});
test('a synchronous submit exception does not permanently lock the editor', () => {
  const h = harness(ticket(null)); let count = 0; h.props.onSubmit = () => { if (++count === 1) throw new Error('host failed'); };
  let view = h.render(); view.setName('New'); view = h.render(); assert.throws(() => view.submit(), /host failed/); view.submit(); assert.equal(count, 2);
});

test('callbacks captured by a prior ticket cannot submit after the host switches tickets', () => {
  const h = harness(ticket(null)), old = h.render(); old.setName('Old'); const prior = h.render();
  h.props.ticket = ticket({ ...location, id: 'new-account' }); h.render(); prior.submit(); prior.cancel(); prior.setName('changed');
  assert.deepEqual(h.events, []);
});
