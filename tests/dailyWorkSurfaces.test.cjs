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
const model = load('dailyWork.ts', { './apparatusApi': {}, './workerProgressModel': { progressBatchStatusDetail: row => row.status_detail ?? {} }, './workerProgressApi': {}, './workerControlsApi': {} });
const presentation = load('dailyWorkPresentation.ts', { './dailyWork': model });
const p = key => key;
const batch = overrides => model.parseDailyWorkHistory({ batches: [{ batch_id: 'b', order_id: 'o', qr_payload: 'QR', label_item_name: 'Film yarim tayyor mahsulot, apparat: apparatus:default:cut', wip_status: 'waiting', produced_qty: 123.4567, uom: 'm', finished_goods_kg: 4.5678, bobina_kg: 1, diameter: 100, apparatus: 'apparatus:default:cut', ...overrides }] })[0];
function nodes(tree, predicate) {
  if (!tree || typeof tree !== 'object') return [];
  if (Array.isArray(tree)) return tree.flatMap(item => nodes(item, predicate));
  return [...(predicate(tree) ? [tree] : []), ...nodes(tree.props?.children, predicate)];
}
const find = (tree, predicate) => nodes(tree, predicate)[0];
const modifiers = new Proxy({}, { get: (_, name) => name === 'shapes' ? { rectangle: () => 'rectangle' } : (...args) => ({ name, args }) });
const iosUi = Object.fromEntries(['Button','DatePicker','Divider','Host','HStack','Image','List','NavigationStack','ProgressView','RNHostView','ScrollView','Section','Spacer','Text','TextField','Toolbar','ToolbarItem','VStack'].map(x => [x,x]));
const modifier = (node, name) => node?.props.modifiers?.find(value => value.name === name)?.args[0];

// @v2-test test/aparatchi_daily_work_test.dart
test('daily cards use source product titles, translated statuses, short QR fallbacks and two-decimal metrics', () => {
  const row = batch({ status_detail: { flow_status: 'in_progress' } });
  assert.equal(presentation.dailyWorkProductTitle(row, 1), 'Film yarim tayyor mahsulot');
  assert.equal(presentation.dailyWorkStatusLabel(row, p), 'worker.queue.status.in_progress');
  assert.equal(presentation.dailyWorkStatusLabel(batch(), p), 'worker.wip.waiting');
  assert.equal(presentation.dailyWorkStatusLabel(batch({ wip_status: 'used' }), p), 'worker.daily.used');
  assert.equal(presentation.dailyWorkDisplayCode(batch({ qr_payload: '', batch_id: 'x'.repeat(70) + '123456789012' })), '…123456789012');
  assert.equal(presentation.dailyWorkProductTitle(batch({ label_item_name: '', label_item_code: '' }), 3), 'WIP 3');
  const rows = presentation.dailyWorkExpandedRows(row, { 'apparatus:default:cut': 'Kesish' }, p);
  assert.deepEqual(rows.slice(0, 5), [['worker.wip.info.qr', 'QR'], ['worker.daily.field.length', '123.46 m'], ['worker.daily.field.weight', '4.57 kg'], ['worker.daily.field.roll', '1 kg'], ['worker.daily.field.diameter', '100 mm']]);
  assert.deepEqual(rows.slice(-2), [['worker.wip.info.source', 'Kesish'], ['worker.wip.info.location', 'Kesish']]);
  assert.equal(model.dailyWorkLocation('apparatus:unknown', { a: 'Other', cut: 'Assigned' }, ['cut']), 'Assigned');
  assert.equal(model.dailyWorkLocation('', {}), '—');
  const time = new Date(2026, 10, 9, 6, 7).getTime() / 1000;
  assert.equal(model.dailyWorkDate(time), '09.11.2026 06:07');
});

