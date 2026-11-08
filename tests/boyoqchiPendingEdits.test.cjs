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
function compile(relative, mocks = {}, extra = '') {
  const filename = path.resolve(__dirname, `../src/${relative}`), loaded = new Module(filename, module);
  loaded.filename = filename; loaded.paths = module.paths;
  loaded.require = id => id === 'react/jsx-runtime' ? jsx : Object.hasOwn(mocks, id) ? mocks[id] : id.startsWith('.') ? {} : require(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText + extra, filename); return loaded.exports;
}
const tick = () => new Promise(resolve => setImmediate(resolve));
function fixture() {
  const hooks = [], busyChanges = [], resets = []; let cursor = 0, back, closes = 0, saves = 0, keyboard = 0, resolve, reject;
  const pending = new Promise((yes, no) => { resolve = yes; reject = no; });
  const react = { useState: initial => { const i = cursor++; if (!hooks[i]) hooks[i] = { value: initial };
      return [hooks[i].value, value => { hooks[i].value = typeof value === 'function' ? value(hooks[i].value) : value; }]; },
    useRef: initial => { const i = cursor++; return hooks[i] ?? (hooks[i] = { current: initial }); },
    useEffect: (effect, deps) => { const i = cursor++, prior = hooks[i];
      if (prior && deps?.length === prior.deps?.length && deps.every((value, j) => Object.is(value, prior.deps[j]))) return;
      prior?.cleanup?.(); hooks[i] = { deps, cleanup: effect() }; } };
  const { paintOptions } = compile('workerOrderLogic.ts', { './workerControlsApi': {} });
  const { ReturnedPaintDraft } = compile('boyoqchi/returnedPaintDraft.ts', { './returnedPaintModel': {} });
  const { BoyoqchiFormContent, __Field: Field, __NamedFieldDialog: NamedFieldDialog } = compile('boyoqchi/BoyoqchiFormContent.tsx', {
    react, '@expo/ui': { Host: 'Host', Button: 'Button', RNHostView: 'RNHostView', TextInput: 'TextInput',
      useNativeState: initial => ({ set: value => resets.push(value), value: initial }) },
    'react-native': { ActivityIndicator: 'ActivityIndicator', Keyboard: { dismiss: () => { keyboard++; } },
      BackHandler: { addEventListener: (_event, fn) => { back = fn; return { remove() {} }; } },
      Modal: 'Modal', Pressable: 'Pressable', ScrollView: 'ScrollView', Text: 'Text', View: 'View',
      StyleSheet: { create: value => value, absoluteFill: {} } },
    '../components/WorkerIconButton': { WorkerIconButton: 'WorkerIconButton' }, '../components/WorkerSheetButton': { WorkerSheetButton: 'WorkerSheetButton' },
    '../components/useWorkerColors': { useWorkerColors: () => ({}) }, '../workerOrderLogic': { paintOptions },
    './BoyoqchiPaintPalette': { BoyoqchiPaintPalette: 'BoyoqchiPaintPalette' }, './BoyoqchiImage': {},
    './boyoqchiLogic': { boyoqchiInputAllowed: () => true, boyoqchiSaveInput: () => ({ items: [{ name: 'paint' }], error: '' }) },
    './returnedPaintModel': { returnedPaintDouble: value => Number(value) }, './useBoyoqchiText': { useBoyoqchiText: () => value => value },
  }, '\nmodule.exports.__Field = Field; module.exports.__NamedFieldDialog = NamedFieldDialog;');
  const draft = new ReturnedPaintDraft(() => {});
  const render = () => { cursor = 0; return BoyoqchiFormContent({ session: {}, draft, close: () => { closes++; },
    onBusyChange: value => busyChanges.push(value), save: () => { saves++; return pending; } }); };
  return { render, Field, NamedFieldDialog, draft, resets, busyChanges, resolve, reject, keyboard: () => keyboard,
    closes: () => closes, saves: () => saves, back: () => back(), unmount: () => { for (const hook of hooks) hook?.cleanup?.(); } };
}
const button = (tree, label) => nodes(tree, n => n.type === 'WorkerSheetButton' && n.props.label === label)[0];

