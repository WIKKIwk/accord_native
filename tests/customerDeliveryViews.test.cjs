const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const { loadCustomerStates } = require('./support/customerNativeStates.cjs');
const jsx = { Fragment: 'Fragment', jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
function nodes(node, pred) { if (!node || typeof node !== 'object') return []; if (Array.isArray(node)) return node.flatMap(n => nodes(n, pred));
  return [...(pred(node) ? [node] : []), ...nodes(node.props?.children, pred)]; }
function load(file, mocks = {}) {
  const filename = path.resolve(__dirname, '../src/customer', file), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths; mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, filename);
  return mod.exports;
}
const logic = load('customerLogic.ts'), view = load('customerDeliveryView.ts');
const record = { id: 'dn', supplier_name: 'Customer', item_code: 'P1', item_name: 'Product', sent_qty: 10, accepted_qty: 3,
  uom: 'kg', note: ' a note ', status: 'partial' };
function fixture(platform, state, stateValues = [false, null], text = key => key) {
  let index = 0; const updates = [], focus = [];
  const mocks = { 'react/jsx-runtime': jsx, react: { useCallback: fn => fn, useRef: value => ({ current: value }),
    useState: () => { const i = index++; return [stateValues[i], value => updates.push([i, value])]; } },
    'expo-router': { useFocusEffect: fn => focus.push(fn) }, '@expo/ui': { ListItem: 'ListItem', Text: 'Text', Button: 'Button', Host: 'Host' },
    '@expo/ui/swift-ui': { Button: 'Button', Host: 'Host', List: 'List', ProgressView: 'ProgressView', Section: 'Section', VStack: 'VStack' },
    '@expo/ui/swift-ui/modifiers': { disabled: value => ['disabled', value], listStyle: value => ['listStyle', value], refreshable: fn => ['refreshable', fn],
      background: (color, shape) => ['background', color, shape], fixedSize: value => ['fixedSize', value], font: value => ['font', value],
      foregroundStyle: value => ['foregroundStyle', value], frame: value => ['frame', value], lineLimit: value => ['lineLimit', value],
      padding: value => ['padding', value], shapes: { roundedRectangle: value => ['roundedRectangle', value] } },
    '@expo/ui/jetpack-compose': { useMaterialColors: () => ({ onSurface: 'fg', onSurfaceVariant: 'muted', surfaceContainerLow: 'bg',
      secondaryContainer: 'status-bg', onSecondaryContainer: 'status-fg' }) },
    'react-native': { ActivityIndicator: 'ActivityIndicator', RefreshControl: 'RefreshControl', ScrollView: 'ScrollView', Text: 'Text', View: 'View', PlatformColor: value => value },
    '../components/WorkerAlert': { WorkerAlert: 'WorkerAlert' }, '../components/WorkerQueueCard.android': { WorkerQueueCard: 'WorkerQueueCard' },
    './CustomerContext': { useCustomerText: () => ({ text }) }, './CustomerStates': loadCustomerStates(platform, { text }),
    './customerLogic': logic, './customerDeliveryView': view,
    './CustomerReturnDialog': { CustomerReturnDialog: 'CustomerReturnDialog' }, './CustomerSnackbar': { CustomerSnackbar: 'CustomerSnackbar' },
    './useCustomerScreens': { useCustomerDelivery: () => state } };
  return { ...load(`CustomerDelivery.${platform}.tsx`, mocks), updates, focus };
}
function state(calls, extra = {}) { return { loading: false, error: null, detail: { record, canApprove: true, canReject: true,
  canPartiallyAccept: true, canReportClaim: true }, submitting: false, message: '', clearMessage() {}, reload: async () => calls.push('reload'),
  send: async reply => calls.push(reply), ...extra }; }

