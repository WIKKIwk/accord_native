const assert = require('node:assert/strict'), test = require('node:test');
const { harness, nodes, main, buttons, load, presentation } = require('./support/workerOrderScreen.cjs');
const tick = () => new Promise(resolve => setImmediate(resolve));
const input = (change = {}) => ({ scope: 'actor/order/apparatus/epoch', eligible: true, synchronized: true, ...change });
test('only eligible synchronized JSON display data is captured; transport objects cannot mutate a retained frame', () => {
  const data = { showResume: true, pauseLabel: 'Rulonni yechish', molds: [{ code: 'A' }] };
  const first = presentation.workerOrderPresentationFor(null, input(), data);
  data.molds[0].code = 'changed';
  const stale = presentation.workerOrderPresentationFor(first.next, input({ synchronized: false }), { showResume: false });
  assert.equal(stale.retaining, true); assert.equal(stale.data.showResume, true); assert.equal(stale.data.molds[0].code, 'A');
  assert.equal(presentation.workerOrderPresentationFor(first.next, input(), first.next.data).next, first.next);
  for (const change of [{ eligible: false }, { scope: 'other-account' }, { scope: 'other-order' }, { scope: 'other-apparatus' }, { scope: 'other-epoch' }]) {
    const result = presentation.workerOrderPresentationFor(first.next, input({ synchronized: false, ...change }), { showResume: false });
    assert.equal(result.retaining, false); assert.equal(result.next, null); assert.equal(result.data.showResume, false);
  }
  assert.equal(presentation.workerOrderPresentationFor(null, input({ synchronized: false }), {}).next, null);
});
test('authoritative denial has the exact V2 401/403/code boundary; ordinary read failures remain recoverable', () => {
  for (const error of [{ statusCode: 401 }, { statusCode: 403 }, ...['unauthorized', 'forbidden', 'order_not_available', 'training_order_scan_bootstrap_unsupported'].map(code => ({ code }))])
    assert.equal(presentation.workerOrderPresentationDenied(error), true);
  for (const error of [null, new Error('network'), { statusCode: 500 }, { name: 'TimeoutError' }]) assert.equal(presentation.workerOrderPresentationDenied(error), false);
});
test('the real hook stores once per visible change and clears on scope loss without a render loop', () => {
  let saved = null, updated = 0; const effects = [];
  const hook = load('components/useWorkerOrderPresentation.ts', { '../workerOrderPresentation': presentation,
    react: { useState: () => [saved, value => { saved = value; updated++; }], useLayoutEffect: effect => effects.push(effect) } });
  const render = (scope, data) => { effects.length = 0; const result = hook.useWorkerOrderPresentation(scope, data); effects.forEach(effect => effect()); return result; };
  render(input(), { showStart: true }); render(input(), { showStart: true }); assert.equal(updated, 1);
  assert.equal(render(input({ synchronized: false }), { showStart: false }).data.showStart, true);
  render(input({ eligible: false, synchronized: false }), { showStart: false }); assert.equal(saved, null); assert.equal(updated, 2);
});
for (const platform of ['ios', 'android']) for (const [mode, actions] of [
  ['fresh_start', ['start']], ['requeued_ready', ['resume']], ['in_progress', ['pause', 'merge', 'complete']], ['paused', ['resume']],
]) test(`${platform}: ${mode} keeps the V2 action layout while stale, but cannot scan, open a report or submit`, async () => {
  const h = harness(platform, { control: { allowed_actions: actions }, interaction: { mode, blocking_reason_code: '' } });
  const before = buttons(h.render()).map(button => button.props.label);
  h.setFresh(false); h.values.set('bootstrap', null);
  const tree = h.render(), retained = buttons(tree);
  assert.deepEqual(retained.map(button => button.props.label), before); assert.ok(retained.every(button => button.props.disabled));
  assert.equal(nodes(tree, node => node.type === 'CameraView').length, 0);
  for (const button of retained) button.props.onPress(); await tick();
  assert.equal(h.actions.length, 0); assert.ok(!h.values.get('selected')); assert.equal(h.values.get('intakeMode'), false);
  assert.equal(nodes(tree, node => node.type === 'WorkerOrderSyncProgress')[0].props.pending, true);
});
for (const platform of ['ios', 'android']) for (const change of ['account', 'epoch', 'apparatus', 'order', 'frozen', 'denied', 'capability', 'assignment'])
  test(`${platform}: ${change} invalidates presentation instead of carrying actions across contexts`, () => {
    const h = harness(platform, { control: { allowed_actions: ['resume'] }, interaction: { mode: 'paused', blocking_reason_code: '' } });
    h.render(); h.setFresh(false);
    if (change === 'account') h.setScope('other-actor');
    if (change === 'epoch') h.props.queueCursor = { epoch: 'new-epoch', rev: 1 };
    if (change === 'apparatus') h.props.apparatusId = 'apparatus:default:other';
    if (change === 'order') h.props.orderId = 'other-order';
    if (change === 'frozen') h.bootstrap.control_state.order_control = 'frozen';
    if (change === 'denied') h.values.set('presentationDenied', true);
    if (change === 'capability') h.props.session.capabilities = [];
    if (change === 'assignment') h.props.session.assigned_apparatus = [];
    assert.equal(buttons(h.render()).length, 0);
  });
