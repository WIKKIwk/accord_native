const assert = require('node:assert/strict'), fs = require('node:fs'), Module = require('node:module'), path = require('node:path'), test = require('node:test'), ts = require('typescript');
const jsx = { Fragment: 'Fragment', jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
function compile(file, mocks) {
  const filename = path.resolve(__dirname, '../src', file), mod = new Module(filename, module); mod.filename = filename; mod.paths = module.paths;
  mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, filename); return mod.exports;
}
function hooks() {
  let index = 0; const slots = [], effects = [];
  const changed = (a, b) => !a || !b || a.length !== b.length || a.some((value, i) => value !== b[i]);
  const effect = (fn, deps) => { const i = index++; if (!slots[i] || changed(slots[i].deps, deps)) { const old = slots[i]; slots[i] = { deps }; effects.push(() => { old?.cleanup?.(); slots[i].cleanup = fn(); }); } };
  const react = { useRef: initial => { const i = index++; slots[i] ??= { current: initial }; return slots[i]; },
    useState: initial => { const i = index++; slots[i] ??= { value: typeof initial === 'function' ? initial() : initial }; return [slots[i].value, value => { slots[i].value = typeof value === 'function' ? value(slots[i].value) : value; }]; },
    useEffect: effect, useLayoutEffect: effect, useEffectEvent: fn => { const i = index++; if (!slots[i]) slots[i] = { fn, event: (...args) => slots[i].fn(...args) }; slots[i].fn = fn; return slots[i].event; } };
  return { react, begin: () => { index = 0; }, flush: () => { while (effects.length) effects.shift()(); }, dispose: () => slots.forEach(slot => slot?.cleanup?.()) };
}
function nodes(node, type) {
  if (!node || typeof node !== 'object') return []; if (Array.isArray(node)) return node.flatMap(child => nodes(child, type));
  return [...(node.type === type ? [node] : []), ...nodes(node.props?.children, type)];
}
const tick = () => new Promise(setImmediate), p = key => key;
// @v2-test test/admin_production_map_worker_fab_qr_test_part.dart
for (const platform of ['ios', 'android']) {
  function setup() {
    const react = hooks(), h = { chosen: [], hides: 0 }; let resolveHide; const hidden = new Promise(resolve => { resolveHide = resolve; });
    h.resolveHide = resolveHide;
    const native = new Proxy({}, { get: (_, key) => key }), modifiers = new Proxy({}, { get: (_, key) => (...args) => ({ kind: key, args }) });
    const view = compile(`components/WorkerSwitchPrompt.${platform}.tsx`, { 'react/jsx-runtime': jsx, react: react.react,
      '@expo/ui/swift-ui': native, '@expo/ui/swift-ui/modifiers': modifiers, '@expo/ui/jetpack-compose': native, '@expo/ui/jetpack-compose/modifiers': modifiers,
      './BaseHost': { BaseHost: 'Host' }, './useWorkerOrderText': { useWorkerOrderText: () => ({ p }) },
      'react-native': { useWindowDimensions: () => ({ width: 390, height: 840 }) }, 'react-native-safe-area-context': { useSafeAreaInsets: () => ({ bottom: 34 }) } });
    h.render = (canComplete = true) => { react.begin(); return view.WorkerSwitchPrompt({ apparatus: 'Aparat', order: '0031 • Order', canComplete, onChoose: choice => h.chosen.push(choice) }); };
    h.tree = h.render(); h.sheet = nodes(h.tree, platform === 'ios' ? 'BottomSheet' : 'ModalBottomSheet')[0];
    if (platform === 'android') h.sheet.props.ref.current = { hide: () => { h.hides++; return hidden; } };
    return h;
  }
  test(`${platform}: switch choices retain V2 order and optional completion, with native controls`, () => {
    const h = setup(), text = nodes(h.tree, 'Text').map(node => node.props.children);
    const labels = platform === 'ios' ? nodes(h.tree, 'Button').map(node => node.props.label ?? nodes(node, 'Text')[0].props.children) : text.slice(-2);
    assert.deepEqual(labels, ['worker.temporary_pause.action', 'worker.temporary_pause.switch_complete']);
    assert.equal(nodes(h.render(false), platform === 'ios' ? 'Button' : 'OutlinedButton').length, platform === 'ios' ? 1 : 0);
  });
  test(`${platform}: selecting once waits for native dismissal and double taps cannot send another choice`, async () => {
    const h = setup(), button = nodes(h.tree, 'Button')[0];
    if (platform === 'ios') {
      button.props.onPress(); button.props.onPress(); assert.deepEqual(h.chosen, []);
      h.sheet.props.onDismiss(); assert.deepEqual(h.chosen, ['temporary_pause']);
    } else {
      button.props.onClick(); button.props.onClick(); assert.deepEqual(h.chosen, []); assert.equal(h.hides, 1);
      h.resolveHide(); await tick(); assert.deepEqual(h.chosen, ['temporary_pause']);
    }
  });
  test(`${platform}: swipe or outside dismissal cancels without choosing an action`, () => {
    const h = setup();
    if (platform === 'ios') { h.sheet.props.onIsPresentedChange(false); h.sheet.props.onDismiss(); }
    else h.sheet.props.onDismissRequest();
    assert.deepEqual(h.chosen, [null]);
  });
}
function switchSetup({ temporary = true, complete = true, astatka = false, failed = false } = {}) {
  const react = hooks(), h = { valid: true, events: [], owners: 0, prepares: 0 };
  const ctl = { allowed_actions: complete ? ['pause', 'complete'] : ['pause'], interaction: { mode: astatka ? 'completed' : 'in_progress' },
    stage_work: { astatka_required: astatka }, temporary_pause: temporary ? { session_id: 'one', token: 'a'.repeat(64) } : null };
  const data = { control_state: { control: ctl } };
  const { WorkerInitialOrderSwitch } = compile('components/WorkerInitialOrderSwitch.tsx', { react: react.react, 'react/jsx-runtime': jsx,
    '../auth': { subscribeSessionWitness: () => () => {} },
    '../workerControlsApi': { adminTemporarilyPauseWork: async (_s, _a, _o, control, current) => { assert(current()); h.events.push(['write', control.session_id]); if (failed) throw Error('uncertain'); } },
    '../workerFabQr': { prepareWorkerFabQr: async () => { h.prepares++; return { orderId: 'old', scannedOrderId: 'new', switching: true }; },
      workerFabChanged: () => Error('changed'), workerFabTemporaryPause: (_s, _a, _o, value) => value.control_state.control.temporary_pause,
      workerFabErrorText: error => error.message },
    '../workerFabQrReads': { workerFabQrReads: (_s, _a, _g, alive) => { h.owners++; return { current: () => h.valid && alive(), context: async order => {
      h.events.push(['read', order]); if (h.readGate) await h.readGate;
      return { bootstrap: order === 'new' ? { control_state: { control: { allowed_actions: ['start'] } } } : data };
    } }; } },
    './WorkerAlert': { WorkerAlert: 'Alert' }, './WorkerSwitchPrompt': { WorkerSwitchPrompt: 'Prompt' }, './useWorkerOrderText': { useWorkerOrderText: () => ({ p }) } });
  h.props = { session: {}, apparatus: { id: 'apparatus', name: 'Apparat', operation: 'laminate' }, orderId: 'old', orderLabel: 'Old', qr: 'QR', ready: true, data,
    current: () => h.valid, snapshot: () => null, onError: message => h.events.push(['error', message]), onReport: action => h.events.push(['report', action]),
    onPauseStart: () => h.events.push(['pause-start']), onPauseEnd: success => h.events.push(['pause-end', success]), onProceed: () => h.events.push(['proceed']) };
  h.render = () => { react.begin(); h.tree = WorkerInitialOrderSwitch(h.props); react.flush(); return h.tree; }; h.dispose = react.dispose; h.render(); return h;
}
test('initial order switch prepares once and uses one retained scoped read owner', async () => {
  const h = switchSetup(); await tick(); assert.equal(h.render().type, 'Prompt'); h.render(); assert.equal(h.owners, 1); assert.equal(h.prepares, 1); h.dispose();
});
test('cancel never pauses, produces output or enters the scanned order', async () => {
  const h = switchSetup(); await tick(); const old = h.render(); old.props.onChoose(null); old.props.onChoose('temporary_pause'); await tick(); h.render(); assert.equal(h.tree, null); assert(!h.events.some(event => ['write', 'report', 'proceed'].includes(event[0]))); h.dispose();
});
test('temporary pause revalidates the current token, serializes duplicate choices and acknowledges only a confirmed write', async () => {
  for (const failed of [false, true]) {
    const h = switchSetup({ failed }); await tick(); const tree = h.render(); tree.props.onChoose('temporary_pause'); tree.props.onChoose('temporary_pause'); await tick();
    assert.equal(h.events.filter(event => event[0] === 'write').length, 1); assert.deepEqual(h.events.at(-1), ['pause-end', !failed]);
    assert(!h.events.some(event => event[0] === 'report')); h.dispose();
  }
});
test('completion and a pending astatka use measured report flows, without a temporary-pause write', async () => {
  const h = switchSetup(); await tick(); h.render().props.onChoose('complete'); await tick(); assert.deepEqual(h.events.at(-1), ['report', 'complete']); h.dispose();
  const report = switchSetup({ temporary: false, complete: false, astatka: true }); await tick(); report.render().props.alert.onConfirm();
  assert.deepEqual(report.events.at(-1), ['report', 'astatka']); report.dispose();
});
test('losing the owner during pause validation blocks the command and all completion callbacks', async () => {
  const h = switchSetup(); await tick(); const tree = h.render(); let release; h.readGate = new Promise(resolve => { release = resolve; });
  tree.props.onChoose('temporary_pause'); h.valid = false; release(); await tick(); assert(!h.events.some(event => event[0] === 'pause-end'));
  assert(!h.events.some(event => event[0] === 'write')); h.dispose();
});