test('iOS daily WIP tap expands inline, editing appears only expanded, and long press owns a non-Button gesture row', () => {
  const runner = hooks(), calls = [], actions = { qrBatch: null, alert: null, canEdit: () => true, edit: row => calls.push(['edit', row.id]), showQr: row => calls.push(['qr', row.id]) };
  const { BatchCard } = load('components/DailyWorkScreen.ios.tsx', {
    react: runner.react, '@expo/ui/swift-ui': iosUi, '@expo/ui/swift-ui/modifiers': modifiers, 'expo-router': { Stack: { Screen: 'Screen' } },
    'react-native': { PlatformColor: name => name, StyleSheet: { create: x => x }, View: 'View' }, '../dailyWork': model, '../dailyWorkPresentation': presentation,
    './useDailyWork': {}, './useDailyWorkActions': {}, './DailyWorkDialogs': {}, './WorkerFormDialog': {}, './useWorkerOrderText': { useWorkerOrderText: () => ({ p, t: p }) },
  }, '\nexport { BatchCard };');
  const render = () => { runner.begin(); const tree = BatchCard({ batch: batch(), index: 0, names: { 'apparatus:default:cut': 'Kesish' }, assigned: ['apparatus:default:cut'], showWorker: false, actions }); runner.flush(); return tree; };
  let tree = render();
  assert.equal(modifier(tree, 'background'), 'tertiarySystemGroupedBackground');
  assert.equal(modifier(tree, 'cornerRadius'), 16);
  const compact = nodes(tree, node => node.type?.name === 'CompactValue');
  assert.deepEqual(compact.map(node => [node.props.label, node.props.value]), [['worker.wip.info.qr', 'QR'], ['worker.daily.field.length', '123.46 m']]);
  assert.equal(find(tree, node => node.type === 'HStack' && compact.every(value => node.props.children?.includes?.(value)))?.props.alignment, 'top');
  assert.equal(find(tree, node => node.type === 'Button'), undefined);
  const owner = find(tree, node => node.props?.modifiers?.some(mod => mod.name === 'onLongPressGesture'));
  assert.equal(owner.type, 'VStack');
  assert.equal(modifier(owner, 'frame').maxWidth, Infinity);
  assert.deepEqual(modifier(owner, 'padding'), { all: 12 });
  const tap = owner.props.modifiers.find(mod => mod.name === 'onTapGesture').args[0];
  owner.props.modifiers.find(mod => mod.name === 'onLongPressGesture').args[0](); tap(); tree = render();
  assert.deepEqual(calls, [['qr', 'b']]); assert.equal(find(tree, node => node.type === 'Button'), undefined);
  tap(); tree = render();
  const edit = find(tree, node => node.type === 'Button' && node.props.label === 'worker.daily.edit_wip');
  assert.ok(edit); edit.props.onPress(); assert.deepEqual(calls.at(-1), ['edit', 'b']);
  assert.equal(modifier(edit, 'buttonStyle'), 'bordered'); assert.equal(modifier(edit, 'controlSize'), 'large');
  assert.equal(modifier(edit, 'labelStyle'), 'titleAndIcon');
  assert.equal(modifier(edit, 'frame').minHeight, 44);
  const expandedOwner = find(tree, node => modifier(node, 'onLongPressGesture'));
  assert.equal(find(expandedOwner, node => node === edit), undefined, 'edit must not compete with the enclosing tap/long-press gesture');
  assert.ok(find(tree, node => node.props?.children === 'worker.wip.info.source'));
  assert.equal(find(tree, node => node.type === 'WorkerOrderSheet'), undefined);
  runner.dispose();
});