for (const platform of ['ios', 'android']) test(`${platform}: mold rows, accepted counts and material disclosures survive temporary synchronization loss`, () => {
  const h = harness(platform, { control: { allowed_actions: ['start'] },
    interaction: { mode: 'fresh_start', blocking_reason_code: '', qolip_mode: 'scan_required', start_materials_mode: 'scan_required', material_scan_required: true },
    sections: { qolips: { status: 'ready', data: { qolip: { required_qolips: [{ qolip_code: 'MOLD-A', color: 'Qizil' }] } } } },
    states: { qolips: ['MOLD-A'], qolipsExpanded: true, materialsExpanded: true } });
  const before = main(h.render()); h.setFresh(false); h.values.set('bootstrap', null);
  const after = main(h.render());
  const molds = tree => nodes(tree, node => node.type === 'Text').map(node => node.props.children).flat().filter(value => typeof value === 'string' && value.includes('MOLD-A'));
  assert.deepEqual(molds(after), molds(before)); assert.ok(JSON.stringify(after).includes('✓'));
  const lists = tree => nodes(tree, node => node.type === 'WorkerMaterialList').map(node => node.props.rows);
  assert.deepEqual(lists(after), lists(before));
  assert.ok(buttons(after).every(button => button.props.disabled));
});
for (const platform of ['ios', 'android']) test(`${platform}: preflight buttons remain visible and disabled while permission is being refreshed`, () => {
  const h = harness(platform, { control: { state: 'print_preflight', allowed_actions: [], print_preflight: { order_id: '0198', apparatus: 'apparatus:default:bosma_8', hold_id: 'hold', revision: 1, status: 'held' } },
    interaction: { mode: 'fresh_start_blocked', blocking_reason_code: 'print_preflight_active' } });
  const before = buttons(h.render()).map(node => node.props.label); h.setFresh(false);
  assert.ok(before.includes('Rang chiqdi')); assert.ok(before.includes('Chiqmadi'));
  const after = buttons(h.render()); assert.deepEqual(after.map(node => node.props.label), before); assert.ok(after.every(node => node.props.disabled));
});
test('connection progress appears after V2’s two-second grace period and cancels on unmount', t => {
  let visible = false, cleanup, callback, delay, cleared = 0, effectRan = false;
  t.mock.method(global, 'setTimeout', (fn, ms) => { callback = fn; delay = ms; return 7; });
  t.mock.method(global, 'clearTimeout', id => { assert.equal(id, 7); cleared++; });
  const ui = load('components/WorkerOrderSyncProgress.tsx', { 'react-native': { ActivityIndicator: 'ActivityIndicator' },
    react: { useState: () => [visible, value => { visible = value; }], useEffect: effect => { if (!effectRan) { cleanup = effect(); effectRan = true; } } } });
  assert.equal(ui.WorkerOrderSyncProgress({ pending: false, color: '#fff' }), null);
  const child = ui.WorkerOrderSyncProgress({ pending: true, color: '#fff' });
  assert.equal(child.type(child.props), null); assert.equal(delay, 2000); callback();
  assert.equal(child.type(child.props).type, 'ActivityIndicator'); cleanup(); assert.equal(cleared, 1);
});
test('preflight disabled state reaches the native iOS modifier and Android button wrapper', () => {
  const native = new Proxy({}, { get: (_target, key) => key });
  const modifiers = new Proxy({}, { get: (_target, key) => value => ({ [key]: value }) });
  const controls = load('components/WorkerOrderControls.ios.tsx', { '@expo/ui/swift-ui': native, '@expo/ui/swift-ui/modifiers': modifiers,
    './BaseHost': { BaseHost: 'Host' }, './useBaseTheme': {}, './workerOrderLayout': load('components/workerOrderLayout.ts'),
    './useWorkerOrderText': { useWorkerOrderText: () => ({ locale: 'uz' }) }, '../workerNoticeHyphenation': { hyphenateWorkerNotice: value => value },
    'react-native': { Platform: { Version: 26 }, PlatformColor: value => value, View: 'View' } });
  const ios = load('components/WorkerPreflightButton.ios.tsx', { './WorkerOrderControls': controls });
  const element = ios.WorkerPreflightButton({ onPress() {}, disabled: true, label: 'Rang chiqdi' }), tree = element.type(element.props);
  assert.ok(nodes(tree, node => node.type === 'Button')[0].props.modifiers.some(modifier => modifier.disabled === true));
  const android = load('components/WorkerPreflightButton.tsx', { './WorkerSheetButton': { WorkerSheetButton: 'WorkerSheetButton' } });
  assert.equal(android.WorkerPreflightButton({ onPress() {}, disabled: true }).props.disabled, true);
});
