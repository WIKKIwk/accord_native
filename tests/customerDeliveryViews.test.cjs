const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
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
function fixture(platform, state, stateValues = [false, null]) {
  let index = 0; const updates = [], focus = [];
  const mocks = { 'react/jsx-runtime': jsx, react: { useCallback: fn => fn, useRef: value => ({ current: value }),
    useState: () => { const i = index++; return [stateValues[i], value => updates.push([i, value])]; } },
    'expo-router': { useFocusEffect: fn => focus.push(fn) }, '@expo/ui': { ListItem: 'ListItem', Text: 'Text', Button: 'Button', Host: 'Host' },
    '@expo/ui/swift-ui': { Button: 'Button', Host: 'Host', List: 'List', ProgressView: 'ProgressView', Section: 'Section' },
    '@expo/ui/swift-ui/modifiers': { disabled: value => ['disabled', value], listStyle: value => ['listStyle', value], refreshable: fn => ['refreshable', fn] },
    '@expo/ui/jetpack-compose': { useMaterialColors: () => ({ onSurface: 'fg', onSurfaceVariant: 'muted', surfaceContainerLow: 'bg' }) },
    'react-native': { ActivityIndicator: 'ActivityIndicator', RefreshControl: 'RefreshControl', ScrollView: 'ScrollView', Text: 'Text', View: 'View' },
    '../components/WorkerAlert': { WorkerAlert: 'WorkerAlert' }, '../components/WorkerQueueCard.android': { WorkerQueueCard: 'WorkerQueueCard' },
    './CustomerContext': { useCustomerText: () => ({ text: key => key }) }, './customerLogic': logic, './customerDeliveryView': view,
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
    assert.ok(nodes(loading, n => n.type === (platform === 'ios' ? 'ProgressView' : 'ActivityIndicator')).length);
    const failed = fixture(platform, state(calls, { error: Error('offline'), detail: null })).CustomerDeliveryDetailScreen({ deliveryNoteID: 'dn', onChanged() {} });
    assert.ok(nodes(failed, n => n.type === 'Text' && n.props.children === 'serverDisconnectedRetry').length);
    nodes(failed, n => n.type === 'Button' && n.props.label === 'retry')[0].props.onPress();
    assert.equal(calls.at(-1), 'reload');
  }
});