test('both detail views preserve action order, discussion ID and reload on return', async () => {
  for (const platform of ['ios', 'android']) {
    const calls = [], f = fixture(platform, state(calls)), screen = f.CustomerDeliveryDetailScreen({ deliveryNoteID: ' DN ', onChanged() {},
      onOpenDiscussion: id => calls.push(id) });
    const buttons = nodes(screen, n => n.type === 'Button');
    assert.deepEqual(buttons.map(b => b.props.label), ['openDiscussionAction', 'approveAction', 'partialAcceptAction', 'rejectAction', 'reportIssueAction']);
    buttons[0].props.onPress(); assert.equal(calls[0], 'customer_delivery_result:DN');
    f.focus[0](); await Promise.resolve(); assert.equal(calls[1], 'reload');
    buttons[1].props.onPress(); assert.deepEqual(f.updates.at(-1), [0, true]);
    buttons[2].props.onPress(); assert.deepEqual(f.updates.at(-1), [1, 'partial']);
  }
});
test('confirm and return actions send the V2 request parameters', async () => {
  for (const platform of ['ios', 'android']) {
    const calls = [], approved = fixture(platform, state(calls), [true, null]).CustomerDeliveryDetailScreen({ deliveryNoteID: 'dn', onChanged() {} });
    const alert = nodes(approved, n => n.type === 'WorkerAlert')[0].props.alert;
    assert.deepEqual([alert.title, alert.message, alert.cancelLabel, alert.confirmLabel], ['confirmTitle', 'confirmQuestion', 'no', 'yes']);
    alert.onConfirm(); await Promise.resolve(); assert.deepEqual(calls[0], { deliveryNoteID: 'dn', approve: true, mode: 'acceptAll' });
    for (const kind of ['partial', 'reject', 'claim']) {
      const f = fixture(platform, state(calls), [false, kind]), screen = f.CustomerDeliveryDetailScreen({ deliveryNoteID: 'dn', onChanged() {} });
      nodes(screen, n => n.type === 'CustomerReturnDialog')[0].props.onConfirm({ returnedQty: 2, reason: 'reason', comment: 'c' });
      await Promise.resolve();
      const expected = kind === 'partial' ? { deliveryNoteID: 'dn', mode: 'acceptPartial', acceptedQty: 8, returnedQty: 2, reason: 'reason', comment: 'c' }
        : kind === 'reject' ? { deliveryNoteID: 'dn', approve: false, mode: 'rejectAll', returnedQty: 10, reason: 'reason', comment: 'c' }
          : { deliveryNoteID: 'dn', mode: 'claimAfterAccept', returnedQty: 2, reason: 'reason', comment: 'c' };
      assert.deepEqual(calls.at(-1), expected); assert.deepEqual(f.updates.at(-1), [1, null]);
    }
  }
});
test('permission flags control response buttons and submission disables them without blocking discussion', () => {
  for (const platform of ['ios', 'android']) {
    const calls = [], busy = state(calls, { submitting: true, detail: { record, canApprove: true, canReject: false, canPartiallyAccept: true, canReportClaim: false } });
    const screen = fixture(platform, busy).CustomerDeliveryDetailScreen({ deliveryNoteID: 'dn', onChanged() {}, onOpenDiscussion() {} });
    const buttons = nodes(screen, n => n.type === 'Button'); assert.deepEqual(buttons.map(b => b.props.label), ['openDiscussionAction', 'sending', 'partialAcceptAction']);
    if (platform === 'ios') {
      assert.equal(buttons[0].props.modifiers, undefined);
      assert.deepEqual(buttons[1].props.modifiers, [['disabled', true]]);
    } else { assert.equal(buttons[0].props.disabled, undefined); assert.equal(buttons[1].props.disabled, true); }
    const unconnected = fixture(platform, busy).CustomerDeliveryDetailScreen({ deliveryNoteID: 'dn', onChanged() {} });
    assert.equal(nodes(unconnected, n => n.type === 'Button' && n.props.label === 'openDiscussionAction').length, 0);
  }
});
test('loading and retry states use the existing V2 texts', () => {
  for (const platform of ['ios', 'android']) {
    const calls = [], loading = fixture(platform, state(calls, { loading: true })).CustomerDeliveryDetailScreen({ deliveryNoteID: 'dn', onChanged() {} });
    assert.equal(loading.type.name, 'CustomerLoadingState');
    assert.ok(nodes(loading.type(loading.props), n => n.type === (platform === 'ios' ? 'ProgressView' : 'LoadingIndicator')).length);
    const failed = fixture(platform, state(calls, { error: Error('offline'), detail: null })).CustomerDeliveryDetailScreen({ deliveryNoteID: 'dn', onChanged() {} });
    assert.equal(failed.type.name, 'CustomerRetryState');
    const retryView = failed.type(failed.props);
    assert.ok(nodes(retryView, n => n.type === 'Text' && n.props.children === 'serverDisconnectedRetry').length);
    if (platform === 'ios') nodes(retryView, n => n.type === 'Button' && n.props.label === 'retry')[0].props.onPress();
    else nodes(retryView, n => n.type === 'TextButton')[0].props.onClick();
    assert.equal(calls.at(-1), 'reload');
  }
});

// Source-derived: customer_delivery_detail_screen.dart and _DetailLine in widgets_part_01.dart.
test('read-only delivery rows preserve field order, quantity precision and accepted quantity visibility', () => {
  const text = key => `localized:${key}`;
  const expected = [
    ['customerLabel', 'Customer'], ['itemLabel', 'P1 • Product'], ['pendingStatus', '10.00 kg'],
    ['acceptedFromQtyPrefix', '3.00 kg'], ['statusLabel', 'localized:partiallyCompleted'],
  ];
  assert.deepEqual(view.customerDeliveryInfoRows(record, text).map(row => [row.labelKey, row.value]), expected);
  for (const accepted_qty of [0, -1]) {
    const rows = view.customerDeliveryInfoRows({ ...record, sent_qty: 1.125, accepted_qty }, text);
    assert.deepEqual(rows.map(row => row.labelKey), ['customerLabel', 'itemLabel', 'pendingStatus', 'statusLabel']);
    assert.equal(rows[2].value, '1.13 kg');
  }
  assert.equal(view.customerDeliveryInfoRows({ ...record, accepted_qty: 0.001 }, text)[3].value, '0.00 kg');
  for (const [status, key] of [['accepted', 'approvedLabel'], ['partial', 'partiallyCompleted'], ['rejected', 'rejectedStatusLabel'],
    ['pending', 'pendingLabel'], ['draft', 'pendingLabel'], ['cancelled', 'pendingLabel']]) {
    assert.equal(view.customerDeliveryInfoRows({ ...record, status }, text).at(-1).value, `localized:${key}`);
  }
});

