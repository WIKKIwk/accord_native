const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
function fixture() {
  const filename = path.resolve(__dirname, '../src/boyoqchi/useReturnedPaintForm.tsx'), loaded = new Module(filename, module);
  const pendingLoad = deferred(), pendingSave = deferred(), opened = [], cleared = [], refreshed = [];
  let current = true;
  const store = { isCurrent: () => current, load: () => pendingLoad.promise, clear: async id => {
    if (!current) throw new Error('Sessiya tugagan'); cleared.push(id);
  } };
  const sheet = { isOpen: () => false, open: value => opened.push(value), close() {}, update() {} };
  const mocks = {
    'react/jsx-runtime': { jsx: (type, props) => ({ type, props }) },
    react: { useRef: value => ({ current: value }), useEffect: effect => { effect(); } },
    '../nativeSheet': { useNativeSheet: () => sheet }, './BoyoqchiForm': { BoyoqchiForm: 'BoyoqchiForm' },
    './returnedPaintApi': { completeReturnedPaint: () => pendingSave.promise },
    './returnedPaintCompletion': { ReturnedPaintReconciliationError: class extends Error {}, verifyReturnedPaintCompletion() {} },
    './returnedPaintDraftRuntime': { returnedPaintDraftStoreFor: () => store },
  };
  loaded.filename = filename; loaded.paths = module.paths;
  loaded.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, filename);
  const open = loaded.exports.useReturnedPaintForm({ baseUrl: 'https://alpha.invalid', profile: { role: 'boyoqchi', ref: 'actor' } },
    { refresh: async () => { refreshed.push(true); } });
  return { open, pendingLoad, pendingSave, opened, cleared, refreshed, switchSession: () => { current = false; } };
}

test('an old account draft load does not open a sheet after account switch', async () => {
  const f = fixture(), pending = f.open({ id: 'request', image: null });
  f.switchSession(); f.pendingLoad.resolve({}); await pending;
  assert.deepEqual(f.opened, []);
});

test('a save resolving after account switch does not clear a draft or refresh the new session', async () => {
  const f = fixture(), pending = f.open({ id: 'request', image: null });
  f.pendingLoad.resolve({}); await pending;
  const saving = f.opened[0].props.save([]);
  f.switchSession(); f.pendingSave.resolve({});
  await assert.rejects(saving, /Sessiya tugagan/);
  assert.deepEqual(f.cleared, []); assert.deepEqual(f.refreshed, []);
});