test('iOS order expansion reveals individually keyed WIP cards without native DisclosureGroup indentation', () => {
  const runner = hooks(), row = batch(), other = batch({ batch_id: 'other', qr_payload: 'OTHER' });
  const { BatchGroup } = load('components/DailyWorkScreen.ios.tsx', {
    react: runner.react, '@expo/ui/swift-ui': iosUi, '@expo/ui/swift-ui/modifiers': modifiers, 'expo-router': { Stack: { Screen: 'Screen' } },
    'react-native': { PlatformColor: name => name, StyleSheet: { create: x => x }, View: 'View' }, '../dailyWork': model, '../dailyWorkPresentation': presentation,
    './useDailyWork': {}, './useDailyWorkActions': {}, './DailyWorkDialogs': {}, './WorkerFormDialog': {}, './useWorkerOrderText': { useWorkerOrderText: () => ({ p, t: p }) },
  }, '\nexport { BatchGroup };');
  const props = { group: { key: 'order:o', orderId: 'o', title: 'Film', batches: [row, other] }, names: {}, assigned: [], showWorker: false, actions: {} };
  const render = () => { runner.begin(); const tree = BatchGroup(props); runner.flush(); return tree; };
  let tree = render();
  assert.equal(modifier(tree, 'strokeBorder').style.lineWidth, 1);
  assert.equal(modifier(tree, 'listRowInsets').leading, 0);
  assert.equal(find(tree, node => node.type?.name === 'BatchCard'), undefined);
  assert.ok(find(tree, node => node.props.systemName === 'chevron.down'));
  find(tree, node => node.type === 'Button').props.onPress(); tree = render();
  assert.ok(find(tree, node => node.props.systemName === 'chevron.up'));
  const children = nodes(tree, node => node.type?.name === 'BatchCard');
  assert.deepEqual(children.map(node => node.props.batch.id), ['b', 'other']);
  assert.equal(new Set(children.map(node => node.key)).size, 2);
  find(tree, node => node.type === 'Button').props.onPress(); tree = render();
  assert.equal(find(tree, node => node.type?.name === 'BatchCard'), undefined);
  runner.dispose();
});

test('Android daily WIP tap expands and collapses inside the list without an extra dialog', () => {
  const runner = hooks(), row = batch(), calls = [];
  const group = { key: 'order:o', orderId: 'o', title: 'Film', batches: [row] };
  const modelValue = { day: new Date(), setDay() {}, batches: [row], apparatusNames: {}, groups: [group], totals: { orders: 1, wips: 1, used: 0 }, error: '', refreshing: false, refresh() {} };
  const { DailyWorkScreen } = load('components/DailyWorkScreen.tsx', {
    react: runner.react, 'react-native': { StyleSheet: { create: x => x }, Platform: { OS: 'android' }, BackHandler: { addEventListener: () => ({ remove() {} }) }, ActivityIndicator: 'Spinner', Pressable: 'Pressable', RefreshControl: 'Refresh', ScrollView: 'ScrollView', Text: 'Text', View: 'View' },
    '@expo/ui/community/datetime-picker': { DateTimePicker: 'DatePicker' }, '../dailyWork': model, '../dailyWorkPresentation': presentation,
    './useDailyWork': { useDailyWork: () => modelValue }, './useDailyWorkActions': { useDailyWorkActions: () => ({ showQr: value => calls.push(['qr', value.id]), canEdit: () => true, edit: value => calls.push(['edit', value.id]) }) },
    './DailyWorkDialogs': { DailyWorkDialogs: 'Dialogs' }, './WorkerIconButton': { WorkerIconButton: 'IconButton' }, './useWorkerColors': { useWorkerColors: () => ({}) }, './useWorkerOrderText': { useWorkerOrderText: () => ({ p, t: p }) },
  });
  const render = () => { runner.begin(); const tree = DailyWorkScreen({ session: { profile: { role: 'aparatchi' }, assigned_apparatus: [] }, onBack() {} }); runner.flush(); return tree; };
  let tree = render(); find(tree, node => node.type === 'Pressable' && node.props.accessibilityState?.expanded === false).props.onPress(); tree = render();
  let card = find(tree, node => node.type === 'Pressable' && node.props.onLongPress);
  assert.equal(find(card, node => node.type === 'IconButton'), undefined);
  card.props.onPress(); tree = render(); card = find(tree, node => node.type === 'Pressable' && node.props.onLongPress);
  assert.ok(find(card, node => node.type === 'IconButton'));
  card.props.onLongPress(); assert.deepEqual(calls, [['qr', 'b']]);
  card.props.onPress(); tree = render();
  assert.equal(find(tree, node => node.type === 'IconButton'), undefined);
  runner.dispose();
});

