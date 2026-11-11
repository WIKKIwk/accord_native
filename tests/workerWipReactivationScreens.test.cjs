const assert = require('node:assert/strict'), fs = require('node:fs'), Module = require('node:module'), path = require('node:path'), test = require('node:test'), ts = require('typescript');
const { hooks } = require('./support/workerPaddonHarness.cjs');
const tick = () => new Promise(setImmediate);
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const jsx = { jsx: (type, props) => ({ type, props: props ?? {} }), jsxs: (type, props) => ({ type, props: props ?? {} }), Fragment: 'Fragment' };
function nodes(tree, predicate) { if (!tree || typeof tree !== 'object') return []; if (Array.isArray(tree)) return tree.flatMap(value => nodes(value, predicate)); return [...(predicate(tree) ? [tree] : []), ...nodes(tree.props?.children, predicate)]; }
function setup(extra = {}) {
  const runner = hooks(), h = { version: 1, reads: 0, previews: [], writes: 0, attempted: 0, details: [], fences: [], notices: [], nativeCloses: 0, routeCloses: 0, ...extra };
  const sheet = { shown: false, content: null, options: null, isOpen() { return this.shown; }, open(content, options) { this.content = content; this.options = options; this.shown = true; }, close() { h.routeCloses++; } };
  const presentation = { data: null, visible: false, notice: '', isOpen: () => !!h.confirmResolve, close() {}, dismissed() {},
    open(data) { h.confirmation = data; return new Promise(resolve => { h.confirmResolve = resolve; }); }, message: value => h.notices.push(value) };
  const p = (key, values) => key + (values ? `:${JSON.stringify(values)}` : '');
  runner.react.useContext = () => () => { h.nativeCloses++; };
  h.review = { target: { token: 'preview' }, reason: '', identity: '0304\nBosma\nQR', actionKey: 'worker.reactivate.wip_action', explanationKey: 'worker.reactivate.wip_explanation' };
  const file = path.resolve(__dirname, '../src/components/useWorkerWipReactivation.tsx'), mod = new Module(file, module); mod.paths = module.paths;
  const mocks = {
    react: runner.react, 'react/jsx-runtime': jsx, 'react-native': { Text: 'Text', View: 'View' },
    '../auth': { activeSessionToken: () => 'token', captureSessionWitness: () => ({ version: h.version }), isSessionWitnessCurrent: witness => witness.version === h.version,
      subscribeSessionWitness: fn => { h.witnessChanged = fn; return () => {}; } },
    '../sessionReadScope': { sessionReadScope: () => `scope:${h.version}` }, '../nativeSheet': { useNativeSheet: () => sheet },
    '../workerDetailApi': { workerProductionOrderDetail: async () => { h.reads++; if (h.mapRead) return h.mapRead.promise; return { maps: [{ map: { id: 'o', nodes: [] } }] }; } },
    '../workerWipReactivation': { prepareWorkerWipReactivation: async (_session, input) => { h.previews.push(input); return h.review; }, workerReactivationDenialKey: reason => `worker.reactivate.reason.${reason || 'unavailable'}`,
      runWorkerWipReactivation: async () => { h.writes++; return h.write ? h.write.promise : { attempted: true, succeeded: true, reason: '' }; } },
    './WorkerSheetButton': { WorkerSheetButton: 'Action' }, './WorkerPaddonDialog': { WorkerPaddonDialog: 'Dialog' }, './WorkerPaddonFeedback': { WorkerPaddonFeedback: 'Feedback' },
    './useWorkerPaddonPresentation': { useWorkerPaddonPresentation: () => presentation }, './useWorkerOrderText': { useWorkerOrderText: () => ({ p }) },
    './useWorkerColors': { useWorkerColors: () => ({}) }, './WorkerAlert': { WorkerAlert: 'Alert' }, './workerSheetContext': { WorkerSheetCloseContext: {} },
  };
  mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, file);
  const props = { session: { profile: { role: 'aparatchi', ref: 'me' } }, order: { id: 'o', code: '0304', title: 'Film', apparatusId: 'apparatus:default:cut' }, apparatusNames: { 'apparatus:default:cut': 'Kesish' },
    operation: 'cut', allowReactivation: true, showDetails: batch => h.details.push(batch.batch_id), onAttempted: () => h.attempted++, onWritePending: value => h.fences.push(value), ...extra.props };
  const render = () => { runner.begin(); const result = mod.exports.useWorkerWipReactivation(props); runner.flush(); return result; };
  h.model = render();
  return Object.assign(h, { props, sheet, render, unmount: runner.dispose,
    choose(value) { const menu = sheet.content.type(sheet.content.props), label = value === 'details' ? 'worker.reactivate.details' : h.review.actionKey;
      nodes(menu, node => node.type === 'Action' && node.props.label === label)[0].props.onPress(); },
    dismissMenu() { sheet.shown = false; sheet.options.onDismiss(); }, confirm(value) { const resolve = h.confirmResolve; h.confirmResolve = null; resolve(value); } });
}
const batch = { batch_id: 'selected', qr_payload: 'QR' };
// @v2-test test/production_work_reactivation_test.dart
test('WIP long press previews its selected batch, dismisses native sheet, then confirms before a single fenced write', async () => {
  const h = setup();
  try {
    const pending = h.model.open(batch); h.model.open(batch); await tick();
    assert.equal(h.reads, 1); assert.equal(h.previews.length, 1); assert.deepEqual(h.previews[0].batch, batch);
    h.choose('reactivate'); assert.equal(h.nativeCloses, 1); assert.equal(h.routeCloses, 0, 'selection must close the SwiftUI sheet rather than pop its presenter');
    await tick(); assert.equal(h.confirmation, undefined); assert.equal(h.writes, 0);
    h.dismissMenu(); await tick(); assert.equal(h.confirmation.title, 'worker.reactivate.wip_action'); assert.equal(h.writes, 0);
    assert.equal(h.confirmation.confirmLabel, 'worker.reactivate.confirm');
    h.confirm('confirm'); await pending;
    assert.equal(h.writes, 1); assert.equal(h.attempted, 1); assert.deepEqual(h.fences, [true, false]); assert.deepEqual(h.notices, ['worker.reactivate.success']);
  } finally { h.unmount(); }
});

