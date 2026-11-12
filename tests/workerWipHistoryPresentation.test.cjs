const assert = require('node:assert/strict'), fs = require('node:fs'), Module = require('node:module'), path = require('node:path'), test = require('node:test'), ts = require('typescript');
const { hooks } = require('./support/workerPaddonHarness.cjs');
const jsx = { jsx: (type, props) => ({ type, props: props ?? {} }), jsxs: (type, props) => ({ type, props: props ?? {} }), Fragment: 'Fragment' };
function load(file, mocks = {}) {
  const name = path.resolve(__dirname, '../src', file), mod = new Module(name, module); mod.paths = module.paths;
  mod.require = id => id === 'react/jsx-runtime' ? jsx : Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(name, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, name); return mod.exports;
}
const daily = load('dailyWork.ts', { './apparatusApi': {}, './workerProgressModel': { progressBatchStatusDetail: row => row.status_detail ?? {} }, './workerProgressApi': {}, './workerControlsApi': {} });
const api = load('workerWipHistoryPresentation.ts', { './dailyWork': daily });
const details = load('workerWipDetailsPresentation.ts', { './dailyWork': daily, './workerProgressModel': { progressBatchStatusDetail: row => row.status_detail ?? {} } });
const wip = load('workerWip.ts', { './workerProgressModel': { progressBatchStatusDetail: row => row.status_detail ?? {} }, './workerWipApi': {}, './workerControlsApi': {} });
const p = (key, values) => key + (values ? `:${JSON.stringify(values)}` : '');
const batch = extra => ({ batch_id: 'b', qr_payload: 'QR', wip_status: 'waiting', apparatus: 'apparatus:default:press', produced_qty: 100.12345, uom: 'm', payload_json: {}, ...extra });
function nodes(tree, predicate) { if (!tree || typeof tree !== 'object') return []; if (Array.isArray(tree)) return tree.flatMap(value => nodes(value, predicate)); return [...(predicate(tree) ? [tree] : []), ...nodes(tree.props?.children, predicate), ...nodes(tree.props?.ListHeaderComponent, predicate)]; }
const find = (tree, predicate) => nodes(tree, predicate)[0];
const tick = () => new Promise(setImmediate);

// @v2-test test/admin_production_map_worker_completed_wip_test_part.dart
test('history totals sum micro-units and keep missing measurements separate from known zero', () => {
  const totals = api.workerWipHistoryTotals([
    batch({ finished_goods_kg: 10.0000001, bobina_kg: 10.0000002 }),
    batch({ produced_qty: 0, finished_goods_kg: 4, payload_json: { gross_qty: 'bad' } }),
  ]);
  assert.deepEqual(totals.gross, { units: 10000000, known: 1, missing: 1 });
  assert.deepEqual(totals.net, { units: 0, known: 1, missing: 1 });
  assert.deepEqual(totals.meters, { units: 100123450, known: 2, missing: 0 });
  assert.equal(api.workerWipHistoryTotalText(totals.net, 'kg', p), '0 kg');
  assert.equal(api.workerWipHistoryTotalText({ units: 0, known: 0, missing: 2 }, 'kg', p), 'worker.paddon.bobina_unknown');
});

