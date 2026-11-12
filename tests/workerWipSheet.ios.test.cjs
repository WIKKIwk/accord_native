const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), Module = require('node:module'), test = require('node:test'), ts = require('typescript');
const { hooks } = require('./support/workerPaddonHarness.cjs');
const jsx = (type, props, key) => ({ type, props: props ?? {}, key });

function harness() {
  const runner = hooks(), calls = { nativeCloses: 0, dismissals: 0 };
  const nativeClose = () => { calls.nativeCloses++; };
  runner.react.useContext = () => nativeClose;
  const file = path.resolve(__dirname, '../src/components/useWorkerWipSheet.ios.tsx');
  const mod = new Module(file, module);
  const mocks = { react: runner.react, 'react/jsx-runtime': { jsx, jsxs: jsx },
    './WorkerOrderSheet': { WorkerOrderSheet: 'Sheet' }, './workerSheetContext': { WorkerSheetCloseContext: {} } };
  mod.require = name => { assert(Object.hasOwn(mocks, name), `unexpected dependency or root-route navigation: ${name}`); return mocks[name]; };
  mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, file);
  const render = () => {
    runner.begin(); const model = mod.exports.useWorkerWipSheet();
    if (model.dialogs) {
      const child = model.dialogs.props.children;
      child.type(child.props);
    }
    runner.flush(); return model;
  };
  return { calls, render, dispose: runner.dispose, initial: render() };
}

test('iOS WIP detail stays inside its parent and resolves only after the child native sheet dismisses', () => {
  const h = harness();
  const sheet = h.initial.sheet;
  sheet.open('WIP information', { dismissible: true, onDismiss: () => h.calls.dismissals++ });
  sheet.open('duplicate gesture');
  const first = h.render();
  assert.equal(first.dialogs.type, 'Sheet');
  assert.equal(first.dialogs.props.children.props.children, 'WIP information');
  assert.equal(first.sheet, sheet);
  sheet.close(); sheet.close();
  assert.equal(h.calls.nativeCloses, 1); assert.equal(h.calls.dismissals, 0);
  assert.equal(sheet.isOpen(), true);
  first.dialogs.props.onClose();
  assert.equal(h.calls.dismissals, 1); assert.equal(h.render().dialogs, null);
  sheet.open('next WIP'); const second = h.render();
  first.dialogs.props.onClose();
  assert.equal(h.render().dialogs.props.children.props.children, 'next WIP');
  assert.notEqual(second.dialogs.key, first.dialogs.key);
  h.dispose();
});

test('iOS long-press menu hands off to WIP details after its own dismissal', () => {
  const h = harness(), sheet = h.initial.sheet;
  sheet.open('action menu', { compact: true, dismissible: true, onDismiss: () => sheet.open('WIP details') });
  const menu = h.render();
  sheet.close(); assert.equal(h.render().dialogs.props.children.props.children, 'action menu');
  menu.dialogs.props.onClose();
  assert.equal(h.render().dialogs.props.children.props.children, 'WIP details');
  assert.equal(h.calls.nativeCloses, 1);
  h.dispose();
});

test('early close and owner unmount cannot reopen or dismiss a replacement WIP sheet', async () => {
  const h = harness(), sheet = h.initial.sheet;
  sheet.open('pending', { onDismiss: () => h.calls.dismissals++ });
  sheet.close(); const pending = h.render();
  assert.equal(h.calls.nativeCloses, 1);
  h.dispose(); await new Promise(resolve => queueMicrotask(resolve));
  pending.dialogs.props.onClose(); sheet.open('retired owner');
  assert.equal(h.calls.dismissals, 0); assert.equal(sheet.isOpen(), false);
});
