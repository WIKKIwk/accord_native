const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const { hooks } = require('./support/workerPaddonHarness.cjs');

const jsx = { jsx: (type, props, key) => ({ type, props: props ?? {}, key }), jsxs: (type, props, key) => ({ type, props: props ?? {}, key }), Fragment: 'Fragment' };
function load(file, mocks = {}, extra = '') {
  const filename = path.resolve(__dirname, '../src', file), mod = new Module(filename, module); mod.paths = module.paths;
  mod.require = id => id === 'react/jsx-runtime' ? jsx : Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8') + extra, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, filename);
  return mod.exports;
}
function loadWithReactCompiler(file, mocks, extra) {
  const filename = path.resolve(__dirname, '../src', file), mod = new Module(filename, module); mod.paths = module.paths;
  const compiled = require('@babel/core').transformSync(fs.readFileSync(filename, 'utf8') + extra, {
    filename, babelrc: false, configFile: false,
    plugins: [[require('babel-plugin-react-compiler'), { target: '19', environment: { enableResetCacheOnSourceFileChanges: true } }],
      [require('@babel/plugin-transform-react-jsx'), { runtime: 'automatic' }], require('@babel/plugin-transform-modules-commonjs')],
    presets: [[require('@babel/preset-typescript'), { allExtensions: true, isTSX: true }]],
  }).code;
  mod.require = id => id === 'react/jsx-runtime' ? jsx : Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  mod._compile(compiled, filename);
  return { compiled, exports: mod.exports };
}
function nodes(tree, predicate) {
  if (!tree || typeof tree !== 'object') return [];
  if (Array.isArray(tree)) return tree.flatMap(child => nodes(child, predicate));
  return [...(predicate(tree) ? [tree] : []), ...nodes(tree.props?.children, predicate)];
}
const find = (tree, predicate) => nodes(tree, predicate)[0];
const modifiers = new Proxy({}, { get: (_, name) => name === 'Shapes' ? { RoundedCorner: radius => ({ radius }), Circle: 'circle' } : (...args) => ({ name, args }) });
const modifier = (node, name) => node?.props.modifiers?.find(value => value.name === name)?.args[0];
const compose = { ...Object.fromEntries(['Box', 'Column', 'FilledTonalIconButton', 'Host', 'OutlinedCard', 'RNHostView', 'Row'].map(name => [name, name])), Text: 'ComposeText', useMaterialColors: () => palette };
const model = load('dailyWork.ts', { './apparatusApi': {}, './workerProgressModel': { progressBatchStatusDetail: row => row.status_detail ?? {} }, './workerProgressApi': {}, './workerControlsApi': {} });
const presentation = load('dailyWorkPresentation.ts', { './dailyWork': model });
const p = key => key;
const palette = { primary: 'primary', onSurface: 'text', onSurfaceVariant: 'muted', surfaceContainerLow: 'group', surfaceContainerHighest: 'wip', outlineVariant: 'outline',
  secondaryContainer: 'secondary', onSecondaryContainer: 'onSecondary', primaryContainer: 'waiting', onPrimaryContainer: 'onWaiting', tertiaryContainer: 'active', onTertiaryContainer: 'onActive' };
const batch = overrides => model.parseDailyWorkHistory({ batches: [{ batch_id: 'b', order_id: 'zakaz-0306', qr_payload: '400118E2523834AC4CC00309',
  label_item_name: 'Hamroh qizil 80 gr tuzli yarim tayyor mahsulot', wip_status: 'waiting', produced_qty: 151, uom: 'm',
  finished_goods_kg: 12, bobina_kg: 2, diameter: 100, apparatus: 'cut', current_location: 'stock', ...overrides }] })[0];

