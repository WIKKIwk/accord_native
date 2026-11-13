// Rendered native-control contract only; actual VoiceOver and keyboard layout require a phone.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const jsx = { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
function find(node, predicate) {
  if (!node || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap(value => find(value, predicate));
  return [...(predicate(node) ? [node] : []), ...find(node.props?.children, predicate)];
}
test('shared scanner dialog retains the manual barcode label and value on iOS', () => {
  const filename = path.resolve(__dirname, '../src/components/WorkerQrScannerDialogs.tsx'), mod = new Module(filename, module);
  const calls = [], labels = { manual: 'Kodni kiriting', payload: 'QR / shtrix-kod', cancel: 'Bekor qilish', verify: 'Tekshirish' };
  const model = { labels, error: '', manualOpen: true, manual: 'ROLL-123', busy: false,
    setManual: value => calls.push(value), cancelManual() {}, confirmManual() {}, manualDismissed() {}, clearError() {} };
  const mocks = { 'react/jsx-runtime': jsx, './WorkerAlert': { WorkerAlert: 'WorkerAlert' },
    './WorkerFormDialog': { WorkerFormDialog: 'WorkerFormDialog' }, './WorkerFormField': { WorkerFormField: 'WorkerFormField' } };
  mod.filename = filename; mod.paths = module.paths; mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, filename);
  const tree = mod.exports.WorkerQrScannerDialogs({ model }), field = find(tree, node => node.type === 'WorkerFormField')[0];
  assert.equal(field.props.label, labels.payload); assert.equal(field.props.initialValue, 'ROLL-123');
  field.props.onChangeText('ROLL-456'); assert.deepEqual(calls, ['ROLL-456']);
});

test('iOS printer picker reuses the dismissible native sheet and all existing transport choices', () => {
  const filename = path.resolve(__dirname, '../src/homashyo/RawSplitPickerOverlay.ios.tsx'), mod = new Module(filename, module);
  let closed = 0;
  const close = () => { closed++; };
  const mocks = { 'react/jsx-runtime': jsx,
    '../components/WorkerOrderSheet': { WorkerOrderSheet: 'WorkerOrderSheet' },
    '../shared/printing/DeviceSheet': { DeviceSheet: 'DeviceSheet' },
    '../preparation/PreparationUI': { usePreparationText: () => value => value },
    './useRawSplitPickerOverlay': { useRawSplitPickerOverlay: () => close } };
  mod.filename = filename; mod.paths = module.paths; mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, filename);
  const adapter = {}, tree = mod.exports.RawSplitPickerOverlay({ request: { adapter }, owner: {} });
  assert.equal(tree.type, 'WorkerOrderSheet'); assert.equal(tree.props.dismissible, true);
  const picker = find(tree, node => node.type === 'DeviceSheet')[0];
  assert.equal(picker.props.operator, adapter); assert.equal(picker.props.safe, true); assert.equal(picker.props.printerOnly, undefined);
  tree.props.onClose(); picker.props.close(); assert.equal(closed, 2);
});
