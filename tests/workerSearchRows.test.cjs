/* global __dirname */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

function load(file, mocks = {}) {
  const filename = path.resolve(__dirname, '../src', file), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths;
  mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
  }).outputText, filename);
  return mod.exports;
}
const helpers = load('workerSearchRows.ts');
const key = row => row.id;
const text = row => `${row.code} ${row.title} ${row.customer}`;
const row = (id, title, code = id, customer = 'Client') => ({ id, title, code, customer });

test('baseline union keeps order and current metadata wins, without accumulating older filtered windows', () => {
  const base = [row('a', 'Keks'), row('b', 'Brownie')], freshA = { ...base[0], title: 'Keks yangi', state: 'paused' }, c = row('c', 'Candy');
  assert.equal(helpers.mergeWorkerSearchRows(base, base, key), base);
  const merged = helpers.mergeWorkerSearchRows(base, [freshA, c], key);
  assert.deepEqual(merged.map(key), ['a', 'b', 'c']); assert.equal(merged[0], freshA); assert.equal(merged[1], base[1]);
  const next = helpers.mergeWorkerSearchRows(base, [base[1]], key);
  assert.deepEqual(next.map(key), ['a', 'b']);
});

test('local index matches product name, number and customer, applying limit after filtering', () => {
  const rows = [row('1', 'Candy', '0301'), row('2', 'Mitti Brownie', '0304'), row('3', 'brownie keks', '0305', 'Isko')];
  const index = helpers.indexWorkerSearchRows(rows, text);
  assert.deepEqual(helpers.filterWorkerSearchRows(index, 'BROWNIE', 1), [rows[1]]);
  assert.deepEqual(helpers.filterWorkerSearchRows(index, '0304', 0), [rows[1]]);
  assert.deepEqual(helpers.filterWorkerSearchRows(index, 'isko', 0), [rows[2]]);
  assert.deepEqual(helpers.filterWorkerSearchRows(index, '', 0), rows);
});

