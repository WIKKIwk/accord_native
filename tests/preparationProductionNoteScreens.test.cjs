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
  test(`${platform} batch note belongs to the batch card and a held roll enters selection`, () => {
    const opened = [], selected = [];
    const session = {}, note = { text: 'Sovuq joyda saqlansin' };
    const roll = { epc: 'EPC1', receipt_name: 'receipt-EPC1' };
    const state = { items: [roll], loading: false, error: null, has_more: false, summary: { batch_id: 'batch:a', order_id: 'order-a', item_name: 'PE PR', batch_note: note } };
    const journal = { load() {} }, editor = {};
    const native = Object.fromEntries(['Button', 'Host', 'HStack', 'List', 'ProgressView', 'RNHostView', 'Section', 'Text', 'VStack'].map(name => [name, name]));
    const mocks = {
      react: { useState: () => [state, () => {}], useRef: () => ({ current: null }), useCallback: fn => fn, useMemo: fn => fn(), useEffect() {} },
      'react-native': { View: 'View', StyleSheet: { create: value => value } },
      'expo-router': { Stack: { Screen: 'Stack.Screen' }, useLocalSearchParams: () => ({ id: 'batch:a' }) },
      'react-native-safe-area-context': { useSafeAreaInsets: () => ({ bottom: 0 }) },
      '@expo/ui/swift-ui': native, '@expo/ui/jetpack-compose': { ...native, useMaterialColors: () => ({}) },
      '@expo/ui/swift-ui/modifiers': {
        accessibilityAddTraits: () => null, accessibilityElement: () => null, accessibilityLabel: () => null,
        contentShape: () => null, frame: () => null, shapes: { rectangle: () => null },
        onTapGesture: () => null, onLongPressGesture: hold => ({ hold }),
      },
      '../nativeSheet': { useNativeSheet: () => ({}) },
      '../components/WorkerQueueCard.android': { WorkerQueueCard: 'WorkerQueueCard' },
      'expo-symbols': { SymbolView: 'SymbolView' },
      '../components/WorkerIconButton': { WorkerIconButton: 'WorkerIconButton' },
      './PreparationProductionNoteDialog': { PreparationProductionNoteDialog: 'NoteDialog' },
      './usePreparationProductionWorkspace': { usePreparationJournal: () => ({ state, journal }) },
      './preparationProductionPresentation': { preparationProductionMetrics: () => '1 ta rulon', preparationProductionDate: () => '',
        preparationProductionRecipeLines: () => [], preparationProductionRollCard: () => ({ title: roll.epc, subtitle: 'Own W', metrics: '1 kg' }) },
      './usePreparationOutputNotes': { usePreparationOutputNotes: actualSession => {
        assert.equal(actualSession, session);
        return { editor, selected: new Map(), latest: (_scope, _id, incoming) => incoming, openBatch: (...args) => opened.push(args),
          toggle: item => selected.push(item.receipt_name) };
      } },
    };
    const ui = { usePreparationText: () => text => text, PreparationPage: 'Page', PreparationRow: 'PreparationRow', PreparationList: 'List' };
    mocks[platform === 'ios' ? './PreparationContext' : './PreparationContext.android'] = { usePreparationContext: () => ({ session }) };
    mocks[platform === 'ios' ? './PreparationUI' : './PreparationUI.android'] = ui;
    const exports = load(platform === 'ios' ? 'PreparationProductionScreens.ios.tsx' : 'PreparationProduction.android.tsx', mocks);
    const tree = platform === 'ios' ? exports.PreparationProductionBatch() : exports.PreparationProductionBatchScreen();
    const attach = platform === 'ios' ? nodes(tree, n => n.type === 'Button' && n.props.label === 'Batchga eslatma')[0]
      : nodes(tree, n => n.type === 'PreparationRow' && n.props.title === 'Batch eslatmasi')[0].props.trailing;
    attach.props.onPress(); assert.deepEqual(opened, [['batch:a', note]]);
    const dialog = nodes(tree, n => n.type === 'NoteDialog')[0]; assert.equal(dialog.props.editor, editor);
    if (platform === 'android') assert.equal(nodes(tree, n => n.type === 'PreparationRow' && n.props.title === 'Batch eslatmasi')[0].props.subtitle, note.text);
    else assert.ok(nodes(tree, n => n.type === 'Text').some(n => n.props.children === note.text));
    const row = nodes(tree, n => n.type?.name === 'ProductionRollRow')[0];
    const nativeRow = row.type(row.props);
    if (platform === 'android') nativeRow.props.onLongPress();
    else nativeRow.props.modifiers.find(modifier => modifier?.hold).hold();
    assert.deepEqual(selected, [roll.receipt_name]);
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
