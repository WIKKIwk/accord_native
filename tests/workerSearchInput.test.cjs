const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

function load(name, mocks = {}) {
  const filename = path.resolve(__dirname, `../src/${name}`), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths;
  mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, filename);
  return mod.exports;
}
const { WorkerSearchInput } = load('workerSearchInput.ts', { './workerQueueWindow': load('workerQueueWindow.ts') });

function clock() {
  const originalSet = global.setTimeout, originalClear = global.clearTimeout, timers = new Map();
  let now = 0, nextId = 0;
  global.setTimeout = (fn, ms) => { const id = ++nextId; timers.set(id, { fn, at: now + ms }); return id; };
  global.clearTimeout = id => timers.delete(id);
  return {
    advance(ms) {
      const end = now + ms;
      while (true) {
        const next = [...timers].filter(([, timer]) => timer.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
        if (!next) break;
        timers.delete(next[0]); now = next[1].at; next[1].fn();
      }
      now = end;
    },
    restore() { global.setTimeout = originalSet; global.clearTimeout = originalClear; },
  };
}

test('native draft edits notify only the search field until the latest text settles for 350ms', () => {
  const c = clock(), input = new WorkerSearchInput(), text = [], queries = [];
  const stopText = input.subscribeText(() => text.push(input.getText()));
  const stopQuery = input.subscribeQuery(() => queries.push(input.getQuery()));
  try {
    for (const raw of ['M', 'Mi', 'Mitti', 'Mitti ', 'Mitti brownie']) { input.change(raw); c.advance(40); }
    assert.equal(input.getText(), 'Mitti brownie'); assert.equal(input.getDraftQuery(), 'Mitti brownie'); assert.equal(input.getQuery(), '');
    assert.deepEqual(text, ['M', 'Mi', 'Mitti', 'Mitti ', 'Mitti brownie']); assert.deepEqual(queries, []);
    c.advance(309); assert.deepEqual(queries, []);
    c.advance(1); assert.deepEqual(queries, ['Mitti brownie']);
    stopText(); stopQuery(); input.change('0304'); c.advance(350);
    assert.equal(text.length, 5); assert.deepEqual(queries, ['Mitti brownie']);
  } finally { input.cancelPending(); c.restore(); }
});

test('clear uses the same delay and unchanged normalized queries never publish another queue window', () => {
  const c = clock(), input = new WorkerSearchInput('keks'), queries = [];
  input.subscribeQuery(() => queries.push(input.getQuery()));
  try {
    input.change(' keks '); c.advance(350);
    assert.equal(input.getText(), ' keks '); assert.deepEqual(queries, []);
    input.change(''); c.advance(349);
    assert.equal(input.getText(), ''); assert.equal(input.getQuery(), 'keks');
    c.advance(1); assert.deepEqual(queries, ['']);
    input.change('   '); c.advance(350); assert.deepEqual(queries, ['']);
  } finally { input.cancelPending(); c.restore(); }
});

test('query normalization retains complete Unicode code points while raw draft remains untouched', () => {
  const c = clock(), input = new WorkerSearchInput(), raw = `  ${'a'.repeat(119)}😀extra  `;
  try {
    input.change(raw);
    assert.equal(input.getDraftQuery(), `${'a'.repeat(119)}😀`); assert.equal(input.getQuery(), '');
    c.advance(350);
    assert.equal(input.getText(), raw); assert.equal(input.getQuery(), `${'a'.repeat(119)}😀`);
    assert.equal(Array.from(input.getQuery()).length, 120);
  } finally { input.cancelPending(); c.restore(); }
});

test('normalized draft is ready before text listeners and unchanged trimmed snapshots skip draft renders', () => {
  const c = clock(), input = new WorkerSearchInput('  Keks  '), notifications = [], queries = [];
  let renderedDraft = input.getDraftQuery(), draftRenders = 0;
  input.subscribeText(() => {
    const next = input.getDraftQuery();
    notifications.push([input.getText(), next]);
    if (!Object.is(next, renderedDraft)) { renderedDraft = next; draftRenders++; }
  });
  input.subscribeQuery(() => queries.push(input.getQuery()));
  try {
    assert.equal(input.getText(), '  Keks  '); assert.equal(renderedDraft, 'Keks'); assert.equal(input.getQuery(), 'Keks');
    input.change(' Keks ');
    assert.deepEqual(notifications, [[' Keks ', 'Keks']]); assert.equal(draftRenders, 0);
    input.change('  KEKS  ');
    assert.equal(input.getText(), '  KEKS  '); assert.equal(input.getDraftQuery(), 'KEKS');
    assert.equal(draftRenders, 1); assert.deepEqual(queries, []);
    c.advance(349); assert.equal(input.getQuery(), 'Keks');
    c.advance(1); assert.deepEqual(queries, ['KEKS']);
  } finally { input.cancelPending(); c.restore(); }
});

test('cancelling a pending draft never publishes it and a duplicate native value does not postpone a query', () => {
  const c = clock(), input = new WorkerSearchInput(), queries = [];
  input.subscribeQuery(() => queries.push(input.getQuery()));
  try {
    input.change('discard'); input.cancelPending(); c.advance(1000);
    assert.equal(input.getText(), 'discard'); assert.deepEqual(queries, []);
    input.change('0304'); c.advance(349); input.change('0304'); c.advance(1);
    assert.deepEqual(queries, ['0304']);
  } finally { input.cancelPending(); c.restore(); }
});

function ownerHarness() {
  const hooks = []; let cursor = 0, publications = 0;
  const same = (a, b) => a && b && a.length === b.length && a.every((value, index) => Object.is(value, b[index]));
  const react = {
    useMemo(create, dependencies) {
      const id = cursor++;
      if (!same(hooks[id]?.dependencies, dependencies)) hooks[id] = { dependencies, value: create() };
      return hooks[id].value;
    },
    useSyncExternalStore(subscribe, snapshot) {
      const id = cursor++;
      if (hooks[id]?.subscribe !== subscribe) {
        hooks[id]?.cleanup(); hooks[id] = { subscribe, cleanup: subscribe(() => { publications++; }) };
      }
      return snapshot();
    },
    useEffect(effect, dependencies) {
      const id = cursor++;
      if (!same(hooks[id]?.dependencies, dependencies)) {
        hooks[id]?.cleanup?.(); hooks[id] = { dependencies, cleanup: effect() };
      }
    },
  };
  const { useWorkerSearchInput } = load('components/useWorkerSearchInput.ts', { react, '../workerSearchInput': { WorkerSearchInput } });
  return {
    get publications() { return publications; },
    render(scope) { cursor = 0; return useWorkerSearchInput(scope); },
    unmount() { hooks.forEach(hook => hook.cleanup?.()); },
  };
}

test('queue owner subscribes only to committed queries and same-scope refresh preserves the draft and timer', () => {
  const c = clock(), owner = ownerHarness();
  try {
    const initial = owner.render('worker-a'); initial.input.change('pending'); c.advance(200);
    const refreshed = owner.render('worker-a');
    assert.equal(refreshed.input, initial.input); assert.equal(refreshed.input.getText(), 'pending');
    assert.equal(refreshed.query, ''); assert.equal(owner.publications, 0);
    c.advance(150); assert.equal(owner.render('worker-a').query, 'pending'); assert.equal(owner.publications, 1);
  } finally { owner.unmount(); c.restore(); }
});

test('scope replacement and unmount cancel pending commits without carrying a draft to another worker', () => {
  const c = clock(), owner = ownerHarness();
  try {
    const old = owner.render('worker-a'); old.input.change('old worker draft');
    const current = owner.render('worker-b');
    assert.notEqual(current.input, old.input); assert.equal(current.input.getText(), '');
    c.advance(350); assert.equal(old.input.getQuery(), ''); assert.equal(owner.publications, 0);
    current.input.change('new worker draft'); owner.unmount(); c.advance(350);
    assert.equal(current.input.getQuery(), ''); assert.equal(owner.publications, 0);
  } finally { owner.unmount(); c.restore(); }
});

test('worker header subscribes to raw text independently and forwards the stable native edit callback', () => {
  const input = new WorkerSearchInput('Mitti'), subscriptions = [];
  const { WorkerSearchHeader } = load('components/WorkerSearchHeader.tsx', {
    react: { useSyncExternalStore: (subscribe, snapshot) => { subscriptions.push(subscribe); return snapshot(); } },
    'react/jsx-runtime': { jsx: (type, props) => ({ type, props }) },
    '../shared/orders/OrdersHeader': { OrdersHeader: 'OrdersHeader' },
  });
  const onMenu = () => {}, tree = WorkerSearchHeader({ input, onMenu });
  assert.deepEqual(subscriptions, [input.subscribeText]);
  assert.equal(tree.props.search, 'Mitti'); assert.equal(tree.props.onSearchChange, input.change); assert.equal(tree.props.onMenu, onMenu);
});