test('iOS scanned-WIP close requests native dismissal before releasing its parent', () => {
  const calls = [];
  const { CloseHistory } = load('components/WorkerScannedWipHistory.ios.tsx', {
    react: { useContext: () => () => calls.push('native-close') },
    '@expo/ui/swift-ui': { Button: 'Button' }, '@expo/ui/swift-ui/modifiers': modifiers,
    'react-native': { View: 'View' }, './BaseHost': {}, './WorkerAlert': {}, './WorkerOrderSheet': {}, './useWorkerScannedWips': {}, './workerSheetContext': { WorkerSheetCloseContext: {} },
  }, '\nexport { CloseHistory };');
  const tree = CloseHistory({ onClose: () => calls.push('parent-unmount'), writing: false, label: 'Close' });
  tree.props.onPress(); assert.deepEqual(calls, ['native-close']);
  assert.equal(tree.props.modifiers.find(mod => mod.name === 'disabled').args[0], false);
});

test('daily QR presentations haptic once per accepted open, serialize rapid opens and defer editing until native dismissal', async () => {
  const runner = hooks(), row = batch({ revision: 2 }), other = batch({ batch_id: 'other', qr_payload: 'OTHER', revision: 2 });
  const haptics = [];
  const correction = load('dailyWorkCorrection.ts'), sheets = load('workerSheetPresentation.ts');
  const modelValue = { current: () => true, batches: [row, other], catalog: [], replaceBatch() {}, refresh() {} };
  const { useDailyWorkActions } = load('components/useDailyWorkActions.ts', {
    react: runner.react, '../auth': { subscribeSessionWitness: () => () => {} }, '../dailyWork': model,
    '../dailyWorkCorrection': correction, '../productionProgressCorrectionApi': {}, '../workerSheetPresentation': sheets,
    'expo-haptics': { ImpactFeedbackStyle: { Medium: 'medium' }, impactAsync: style => { haptics.push(style); return Promise.reject(new Error('unavailable')); } },
    './useWorkerOrderText': { useWorkerOrderText: () => ({ p }) },
  });
  const session = { profile: { role: 'aparatchi', ref: 'worker' } };
  const render = () => { runner.begin(); const value = useDailyWorkActions(session, modelValue); runner.flush(); return value; };
  let actions = render();
  actions.showQr(batch({ qr_payload: '' })); actions = render();
  assert.ok(actions.alert); assert.deepEqual(haptics, []);
  actions.dismissAlert(); actions = render();
  actions.showQr(row); actions.showQr(other); actions = render();
  assert.equal(actions.qrBatch.id, row.id);
  assert.deepEqual(haptics, ['medium']);
  const firstClose = actions.qrClosed, firstQueueEdit = actions.queueEdit, firstKey = actions.qrPresentationId;
  // The sheet remains selected while the native dismissal animation is running.
  actions.showQr(other); actions = render(); assert.equal(actions.qrPresentationId, firstKey);
  assert.equal(haptics.length, 1);
  firstClose(); actions = render(); assert.equal(actions.qrBatch, null);
  actions.showQr(other); actions = render();
  assert.notEqual(actions.qrPresentationId, firstKey);
  firstClose(); firstQueueEdit(row); actions = render();
  assert.equal(actions.qrBatch.id, other.id); assert.equal(actions.state.edit, null);
  actions.queueEdit(other); actions = render(); assert.equal(actions.state.edit, null);
  actions.qrClosed(); actions = render();
  assert.equal(actions.qrBatch, null); assert.equal(actions.state.edit.batch.id, other.id);
  actions.showQr(row); assert.deepEqual(haptics, ['medium', 'medium']);
  await new Promise(setImmediate); // An unsupported haptics engine must not reject or block presentation.
  runner.dispose();
});

