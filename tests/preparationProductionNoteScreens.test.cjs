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
function load(name, mocks) {
  const filename = path.resolve(__dirname, '../src/preparation', name), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths;
  mod.require = id => id === 'react/jsx-runtime' ? jsx : Object.hasOwn(mocks, id) ? mocks[id] : {};
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, filename);
  return mod.exports;
}
for (const platform of ['android', 'ios']) {
  test(`${platform} order card opens the shared note editor and displays confirmed note`, () => {
    let opened = 0;
    const session = {}, note = { text: 'Sovuq joyda saqlansin' };
    const state = { items: [], loading: false, error: null, has_more: false, summary: { order_id: 'order-a', order_code: '0317', order_title: 'Silver choy', preparation_note: note } };
    const journal = { load() {} }, editor = { note, open() { opened++; } };
    const native = Object.fromEntries(['Button', 'Host', 'HStack', 'List', 'ProgressView', 'RNHostView', 'Section', 'Text', 'TextField', 'VStack'].map(name => [name, name]));
    const mocks = {
      react: { useState: () => [state, () => {}], useRef: () => ({ current: null }), useCallback: fn => fn, useMemo: fn => fn(), useEffect() {} },
      'react-native': { View: 'View', StyleSheet: { create: value => value } },
      'expo-router': { Stack: { Screen: 'Stack.Screen' }, useLocalSearchParams: () => ({ id: 'order-a' }), useFocusEffect() {} },
      '@expo/ui/swift-ui': native, '@expo/ui/jetpack-compose': { ...native, useMaterialColors: () => ({}) },
      '../components/WorkerIconButton': { WorkerIconButton: 'WorkerIconButton' },
      './PreparationProductionNoteDialog': { PreparationProductionNoteDialog: 'NoteDialog' },
      './preparationJournalFactory': { createPreparationProductionOrderJournal: () => journal },
      './preparationProductionPresentation': { preparationProductionMetrics: () => '5 ta rulon' },
      './usePreparationProductionNote': { usePreparationProductionNote: (actualSession, id, incoming) => {
        assert.equal(actualSession, session); assert.equal(id, 'order-a'); assert.equal(incoming, note); return editor;
      } },
    };
    const ui = { usePreparationText: () => text => text, PreparationPage: 'Page', PreparationRow: 'PreparationRow', PreparationList: 'List' };
    mocks[platform === 'ios' ? './PreparationContext' : './PreparationContext.android'] = { usePreparationContext: () => ({ session }) };
    mocks[platform === 'ios' ? './PreparationUI' : './PreparationUI.android'] = ui;
    const exports = load(platform === 'ios' ? 'PreparationProductionScreens.ios.tsx' : 'PreparationProduction.android.tsx', mocks);
    const tree = platform === 'ios' ? exports.PreparationProductionOrder() : exports.PreparationProductionOrderScreen();
    const icon = platform === 'ios' ? nodes(tree, n => n.type === 'WorkerIconButton')[0] : nodes(tree, n => n.type === 'PreparationRow')[0].props.trailing;
    assert.equal(icon.props.icon, 'edit'); icon.props.onPress(); assert.equal(opened, 1);
    const dialog = nodes(tree, n => n.type === 'NoteDialog')[0]; assert.equal(dialog.props.editor, editor);
    if (platform === 'android') assert.match(nodes(tree, n => n.type === 'PreparationRow')[0].props.subtitle, /Sovuq joyda saqlansin/);
    else assert.ok(nodes(tree, n => n.type === 'Text').some(n => (JSON.stringify(n.props.children) ?? '').includes(note.text)));
  });
  test(`${platform} dialog reuses native form/field and prevents duplicate save or dismissal while saving`, () => {
    let saved = 0, cancelled = 0, value;
    const editor = { state: { original: {}, draft: 'Draft', saving: false, error: 'Offline' }, count: 5, limit: 2000, canSave: true,
      save() { saved++; }, cancel() { cancelled++; }, change(text) { value = text; } };
    const exports = load(`PreparationProductionNoteDialog.${platform}.tsx`, {
      '@expo/ui/jetpack-compose': { Host: 'Host', Text: 'Text', useMaterialColors: () => ({}) }, '@expo/ui/swift-ui': { Text: 'Text' },
      '@expo/ui/swift-ui/modifiers': { foregroundStyle: value => value }, 'react-native': { PlatformColor: value => value },
      '../components/BaseHost': { BaseHost: 'Host' }, '../components/WorkerFormDialog': { WorkerFormDialog: 'WorkerFormDialog' },
      '../components/WorkerReportField': { WorkerReportField: 'WorkerReportField' }, './PreparationUI': { usePreparationText: () => text => text },
    });
    let tree = exports.PreparationProductionNoteDialog({ editor });
    assert.equal(tree.type, 'WorkerFormDialog'); assert.equal(tree.props.confirmLabel, 'Saqlash'); tree.props.onConfirm(); tree.props.onCancel();
    assert.equal(saved, 1); assert.equal(cancelled, 1);
    const field = nodes(tree, n => n.type === 'WorkerReportField')[0]; assert.equal(field.props.multiline, true); field.props.change('Changed'); assert.equal(value, 'Changed');
    editor.state.saving = true; editor.canSave = false; tree = exports.PreparationProductionNoteDialog({ editor });
    assert.equal(tree.props.confirmDisabled, true); assert.equal(tree.props.cancelDisabled, true); assert.equal(tree.props.preventDismiss, true);
    assert.equal(nodes(tree, n => n.type === 'WorkerReportField')[0].props.disabled, true);
  });
}