test('delivery status highlight preserves V2 exact localized label comparison', () => {
  for (const [label, highlighted] of [['Status', true], ['Статус', false], ['حیثیت', false], ['status', false], [' Status ', false]]) {
    const rows = view.customerDeliveryInfoRows(record, key => key === 'statusLabel' ? label : key);
    assert.equal(rows.at(-1).highlighted, highlighted);
    assert.equal(rows.at(-1).label, label);
    assert.equal(rows.slice(0, -1).some(row => row.highlighted), false);
  }
});

test('both platforms render full shipment facts as read-only stacked text, with the V2 Status highlight', () => {
  const labels = { shipmentInfoTitle: 'Jo‘natma ma’lumoti', customerLabel: 'Haridor', itemLabel: 'Mahsulot', pendingStatus: 'Jarayonda',
    acceptedFromQtyPrefix: 'Qabul', statusLabel: 'Status', partiallyCompleted: 'Qisman yakunlangan' };
  const text = key => labels[key] ?? key;
  const longRecord = { ...record, supplier_name: 'Yetkazib beruvchi نام '.repeat(30), item_name: 'Mahsulot نام '.repeat(40),
    item_code: 'PRODUCT-'.repeat(30), note: '' };
  const expected = ['Haridor', longRecord.supplier_name, 'Mahsulot', `${longRecord.item_code} • ${longRecord.item_name}`,
    'Jarayonda', '10.00 kg', 'Qabul', '3.00 kg', 'Status', 'Qisman yakunlangan'];
  for (const platform of ['ios', 'android']) {
    const snapshot = state([], { detail: { record: longRecord, canApprove: false, canReject: false, canPartiallyAccept: false, canReportClaim: false } });
    const screen = fixture(platform, snapshot, [false, null], text).CustomerDeliveryDetailScreen({ deliveryNoteID: 'dn', onChanged() {} });
    const info = platform === 'ios' ? nodes(screen, n => n.type === 'Section' && n.props.title === labels.shipmentInfoTitle)[0]
      : nodes(screen, n => n.type === 'WorkerQueueCard')[0];
    assert.equal(nodes(info, n => ['ListItem', 'Button', 'Pressable', 'TextButton'].includes(n.type) || n.props?.onPress).length, 0,
      `${platform} shipment facts must not create no-op action targets`);
    const texts = nodes(info, n => n.type === 'Text');
    assert.deepEqual(texts.map(n => n.props.children), platform === 'ios' ? expected : [labels.shipmentInfoTitle, ...expected]);
    for (const value of [longRecord.supplier_name, `${longRecord.item_code} • ${longRecord.item_name}`]) {
      const fact = texts.find(n => n.props.children === value);
      assert.equal(fact.props.numberOfLines, undefined, `${platform} retains complete detail text`);
      if (platform === 'ios') assert.ok(fact.props.modifiers.some(m => m[0] === 'fixedSize' && m[1].horizontal === false && m[1].vertical === true));
    }
    const status = texts.find(n => n.props.children === 'Qisman yakunlangan');
    if (platform === 'ios') assert.ok(status.props.modifiers.some(m => m[0] === 'background' && m[1] === 'secondarySystemFill'));
    else {
      assert.equal(status.props.style.color, 'status-fg');
      assert.ok(nodes(info, n => n.type === 'View' && n.props.style?.backgroundColor === 'status-bg').length);
    }
  }
});

test('a translated non-Status label keeps the plain V2 detail value on both platforms', () => {
  const snapshot = state([], { detail: { record: { ...record, note: '' }, canApprove: false, canReject: false,
    canPartiallyAccept: false, canReportClaim: false } });
  for (const platform of ['ios', 'android']) {
    const screen = fixture(platform, snapshot, [false, null], key => key === 'statusLabel' ? 'Статус' : key)
      .CustomerDeliveryDetailScreen({ deliveryNoteID: 'dn', onChanged() {} });
    const status = nodes(screen, n => n.type === 'Text' && n.props.children === 'partiallyCompleted')[0];
    if (platform === 'ios') assert.equal(status.props.modifiers.some(m => m[0] === 'background'), false);
    else assert.equal(status.props.style.color, 'fg');
  }
});
