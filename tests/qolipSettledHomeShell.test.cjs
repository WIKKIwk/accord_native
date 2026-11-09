const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

function load(file, mocks) {
  const filename = path.resolve(__dirname, '../src/qolip', file), loaded = new Module(filename, module);
  loaded.require = id => id in mocks ? mocks[id] : require(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ESNext,
  } }).outputText, filename);
  return loaded.exports;
}

test('the unrouted shell mounts the actual owner only for a ready session and passes all real callbacks unchanged', () => {
  const session = {}, boundary = {}, calls = [], captured = [];
  let entry = { kind: 'loading' };
  const Shell = load('QolipSettledHomeShell.tsx', {
    './QolipHomeOwner': { QolipHomeOwner: props => { captured.push(props); return React.createElement('div', null, 'owner'); } },
    './useQolipSettledHomeSession': { useQolipSettledHomeSession: () => entry },
  }).QolipSettledHomeShell;
  const props = { onMenu: () => calls.push('menu'), onProfile: () => calls.push('profile'),
    openCell: () => calls.push('cell'), printCell: () => calls.push('print') };
  const render = () => renderToStaticMarkup(React.createElement(Shell, props));
  for (const kind of ['loading', 'unavailable', 'invalid']) { entry = { kind }; assert.equal(render(), ''); }
  entry = { kind: 'ready', session, boundary }; assert.equal(render(), '<div>owner</div>');
  assert.equal(captured.length, 1); assert.equal(captured[0].session, session); assert.equal(captured[0].boundary, boundary);
  for (const key of Object.keys(props)) assert.equal(captured[0][key], props[key]); assert.deepEqual(calls, []);
});

test('the hook retains one owner, subscribes through React and activates only after commit', () => {
  const events = [], effects = [], snapshot = { kind: 'loading' };
  let instance;
  class Owner {
    constructor() { events.push('construct'); instance = this; }
    subscribe() {} getSnapshot() { return snapshot; }
    activate() { events.push('activate'); return () => events.push('suspend'); }
  }
  const hook = load('useQolipSettledHomeSession.ts', { react: {
    useMemo: make => make(), useSyncExternalStore: (subscribe, get, serverGet) => {
      assert.equal(subscribe, instance.subscribe); assert.equal(get, instance.getSnapshot); assert.equal(serverGet, get); return snapshot;
    }, useLayoutEffect: effect => effects.push(effect),
  }, './qolipSettledHomeSession': { QolipSettledHomeSessionOwner: Owner } }).useQolipSettledHomeSession;
  assert.equal(hook(), snapshot); assert.deepEqual(events, ['construct']); const cleanup = effects[0](); cleanup();
  assert.deepEqual(events, ['construct', 'activate', 'suspend']);
});