test('WIP details choice and cancellation wait for dismissal and never reactivate', async () => {
  for (const action of ['details', 'cancel']) {
    const h = setup();
    try {
      const pending = h.model.open(batch); await tick();
      if (action === 'details') h.choose('details');
      assert.deepEqual(h.details, []); h.dismissMenu(); await pending;
      assert.deepEqual(h.details, action === 'details' ? ['selected'] : []); assert.equal(h.writes, 0); assert.deepEqual(h.fences, []);
    } finally { h.unmount(); }
  }
});

test('retired menu callbacks cannot close the next sheet, and a stale account cannot confirm an old preview', async () => {
  const h = setup();
  try {
    const first = h.model.open(batch); await tick(); const retiredChoose = h.sheet.content.props.choose;
    h.dismissMenu(); await first;
    const next = h.model.open(batch); await tick(); retiredChoose('reactivate'); h.dismissMenu(); await next;
    assert.equal(h.confirmation, undefined); assert.equal(h.writes, 0);
    const pending = h.model.open(batch); await tick(); h.choose('reactivate'); h.dismissMenu(); await tick();
    h.version++; h.witnessChanged(); h.confirm('confirm'); await pending;
    assert.equal(h.writes, 0); assert.deepEqual(h.fences, []);
  } finally { h.unmount(); }
});

test('uncertain WIP reactivation reconciles once and releases write fence only when the POST settles, including unmount', async () => {
  for (const unmount of [false, true]) {
    const h = setup({ write: deferred() });
    try {
      const pending = h.model.open(batch); await tick(); h.choose('reactivate'); h.dismissMenu(); await tick(); h.confirm('confirm'); await tick();
      assert.deepEqual(h.fences, [true]); assert.equal(h.writes, 1);
      if (unmount) h.unmount();
      h.write.resolve({ attempted: true, succeeded: false, reason: 'stale_target' }); await pending;
      assert.deepEqual(h.fences, [true, false]); assert.equal(h.attempted, unmount ? 0 : 1);
      assert.deepEqual(h.notices, unmount ? [] : ['worker.reactivate.reason.stale_target\nworker.reactivate.unconfirmed']);
      assert.equal(h.writes, 1);
    } finally { h.unmount(); }
  }
});

test('read-only and unsupported operations retain ordinary details without a reactivation read', async () => {
  for (const props of [{ allowReactivation: false }, { operation: 'print' }]) {
    const h = setup({ props });
    try { await h.model.open(batch); assert.deepEqual(h.details, ['selected']); assert.equal(h.reads, 0); assert.equal(h.writes, 0); }
    finally { h.unmount(); }
  }
});