test('daily QR sheet retains source detail order without generic history fields', () => {
  const row = batch({ description: 'note', next_apparatus: 'next', current_location: 'location' });
  const rows = presentation.dailyWorkQrRows(row, {}, p);
  assert.deepEqual(rows.map(([label]) => label), ['worker.daily.order', 'worker.wip.info.qr', 'worker.daily.field.length', 'worker.daily.field.weight', 'worker.daily.field.roll', 'worker.daily.field.diameter', 'worker.daily.status', 'worker.wip.info.source', 'worker.wip.info.location']);
  const { DailyWorkDialogs } = load('components/DailyWorkDialogs.tsx', {
    react: { useEffect() {} }, './WorkerPaddonFeedback': { WorkerPaddonFeedback: 'Feedback' },
    'react-native': { Text: 'Text' }, './WorkerFormDialog': { WorkerFormDialog: 'Form' }, './DailyWorkCorrectionFields': {}, './WorkerOrderSheet': { WorkerOrderSheet: 'Sheet' },
    './WorkerWipBatchDetails': { WorkerWipBatchDetails: 'Details' }, './WorkerAlert': { WorkerAlert: 'Alert' }, './useWorkerColors': { useWorkerColors: () => ({}) },
    './useWorkerOrderText': { useWorkerOrderText: () => ({ p, t: p }) }, '../dailyWorkPresentation': presentation,
  });
  const tree = DailyWorkDialogs({ session: { assigned_apparatus: [] }, model: { apparatusNames: {} }, actions: { controller: {}, state: {}, qrBatch: row, qrPresentationId: 8, canEdit: () => false } });
  const sheet = find(tree, node => node.type === 'Sheet');
  assert.equal(sheet.key, 8);
  const details = find(tree, node => node.type === 'Details');
  assert.equal(details.props.title, 'worker.daily.wip_qr'); assert.equal(details.props.itemName, 'Film yarim tayyor mahsulot');
  assert.deepEqual(details.props.detailRows, rows);
});

test('WIP QR close is blocked from the first printing event until the print settles', async () => {
  const runner = hooks(), calls = [];
  runner.react.useContext = () => () => calls.push('native-close');
  let finish; const pending = new Promise(resolve => { finish = resolve; });
  const qrFactory = () => ({ addData() {}, make() {}, createDataURL: () => 'qr-image' });
  const { WorkerWipBatchDetails } = load('components/WorkerWipBatchDetails.tsx', {
    react: runner.react, '@expo/ui': { Button: 'Button', Column: 'Column', Host: 'Host', ListItem: 'ListItem' }, 'expo-image': { Image: 'Image' },
    'qrcode-generator': { __esModule: true, default: qrFactory }, 'react-native': { ScrollView: 'ScrollView', StyleSheet: { create: x => x }, Text: 'Text', View: 'View' },
    '../auth': { activeSessionToken: () => 'token' }, '../sessionReadScope': { sessionReadScope: () => 'scope' },
    '../workerPrinting': { reprintWorkerWip: () => pending, WorkerPrintCancelled: class extends Error {} },
    '../workerWipDetailsPresentation': { workerWipDetailsItemName: () => 'WIP' },
    '../workerWip': { wipText: value => typeof value === 'string' ? value.trim() : '', wipBatchWeights: () => ({ gross: null, net: null, bobina: null }) },
    './useWorkerColors': { useWorkerColors: () => ({}) }, './useWorkerPrinterSelector': { useWorkerPrinterSelector: () => ({ dialogs: null }) },
    './WorkerWipBatchDetailsView': { WorkerWipBatchDetailsView: 'WipView' },
    './WorkerPaddonFeedback': { WorkerPaddonFeedback: 'Feedback' },
    './workerSheetContext': { WorkerSheetCloseContext: {} }, './useWorkerOrderText': { useWorkerOrderText: () => ({ p, t: p }) },
  });
  const render = () => { runner.begin(); const tree = WorkerWipBatchDetails({ session: {}, order: {}, batch: { batch_id: 'b', qr_payload: 'QR' }, apparatusNames: {}, onClose() {}, allowReprint: true, detailRows: [], title: 'QR' }); runner.flush(); return tree; };
  let tree = render();
  const close = find(tree, node => node.type === 'WipView').props.onClose;
  find(tree, node => node.type === 'WipView').props.onReprint();
  close(); assert.deepEqual(calls, []);
  tree = render(); assert.equal(find(tree, node => node.type === 'WipView').props.busy, true);
  finish(); await new Promise(setImmediate); tree = render();
  assert.equal(find(tree, node => node.type === 'Feedback').props.message, 'worker.daily.wip_qr.reprinted');
  find(tree, node => node.type === 'WipView').props.onClose(); assert.deepEqual(calls, ['native-close']);
  runner.dispose();
});