function setup(extra = {}) {
  const runner = hooks(), calls = [], row = batch();
  const group = { key: 'order:zakaz-0306', orderId: 'zakaz-0306', title: 'Hamroh qizil 80 gr tuzli', batches: [row] };
  const actions = { canEdit: () => true, edit: item => calls.push(['edit', item.id]), showQr: (item, options) => calls.push(['qr', item.id, options]) };
  const value = { day: new Date(2026, 9, 27), setDay: date => calls.push(['date', date]), batches: [row], apparatusNames: { cut: 'Kesish', stock: 'Ombor' }, groups: [group],
    totals: { orders: 1, wips: 1, used: 0 }, error: '', refreshing: false, refresh() {} };
  const mocks = {
    react: runner.react, 'react-native': { StyleSheet: { create: x => x }, BackHandler: { addEventListener: () => ({ remove() {} }) },
      ActivityIndicator: 'Spinner', Pressable: 'Pressable', RefreshControl: 'Refresh', ScrollView: 'ScrollView', Text: 'Text', View: 'View' },
    '@expo/ui/community/datetime-picker': { DateTimePicker: 'DatePicker' }, '@expo/ui/jetpack-compose': compose, '@expo/ui/jetpack-compose/modifiers': modifiers,
    'expo-symbols': { SymbolView: 'SymbolView' }, '../dailyWork': model, '../dailyWorkPresentation': presentation,
    './useDailyWork': { useDailyWork: () => value }, './useDailyWorkActions': { useDailyWorkActions: () => actions },
    './DailyWorkDialogs': { DailyWorkDialogs: 'Dialogs' }, './WorkerIconButton': { WorkerIconButton: 'IconButton' },
    './useWorkerColors': { useWorkerColors: () => ({}) }, './useWorkerOrderText': { useWorkerOrderText: () => ({ p, t: p }) }, ...extra,
  };
  const exports = load('components/DailyWorkScreen.android.tsx', mocks, '\nexport { OrderGroup, BatchCard, CompactValue, InfoRow };');
  const render = (component, props) => { runner.begin(); const tree = component(props); runner.flush(); return tree; };
  const props = { group, names: value.apparatusNames, assigned: ['cut'], showWorker: false, actions, p, colors: palette };
  return { ...exports, row, group, actions, props, calls, value, render, mocks, dispose: runner.dispose };
}

