const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const jsx = { Fragment: 'Fragment', jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
function load(file, mocks = {}) {
  const filename = path.resolve(__dirname, '../src', file), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths;
  mod.require = name => name === 'react/jsx-runtime' ? jsx : Object.hasOwn(mocks, name) ? mocks[name] : require(name);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { fileName: filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, filename);
  return mod.exports;
}
const tick = () => new Promise(resolve => setImmediate(resolve));
test('Android native picker waits for hide and delivers its detached result only once after dismissal', async () => {
  const events = [], refs = [];
  const Sheet = load('admin/FactoryLocationPickerSheet.android.tsx', { react: { useRef: value => { const ref = { current: value }; refs.push(ref); return ref; } },
    '../components/WorkerOrderSheet.android': { WorkerOrderSheet: 'Sheet' }, './FactoryApparatusPicker.android': { FactoryApparatusPicker: 'Picker' } }).FactoryLocationPickerSheet;
  const tree = Sheet({ apparatus: [], initialSelected: new Set(), onConfirm: value => events.push([...value]), onCancel: () => events.push('cancel') });
  let resolveHide; refs[0].current = { hide: () => new Promise(resolve => { resolveHide = resolve; }) };
  assert.equal(tree.props.heightFraction, 0.78); assert.equal(tree.props.dismissible, true);
  tree.props.children.props.onConfirm(new Set(['one'])); assert.deepEqual(events, []);
  resolveHide(); await tick(); tree.props.onClose(); assert.deepEqual(events, [['one']]);
});
test('iOS native picker resolves confirmation after the native sheet onDismiss callback', () => {
  const events = [], refs = [];
  const Sheet = load('admin/FactoryLocationPickerSheet.ios.tsx', { react: { useRef: value => { const ref = { current: value }; refs.push(ref); return ref; }, useContext: () => () => events.push('hide') },
    '../components/WorkerOrderSheet.ios': { WorkerOrderSheet: 'Sheet' }, '../components/workerSheetContext': { WorkerSheetCloseContext: {} },
    './FactoryApparatusPicker.ios': { FactoryApparatusPicker: 'Picker' } }).FactoryLocationPickerSheet;
  const tree = Sheet({ apparatus: [], initialSelected: new Set(), onConfirm: value => events.push([...value]), onCancel: () => events.push('cancel') });
  assert.equal(tree.props.heightFraction, 0.78); assert.equal(tree.props.dismissible, true);
  const content = tree.props.children.type(tree.props.children.props); content.props.onConfirm(new Set(['one'])); assert.deepEqual(events, ['hide']);
  tree.props.onClose(); tree.props.onClose(); assert.deepEqual(events, ['hide', ['one']]);
});
test('factory session uses original witness for catalog/location sends and refuses later old-owner writes', async () => {
  let current = true; const session = { token: 'real' }, witness = { session }, calls = [];
  const deps = {};
  const sync = load('shared/camera/synchronousGuard.ts');
  const { createFactoryLocationSession } = load('admin/factoryLocationSession.ts', {
    '../shared/camera/synchronousGuard': sync,
    '../auth': { activeSessionEpoch: () => 1, isSessionWitnessCurrent: value => current && value === witness },
    '../apparatusApi': { adminApparatus: async (_session, options) => { calls.push(['catalog', options]); return []; } },
    '../sessionReadScope': { sessionReadScope: () => 'scope' }, '../shared/appRoutes': { appRoutes: { adminFactoryLocations: '/states' }, canOpenRoute: () => true },
    './factoryLocationController': { FactoryLocationController: class { constructor(value) { Object.assign(deps, value); } } },
    './factoryLocationApi': { adminFactoryLocations: async (_session, guard, readWitness) => { calls.push(['locations', guard, readWitness]); return []; },
      adminCreateFactoryLocation: async (_session, _name, _ids, guard) => { guard(); calls.push('write'); } },
  });
  createFactoryLocationSession(session, witness, () => true);
  const guard = () => { if (!deps.isCurrent()) throw new Error('retired'); };
  await deps.readLocations(guard); await deps.readApparatus(guard);
  assert.equal(calls[0][2](), true); assert.equal(calls[1][1].readWitness(), true); assert.equal(calls[1][1].limit, 10000);
  current = false; assert.equal(calls[0][2](), false); assert.equal(calls[1][1].readWitness(), false);
  current = true; assert.equal(deps.isCurrent(), false);
  await assert.rejects(deps.create('New', [], guard), /retired/); assert.equal(calls.includes('write'), false);
});
test('factory location GET threads guarded transport and checks its original guard after body parsing', async () => {
  let current = true, request;
  const guard = () => { if (!current) throw new Error('retired'); }, witness = () => current;
  const api = load('admin/factoryLocationApi.ts', { '../authorizedFetch': { authorizedFetch: async (...args) => {
    request = args; return { status: 200, json: async () => { current = false; return []; } };
  } }, '../shared/mobileApiException': {}, './adminApiError': {}, './dartJsonString': { dartTrim: value => value.trim() },
    './factoryLocationModel': { adminFactoryLocationFromJson: value => value } });
  await assert.rejects(api.adminFactoryLocations({}, guard, witness), /retired/);
  assert.equal(request[5].readWitness, witness); assert.equal(request[3], guard);
});