test('iOS WIP QR uses aligned label/value rows in a native scroll, with large visible edit and reprint controls', () => {
  const { WorkerWipBatchDetailsView } = load('components/WorkerWipBatchDetailsView.ios.tsx', {
    '@expo/ui/swift-ui': iosUi, '@expo/ui/swift-ui/modifiers': modifiers, 'expo-image': { Image: 'QrImage' },
    'react-native': { Platform: { Version: '26.1.1' }, PlatformColor: name => name }, './BaseHost': { BaseHost: 'Host' },
  });
  const calls = [], rows = [['Order', 'zakaz-0304'], ['QR:', '400118E6EF86AD68FBA09EF6'], ['Metraj', '8000 m'],
    ['Og‘irlik', '12 kg'], ['Boshlangan', '11.11.2026 13:13'], ['Qayerdan chiqdi', '8 ta rangli bosma apparat']];
  const props = { title: 'WIP QR', itemName: 'keks yarim tayyor mahsulot', payload: rows[1][1], qrImage: 'qr', rows,
    editLabel: 'WIPni o‘zgartirish', closeLabel: 'Yopish', reprintLabel: 'Qayta chop etish', canReprint: true, busy: false, message: '',
    onEdit: () => calls.push('edit'), onClose: () => calls.push('close'), onReprint: () => calls.push('reprint') };
  const tree = WorkerWipBatchDetailsView(props), scroll = find(tree, node => node.type === 'ScrollView');
  assert.ok(scroll); assert.equal(find(tree, node => node.type === 'ListItem'), undefined);
  const table = find(scroll, node => modifier(node, 'accessibilityIdentifier') === 'worker-wip-qr-details');
  assert.equal(table.props.children.length, rows.length);
  table.props.children.forEach((row, index) => {
    assert.equal(row.type, 'HStack'); assert.equal(row.props.alignment, 'top');
    assert.deepEqual(row.props.children.map(node => node.props.children), rows[index]);
    assert.equal(modifier(row.props.children[0], 'frame').width, 88);
    assert.equal(modifier(row.props.children[1], 'frame').maxWidth, Infinity);
    for (const node of row.props.children) assert.equal(modifier(node, 'fixedSize').vertical, true);
  });
  const qr = find(scroll, node => node.type === 'QrImage');
  assert.equal(qr.props.style.width, 240); assert.equal(qr.props.style.height, 240);
  assert.equal(qr.props.style.backgroundColor, '#fff');
  assert.equal(modifier(find(scroll, node => node.type === 'Text' && node.props.children === props.payload), 'textSelection'), true);
  for (const id of ['edit', 'close', 'reprint']) {
    const button = find(tree, node => modifier(node, 'accessibilityIdentifier') === `worker-wip-qr-${id}`);
    assert.equal(modifier(button, 'controlSize'), 'large'); assert.equal(modifier(button, 'disabled'), false);
    assert.notEqual(modifier(button, 'buttonStyle'), 'plain');
    if (id !== 'reprint') assert.deepEqual(modifier(button, 'frame'), { width: 44, height: 44 });
    button.props.onPress();
  }
  assert.deepEqual(calls, ['edit', 'close', 'reprint']);
  const locked = WorkerWipBatchDetailsView({ ...props, busy: true });
  assert.equal(nodes(locked, node => node.type === 'Button').every(button => modifier(button, 'disabled') === true), true);
  const restricted = WorkerWipBatchDetailsView({ ...props, onEdit: undefined, canReprint: false });
  assert.equal(find(restricted, node => modifier(node, 'accessibilityIdentifier') === 'worker-wip-qr-edit'), undefined);
  assert.equal(find(restricted, node => modifier(node, 'accessibilityIdentifier') === 'worker-wip-qr-reprint'), undefined);
});