test('Android daily cards render with React Compiler enabled', () => {
  const h = setup();
  try {
    const { compiled, exports } = loadWithReactCompiler('components/DailyWorkScreen.android.tsx', {
      ...h.mocks, 'react/compiler-runtime': { c: size => Array(size).fill(null) },
    }, '\nexport { DailyWorkIcon, OrderGroup, BatchCard, CompactValue };');
    assert.match(compiled, /Symbol\.for\(["']react\.memo_cache_sentinel["']\)/);
    const icon = exports.DailyWorkIcon({ name: 'receipt_long', color: 'primary' });
    assert.equal(icon.type, 'RNHostView'); assert.equal(icon.props.children.props.name.android, 'receipt_long');
    assert.doesNotThrow(() => h.render(exports.OrderGroup, h.props));
    assert.doesNotThrow(() => h.render(exports.BatchCard, { batch: h.row, index: 0, names: {}, assigned: [], showWorker: false, actions: h.actions, p, colors: palette }));
    assert.doesNotThrow(() => h.render(exports.CompactValue, { label: 'QR', value: '123', colors: palette }));
  } finally { h.dispose(); }
});

test('Android daily order has the V2 identity, count badge and separate expandable WIP cards', () => {
  const h = setup();
  try {
    const session = { profile: { role: 'aparatchi' }, assigned_apparatus: ['cut'] };
    const screen = h.render(h.DailyWorkScreen, { session, onBack() {} });
    const group = find(screen, node => node.type === h.OrderGroup);
    assert.equal(group.props.group, h.group); assert.deepEqual(group.props.assigned, ['cut']);
    const runner = hooks();
    const exports = setup({ react: runner.react });
    const render = () => { runner.begin(); const tree = exports.OrderGroup(h.props); runner.flush(); return tree; };
    let tree = render();
    const card = find(tree, node => node.type === 'OutlinedCard');
    assert.equal(card.props.colors.containerColor, 'group'); assert.equal(card.props.border.color, 'outline');
    const header = find(tree, node => modifier(node, 'testID') === 'daily-work-order-header-order:zakaz-0306');
    assert.ok(header);
    assert.equal(find(tree, node => node.type?.name === 'DailyWorkIcon').props.name, 'receipt_long');
    assert.ok(find(tree, node => node.type === 'ComposeText' && node.props.children === 'Hamroh qizil 80 gr tuzli'));
    const label = find(tree, node => node.type === 'ComposeText' && Array.isArray(node.props.children) && node.props.children[0] === 'worker.daily.order');
    assert.equal(label.props.children[1].props.children, ' • zakaz-0306');
    assert.ok(find(tree, node => node.type === 'ComposeText' && node.props.children === '1 worker.daily.wip'));
    modifier(header, 'clickable')(); tree = render();
    const cards = nodes(tree, node => node.type === exports.BatchCard);
    assert.equal(cards.length, 1); assert.equal(cards[0].props.batch, h.row); assert.equal(cards[0].props.index, 0);
    modifier(find(tree, node => modifier(node, 'testID') === 'daily-work-order-header-order:zakaz-0306'), 'clickable')(); tree = render();
    assert.equal(nodes(tree, node => node.type === exports.BatchCard).length, 0);
    runner.dispose(); exports.dispose();
  } finally { h.dispose(); }
});

test('Android WIP cards separate QR and metraj, then show aligned complete details and keep tap, edit and long press', () => {
  const h = setup();
  try {
    const props = { batch: h.row, index: 0, names: h.props.names, assigned: ['cut'], showWorker: false, actions: h.actions, p, colors: palette };
    let tree = h.render(h.BatchCard, props);
    assert.equal(modifier(tree, 'testID'), 'daily-work-wip-card-b'); assert.equal(modifier(tree, 'background'), 'wip');
    const gesture = modifier(tree, 'combinedClickable');
    assert.equal(typeof gesture.onClick, 'function'); assert.equal(typeof gesture.onLongClick, 'function');
    assert.ok(find(tree, node => node.type === 'ComposeText' && node.props.children === '1'));
    assert.ok(find(tree, node => node.type === 'ComposeText' && node.props.children === 'Hamroh qizil 80 gr tuzli yarim tayyor mahsulot'));
    assert.ok(find(tree, node => modifier(node, 'background') === 'waiting'));
    const compact = nodes(tree, node => node.type === h.CompactValue);
    assert.deepEqual(compact.map(item => [item.props.label, item.props.value]), [
      ['worker.wip.info.qr', '400118E2523834AC4CC00309'], ['worker.daily.field.length', '151 m'],
    ]);
    const compactRow = find(tree, node => node.type === 'Row' && Array.isArray(node.props.children) && compact.every(item => node.props.children.includes(item)));
    assert.equal(compactRow.props.horizontalArrangement.spacedBy, 12);
    gesture.onLongClick(); assert.deepEqual(h.calls, [['qr', 'b', { nativeFeedback: true }]]);
    gesture.onClick(); tree = h.render(h.BatchCard, props);
    const info = nodes(tree, node => node.type === h.InfoRow);
    assert.deepEqual(info.map(item => item.props.row), [['worker.wip.info.qr', '400118E2523834AC4CC00309']]);
    const qr = h.InfoRow(info[0].props), value = qr.props.children[1];
    assert.equal(value.props.children, '400118E2523834AC4CC00309'); assert.equal(value.props.maxLines, undefined);
    const details = nodes(tree, node => node.type === h.CompactValue);
    assert.deepEqual(details.map(item => [item.props.label, item.props.value]), [
      ['worker.daily.field.length', '151 m'], ['worker.daily.field.weight', '12 kg'], ['worker.daily.field.roll', '2 kg'], ['worker.daily.field.diameter', '100 mm'],
      ['worker.wip.info.source', 'Kesish'], ['worker.wip.info.location', 'Ombor'],
    ]);
    find(tree, node => node.type === 'FilledTonalIconButton').props.onClick(); assert.deepEqual(h.calls.at(-1), ['edit', 'b']);
    modifier(tree, 'combinedClickable').onClick(); tree = h.render(h.BatchCard, props);
    assert.equal(find(tree, node => node.type === 'FilledTonalIconButton'), undefined);
  } finally { h.dispose(); }
});

test('Android WIP status badges follow the current status and cannot expose editing when unavailable', () => {
  for (const [input, expected] of [
    [{ wip_status: 'waiting' }, ['worker.wip.waiting', 'waiting']],
    [{ wip_status: 'in_progress' }, ['worker.queue.status.in_progress', 'active']],
    [{ wip_status: 'used' }, ['worker.daily.used', 'secondary']],
  ]) {
    const h = setup();
    try {
      const row = batch(input), props = { batch: row, index: 0, names: {}, assigned: [], showWorker: false,
        actions: { ...h.actions, canEdit: () => false }, p, colors: palette };
      let tree = h.render(h.BatchCard, props);
      const text = find(tree, node => node.type === 'ComposeText' && node.props.children === expected[0]);
      assert.ok(text); assert.ok(find(tree, node => node.type === 'Box' && modifier(node, 'background') === expected[1]));
      modifier(tree, 'combinedClickable').onClick(); tree = h.render(h.BatchCard, props);
      assert.equal(find(tree, node => node.type === 'FilledTonalIconButton'), undefined);
    } finally { h.dispose(); }
  }
});

test('Android date selection renders only the supplied day groups and keeps multiple WIPs separate', () => {
  const h = setup();
  try {
    const other = batch({ batch_id: 'b2', order_id: 'zakaz-0210', qr_payload: 'QR-2', label_item_name: 'Long second product' });
    const third = batch({ batch_id: 'b3', order_id: 'zakaz-0210', qr_payload: 'QR-3', label_item_name: 'Third product' });
    const nextGroup = { key: 'order:zakaz-0210', orderId: 'zakaz-0210', title: 'Second order', batches: [other, third] };
    h.value.setDay = value => { h.value.day = value; h.value.groups = [nextGroup]; };
    const session = { profile: { role: 'aparatchi' }, assigned_apparatus: ['cut'] };
    const screen = () => h.render(h.DailyWorkScreen, { session, onBack() {} });
    let tree = screen();
    assert.deepEqual(nodes(tree, node => node.type === h.OrderGroup).map(item => item.props.group.key), ['order:zakaz-0306']);
    const date = find(tree, node => node.type === 'Pressable' && find(node, child => child.type === 'Text' && child.props.children === 'worker.action.select'));
    date.props.onPress(); tree = screen();
    find(tree, node => node.type === 'DatePicker').props.onValueChange({}, new Date(2025, 3, 9)); tree = screen();
    assert.deepEqual(nodes(tree, node => node.type === h.OrderGroup).map(item => item.props.group.key), ['order:zakaz-0210']);
    assert.equal(h.value.day.getTime(), new Date(2025, 3, 9).getTime());

    const groupHarness = setup(), props = { ...groupHarness.props, group: nextGroup };
    let groupTree = groupHarness.render(groupHarness.OrderGroup, props);
    modifier(find(groupTree, node => modifier(node, 'testID') === 'daily-work-order-header-order:zakaz-0210'), 'clickable')();
    groupTree = groupHarness.render(groupHarness.OrderGroup, props);
    const cards = nodes(groupTree, node => node.type === groupHarness.BatchCard);
    assert.deepEqual(cards.map(card => [card.props.batch.id, card.props.index]), [['b2', 0], ['b3', 1]]);
    assert.equal(new Set(cards.map(card => card.key)).size, 2);
    groupHarness.dispose();
  } finally { h.dispose(); }
});

test('Android expanded WIP keeps optional dates, location, next apparatus and note in source order', () => {
  const h = setup();
  try {
    const row = batch({ finished_goods_kg: null, bobina_kg: null, diameter: null, started_at_unix: 1700000000,
      completed_at_unix: 1700000100, next_apparatus: 'next', description: 'Checked' });
    const props = { batch: row, index: 0, names: { cut: 'Kesish', stock: 'Ombor', next: 'Bosma' }, assigned: ['cut'], showWorker: false, actions: h.actions, p, colors: palette };
    let tree = h.render(h.BatchCard, props); modifier(tree, 'combinedClickable').onClick();
    tree = h.render(h.BatchCard, props);
    assert.deepEqual(nodes(tree, node => node.type === h.InfoRow).map(item => item.props.row[0]), [
      'worker.wip.info.qr', 'worker.wip.info.started', 'worker.wip.info.finished', 'worker.wip.info.next_machine', 'worker.wip.info.note',
    ]);
    assert.deepEqual(nodes(tree, node => node.type === h.CompactValue).map(item => [item.props.label, item.props.value]), [
      ['worker.daily.field.length', '151 m'], ['worker.wip.info.source', 'Kesish'], ['worker.wip.info.location', 'Ombor'],
    ]);
    assert.equal(nodes(tree, node => node.type === h.InfoRow).at(-1).props.row[1], 'Checked');
  } finally { h.dispose(); }
});
