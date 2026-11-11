const assert = require('node:assert/strict'), fs = require('node:fs'), Module = require('node:module'), path = require('node:path'), test = require('node:test'), ts = require('typescript');
function fixture() {
  const refs = [], effects = [], opened = [], calls = []; let cursor = 0, current = true;
  const filename = path.resolve(__dirname, '../src/components/useWorkerPrinterSelector.ios.tsx'), mod = new Module(filename, module);
  const mocks = {
    react: { useRef: initial => refs[cursor++] ??= { current: initial }, useEffect: effect => effects.push(effect), useContext: () => () => calls.push('native-close') },
    'react/jsx-runtime': { jsx: (type, props) => ({ type, props }) },
    '../nativeSheet': { useNativeSheet: () => ({ open: (content, options) => opened.push({ content, options }), close: () => calls.push('route-close') }) },
    '../preparation/PreparationPrinterPicker': { PreparationPrinterPicker: 'Picker' }, './workerSheetContext': { WorkerSheetCloseContext: {} },
  };
  mod.require = id => mocks[id]; mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, filename);
  return { opened, calls, effects, expire: () => { current = false; }, render() { cursor = 0; return mod.exports.useWorkerPrinterSelector(() => current); } };
}
test('worker printer choice waits for native dismissal before handing the printer to a report', async () => {
  const h = fixture(), owner = h.render(), printer = { transport: 'bluetooth', printer: { address: 'unit' } };
  let settled = false; const pending = owner.selectDevice().then(value => { settled = true; return value; });
  const first = h.opened[0], picker = first.content.type(first.content.props);
  assert.equal(picker.props.emptyLabel, 'Bluetooth printer topilmadi');
  assert.equal(picker.props.title, 'Bluetooth printer');
  picker.props.select(printer); await Promise.resolve();
  assert.deepEqual(h.calls, ['native-close']); assert.equal(settled, false);
  first.options.onDismiss(); assert.deepEqual(await pending, printer);
  const next = owner.selectDevice(); first.options.onDismiss();
  let nextSettled = false; next.then(() => { nextSettled = true; }); await Promise.resolve();
  assert.equal(nextSettled, false, 'a delayed old native dismissal cannot settle a later picker');
  h.opened[1].options.onDismiss(); assert.equal(await next, null);
});
test('expired worker printer selections cannot continue a report', async () => {
  const h = fixture(), owner = h.render(), pending = owner.selectDevice(), entry = h.opened[0];
  entry.content.type(entry.content.props).props.select({ transport: 'bluetooth' }); h.expire(); entry.options.onDismiss();
  assert.equal(await pending, null); assert.equal(await owner.selectDevice(), null);
});
