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
    '../sessionReadScope': { sessionReadScope: () => `scope:${h.version}` }, './useWorkerWipSheet': { useWorkerWipSheet: () => ({ sheet, dialogs: null }) },
    '../workerDetailApi': { workerProductionOrderDetail: async () => { h.reads++; if (h.mapError) throw h.mapError; if (h.mapRead) return h.mapRead.promise; return { maps: [{ map: { id: 'o', nodes: [] } }] }; } },
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
test('a failed full-detail read shows the source notice and never starts a reactivation preview', async () => {
  for (const error of [Error('Network'), Object.assign(Error('Source API detail'), { name: 'MobileApiException' })]) {
    const h = setup({ mapError: error });
    try {
      await h.model.open(batch);
      assert.deepEqual(h.notices, [error.name === 'MobileApiException' ? error.message : 'worker.error.sync']);
      assert.equal(h.previews.length, 0); assert.equal(h.writes, 0); assert.equal(h.sheet.shown, false);
      h.mapError = null;
      const retry = h.model.open(batch); await tick(); assert.equal(h.previews.length, 1);
      h.dismissMenu(); await retry;
    } finally { h.unmount(); }
  }
});
// @v2-test test/admin_production_map_reactivation_test_part.dart
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

function completedMenu(completed = true, platform = 'ios') {
  const runner = hooks(), h = { version: 1, reads: 0, previews: 0, writes: 0, choices: [], closes: 0 };
  const p = key => key, close = () => h.closes++;
  runner.react.useContext = () => close;
  const review = { target: { token: 'preview' }, reason: '', identity: '0304\nKesish\n2-bosqich', actionKey: 'worker.reactivate.action', explanationKey: 'worker.reactivate.explanation' };
  const file = path.resolve(__dirname, '../src/components/WorkerLongPressActions.tsx'), mod = new Module(file, module); mod.paths = module.paths;
  const mocks = {
    react: runner.react, 'react/jsx-runtime': jsx, '@expo/ui': { Button: 'Button', Host: 'Host' },
    'react-native': { ActivityIndicator: 'Spinner', Platform: { OS: platform }, StyleSheet: { create: value => value }, Text: 'Text', View: 'View' },
    '../auth': { activeSessionToken: () => 'token', captureSessionWitness: () => ({ version: h.version }), isSessionWitnessCurrent: witness => witness.version === h.version },
    '../sessionReadScope': { sessionReadScope: () => `scope:${h.version}` },
    '../workerLongPress': { readWorkerActionControl: async () => ({}), workerLongPressMenu: () => ({ kind: 'bosma', operation: 'print',
      actions: ['temporary_pause', 're_pause', 'astatka', 'finish'], control: { state: 'in_progress' } }) }, '../workerWipApi': {}, '../workerHandoff': {},
    '../workerDetailApi': { workerProductionOrderDetail: async () => { h.reads++; return { maps: [{ map: { id: 'o', nodes: [] } }] }; } },
    '../workerWipReactivation': { prepareWorkerWipReactivation: async (_session, input) => { h.previews++; assert.equal(input.batch, undefined); return review; },
      workerReactivationDenialKey: reason => `worker.reactivate.reason.${reason}`,
      runWorkerWipReactivation: async (_session, candidate, current) => { assert.equal(candidate, review); if (!current()) return { attempted: false, succeeded: false, reason: '' }; h.writes++; return { attempted: true, succeeded: true, reason: '' }; } },
    './useWorkerColors': { useWorkerColors: () => ({}) }, './useWorkerOrderText': { useWorkerOrderText: () => ({ p }) },
    './workerSheetContext': { WorkerSheetCloseContext: {} }, './WorkerAlert': { WorkerAlert: 'Alert' }, './WorkerIconButton': { WorkerIconButton: 'Icon' }, './WorkerOrderControls': { WorkerOrderButton: 'Action' },
  };
  mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, file);
  const props = { session: {}, apparatusId: 'cut', apparatusName: 'Kesish', operation: completed ? 'cut' : 'print', order: { id: 'o', code: '0304', title: 'Film' }, completed,
    prepared: completed ? { kind: 'reactivation', reactivation: review } : { kind: 'menu', menu: { kind: 'bosma', operation: 'print',
      actions: ['temporary_pause', 're_pause', 'astatka', 'finish'], control: { state: 'in_progress' } } },
    onChoose: choice => h.choices.push(choice) };
  const render = () => { runner.begin(); const tree = mod.exports.WorkerLongPressActions(props); runner.flush(); return tree; };
  return Object.assign(h, { props, render, unmount: runner.dispose, review });
}