test('history card rows retain source action, two-decimal quantity, both activity dates and legacy identity fallbacks', () => {
  const row = batch({ current_location: 'location', next_apparatus: '', worker_ref: 'worker:123456', action: ' PAUSE ', started_at_unix: 1, completed_at_unix: 2 });
  const actual = api.workerWipHistoryRows(row, { 'apparatus:default:press': 'Bosma' }, p);
  assert.deepEqual(actual.map(([label]) => label), ['worker.wip.info.quantity', 'worker.wip.info.started', 'worker.wip.info.finished', 'worker.wip.info.source', 'worker.wip.info.action', 'worker.wip.info.location', 'worker.wip.info.next_machine', 'worker.wip.info.worker']);
  assert.equal(actual[0][1], '100.12 m'); assert.equal(actual[3][1], 'Bosma'); assert.equal(actual[4][1], 'worker.wip.action.pause');
  assert.equal(actual[6][1], '—'); assert.equal(actual[7][1], 'worker:123456', 'source list card deliberately retains the legacy worker fallback');
});
function harness(platform = 'ios', initial = [], role = 'aparatchi', inline = false) {
  const runner = hooks(), state = { rows: initial, error: null, opened: [], actions: [], longPressDetails: false, parentCloses: 0, reads: 0 };
  runner.react.useContext = () => null;
  runner.react.useImperativeHandle = () => {};
  const sheet = { isOpen: () => false, close() {}, open: (content, options) => state.opened.push({ content, options }) };
  const inlinePresenter = inline ? load('components/useWorkerWipSheet.ios.tsx', {
    react: runner.react, './WorkerOrderSheet': { WorkerOrderSheet: 'InlineSheet' }, './workerSheetContext': { WorkerSheetCloseContext: {} },
  }) : null;
  const { WorkerWipHistory } = load('components/WorkerWipHistory.tsx', {
    react: runner.react, '@expo/ui': { Button: 'Button', Column: 'Column', Host: 'Host', RNHostView: 'RNHostView', Row: 'Row', Text: 'NativeText' },
    'expo-symbols': { SymbolView: 'SymbolView' }, 'expo-camera': { CameraView: 'Camera', useCameraPermissions: () => [{ granted: false, status: 'undetermined' }, async () => {}] },
    'react-native': { ActivityIndicator: 'Spinner', FlatList: 'FlatList', Platform: { OS: platform }, PlatformColor: value => value, Pressable: 'Pressable', StyleSheet: { create: value => value }, Text: 'Text', View: 'View' },
    '../authorizedFetch': {}, './useWorkerWipSheet': inlinePresenter ?? { useWorkerWipSheet: () => ({ sheet, dialogs: null }) }, './WorkerOrderControls': { WorkerOrderButton: 'Button' },
    './useWorkerColors': { useWorkerColors: () => ({}) }, './workerSheetContext': { WorkerSheetCloseContext: {} },
    './useWorkerWipHistoryPalette': { useWorkerWipHistoryPalette: () => ({ summary: 'summary', summaryText: 'on-summary', summaryChip: 'summary-chip',
      card: 'card', cardText: 'card-text', cardMuted: 'card-muted', number: 'number', numberText: 'number-text', onPrimary: 'on-primary',
      status: { waiting: { backgroundColor: 'waiting', color: 'on-waiting' }, inUse: { backgroundColor: 'in-use', color: 'on-in-use' }, processed: { backgroundColor: 'processed', color: 'on-processed' } } }) },
    './WorkerAlert': { WorkerAlert: 'Alert' }, './WorkerFormDialog': { WorkerFormDialog: 'Search' }, './WorkerFormField': { WorkerFormField: 'Field' }, './WorkerIconButton': { WorkerIconButton: 'IconButton' },
    './WorkerOrderSheet': {}, '../workerWip': { ...wip, loadWorkerWipBatches: async () => { state.reads++; if (state.error) throw state.error; return state.rows; } },
    './WorkerWipBatchDetails': { WorkerWipBatchDetails: 'Details' }, './WorkerOrderDetails': {}, './useWorkerOrderText': { useWorkerOrderText: () => ({ p, t: key => key }) },
    './useWorkerWipReactivation': { useWorkerWipReactivation: options => ({ isBusy: () => false, open: item => {
      state.actions.push(item); if (state.longPressDetails) options.showDetails(item);
    }, dialogs: null }) },
    '../workerWipHistoryPresentation': api, '../workerWipDetailsPresentation': details,
  });
  const props = { session: { profile: { ref: 'worker', role } }, order: { id: 'o', code: '0304', title: 'Film', apparatusId: 'apparatus:default:press' }, apparatusNames: { 'apparatus:default:press': 'Bosma' }, onClose() { state.parentCloses++; } };
  return { state, render() { runner.begin(); const tree = WorkerWipHistory(props); runner.flush(); return tree; }, dispose: runner.dispose };
}
for (const platform of ['ios', 'android']) test(`${platform}: history renders localized summary, partial totals, states and QR details with no lost source action row`, async () => {
  const h = harness(platform, [batch({ finished_goods_kg: 10, bobina_kg: 2, action: 'pause', worker_ref: 'worker' }), batch({ batch_id: 'unknown', qr_payload: '' })]);
  try {
    h.render(); await tick(); let tree = h.render();
    assert.ok(find(tree, node => node.props?.children === 'worker.wip.history.title'));
    assert.ok(find(tree, node => node.props?.children === 'worker.wip.history.summary:{"count":2}'));
    assert.ok(find(tree, node => node.props?.children === 'worker.wip.history.partial_total:{"count":1}'));
    const list = find(tree, node => node.type === 'FlatList'); assert.equal(list.props.data.length, 2);
    const rendered = list.props.renderItem({ item: h.state.rows[0], index: 0 });
    assert.ok(find(rendered, node => node.props?.children === 'worker.wip.status.waiting'));
    const texts = nodes(rendered, node => node.type === 'Text').map(node => node.props.children).flat().join(' ');
    assert.match(texts, /worker.wip.info.action.*worker.wip.action.pause/);
    rendered.props.onPress(); assert.equal(h.state.opened[0].content.type, 'Details');
    list.props.renderItem({ item: h.state.rows[1], index: 1 }).props.onPress(); tree = h.render();
    assert.deepEqual(find(tree, node => node.type === 'Alert').props.alert, { title: 'worker.daily.wip_qr_missing', message: 'worker.daily.wip_qr_missing.body', confirmLabel: 'worker.action.close' });
    const search = find(tree, node => node.type === 'Button' && node.props.label === 'worker.wip.history.search_qr'); search.props.onPress(); tree = h.render();
    assert.equal(find(tree, node => node.type === 'Search').props.title, 'worker.wip.history.search_qr');
    assert.equal(find(tree, node => node.type === 'Field').props.label, 'worker.wip.history.enter_qr');
  } finally { h.dispose(); }
});

