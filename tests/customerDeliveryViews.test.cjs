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
function deliveryButtons(screen) {
  return nodes(screen, n => ['Button', 'FilledTonalButton', 'OutlinedButton'].includes(n.type)).map(button => ({ ...button,
    props: { ...button.props, label: button.props.label ?? nodes(button.props.children, n => n.type === 'Text').map(n => n.props.children).join(''),
      onPress: button.props.onPress ?? button.props.onClick } }));
}
function load(file, mocks = {}) {
  const filename = path.resolve(__dirname, '../src/customer', file), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths; mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, filename);
  return mod.exports;
}
const logic = load('customerLogic.ts'), view = load('customerDeliveryView.ts'), presentation = load('customerPresentation.ts', { './customerLogic': logic });
const record = { id: 'dn', supplier_name: 'Customer', item_code: 'P1', item_name: 'Product', sent_qty: 10, accepted_qty: 3,
  uom: 'kg', note: ' a note ', status: 'partial' };
function fixture(platform, state, stateValues = [false, null], text = key => key, locale = 'uz') {
  let index = 0; const updates = [], focus = [];
  const mocks = { 'react/jsx-runtime': jsx, react: { useCallback: fn => fn, useRef: value => ({ current: value }),
    useState: () => { const i = index++; return [stateValues[i], value => updates.push([i, value])]; } },
    'expo-router': { useFocusEffect: fn => focus.push(fn) }, '@expo/ui': { ListItem: 'ListItem', Text: 'Text', Button: 'Button', Host: 'Host' },
    '@expo/ui/swift-ui': { Button: 'Button', Host: 'Host', List: 'List', ProgressView: 'ProgressView', Section: 'Section', VStack: 'VStack' },
    '@expo/ui/swift-ui/modifiers': { disabled: value => ['disabled', value], listStyle: value => ['listStyle', value], refreshable: fn => ['refreshable', fn],
      background: (color, shape) => ['background', color, shape], fixedSize: value => ['fixedSize', value], font: value => ['font', value],
      foregroundStyle: value => ['foregroundStyle', value], frame: value => ['frame', value], lineLimit: value => ['lineLimit', value],
      padding: value => ['padding', value], buttonStyle: value => ['buttonStyle', value], shapes: { roundedRectangle: value => ['roundedRectangle', value] } },
    '@expo/ui/jetpack-compose': { Button: 'Button', FilledTonalButton: 'FilledTonalButton', Host: 'Host', OutlinedButton: 'OutlinedButton', Text: 'Text',
      Shape: { RoundedCorner: props => ({ type: 'NativeShape', props }) },
      useMaterialColors: () => ({ primary: 'primary', onPrimary: 'on-primary', onSurface: 'fg', onSurfaceVariant: 'muted', surfaceContainerLow: 'bg',
      surfaceContainerHigh: 'header', outlineVariant: 'outline', secondaryContainer: 'status-bg', onSecondaryContainer: 'status-fg' }) },
    '@expo/ui/jetpack-compose/modifiers': { defaultMinSize: value => ['defaultMinSize', value], fillMaxWidth: () => ['fillMaxWidth'], testID: value => ['testID', value] },
    'react-native': { ActivityIndicator: 'ActivityIndicator', RefreshControl: 'RefreshControl', ScrollView: 'ScrollView', Text: 'Text', View: 'View', PlatformColor: value => value },
    '../components/WorkerAlert': { WorkerAlert: 'WorkerAlert' }, '../components/WorkerQueueCard.android': { WorkerQueueCard: 'WorkerQueueCard' },
    './CustomerContext': { useCustomerText: () => ({ locale, text }) }, './CustomerStates': loadCustomerStates(platform, { text }),
    './customerLogic': logic, './customerDeliveryView': view, './customerPresentation': presentation,
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
    const buttons = deliveryButtons(screen);
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
    const buttons = deliveryButtons(screen); assert.deepEqual(buttons.map(b => b.props.label), ['openDiscussionAction', 'sending', 'partialAcceptAction']);
    if (platform === 'ios') {
      assert.equal(buttons[0].props.modifiers.some(m => m[0] === 'disabled'), false);
      assert.ok(buttons[1].props.modifiers.some(m => m[0] === 'disabled' && m[1] === true));
    } else { assert.equal(buttons[0].props.enabled, true); assert.equal(buttons[1].props.enabled, false); assert.equal(buttons[1].props.onPress, undefined); }
    const unconnected = fixture(platform, busy).CustomerDeliveryDetailScreen({ deliveryNoteID: 'dn', onChanged() {} });
    assert.equal(deliveryButtons(unconnected).filter(n => n.props.label === 'openDiscussionAction').length, 0);
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

test('delivery treats every non-null failure as retry even with prior detail', () => {
  for (const platform of ['ios', 'android']) for (const error of [false, 0, '']) {
    const snapshot = state([], { error, loading: false });
    const screen = fixture(platform, snapshot).CustomerDeliveryDetailScreen({ deliveryNoteID: 'dn', onChanged() {} });
    assert.equal(screen.type.name, 'CustomerRetryState'); assert.equal(screen.props.retry, snapshot.reload);
  }
});

test('both delivery views pass the current notice identity and dismissal callback through', () => {
  for (const platform of ['ios', 'android']) {
    const snapshot = state([], { message: 'same failure', messageId: 7 });
    const screen = fixture(platform, snapshot).CustomerDeliveryDetailScreen({ deliveryNoteID: 'dn', onChanged() {} });
    const notice = nodes(screen, n => n.type === 'CustomerSnackbar')[0];
    assert.equal(notice.props.message, 'same failure'); assert.equal(notice.props.messageId, 7);
    assert.equal(notice.props.onDismiss, snapshot.clearMessage);
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
      : nodes(screen, n => n.props.testID === 'customer-delivery-panel')[0];
    assert.equal(nodes(info, n => ['ListItem', 'Button', 'FilledTonalButton', 'OutlinedButton', 'Pressable', 'TextButton'].includes(n.type) || n.props?.onPress).length, 0,
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

test('iOS delivery content follows the selected app locale rather than the device direction', () => {
  for (const [locale, direction] of [['uz', 'leftToRight'], ['en', 'leftToRight'], ['ru', 'leftToRight'], ['ur-PK', 'rightToLeft']]) {
    const screen = fixture('ios', state([]), [false, null], key => key, locale).CustomerDeliveryDetailScreen({ deliveryNoteID: 'dn', onChanged() {} });
    const host = nodes(screen, n => n.type === 'Host')[0]; assert.equal(host.props.layoutDirection, direction);
  }
});

test('Android delivery facts use source card, section and field geometry without adding actions', async () => {
  const calls = [], snapshot = state(calls), screen = fixture('android', snapshot, [false, null], key => key, 'ur-PK')
    .CustomerDeliveryDetailScreen({ deliveryNoteID: 'dn', onChanged() {} });
  const scroll = nodes(screen, n => n.type === 'ScrollView')[0];
  scroll.props.refreshControl.props.onRefresh(); await Promise.resolve(); assert.deepEqual(calls, ['reload']);
  const panel = nodes(screen, n => n.props.testID === 'customer-delivery-panel')[0];
  assert.equal(panel.props.style.backgroundColor, 'bg'); assert.equal(panel.props.style.borderRadius, 24);
  assert.equal(panel.props.style.marginStart, 4); assert.equal(panel.props.style.marginEnd, 6); assert.equal(panel.props.style.direction, 'rtl');
  const headers = nodes(panel, n => n.props.testID === 'customer-delivery-header');
  assert.deepEqual(headers.map(n => n.props.children.props.children), ['shipmentInfoTitle', 'noteTitle', 'responseTitle']);
  for (const [index, header] of headers.entries()) {
    assert.equal(header.props.style.backgroundColor, 'header'); assert.equal(header.props.style.paddingHorizontal, 18);
    assert.equal(header.props.style.paddingVertical, 14); assert.equal(header.props.style.borderTopLeftRadius, index === 0 ? 20 : 0);
    assert.equal(header.props.style.borderTopRightRadius, index === 0 ? 20 : 0);
    assert.deepEqual(header.props.children.props.style, { color: 'muted', fontSize: 16, fontWeight: '700' });
  }
  const facts = nodes(panel, n => n.props.testID === 'customer-delivery-facts')[0];
  assert.equal(facts.props.style.padding, 18); assert.equal(facts.props.style.gap, 12);
  assert.equal(facts.props.children.length, 5); assert.ok(facts.props.children.every(line => line.props.style.gap === 6));
  assert.equal(nodes(facts, n => ['Button', 'FilledTonalButton', 'OutlinedButton', 'Pressable', 'TextButton'].includes(n.type) || n.props.onPress).length, 0);
  const note = nodes(panel, n => n.props.testID === 'customer-delivery-note')[0];
  assert.equal(note.props.style.padding, 18); assert.equal(note.props.children.props.children, record.note);
  const dividers = nodes(panel, n => n.props.testID === 'customer-delivery-divider'); assert.equal(dividers.length, 2);
  for (const item of dividers) assert.deepEqual(item.props.style, { height: 1, marginHorizontal: 18, backgroundColor: 'outline', opacity: 0.55 });
  assert.equal(nodes(panel, n => n.type === 'Text' && n.props.children === 'commentsTitle').length, 0);
  assert.equal(deliveryButtons(screen).some(button => button.props.label === 'openDiscussionAction'), false);
  assert.deepEqual(calls, ['reload']);
});

test('Android read-only delivery panel omits note and response sections when V2 conditions are false', () => {
  const detail = { record: { ...record, note: ' \u0085 ' }, canApprove: false, canReject: false, canPartiallyAccept: false, canReportClaim: false };
  const screen = fixture('android', state([], { detail })).CustomerDeliveryDetailScreen({ deliveryNoteID: 'dn', onChanged() {} });
  const panel = nodes(screen, n => n.props.testID === 'customer-delivery-panel')[0];
  assert.deepEqual(nodes(panel, n => n.props.testID === 'customer-delivery-header').map(n => n.props.children.props.children), ['shipmentInfoTitle']);
  assert.equal(nodes(panel, n => n.props.testID === 'customer-delivery-divider').length, 0);
  assert.equal(nodes(panel, n => n.props.testID === 'customer-delivery-note').length, 0);
  assert.equal(deliveryButtons(screen).length, 0);
});

// Source-derived: CustomerDeliveryDetailScreen's existing outlined discussion and filled/tonal response buttons.
test('iOS delivery distinguishes the primary approve action from secondary native buttons', () => {
  const screen = fixture('ios', state([])).CustomerDeliveryDetailScreen({ deliveryNoteID: 'dn', onChanged() {}, onOpenDiscussion() {} });
  const buttons = deliveryButtons(screen);
  assert.deepEqual(buttons.map(button => button.props.modifiers?.find(m => m[0] === 'buttonStyle')?.[1]),
    ['bordered', 'borderedProminent', 'bordered', 'bordered', 'bordered']);
});

test('Android delivery retains the V2 filled, tonal and outlined button hierarchy', () => {
  const screen = fixture('android', state([])).CustomerDeliveryDetailScreen({ deliveryNoteID: 'dn', onChanged() {}, onOpenDiscussion() {} });
  assert.deepEqual(deliveryButtons(screen).map(button => button.type), ['OutlinedButton', 'Button', 'FilledTonalButton', 'OutlinedButton', 'FilledTonalButton']);
});

test('Android response buttons apply the V2 app theme before tonal defaults', () => {
  for (const flags of permissionCases()) for (const submitting of [false, true]) {
    const snapshot = state([], { submitting, detail: { record, ...flags } });
    const screen = fixture('android', snapshot).CustomerDeliveryDetailScreen({ deliveryNoteID: 'dn', onChanged() {} });
    for (const button of deliveryButtons(screen)) {
      assert.deepEqual(button.props.shape.props.cornerRadii, { topStart: 20, topEnd: 20, bottomStart: 20, bottomEnd: 20 });
      assert.ok(button.props.modifiers.some(m => m[0] === 'defaultMinSize' && m[1].minHeight === 56));
      assert.deepEqual(button.props.colors, button.type === 'OutlinedButton' ? { contentColor: 'fg' }
        : { containerColor: 'primary', contentColor: 'on-primary' });
      assert.deepEqual(nodes(button, n => n.type === 'Text')[0].props.style, { typography: 'labelLarge', fontSize: 16, fontWeight: '500' });
      assert.equal(button.props.enabled, !submitting);
    }
  }
});

function permissionCases() {
  return Array.from({ length: 16 }, (_, mask) => ({ canApprove: !!(mask & 1), canPartiallyAccept: !!(mask & 2), canReject: !!(mask & 4), canReportClaim: !!(mask & 8) }));
}
function sourceActions(flags, submitting) {
  const result = [];
  if (flags.canApprove) result.push({ kind: 'approve', labelKey: submitting ? 'sending' : 'approveAction', appearance: 'filled', spacingBefore: 0 });
  if (flags.canPartiallyAccept) result.push({ kind: 'partial', labelKey: 'partialAcceptAction', appearance: 'tonal', spacingBefore: flags.canApprove ? 12 : 0 });
  if (flags.canReject) result.push({ kind: 'reject', labelKey: 'rejectAction', appearance: 'outlined', spacingBefore: flags.canApprove || flags.canPartiallyAccept ? 12 : 0 });
  if (flags.canReportClaim) result.push({ kind: 'claim', labelKey: 'reportIssueAction', appearance: 'tonal', spacingBefore: 0 });
  return result;
}

// Source-derived: customer_delivery_detail_screen.dart:152–223, including its absent pre-claim spacer.
test('shared response presentation preserves every permission combination and the source spacing', () => {
  for (const flags of permissionCases()) for (const submitting of [false, true]) {
    assert.deepEqual(view.customerDeliveryResponseActions(flags, submitting), sourceActions(flags, submitting));
  }
  assert.deepEqual(view.customerDeliveryResponseActions({ canApprove: true, canPartiallyAccept: false, canReject: false, canReportClaim: true }, false)
    .map(action => action.spacingBefore), [0, 0]);
});

test('both native views preserve permission visibility, busy disabling and conditional action gaps', () => {
  for (const platform of ['ios', 'android']) for (const flags of permissionCases()) for (const submitting of [false, true]) {
    const calls = [], snapshot = state(calls, { submitting, detail: { record, ...flags } });
    const screen = fixture(platform, snapshot).CustomerDeliveryDetailScreen({ deliveryNoteID: 'dn', onChanged() {} });
    const expected = sourceActions(flags, submitting), buttons = deliveryButtons(screen);
    assert.deepEqual(buttons.map(button => button.props.label), expected.map(action => action.labelKey));
    assert.equal(buttons.some(button => button.props.label === 'openDiscussionAction'), false, 'held discussion stays absent without its destination');
    assert.deepEqual(calls, [], 'rendering styles does not submit or reload');
    if (platform === 'ios') {
      assert.deepEqual(buttons.map(button => button.props.modifiers.find(m => m[0] === 'buttonStyle')[1]),
        expected.map(action => action.appearance === 'filled' ? 'borderedProminent' : 'bordered'));
      for (const button of buttons) assert.ok(button.props.modifiers.some(m => m[0] === 'disabled' && m[1] === submitting));
      assert.deepEqual(buttons.map(button => button.props.modifiers.find(m => m[0] === 'padding')[1].top), expected.map(action => action.spacingBefore));
      const response = nodes(screen, n => n.type === 'Section' && n.props.title === 'responseTitle')[0];
      assert.equal(!!response, expected.length > 0);
      if (response) assert.equal(response.props.children.props.spacing, 0);
    } else {
      assert.deepEqual(buttons.map(button => button.type), expected.map(action => ({ filled: 'Button', tonal: 'FilledTonalButton', outlined: 'OutlinedButton' })[action.appearance]));
      for (const button of buttons) assert.equal(button.props.enabled, !submitting);
      const hosts = nodes(screen, n => n.type === 'Host' && ['Button', 'FilledTonalButton', 'OutlinedButton'].includes(n.props.children?.type));
      assert.deepEqual(hosts.map(host => host.props.style.marginTop), expected.map(action => action.spacingBefore));
    }
  }
});

test('restyled response buttons open the same confirmation or return dialog without sending early', () => {
  for (const platform of ['ios', 'android']) {
    const calls = [], f = fixture(platform, state(calls));
    const screen = f.CustomerDeliveryDetailScreen({ deliveryNoteID: 'dn', onChanged() {} });
    const buttons = deliveryButtons(screen);
    buttons.forEach(button => button.props.onPress());
    assert.deepEqual(f.updates, [[0, true], [1, 'partial'], [1, 'reject'], [1, 'claim']]);
    assert.deepEqual(calls, []);
  }
});

test('localized native action labels retain complete text and fill the available row', () => {
  const text = key => `اردو ${key} ${'long '.repeat(30)}`;
  for (const platform of ['ios', 'android']) {
    const screen = fixture(platform, state([]), [false, null], text).CustomerDeliveryDetailScreen({ deliveryNoteID: 'dn', onChanged() {} });
    const buttons = deliveryButtons(screen);
    assert.deepEqual(buttons.map(button => button.props.label), ['approveAction', 'partialAcceptAction', 'rejectAction', 'reportIssueAction'].map(text));
    for (const button of buttons) {
      const label = button.props.children;
      assert.equal(label.props.numberOfLines, undefined); assert.equal(label.props.maxLines, undefined);
      if (platform === 'ios') {
        assert.ok(label.props.modifiers.some(m => m[0] === 'frame' && m[1].maxWidth === Infinity));
        assert.ok(label.props.modifiers.some(m => m[0] === 'fixedSize' && m[1].vertical === true));
      } else assert.ok(button.props.modifiers.some(m => m[0] === 'fillMaxWidth'));
    }
  }
});