test('Android long-press actions use full-size buttons across worker menus and retain their choices', () => {
  const cases = [
    { kind: 'report', operation: 'laminate', actions: ['temporary_pause', 're_pause', 'finish'], labels: ['worker.temporary_pause.action', 'worker.re_pause.action', 'worker.laminatsiya.astatka.title'], choice: 'astatka' },
    { kind: 'bosma', operation: 'print', actions: ['temporary_pause', 're_pause', 'astatka', 'finish'], labels: ['worker.temporary_pause.action', 'worker.re_pause.action', 'worker.bosma.astatka.title', 'worker.finish.title'], choice: 'complete' },
    { kind: 'handoff', operation: 'laminate', actions: ['resume', 'detach_roll', 'astatka'], labels: ['worker.handoff.continue', 'worker.handoff.detach', 'worker.bosma.astatka.title'], choice: 'resume', button: 0 },
    { kind: 'reopen', operation: 'print', actions: ['reopen'], labels: ['worker.print_preflight.reopen.action'] },
  ];
  for (const item of cases) {
    const h = completedMenu(false, 'android');
    try {
      h.props.operation = item.operation;
      h.props.prepared = { kind: 'menu', menu: { kind: item.kind, operation: item.operation, actions: item.actions } };
      const buttons = nodes(h.render(), node => node.type === 'Action');
      assert.deepEqual(buttons.map(button => button.props.label), item.labels);
      assert.ok(buttons.every(button => button.props.height === 56));
      if (item.choice) {
        buttons[item.button ?? buttons.length - 1].props.onPress();
        assert.deepEqual(h.choices, [item.choice]); assert.equal(h.closes, 1);
      }
    } finally { h.unmount(); }
  }
  const h = completedMenu(true, 'android');
  try {
    const button = nodes(h.render(), node => node.type === 'Action')[0];
    assert.equal(button.props.height, 56);
    button.props.onPress(); assert.equal(h.choices.length, 1); assert.equal(h.closes, 1);
  } finally { h.unmount(); }
});

test('iOS long-press menu renders all four full-width platform actions with separate order identity and semantic colors', async () => {
  const h = completedMenu(false);
  try {
    h.render(); await tick(); const tree = h.render();
    const buttons = nodes(tree, node => node.type === 'Action');
    assert.deepEqual(buttons.map(node => [node.props.label, node.props.orderAction]), [
      ['worker.temporary_pause.action', 'pause'], ['worker.re_pause.action', 'pause'],
      ['worker.bosma.astatka.title', 'report'], ['worker.finish.title', 'complete'],
    ]);
    assert.ok(buttons.every(button => button.props.height === undefined));
    const code = nodes(tree, node => node.type === 'Text' && node.props.children === '0304')[0];
    assert.equal(code.props.style[0].fontSize, 22);
    assert.ok(nodes(tree, node => node.type === 'Text' && node.props.children === 'Film')[0]);
    assert.equal(nodes(tree, node => node.type === 'Icon')[0].props.neutralIcon, true);
    assert.equal(nodes(tree, node => node.type === 'Icon')[0].props.tonal, true);
    buttons.at(-1).props.onPress(); buttons.at(-1).props.onPress();
    assert.deepEqual(h.choices, ['complete']); assert.equal(h.closes, 1);
  } finally { h.unmount(); }
});

test('prepared completed-order menu never refetches through rerenders, native dismissal and confirmation', async () => {
  const h = completedMenu();
  try {
    h.render(); await tick(); h.render(); const tree = h.render();
    const action = nodes(tree, node => node.type === 'Action' && node.props.label === h.review.actionKey)[0];
    action.props.onPress(); action.props.onPress();
    assert.equal(h.choices.length, 1); assert.equal(h.closes, 1); assert.equal(h.reads, 0); assert.equal(h.previews, 0); assert.equal(h.writes, 0);
    assert.equal(h.choices[0].confirmation.message, `${h.review.identity}\n\nworker.reactivate.explanation`);
    h.unmount();
    assert.equal(await h.choices[0].run(() => null), 'worker.reactivate.success');
    assert.equal(h.reads, 0); assert.equal(h.previews, 0); assert.equal(h.writes, 1);
  } finally { h.unmount(); }
});

test('completed-order confirmation cannot write through an account change after menu dismissal', async () => {
  const h = completedMenu();
  try {
    h.render(); await tick(); const tree = h.render();
    nodes(tree, node => node.type === 'Action' && node.props.label === h.review.actionKey)[0].props.onPress();
    h.unmount(); h.version++;
    assert.equal(await h.choices[0].run(() => null), ''); assert.equal(h.writes, 0); assert.equal(h.previews, 0);
  } finally { h.unmount(); }
});
