const assert = require('node:assert/strict'), fs = require('node:fs'), Module = require('node:module'), path = require('node:path'), test = require('node:test'), ts = require('typescript');
const jsx = { Fragment: 'Fragment', jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
function compile(name, mocks) {
  const filename = path.resolve(__dirname, `../src/${name}`), mod = new Module(filename, module); mod.filename = filename; mod.paths = module.paths;
  mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, filename);
  return mod.exports;
}
function nodes(node, predicate) { if (!node || typeof node !== 'object') return []; if (Array.isArray(node)) return node.flatMap(value => nodes(value, predicate));
  return [...(predicate(node) ? [node] : []), ...nodes(node.props?.children, predicate)]; }
const tick = () => new Promise(setImmediate);
function hooks() {
  const slots = []; let index = 0; const scheduled = [];
  const changed = (a, b) => !a || !b || a.length !== b.length || a.some((value, i) => value !== b[i]);
  const effect = (fn, deps) => { const i = index++, old = slots[i]; if (!old || changed(old.deps, deps)) { const next = slots[i] = { ...old, deps }; scheduled.push(() => { old?.cleanup?.(); next.cleanup = fn(); }); } };
  return { useState: initial => { const i = index++; slots[i] ??= { value: typeof initial === 'function' ? initial() : initial }; return [slots[i].value, next => { slots[i].value = typeof next === 'function' ? next(slots[i].value) : next; }]; },
    useRef: value => { const i = index++; return slots[i] ??= { current: value }; },
    useMemo: (fn, deps) => { const i = index++; if (!slots[i] || changed(slots[i].deps, deps)) slots[i] = { value: fn(), deps }; return slots[i].value; },
    useEffect: effect, useLayoutEffect: effect, useSyncExternalStore: (_sub, get) => get(),
    begin: () => { index = 0; }, flush: () => { while (scheduled.length) scheduled.shift()(); }, dispose: () => slots.forEach(slot => slot?.cleanup?.()) };
}
function setup(platform, options = {}) {
  const react = hooks(), modal = compile('workerReportModalFlow.ts', {}), report = compile('workerRezkaReport.ts', {});
  const h = { valid: true, scope: 'scope-1', events: [], picks: 0, closes: [], posts: [], reads: 0 };
  h.snapshot = { epoch: 'epoch', revision: 5, kadr_counts: [1, 2], report: { cycle_id: 'cycle', frames: [], reference_frame_index: null,
    layout_outputs: [{ name: 'A', width_mm: 120 }], include_bobina_in_net: false, atomic_save_epoch: 'epoch', peremotka_supported: true } };
  h.data = { control_state: { order_control: 'active', epoch: 'epoch', rev: 5, control: { stage_node_id: 'cut', allowed_actions: ['complete'],
    complete_requires_full_report: true, rezka_output_kadr_counts: [1, 2], rezka_output_report: h.snapshot.report } } };
  h.state = { phase: 'edit', snapshot: h.snapshot, frames: [0, 1].map(() => ({ meter: '', kg: '', bobina: '', diameter: '', note: '' })),
    waste: { total: '', print: '', lamination: '', edge: '' }, note: '', error: '', statuses: {}, queued: [], paused: false, processing: false,
    confirming: false, syncRequired: false, issuePrompted: [], includeBobina: false, fullReport: true, totalWasteOnly: false, freezeRequest: '', canReload: true, notice: '', completed: false };
  class Workflow {
    constructor(deps) { h.deps = deps; h.workflow = this; }
    subscribe = () => () => {}; getSnapshot = () => h.state;
    load() { h.events.push('load'); } invalidate() { h.events.push('invalidate'); h.state = { ...h.state, phase: 'invalid' }; }
    submit() { h.events.push('submit'); } change(...args) { h.events.push(['change', ...args]); }
    changeNote(value) { h.events.push(['note', value]); } changeWaste(...args) { h.events.push(['waste', ...args]); }
    enqueue(...args) { h.events.push(['enqueue', ...args]); } saveIssue(...args) { h.events.push(['issue', ...args]); }
  }
  const session = { assigned_apparatus: ['apparatus:default:cut'] };
  const mocks = { react, 'react/jsx-runtime': jsx, 'react-native': { ActivityIndicator: 'Spinner', Platform: { OS: platform }, Text: 'Text', View: 'View' },
    '../auth': { activeSessionToken: () => h.valid ? 'token' : null, subscribeSessionWitness: fn => { h.witness = fn; return () => {}; } },
    '../sessionReadScope': { sessionReadScope: () => h.scope }, '../workerOrderLogic': { runningFreezeRequest: () => h.freeze ?? null },
    '../workerApi': { canWorkOnApparatus: (machine, ids) => ids.includes(machine.id) },
    '../workerLongPress': { readWorkerActionControl: async () => { h.reads++; return structuredClone(h.data); } },
    '../rezkaOutputReportApi': { adminRezkaOutputReport: async (_s, _a, _o, current) => { assert(current()); return h.unsupported ? null : structuredClone(h.snapshot); } },
    '../workerQueueAction': { adminApparatusQueueActionResult: async (_s, body, current) => { assert(current()); h.posts.push(body); return {}; } },
    '../productionProgressReprintApi': { adminProgressQrReprint: async (_s, body, current) => { assert.equal(typeof current, 'function'); assert(current()); h.events.push(['reprint', body]); return {}; } },
    '../workerPrinting': { WorkerPrintCancelled: class extends Error {}, pickWorkerPrinter: async ({ current }) => { assert(current()); h.picks++; return { transport: 'bluetooth' }; }, printWorkerJobs() {}, workerPrinterFields: () => ({ print_transport: 'bluetooth' }) },
    '../workerRezkaOutputWorkflow': { WorkerRezkaOutputWorkflow: Workflow }, '../workerReportModalFlow': modal,
    '../workerRezkaOutputModel': { rezkaStageOptions: () => ({ includeBobina: false, printCount: 2 }) }, '../workerRezkaReport': report,
    './WorkerFormDialog': { WorkerFormDialog: 'Dialog' }, './WorkerReportField': { WorkerReportField: 'Field' }, './WorkerFramePrint': { WorkerFramePrint: 'Print' },
    './WorkerOrderControls': { WorkerOrderButton: 'Button' }, './useWorkerPrinterSelector': { useWorkerPrinterSelector: () => ({ selectDevice: async () => null, dialogs: null }) },
    './useWorkerColors': { useWorkerColors: () => ({ text: '#111', muted: '#666', error: '#f00', field: '#eee' }) },
    './useWorkerOrderText': { useWorkerOrderText: () => ({ p: (key, values) => values ? `${key}:${JSON.stringify(values)}` : key, t: key => key }) } };
  const Component = compile('components/WorkerRezkaOutputReport.tsx', mocks).WorkerRezkaOutputReport;
  const props = { session, apparatus: session.assigned_apparatus[0], orderId: 'order', stage: 'cut', action: options.action ?? 'complete', map: { products: [] },
    fullCompletionReportRequired: options.fullCompletionReportRequired,
    getCursor: () => h.cursor ?? { epoch: 'epoch', rev: 5 }, onClose: value => h.closes.push(value), onAttempted() {}, onCommitted() {} };
  h.render = () => { react.begin(); h.tree = Component(props); react.flush(); h.dialog = nodes(h.tree, value => value.type === 'Dialog')[0]; return h.tree; };
  h.all = type => nodes(h.tree, value => value.type === type); h.dispose = react.dispose; h.render(); return h;
}