test('iOS history uses a bounded scroll viewport and the standard full-width QR action', async () => {
  const h = harness('ios', [batch()]);
  try {
    h.render(); await tick(); const tree = h.render();
    const list = find(tree, node => node.type === 'FlatList');
    assert.deepEqual(list.props.style, { flex: 1, minHeight: 0 });
    assert.equal(list.props.contentInsetAdjustmentBehavior, 'never');
    assert.equal(list.props.automaticallyAdjustContentInsets, false);
    const search = find(tree, node => node.type === 'Button' && node.props.label === 'worker.wip.history.search_qr');
    assert.equal(search.props.variant, 'filled'); assert.equal(search.props.height, 52);
    assert.equal(search.props.icon.ios, 'qrcode.viewfinder');
    assert.equal(search.props.disabled, false);
    search.props.onPress();
    assert.equal(find(h.render(), node => node.type === 'Search').props.visible, true);
  } finally { h.dispose(); }
});

for (const gesture of ['press', 'longPress']) test(`iOS WIP ${gesture} opens inline details and closing them retains the history list`, async () => {
  const h = harness('ios', [batch(), batch({ batch_id: 'second', qr_payload: 'SECOND' })], 'aparatchi', true);
  try {
    h.state.longPressDetails = true;
    h.render(); await tick(); let tree = h.render();
    const row = find(tree, node => node.type === 'FlatList').props.renderItem({ item: h.state.rows[0], index: 0 });
    if (gesture === 'press') row.props.onPress(); else { row.props.onLongPress(); row.props.onPress(); }
    tree = h.render();
    const children = nodes(tree, node => node.type === 'InlineSheet');
    assert.equal(children.length, 1);
    const child = children[0];
    assert.equal(child.props.children.props.children.type, 'Details');
    assert.equal(child.props.children.props.children.props.batch, h.state.rows[0]);
    assert.equal(h.state.parentCloses, 0); assert.deepEqual(h.state.opened, [], 'iOS must not push a root route over the history sheet');
    child.props.onClose(); tree = h.render();
    assert.equal(find(tree, node => node.type === 'InlineSheet'), undefined);
    assert.equal(find(tree, node => node.type === 'FlatList').props.data.length, 2);
    assert.equal(h.state.parentCloses, 0); assert.equal(h.state.reads, 1);
  } finally { h.dispose(); }
});

test('Android WIP cards keep long titles readable, align facts and retain both row actions', async () => {
  const title = '120 sht detskiy (kok yashil) yarim tayyor mahsulot, apparat: apparatus:default:bosma_7, rulon yechildi';
  const h = harness('android', [batch({ label_item_name: title, action: 'pause', finished_goods_kg: 100, bobina_kg: 1 })]);
  const flatten = style => Object.assign({}, ...[style].flat(Infinity).filter(value => value && typeof value === 'object'));
  try {
    h.render(); await tick(); const tree = h.render();
    const list = find(tree, node => node.type === 'FlatList');
    const summary = find(list.props.ListHeaderComponent, node => node.type === 'View' && flatten(node.props.style).backgroundColor === 'summary');
    assert.ok(summary, 'summary uses the system surface color');
    const row = list.props.renderItem({ item: h.state.rows[0], index: 0 });
    assert.equal(flatten(row.props.style).backgroundColor, 'card');
    assert.equal(find(row, node => node.type === 'Text' && node.props.children === title).props.numberOfLines, 2);
    const status = find(row, node => node.type === 'Text' && node.props.children === 'worker.wip.status.waiting');
    assert.equal(status.props.numberOfLines, 1);
    assert.equal(flatten(status.props.style).backgroundColor, 'waiting');
    const facts = nodes(row, node => node.type === 'View' && Array.isArray(node.props.children)
      && node.props.children[0]?.props?.children === 'worker.wip.info.quantity')[0];
    assert.equal(flatten(facts.props.children[0].props.style).width, 108);
    assert.equal(facts.props.children[1].props.children, '100.12 m');
    assert.equal(flatten(facts.props.children[1].props.style).fontWeight, '600');
    const search = find(tree, node => node.type === 'Button' && node.props.label === 'worker.wip.history.search_qr');
    assert.deepEqual(search.props.style, { width: '100%', height: 56 });
    assert.equal(find(search, node => node.type === 'SymbolView').props.name.android, 'qr_code_scanner');
    row.props.onLongPress(); assert.deepEqual(h.state.actions, [h.state.rows[0]]);
    row.props.onPress(); assert.equal(h.state.opened[0].content.type, 'Details');
  } finally { h.dispose(); }
});