function completedMenu() {
  const runner = hooks(), h = { version: 1, reads: 0, previews: 0, writes: 0, choices: [], closes: 0 };
  const p = key => key, close = () => h.closes++;
  runner.react.useContext = () => close;
  const review = { target: { token: 'preview' }, reason: '', identity: '0304\nKesish\n2-bosqich', actionKey: 'worker.reactivate.action', explanationKey: 'worker.reactivate.explanation' };
  const file = path.resolve(__dirname, '../src/components/WorkerLongPressActions.tsx'), mod = new Module(file, module); mod.paths = module.paths;
  const mocks = {
    react: runner.react, 'react/jsx-runtime': jsx, '@expo/ui': { Button: 'Button', Host: 'Host' },
    'react-native': { ActivityIndicator: 'Spinner', Platform: { OS: 'ios' }, StyleSheet: { create: value => value }, Text: 'Text', View: 'View' },
    '../auth': { activeSessionToken: () => 'token', captureSessionWitness: () => ({ version: h.version }), isSessionWitnessCurrent: witness => witness.version === h.version },
    '../sessionReadScope': { sessionReadScope: () => `scope:${h.version}` }, '../workerLongPress': {}, '../workerWipApi': {}, '../workerHandoff': {},
    '../workerDetailApi': { workerProductionOrderDetail: async () => { h.reads++; return { maps: [{ map: { id: 'o', nodes: [] } }] }; } },
    '../workerWipReactivation': { prepareWorkerWipReactivation: async (_session, input) => { h.previews++; assert.equal(input.batch, undefined); return review; },
      workerReactivationDenialKey: reason => `worker.reactivate.reason.${reason}`,
      runWorkerWipReactivation: async (_session, candidate, current) => { assert.equal(candidate, review); if (!current()) return { attempted: false, succeeded: false, reason: '' }; h.writes++; return { attempted: true, succeeded: true, reason: '' }; } },
    './useWorkerColors': { useWorkerColors: () => ({}) }, './useWorkerOrderText': { useWorkerOrderText: () => ({ p }) },
    './workerSheetContext': { WorkerSheetCloseContext: {} }, './WorkerAlert': { WorkerAlert: 'Alert' }, './WorkerIconButton': { WorkerIconButton: 'Icon' }, './WorkerSheetButton': { WorkerSheetButton: 'Action' },
  };
  mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, file);
  const props = { session: {}, apparatusId: 'cut', apparatusName: 'Kesish', operation: 'cut', order: { id: 'o', code: '0304', title: 'Film' }, completed: true,
    getCursor: () => ({ epoch: 'e', rev: 1 }), onChoose: choice => h.choices.push(choice) };
  const render = () => { runner.begin(); const tree = mod.exports.WorkerLongPressActions(props); runner.flush(); return tree; };
  return Object.assign(h, { render, unmount: runner.dispose, review });
}

test('completed-order menu keeps one preview through native dismissal and confirmation, without a second detail read', async () => {
  const h = completedMenu();
  try {
    h.render(); await tick(); const tree = h.render();
    const action = nodes(tree, node => node.type === 'Action' && node.props.label === h.review.actionKey)[0];
    action.props.onPress(); action.props.onPress();
    assert.equal(h.choices.length, 1); assert.equal(h.closes, 1); assert.equal(h.reads, 1); assert.equal(h.previews, 1); assert.equal(h.writes, 0);
    assert.equal(h.choices[0].confirmation.message, `${h.review.identity}\n\nworker.reactivate.explanation`);
    h.unmount();
    assert.equal(await h.choices[0].run(() => null), 'worker.reactivate.success');
    assert.equal(h.reads, 1); assert.equal(h.previews, 1); assert.equal(h.writes, 1);
  } finally { h.unmount(); }
});

test('completed-order confirmation cannot write through an account change after menu dismissal', async () => {
  const h = completedMenu();
  try {
    h.render(); await tick(); const tree = h.render();
    nodes(tree, node => node.type === 'Action' && node.props.label === h.review.actionKey)[0].props.onPress();
    h.unmount(); h.version++;
    assert.equal(await h.choices[0].run(() => null), ''); assert.equal(h.writes, 0); assert.equal(h.previews, 1);
  } finally { h.unmount(); }
});