test('pending save blocks stale field, tab, add and back handlers until successful completion', async () => {
  const f = fixture(), initial = f.render(), palette = nodes(initial, n => n.type === 'BoyoqchiPaintPalette')[0];
  palette.props.onSelect('Oq'); let tree = f.render();
  const first = nodes(tree, n => n.type === f.Field)[0], input = nodes(f.Field(first.props), n => n.type === 'TextInput')[0];
  input.props.onChangeText('2'); assert.equal(f.draft.valuesFor('rasxot:Oq', 8)[0], '2');
  tree = f.render(); const add = button(tree, 'Pantone+'), backButton = nodes(tree, n => n.type === 'WorkerIconButton')[0];
  button(tree, 'Saqlash').props.onPress(); assert.equal(f.saves(), 1); assert.equal(f.keyboard(), 1); assert.equal(f.back(), true);
  input.props.onChangeText('99'); palette.props.onUsage('astatka'); palette.props.onSelect('Mix'); add.props.onPress(); backButton.props.onPress();
  assert.equal(f.draft.valuesFor('rasxot:Oq', 8)[0], '2'); assert.equal(f.resets.at(-1), '2');
  assert.equal(f.draft.selectedUsageIndex, 0); assert.equal(f.closes(), 0);
  const busy = f.render(); assert.equal(nodes(busy, n => n.type === f.NamedFieldDialog).length, 0);
  assert.equal(nodes(busy, n => n.type === f.Field)[0].props.disabled, true);
  assert.equal(button(busy, 'Pantone+').props.disabled, true);
  assert.ok(nodes(busy, n => n.type === 'View' && n.props.pointerEvents === 'none').length);
  f.resolve(); await tick(); assert.equal(f.closes(), 1); assert.equal(f.back(), false); assert.deepEqual(f.busyChanges, [true, false]);
});

test('after a failed save editing, tabs, add dialogs and navigation work again', async () => {
  const f = fixture(), palette = nodes(f.render(), n => n.type === 'BoyoqchiPaintPalette')[0];
  palette.props.onSelect('Oq'); let tree = f.render(); button(tree, 'Saqlash').props.onPress();
  f.reject(new Error('offline')); await tick(); tree = f.render(); assert.equal(f.back(), false);
  const field = nodes(tree, n => n.type === f.Field)[0]; assert.equal(field.props.disabled, false);
  nodes(f.Field(field.props), n => n.type === 'TextInput')[0].props.onChangeText('7');
  assert.equal(f.draft.valuesFor('rasxot:Oq', 8)[0], '7');
  button(f.render(), 'Pantone+').props.onPress(); assert.equal(nodes(f.render(), n => n.type === f.NamedFieldDialog).length, 1);
  const dialog = nodes(f.render(), n => n.type === f.NamedFieldDialog)[0]; dialog.props.close();
  nodes(f.render(), n => n.type === 'WorkerIconButton')[0].props.onPress();
  const restoredPalette = nodes(f.render(), n => n.type === 'BoyoqchiPaintPalette')[0]; restoredPalette.props.onUsage('astatka');
  assert.equal(f.draft.selectedUsageIndex, 1); assert.deepEqual(f.busyChanges, [true, false]);
});

test('an open named dialog blocks its fields, submit and dismiss handlers while locked', () => {
  const f = fixture(); let closed = 0, added = 0;
  const dialog = f.NamedFieldDialog({ paint: 'Mix', disabled: true, isLocked: () => true, close: () => { closed++; }, add: () => { added++; } });
  dialog.props.onRequestClose(); button(dialog, 'Bekor qilish').props.onPress(); button(dialog, 'Qo‘shish').props.onPress();
  assert.equal(closed, 0); assert.equal(added, 0);
  for (const field of nodes(dialog, n => n.type === f.Field)) {
    const input = nodes(f.Field(field.props), n => n.type === 'TextInput')[0]; assert.equal(input.props.editable, false);
    input.props.onChangeText('42');
  }
  assert.equal(f.resets.length, 2);
});

test('Android shared sheet disables drag and outside dismissal but its native Back option remains open', () => {
  const { WorkerOrderSheet } = compile('components/WorkerOrderSheet.android.tsx', {
    '@expo/ui/jetpack-compose': { Host: 'Host', ModalBottomSheet: 'ModalBottomSheet', RNHostView: 'RNHostView' },
    'react-native': { ScrollView: 'ScrollView', View: 'View', useWindowDimensions: () => ({ width: 300, height: 600 }) },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) },
    './useWorkerColors': { useWorkerColors: () => ({ field: 'field' }) },
    './workerSheetContext': { WorkerSheetCloseContext: { Provider: 'Provider' } },
  });
  const tree = WorkerOrderSheet({ children: null, onClose() {}, dismissible: false });
  const sheet = nodes(tree, n => n.type === 'ModalBottomSheet')[0];
  assert.equal(sheet.props.sheetGesturesEnabled, false); assert.equal(sheet.props.properties.shouldDismissOnClickOutside, false);
  assert.equal(sheet.props.properties.shouldDismissOnBackPress, true);
});