test('Android WIP surfaces follow the current Material palette in light and dark mode', () => {
  for (const mode of ['light', 'dark']) {
    const colors = Object.fromEntries(['tertiaryContainer', 'onTertiaryContainer', 'surfaceContainerHighest', 'surface', 'onSurface', 'onSurfaceVariant',
      'secondaryContainer', 'onSecondaryContainer', 'primaryContainer', 'onPrimaryContainer', 'onPrimary'].map(role => [role, `${mode}-${role}`]));
    let options;
    const { useWorkerWipHistoryPalette } = load('components/useWorkerWipHistoryPalette.android.ts', {
      '@expo/ui/jetpack-compose': { useMaterialColors: value => { options = value; return colors; } },
    });
    const palette = useWorkerWipHistoryPalette();
    assert.deepEqual(options, {});
    assert.equal(palette.summary, colors.surface);
    assert.equal(palette.summaryText, colors.onSurface);
    assert.equal(palette.summaryChip, colors.surfaceContainerHighest);
    assert.equal(palette.card, colors.surface);
    assert.equal(palette.status.waiting.backgroundColor, colors.secondaryContainer);
    assert.equal(palette.status.inUse.backgroundColor, colors.primaryContainer);
    assert.equal(palette.status.processed.backgroundColor, colors.secondaryContainer);
  }
});

test('Android operators can open a reprint for another worker’s ordinary WIP without changing other roles or opening WIP', async () => {
  for (const scenario of [
    { platform: 'android', role: 'aparatchi', source: '', expected: true },
    { platform: 'android', role: 'aparatchi', source: ' OPENING_WIP ', expected: undefined },
    { platform: 'android', role: 'rezka_master', source: '', expected: undefined },
    { platform: 'ios', role: 'aparatchi', source: '', expected: undefined },
  ]) {
    for (const gesture of ['press', 'longPress']) {
      const item = batch({ worker_ref: 'another-worker', payload_json: { input_wip_source_kind: scenario.source } });
      const h = harness(scenario.platform, [item], scenario.role);
      try {
        h.state.longPressDetails = true;
        h.render(); await tick(); const tree = h.render();
        const row = find(tree, node => node.type === 'FlatList').props.renderItem({ item, index: 0 });
        if (gesture === 'press') row.props.onPress(); else row.props.onLongPress();
        const detail = h.state.opened[0].content;
        assert.equal(detail.type, 'Details');
        assert.equal(detail.props.batch, item);
        assert.equal(detail.props.allowReprint, scenario.expected, JSON.stringify({ ...scenario, gesture }));
      } finally { h.dispose(); }
    }
  }
});

for (const scenario of ['empty', 'error', 'forbidden']) test(`history ${scenario} state preserves the source translated message and retry condition`, async () => {
  const h = harness(); if (scenario !== 'empty') h.state.error = Object.assign(Error('private transport details'), { statusCode: scenario === 'forbidden' ? 403 : 500 });
  try {
    h.render(); await tick(); const tree = h.render();
    const key = scenario === 'empty' ? 'worker.wip.history.empty' : scenario === 'forbidden' ? 'worker.wip.access_denied' : 'worker.wip.history.error';
    assert.ok(find(tree, node => node.props?.children === key));
    assert.equal(!!find(tree, node => node.type === 'Button' && node.props.label === 'worker.action.retry'), scenario !== 'empty');
    assert.equal(find(tree, node => node.type === 'Button' && node.props.label === 'worker.wip.history.search_qr').props.disabled, true);
  } finally { h.dispose(); }
});
