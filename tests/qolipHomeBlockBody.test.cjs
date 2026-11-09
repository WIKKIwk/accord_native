const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
function load(name, dependencies = {}) {
  const filename = path.resolve(__dirname, '../src/qolip', name), m = new Module(filename, module);
  m.require = key => key in dependencies ? dependencies[key] : key.startsWith('.')
    ? load(`${path.relative(path.resolve(__dirname, '../src/qolip'), path.resolve(path.dirname(filename), key))}.ts`, dependencies) : require(key);
  m._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ESNext,
  } }).outputText, filename);
  return m.exports;
}
for (const platform of ['ios', 'android']) {
  function harness(invalid = false) {
    const calls = [], captures = []; let active = true, observed;
    const snapshot = { locations: [{ id: 'cached' }], loading: true, error: false, invalid,
      controller: { canAct: () => active } };
    const { QolipHomeBlockBody } = load(`QolipHomeBlockBody.${platform}.tsx`, {
      './QolipHomeGrid': { QolipHomeGrid: props => { captures.push(props); return React.createElement('div', null, 'REAL-GRID'); } },
      './useQolipHomeBlockRead': { useQolipHomeBlockRead: (...args) => { observed = args; return snapshot; } },
    });
    const props = { blockKey: 'a', future: Promise.resolve([]), initialLocations: [], boundary: {}, searchCounts: { A1: 3 },
      refresh: async () => calls.push(['refresh']), openCell: (...args) => calls.push(['open', ...args]), printCell: (...args) => calls.push(['print', ...args]) };
    return { calls, captures, props, snapshot, observed: () => observed, disable: () => { active = false; },
      render: () => renderToStaticMarkup(React.createElement(QolipHomeBlockBody, props)) };
  }
  test(`${platform} body reuses the actual grid with existing future/cache identity and no action on rendering`, async () => {
    const h = harness(); assert.match(h.render(), /REAL-GRID/); assert.deepEqual(h.calls, []);
    assert.deepEqual(h.observed(), ['a', h.props.future, h.props.initialLocations, h.props.boundary]);
    const grid = h.captures[0]; assert.equal(grid.locations, h.snapshot.locations); assert.equal(grid.searchCounts, h.props.searchCounts);
    assert.equal(grid.loading, true); assert.equal(grid.error, false);
    await grid.refresh(); const items = [{ id: 'one' }]; grid.openCell('B', 3, items); grid.printCell('B', 3);
    assert.deepEqual(h.calls, [['refresh'], ['open', 'B', 3, items], ['print', 'B', 3]]);
  });
  test(`${platform} invalid boundary removes the entire old block grid`, () => {
    const h = harness(true); assert.equal(h.render(), ''); assert.deepEqual(h.captures, []); assert.deepEqual(h.calls, []);
  });
  test(`${platform} late native callbacks cannot invoke supplied actions after invalidation or unmount`, async () => {
    const h = harness(); h.render(); const grid = h.captures[0]; h.disable();
    await grid.refresh(); grid.openCell('A', 1, []); grid.printCell('A', 1); assert.deepEqual(h.calls, []);
  });
}

test('block hook binds existing futures after commit and cleans up without starting any API reader', () => {
  const effects = [], calls = []; let observed;
  class State {
    constructor(initial, boundary) { calls.push(['construct', initial, boundary]); observed = this; }
    subscribe() { return () => {}; }
    getSnapshot() { return { locations: null, loading: true, error: false, invalid: false }; }
    activate() { calls.push(['activate']); }
    bind(future) { calls.push(['bind', future]); }
    suspend() { calls.push(['suspend']); }
  }
  const { useQolipHomeBlockRead } = load('useQolipHomeBlockRead.ts', {
    './qolipHomeBlockReadState': { QolipHomeBlockReadState: State },
    react: { useMemo: factory => factory(), useSyncExternalStore: (_subscribe, get) => get(), useLayoutEffect: effect => effects.push(effect) },
  });
  const initial = [], boundary = {}, future = Promise.resolve([]), result = useQolipHomeBlockRead('a', future, initial, boundary);
  assert.equal(result.controller, observed); assert.deepEqual(calls, [['construct', initial, boundary]]);
  const cleanup = effects[0](); assert.deepEqual(calls.slice(1), [['activate'], ['bind', future]]); cleanup(); assert.deepEqual(calls.at(-1), ['suspend']);
});

test('initialData is used once per block/boundary and does not replace a live FutureBuilder snapshot', () => {
  const { QolipHomeBlockReadState } = load('qolipHomeBlockReadState.ts');
  let memo, dependencies; const useMemo = (factory, deps) => {
    if (!dependencies || deps.some((value, index) => value !== dependencies[index])) { memo = factory(); dependencies = deps; }
    return memo;
  };
  const { useQolipHomeBlockRead } = load('useQolipHomeBlockRead.ts', {
    './qolipHomeBlockReadState': { QolipHomeBlockReadState },
    react: { useMemo, useSyncExternalStore: (_subscribe, get) => get(), useLayoutEffect: () => {} },
  });
  const original = [{ id: 'initial' }], changed = [{ id: 'changed' }], boundary = { current: () => true, subscribe: () => () => {} }, future = Promise.resolve([]);
  const a = useQolipHomeBlockRead('a', future, original, boundary);
  const same = useQolipHomeBlockRead('a', future, changed, boundary);
  assert.equal(same.controller, a.controller); assert.equal(same.locations, original);
  const other = useQolipHomeBlockRead('b', future, changed, boundary);
  assert.notEqual(other.controller, a.controller); assert.equal(other.locations, changed);
  const rebound = useQolipHomeBlockRead('b', future, original, { ...boundary }); assert.notEqual(rebound.controller, other.controller);
});