test('role sheet changes its native dismissible option while a save is pending', async () => {
  const updates = [], opened = [];
  const sheet = { isOpen: () => false, open: (content, options) => opened.push({ content, options }),
    update: (_content, options) => updates.push(options), close() {} };
  const { useReturnedPaintForm } = compile('boyoqchi/useReturnedPaintForm.tsx', {
    react: { useRef: value => ({ current: value }), useEffect: effect => { effect(); } },
    '../auth': { isSessionWitnessCurrent: () => true }, '../nativeSheet': { useNativeSheet: () => sheet }, './BoyoqchiForm': { BoyoqchiForm: 'BoyoqchiForm' },
    './returnedPaintApi': {}, './returnedPaintCompletion': {},
    './returnedPaintDraftRuntime': { returnedPaintDraftStoreFor: () => ({ load: async () => ({}), isCurrent: () => true }) },
  });
  const session = {};
  await useReturnedPaintForm(session, {}, { session })({ id: 'r', image: null });
  assert.equal(opened[0].options.dismissible, true);
  opened[0].content.props.onBusyChange(true); opened[0].content.props.onBusyChange(false);
  assert.deepEqual(updates, [{ dismissible: false }, { dismissible: true }]);
});

test('iOS shared sheet disables pan-down when the role marks the save busy', () => {
  const { WorkerOrderSheet } = compile('components/WorkerOrderSheet.ios.tsx', {
    react: { useCallback: fn => fn, useRef: value => ({ current: value }) },
    '@expo/ui/community/bottom-sheet': { BottomSheet: 'BottomSheet' }, 'react-native': { ScrollView: 'ScrollView', View: 'View' },
    './workerSheetContext': { WorkerSheetCloseContext: { Provider: 'Provider' } },
  });
  const tree = WorkerOrderSheet({ children: null, onClose() {}, dismissible: false });
  assert.equal(tree.props.enablePanDownToClose, false); assert.equal(tree.props.handleComponent, null);
});

test('native sheet dismissal while saving cannot reopen or replace a newer draft form', async () => {
  const opened = [], updates = []; let isOpen = false;
  const sheet = { isOpen: () => isOpen, open: (content, options) => { isOpen = true; opened.push({ content, options }); },
    update: (content, options) => { if (isOpen) updates.push({ content, options }); }, close: () => { isOpen = false; } };
  const { useReturnedPaintForm } = compile('boyoqchi/useReturnedPaintForm.tsx', {
    react: { useRef: value => ({ current: value }), useEffect: effect => { effect(); } },
    '../auth': { isSessionWitnessCurrent: () => true }, '../nativeSheet': { useNativeSheet: () => sheet }, './BoyoqchiForm': { BoyoqchiForm: 'BoyoqchiForm' },
    './returnedPaintApi': {}, './returnedPaintCompletion': {},
    './returnedPaintDraftRuntime': { returnedPaintDraftStoreFor: () => ({ load: async () => ({}), isCurrent: () => true }) },
  });
  const session = {}, open = useReturnedPaintForm(session, {}, { session }), request = { id: 'r', image: null };
  await open(request); const first = opened[0].content;
  first.props.onBusyChange(true); isOpen = false; // Native Android Back can dismiss despite the JS guard.
  await open(request); assert.equal(opened.length, 1);
  first.props.onBusyChange(false); assert.equal(updates.length, 1);
  await open(request); assert.equal(opened.length, 2); assert.notEqual(opened[1].content, first);
});


test('callbacks retained after form unmount cannot start a save or mutate the draft', () => {
  const f = fixture(), tree = f.render(), palette = nodes(tree, n => n.type === 'BoyoqchiPaintPalette')[0];
  const save = button(tree, 'Saqlash').props.onPress, back = nodes(tree, n => n.type === 'WorkerIconButton')[0].props.onPress;
  f.unmount(); save(); back(); palette.props.onUsage('astatka'); palette.props.onSelect('Oq');
  assert.equal(f.saves(), 0); assert.equal(f.closes(), 0); assert.equal(f.draft.selectedUsageIndex, 0);
});