test('native daily correction fields retain prefilled values, units, callbacks and the revisioned save/reason flow', async () => {
  const { DailyWorkCorrectionController } = load('dailyWorkCorrection.ts');
  const row = batch({ revision: 7 }), saves = [];
  const controller = new DailyWorkCorrectionController({ current: () => true, canEdit: () => true, latest: () => row, operation: () => 'print',
    save: async input => { saves.push(input); return row.source; }, replace() {}, reconcile() {} });
  controller.open(row);
  const { DailyWorkCorrectionFields } = load('components/DailyWorkCorrectionFields.ios.tsx', {
    '@expo/ui/swift-ui': iosUi, '@expo/ui/swift-ui/modifiers': modifiers, react: {}, 'react-native': { PlatformColor: name => name },
    'react-native-worklets': {},
    './BaseHost': { BaseHost: 'Host' }, './useWorkerOrderText': { useWorkerOrderText: () => ({ p }) },
  });
  const render = () => DailyWorkCorrectionFields({ edit: controller.getSnapshot().edit, controller });
  const fields = nodes(render(), node => node.type?.name === 'CorrectionField');
  assert.deepEqual(fields.map(field => [field.props.label, field.props.value, !!field.props.decimal]), [
    ['worker.daily.field.length (m)', '123.4567', true], ['worker.daily.field.weight (kg)', '4.5678', true],
    ['worker.daily.field.roll (kg)', '1', true], ['worker.daily.field.note', '', false],
  ]);
  for (const [index, value] of ['8000', '12', '2', 'checked'].entries()) fields[index].props.change(value);
  controller.next(); assert.equal(controller.getSnapshot().edit.step, 'reason');
  const reason = find(render(), node => node.type?.name === 'CorrectionField');
  assert.equal(reason.props.label, 'worker.daily.correction.hint'); reason.props.change('Correct measurement');
  await controller.confirm();
  assert.equal(saves.length, 1);
  assert.deepEqual([saves[0].expected_revision, saves[0].produced_qty, saves[0].finished_goods_kg, saves[0].bobina_kg,
    saves[0].description, saves[0].reason], [7, 8000, 12, 2, 'checked', 'Correct measurement']);
});

test('native correction fields stay full width, focus at the end and never replay delayed JS text over typing or deletion', async () => {
  const runner = hooks(), changes = [], queued = [], positions = [];
  const useNativeState = initial => runner.react.useMemo(() => {
    let current = initial;
    const state = { get: () => current, set: value => { current = value; } };
    Object.defineProperty(state, 'value', { get: () => current, set: value => { current = value; } });
    return state;
  }, []);
  const { CorrectionField } = load('components/DailyWorkCorrectionFields.ios.tsx', {
    '@expo/ui/swift-ui': { ...iosUi, useNativeState }, '@expo/ui/swift-ui/modifiers': modifiers, react: runner.react,
    'react-native-worklets': { scheduleOnRN: (fn, ...args) => queued.push(() => fn(...args)) },
    'react-native': { PlatformColor: name => name }, './BaseHost': {}, './useWorkerOrderText': {},
  }, '\nexport { CorrectionField };');
  let props = { label: 'Metraj (m)', value: '8000', decimal: true, change: value => changes.push(value) };
  const render = () => { runner.begin(); const tree = CorrectionField(props); runner.flush(); return tree; };
  let tree = render(), input = find(tree, node => node.type === 'TextField');
  assert.equal(input.props.text.get(), '8000');
  assert.equal(tree.type, 'VStack');
  assert.equal(modifier(input, 'frame').minHeight, 48);
  assert.equal(modifier(input, 'frame').maxWidth, Infinity);
  assert.equal(modifier(input, 'multilineTextAlignment'), 'leading');
  assert.equal(modifier(input, 'textFieldStyle'), 'plain'); assert.equal(modifier(input, 'keyboardType'), 'decimal-pad');
  assert.equal(modifier(input, 'accessibilityLabel'), props.label);
  input.props.ref.current = { setSelection: async (...args) => positions.push(args) };
  input.props.onFocusChange(true); assert.deepEqual(positions, [[4, 4]]);
  for (const value of ['800', '80', '8', '']) {
    input.props.text.set(value); input.props.onTextChange(value);
    tree = render(); input = find(tree, node => node.type === 'TextField');
    assert.equal(input.props.text.get(), value, 'an older parent value must not restore deleted digits');
  }
  assert.deepEqual(changes, []);
  while (queued.length) queued.shift()();
  assert.deepEqual(changes, ['800', '80', '8', '']);
  props = { ...props, value: '80' }; tree = render(); input = find(tree, node => node.type === 'TextField');
  assert.equal(input.props.text.get(), '', 'a late React update must not undo a later native deletion');
  input.props.text.set('1a2,5'); input.props.onTextChange('1a2,5');
  assert.equal(input.props.text.get(), '12,5');
  assert.deepEqual(input.props.selection.get(), { start: 4, end: 4 });
  queued.shift()(); assert.equal(changes.at(-1), '12,5');
  assert.deepEqual(positions, [[4, 4]], 'typing and parent renders must not force the cursor position again');
  input.props.onFocusChange(false); input.props.onFocusChange(true);
  await new Promise(setImmediate); assert.deepEqual(positions.at(-1), [4, 4]);
  props = { ...props, decimal: false }; tree = render(); input = find(tree, node => node.type === 'TextField');
  assert.equal(input.props.axis, 'vertical'); assert.equal(modifier(input, 'keyboardType'), undefined);
  input.props.text.set('New\nnote'); input.props.onTextChange('New\nnote'); queued.shift()();
  assert.equal(changes.at(-1), 'New\nnote');
  props = { ...props, saving: true }; tree = render();
  assert.equal(modifier(find(tree, node => node.type === 'TextField'), 'disabled'), true);
  runner.dispose();
});