function input(initial = '') {
  let query = initial;
  const listeners = new Set();
  return {
    getDraftQuery: () => query,
    subscribeText: listener => { listeners.add(listener); return () => listeners.delete(listener); },
    change(value) { query = value; for (const listener of listeners) listener(); },
    get subscribers() { return listeners.size; },
  };
}
function harness() {
  const hooks = []; let cursor = 0, dirty = false, notifications = 0;
  const same = (a, b) => a && b && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
  const memo = (create, dependencies) => {
    const id = cursor++; if (!same(hooks[id]?.dependencies, dependencies)) hooks[id] = { dependencies, value: create() };
    return hooks[id].value;
  };
  const react = {
    useMemo: memo,
    useCallback: (value, dependencies) => memo(() => value, dependencies),
    useState(initial) {
      const id = cursor++, state = hooks[id] ??= { value: typeof initial === 'function' ? initial() : initial };
      return [state.value, value => { if (!Object.is(value, state.value)) { state.value = value; dirty = true; } }];
    },
    useSyncExternalStore(subscribe, snapshot) {
      const id = cursor++;
      if (hooks[id]?.subscribe !== subscribe) {
        hooks[id]?.cleanup?.();
        const state = hooks[id] = { subscribe, snapshot, value: snapshot() };
        state.cleanup = subscribe(() => { const next = state.snapshot(); if (!Object.is(next, state.value)) { state.value = next; notifications++; } });
      }
      hooks[id].snapshot = snapshot; hooks[id].value = snapshot();
      return hooks[id].value;
    },
  };
  const jsx = { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
  const { WorkerSearchQueueList } = load('components/WorkerSearchQueueList.tsx', {
    react, 'react/jsx-runtime': jsx,
    '../workerSearchRows': helpers,
    './WorkerQueueList': { WorkerQueueList: 'WorkerQueueList' },
  });
  return {
    get notifications() { return notifications; },
    render(props) {
      let tree;
      do { dirty = false; cursor = 0; tree = WorkerSearchQueueList(props); } while (dirty);
      return tree.props;
    },
    close() { hooks.forEach(hook => hook.cleanup?.()); },
  };
}
const common = { active: true, sourceQuery: '', serverQuery: '', serverReady: true, limit: 0,
  searchText: text, rowKey: key, loading: false, children: 'header', emptyState: 'empty', renderRow: (...args) => args };

test('active draft filters immediately; server window equality preserves hidden-field server matches exactly', () => {
  const x = harness(), field = input(), rows = [row('a', 'Keks'), row('b', 'Brownie')];
  try {
    let props = { ...common, input: field, rows }, list = x.render(props);
    assert.equal(list.rows, rows);
    field.change('Brown'); list = x.render(props);
    assert.deepEqual(list.rows, [rows[1]]); assert.deepEqual(list.renderRow(rows[1], 0), [rows[1], 0, 1, true]);
    const hiddenMatch = row('c', 'Other visible title');
    props = { ...props, rows: [hiddenMatch], sourceQuery: 'Brown', serverQuery: 'Brown' };
    list = x.render(props);
    assert.equal(list.rows, props.rows); assert.deepEqual(list.renderRow(hiddenMatch, 0), [hiddenMatch, 0, 1, false]);
    const hiddenSecond = row('d', 'Another server-only match');
    list = x.render({ ...props, rows: [hiddenMatch, hiddenSecond], limit: 1 });
    assert.deepEqual(list.rows, [hiddenMatch], 'selected cap applies without locally discarding server-only matches');
  } finally { x.close(); }
});

test('backspace and clear immediately search the last unfiltered baseline with latest overlapping metadata', () => {
  const x = harness(), field = input(), base = [row('a', 'Keks'), row('b', 'Brownie')];
  try {
    x.render({ ...common, input: field, rows: base });
    field.change('Brown');
    const newer = { ...base[1], state: 'paused' };
    const props = { ...common, input: field, rows: [newer], sourceQuery: 'Brown', serverQuery: 'Brown' };
    x.render(props);
    field.change('K'); let list = x.render(props);
    assert.deepEqual(list.rows, [base[0]]);
    field.change(''); list = x.render(props);
    assert.deepEqual(list.rows, [base[0], newer]);
    const latestBase = [row('d', 'Donut')];
    list = x.render({ ...props, rows: latestBase, sourceQuery: '', serverQuery: '' });
    assert.equal(list.rows, latestBase);
    field.change('K'); list = x.render({ ...props, rows: latestBase, sourceQuery: '', serverQuery: '' });
    assert.deepEqual(list.rows, []);
  } finally { x.close(); }
});

test('preview or loading hides empty state; only settled empty rows show it, and unsynced cached rows force preview', () => {
  const x = harness(), field = input();
  try {
    let props = { ...common, input: field, rows: [] }, list = x.render(props);
    assert.deepEqual(list.children, ['header', 'empty']);
    field.change('none'); list = x.render(props);
    assert.deepEqual(list.children, ['header', null]);
    props = { ...props, sourceQuery: 'none', serverQuery: 'none', loading: true };
    list = x.render(props); assert.deepEqual(list.children, ['header', null]);
    list = x.render({ ...props, loading: false }); assert.deepEqual(list.children, ['header', 'empty']);
    const cached = row('a', 'Other');
    list = x.render({ ...props, rows: [cached], loading: false, serverReady: false });
    assert.deepEqual(list.rows, [cached]); assert.equal(list.renderRow(cached, 0)[3], true);
  } finally { x.close(); }
});

test('terminal errors drop retained baseline and completed rows still use local filtering at canonical equality', () => {
  const x = harness(), field = input(), base = [row('a', 'Keks'), row('b', 'Brownie')];
  try {
    x.render({ ...common, input: field, rows: base });
    field.change('K');
    const props = { ...common, input: field, rows: [base[1]], sourceQuery: 'Brown', serverQuery: 'Brown', previewAllowed: false };
    assert.deepEqual(x.render(props).rows, []);
    field.change(''); assert.deepEqual(x.render({ ...props, previewAllowed: true }).rows, [base[1]]);
    field.change('K');
    const list = x.render({ ...common, input: field, rows: base, sourceQuery: 'K', serverQuery: 'K', filterServerRows: true });
    assert.deepEqual(list.rows, [base[0]]);
  } finally { x.close(); }
});

test('1000 rows normalize once per row update; inactive lists have no raw input subscription', () => {
  const x = harness(), inactive = harness(), field = input(), rows = Array.from({ length: 1000 }, (_, i) => row(String(i), `Keks ${i}`));
  let reads = 0;
  const props = { ...common, input: field, rows, searchText: value => { reads++; return text(value); } };
  try {
    x.render(props); assert.equal(reads, 1000);
    inactive.render({ ...props, active: false }); assert.equal(field.subscribers, 1);
    const inactiveNotices = inactive.notifications;
    for (const query of ['K', 'Ke', 'Kek', 'Keks 99']) { field.change(query); x.render(props); }
    assert.equal(reads, 2000, 'the active index was reused; inactive list built its own index once');
    assert.equal(inactive.notifications, inactiveNotices);
    let list = inactive.render({ ...props, active: false, serverQuery: 'Keks 99', sourceQuery: '' });
    assert.equal(list.rows.length, 11);
    list = x.render({ ...props, limit: 2 }); assert.equal(list.rows.length, 2);
    assert.equal(reads, 2000);
  } finally { x.close(); inactive.close(); }
});
