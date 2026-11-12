const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

const jsx = { Fragment: 'Fragment', jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
function nodes(tree, predicate) {
  if (Array.isArray(tree)) return tree.flatMap(child => nodes(child, predicate));
  if (!tree || typeof tree !== 'object') return [];
  return [...(predicate(tree) ? [tree] : []), ...nodes(tree.props?.children, predicate)];
}
function render(platform, complete) {
  const calls = [], values = { meter: '', kg: '', bobina: '', wip: '', film: '', waste: '', note: '' };
  const state = { phase: 'edit', snapshot: { session_status: 'active' }, values, receipt: null, error: '' };
  class Workflow {
    subscribe() {} getSnapshot() { return state; }
    change(key, value) { calls.push([key, value]); } submit() { calls.push(['submit']); }
  }
  const react = { useState: initial => [typeof initial === 'function' ? initial() : initial, () => {}],
    useRef: current => ({ current }), useMemo: fn => fn(), useCallback: fn => fn,
    useLayoutEffect() {}, useEffect() {}, useSyncExternalStore: (_subscribe, get) => get() };
  const mocks = { 'react/jsx-runtime': jsx, react, 'expo-crypto': { randomUUID: () => 'uuid' }, 'expo-image': { Image: 'Image' },
    'qrcode-generator': () => ({}), 'react-native': { ActivityIndicator: 'ActivityIndicator', Platform: { OS: platform }, Text: 'Text', View: 'View' },
    '../auth': { activeSessionToken: () => 'token', subscribeSessionWitness: () => () => {} },
    '../sessionReadScope': { sessionReadScope: () => 'scope' }, '../workerLaminationApi': {}, '../laminationAstatkaSubmitApi': {},
    '../workerLayerRemainderReprintApi': {}, '../workerLaminationRemainders': { laminationAstatkaInputRoll: () => null },
    '../workerLaminationWorkflow': { WorkerLaminationWorkflow: Workflow }, '../workerPrinting': { WorkerPrintCancelled: class extends Error {} },
    '../productionProgressReprintApi': {}, '../workerQueueAction': {}, '../workerReportPendingStore': {},
    './WorkerFormDialog': { WorkerFormDialog: 'Dialog' }, './WorkerFormField': { WorkerFormField: 'FormField' },
    './WorkerProgressField': { WorkerProgressField: 'ProgressField' }, './WorkerOrderControls': { WorkerOrderButton: 'Button' },
    './useWorkerOrderText': { useWorkerOrderText: () => ({ p: key => key, t: key => key }) },
    './useWorkerColors': { useWorkerColors: () => ({ text: 'text', muted: 'muted', error: 'error' }) },
    './useWorkerPrinterSelector': { useWorkerPrinterSelector: () => ({ selectDevice() {}, dialogs: null }) } };
  const filename = path.resolve(__dirname, '../src/components/WorkerLaminationReport.tsx'), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths;
  mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  } }).outputText, filename);
  const tree = mod.exports.WorkerLaminationReport({ session: { baseUrl: 'server', profile: { role: 'aparatchi', ref: 'worker' } },
    context: { apparatus: 'machine', orderId: 'order', stage: 'stage', complete, fullReport: true }, onAttempted() {}, onCommitted() {}, onClose() {} });
  return { tree, calls };
}

for (const platform of ['android', 'ios']) test(`${platform}: integrated lamination completion preserves its quantity fields and action`, () => {
  const { tree, calls } = render(platform, true), dialog = nodes(tree, node => node.type === 'Dialog')[0];
  assert.equal(dialog.props.progressAction, platform === 'android' ? 'complete' : undefined);
  const fields = nodes(dialog, node => node.type === 'ProgressField');
  assert.equal(fields.length, 7);
  assert.deepEqual(fields.slice(0, 3).map(field => field.props.label), [
    'worker.daily.field.length (m)', 'worker.daily.field.weight (kg)', 'worker.daily.field.roll (kg)',
  ]);
  fields[0].props.onChangeText('100,5'); dialog.props.onConfirm();
  assert.deepEqual(calls, [['meter', '100,5'], ['submit']]);
});
test('Android lamination astatka retains its existing dialog', () => {
  const { tree } = render('android', false), dialog = nodes(tree, node => node.type === 'Dialog')[0];
  assert.equal(dialog.props.progressAction, undefined);
  assert.equal(nodes(dialog, node => node.type === 'ProgressField').length, 0);
  assert.equal(nodes(dialog, node => node.type === 'FormField').length, 7);
});