test('iOS daily date changes remain a bounded draft until Select and Cancel keeps the original day', () => {
  const runner = hooks(), changes = [], initial = new Date(2025, 3, 9, 12), next = new Date(2025, 4, 10, 15);
  const ui = Object.fromEntries(['Button','DatePicker','DisclosureGroup','Host','HStack','Image','List','NavigationStack','ProgressView','Section','Text','Toolbar','ToolbarItem','VStack'].map(x => [x,x]));
  const { DailyWorkScreen } = load('components/DailyWorkScreen.ios.tsx', {
    react: runner.react, '@expo/ui/swift-ui': ui, '@expo/ui/swift-ui/modifiers': modifiers, 'expo-router': { Stack: { Screen: 'Screen' } },
    'react-native': { StyleSheet: { create: x => x }, View: 'View' }, '../dailyWork': model, '../dailyWorkPresentation': presentation,
    './useDailyWork': { useDailyWork: () => ({ day: initial, setDay: day => changes.push(day), batches: [], apparatusNames: {}, groups: [], totals: { orders: 0, wips: 0, used: 0 }, error: '', refresh() {} }) },
    './useDailyWorkActions': { useDailyWorkActions: () => ({}) }, './DailyWorkDialogs': { DailyWorkDialogs: 'Dialogs' }, './WorkerFormDialog': { WorkerFormDialog: 'DateDialog' },
    './useWorkerOrderText': { useWorkerOrderText: () => ({ p, t: p }) },
  });
  const render = () => { runner.begin(); const tree = DailyWorkScreen({ session: { profile: {}, assigned_apparatus: [] }, onBack() {} }); runner.flush(); return tree; };
  let tree = render();
  const open = () => find(tree, node => node.type === 'Button' && node.props.systemImage === 'calendar').props.onPress();
  open(); tree = render(); let picker = find(tree, node => node.type === 'DatePicker');
  assert.equal(picker.props.range.start.getFullYear(), 2020);
  picker.props.onDateChange(next); tree = render(); assert.deepEqual(changes, []);
  let dialog = find(tree, node => node.type === 'DateDialog');
  assert.equal(dialog.props.title, 'worker.daily.choose_date.title'); assert.equal(dialog.props.confirmLabel, 'worker.action.select'); assert.equal(dialog.props.cancelLabel, 'worker.action.cancel');
  dialog.props.onCancel(); tree = render(); assert.deepEqual(changes, []);
  open(); tree = render(); picker = find(tree, node => node.type === 'DatePicker');
  assert.equal(picker.props.selection.getTime(), new Date(2025, 3, 9).getTime());
  picker.props.onDateChange(next); tree = render(); find(tree, node => node.type === 'DateDialog').props.onConfirm();
  assert.equal(changes.length, 1); assert.equal(changes[0].getTime(), new Date(2025, 4, 10).getTime());
  assert.equal(presentation.dailyWorkDateDraft(new Date(2040, 0, 1), new Date(2026, 10, 11)).getTime(), new Date(2026, 10, 11).getTime());
  assert.equal(presentation.dailyWorkDateDraft(new Date(1990, 0, 1), new Date(2026, 10, 11)).getTime(), new Date(2020, 0, 1).getTime());
  runner.dispose();
});