for (const [action, expected] of [['pause', 'pause'], ['detach_roll', 'pause'], ['roll_complete', 'complete'], ['complete', 'complete']]) {
  test(`Android rezka ${action} report uses the native quantity dialog`, () => {
    const h = setup('android', { action });
    assert.equal(h.dialog.props.progressAction, expected);
    assert.ok(h.all('Field').length > 0);
    h.dispose();
  });
}

// @v2-test test/admin_production_map_rezka_deviation_warning_test_part.dart
for (const platform of ['ios', 'android']) {
  test(`${platform}: QR handoff forces measured completion but preserves the server total-waste-only contract`, async () => {
    const h = setup(platform, { fullCompletionReportRequired: true });
    h.data.control_state.control.complete_requires_full_report = false;
    assert.equal((await h.deps.control()).fullReport, true);
    h.data.control_state.control.complete_requires_rezka_total_waste_only = true;
    const control = await h.deps.control();
    assert.equal(control.fullReport, false); assert.equal(control.totalWasteOnly, true); h.dispose();
  });
  test(`${platform}: native report keeps V2 waste-before-frame order, layout title, duplicate labels and readonly saved cards`, () => {
    const h = setup(platform), fields = h.all('Field'); assert.equal(fields.length, 13);
    assert.equal(fields[0].props.label, 'worker.daily.field.total_waste (kg)'); assert.equal(fields[3].props.label, 'worker.daily.field.edge_waste (kg)');
    assert.equal(fields[4].props.label, 'worker.daily.field.length (m)'); assert.equal(fields[12].props.label, 'worker.progress.qty.reason');
    const texts = h.all('Text').map(value => value.props.children).filter(value => typeof value === 'string');
    assert(texts.includes('worker.rezka.print.duplicate_labels')); assert(texts.some(value => value.startsWith('A · 120 mm')));
    h.state.snapshot.report.frames.push({ index: 1, input: { issue_note: 'broken' }, batch_id: '', qr_payload: '' }); h.render();
    assert(h.all('Field').slice(4, 8).every(field => field.props.disabled)); assert.equal(h.all('Print')[0].props.disabled, true); h.dispose();
  });
  test(`${platform}: queued card is locked while other drafts stay editable; safe stop hides per-card mutations`, () => {
    const h = setup(platform); h.state.processing = true; h.state.queued = [0]; h.render();
    assert(h.all('Field').slice(4, 8).every(field => field.props.disabled)); assert(h.all('Field').slice(8, 12).every(field => !field.props.disabled));
    assert.equal(h.dialog.props.cancelDisabled, true); h.state.freezeRequest = 'freeze'; h.render(); assert.equal(h.all('Print').length, 0); assert.equal(h.all('Button').length, 0); h.dispose();
  });
  test(`${platform}: total-only report hides the three category fields and print-pending output stays readonly`, () => {
    const h = setup(platform); h.state.totalWasteOnly = true; h.render(); assert.equal(h.all('Field')[0].props.label, 'worker.daily.field.waste (kg)'); assert.equal(h.all('Field').length, 10);
    h.state.phase = 'print_pending'; h.render(); assert(h.all('Field').every(field => field.props.disabled));
    h.dialog.props.onConfirm(); assert(h.events.includes('submit')); assert.equal(h.dialog.props.confirmLabel, 'Qayta urinish'); h.dispose();
  });
}
test('iOS printer selection starts only after actual report dismissal and a rapid second hide shares its waiter', async () => {
  const h = setup('ios'); h.dialog.props.onShow(); const pending = h.deps.selectPrinter(); await tick(); h.render();
  assert.equal(h.dialog.props.visible, false); assert.equal(h.picks, 0); h.dialog.props.onDismiss(); await pending; h.render();
  assert.equal(h.picks, 1); assert.equal(h.dialog.props.visible, true); h.dispose();
});
test('iOS issue choice transfers directly to reason and saves once after its native dismissal', async () => {
  const h = setup('ios'); h.dialog.props.onShow(); h.all('Button')[0].props.onPress(); h.all('Button')[0].props.onPress();
  await tick(); h.render(); assert.equal(h.dialog.props.visible, false); h.dialog.props.onDismiss(); await tick(); h.render(); h.dialog.props.onShow();
  assert.equal(h.dialog.props.title, 'worker.rezka.print.issue'); const choice = h.all('Button').find(value => value.props.label === 'worker.rezka.print.issue_note'); choice.props.onPress();
  await tick(); h.render(); h.dialog.props.onDismiss(); await tick(); h.render(); assert.equal(h.dialog.props.visible, true); assert.equal(h.all('Field').length, 1); h.dialog.props.onShow();
  h.all('Field')[0].props.change('broken'); h.render(); h.dialog.props.onConfirm(); h.dialog.props.onConfirm();
  await tick(); h.render(); assert.equal(h.events.filter(value => Array.isArray(value) && value[0] === 'issue').length, 0);
  h.dialog.props.onDismiss(); await tick(); h.render(); assert.deepEqual(h.events.filter(value => Array.isArray(value) && value[0] === 'issue'), [['issue', 0, 'broken']]); h.dispose();
});
test('paused print queue cancellation requires discard confirmation before closing', async () => {
  const h = setup('android'); h.state.queued = [0]; h.state.paused = true; h.dialog.props.onCancel(); await tick(); h.render();
  assert.equal(h.dialog.props.title, 'worker.rezka.print.queue_discard_title'); assert.equal(h.closes.length, 0);
  h.dialog.props.onCancel(); await tick(); h.render(); assert.equal(h.closes.length, 0);
  h.dialog.props.onCancel(); await tick(); h.render(); h.dialog.props.onConfirm(); await tick(); assert.deepEqual(h.closes, [false]); h.dispose();
});
test('deviation edit returns false only after native dismissal; double confirmation cannot resolve another step', async () => {
  const h = setup('ios'); h.dialog.props.onShow(); const answer = h.deps.confirm({ index: 1, referenceIndex: 0, field: 'kg', reference: 10, entered: 15, percent: 50 });
  let done = false; answer.then(() => { done = true; }); await tick(); h.render(); h.dialog.props.onDismiss(); await tick(); h.render(); h.dialog.props.onShow();
  assert.equal(h.dialog.props.cancelLabel, 'worker.rezka.deviation.edit'); h.dialog.props.onCancel(); h.dialog.props.onConfirm(); await tick(); assert.equal(done, false);
  h.render(); h.dialog.props.onDismiss(); assert.equal(await answer, false); h.dispose();
});
test('late account invalidation releases modal waiters and closes without a printer or POST', async () => {
  const h = setup('ios'); const picker = h.deps.selectPrinter(); h.valid = false; h.witness(); assert(h.events.includes('invalidate')); assert.deepEqual(h.closes, [false]); h.dispose();
  await assert.rejects(picker); assert.equal(h.picks, 0); assert.equal(h.posts.length, 0);
});
test('scoped report read checks stage, layout, epoch and revision; only unsupported GET uses the contract fallback', async () => {
  const h = setup('android'); assert.equal((await h.deps.read()).report.cycle_id, 'cycle');
  for (const change of [value => { value.epoch = 'old'; }, value => { value.revision = 4; }, value => { value.kadr_counts = [1]; }]) {
    const previous = structuredClone(h.snapshot); change(h.snapshot); await assert.rejects(h.deps.read(), /worker.error.sync/); h.snapshot = previous;
  }
  h.unsupported = true; assert.equal((await h.deps.read()).report.cycle_id, 'cycle'); h.unsupported = false;
  h.data.control_state.control.stage_node_id = 'next'; await assert.rejects(h.deps.read(), /worker.error.sync/); h.dispose();
});
test('a freeze-request report uses authoritative action control instead of the active-only report endpoint', async () => {
  const h = setup('android'); h.freeze = 'freeze'; h.snapshot = null; const report = await h.deps.read(); assert.equal(report.report.cycle_id, 'cycle'); h.dispose();
});
test('an expired owner cannot even start a control read or a QR preparation request', async () => {
  const h = setup('android'); h.scope = 'new-account'; const reads = h.reads;
  await assert.rejects(h.deps.read()); await assert.rejects(h.deps.reprint({ batch_id: 'batch', qr_payload: 'QR' }, {}, 2)); assert.equal(h.reads, reads); h.dispose();
});
test('iOS deviation correction scrolls and focuses the requested native field after the report is presented', () => {
  const h = setup('ios'), layouts = h.all('View').filter(value => value.props.onLayout), offsets = [];
  layouts[5].props.onLayout({ nativeEvent: { layout: { y: 800 } } }); layouts[7].props.onLayout({ nativeEvent: { layout: { y: 160 } } });
  h.dialog.props.scrollRef.current = { scrollTo: value => offsets.push(value) }; h.state.focus = { index: 1, field: 'kg', serial: 1 };
  h.render(); assert.deepEqual(offsets, []); assert.equal(h.all('Field')[9].props.focus, undefined);
  h.dialog.props.onShow(); h.render(); assert.deepEqual(offsets, [{ y: 936, animated: true }]); assert.equal(h.all('Field')[9].props.focus, 1); h.dispose();
});
test('iOS confirmed queue discard closes the child directly without presenting a short-lived main dialog', async () => {
  const h = setup('ios'); h.dialog.props.onShow(); h.state.queued = [0]; h.state.paused = true; h.dialog.props.onCancel();
  await tick(); h.render(); h.dialog.props.onDismiss(); await tick(); h.render(); h.dialog.props.onShow();
  assert.equal(h.dialog.props.title, 'worker.rezka.print.queue_discard_title'); h.dialog.props.onConfirm(); await tick(); h.render();
  h.dialog.props.onDismiss(); await tick(); assert.deepEqual(h.closes, [false]); h.dispose();
});
for (const platform of ['ios', 'android']) test(`${platform}: report fields use controlled native state and respect readonly and correction focus`, () => {
  let text = 'old', focused = 0, received;
  const nativeState = { get: () => text, set: value => { text = value; } }, native = { useNativeState: () => nativeState, Text: 'NativeText', VStack: 'VStack', TextField: 'SwiftTextField', Host: 'Host',
    OutlinedTextField: Object.assign('ComposeTextField', { Label: 'Label' }) };
  const modifiers = { disabled: value => ({ disabled: value }), keyboardType: value => ({ keyboardType: value }), textFieldStyle: value => ({ textFieldStyle: value }), fillMaxWidth: () => ({ fillMaxWidth: true }) };
  const Field = compile(`components/WorkerReportField.${platform}.tsx`, { 'react/jsx-runtime': jsx, react: { useRef: () => ({ current: { focus: async () => { focused++; } } }), useEffect: fn => fn() },
    '@expo/ui': native, '@expo/ui/swift-ui': native, '@expo/ui/jetpack-compose': native, '@expo/ui/swift-ui/modifiers': modifiers, '@expo/ui/jetpack-compose/modifiers': modifiers, './BaseHost': { BaseHost: 'Host' } }).WorkerReportField;
  const tree = Field({ label: 'Weight', value: '10', change: value => { received = value; }, decimal: true, focus: 1 });
  assert.equal(text, '10'); assert.equal(focused, 1);
  const field = nodes(tree, value => value.type === (platform === 'ios' ? 'SwiftTextField' : native.OutlinedTextField))[0];
  (field.props.onTextChange ?? field.props.onValueChange)('12'); assert.equal(received, '12');
  Field({ label: 'Weight', value: '11', change() {}, disabled: true, focus: 2 }); assert.equal(text, '11'); assert.equal(focused, 1);
  if (platform === 'android') assert.equal(field.props.keyboardOptions.keyboardType, 'decimal'); else assert(field.props.modifiers.some(value => value.keyboardType === 'decimal-pad'));
});
