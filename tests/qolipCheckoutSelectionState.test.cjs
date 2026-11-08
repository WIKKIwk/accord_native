const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const root = path.resolve(__dirname, '../src'), cache = new Map();
function load(name) {
  name = name.replaceAll('\\', '/'); if (cache.has(name)) return cache.get(name).exports;
  const filename = path.join(root, name), loaded = new Module(filename, module); cache.set(name, loaded);
  loaded.require = target => target.startsWith('.') ? load(`${path.relative(root, path.resolve(path.dirname(filename), target))}.ts`) : require(target);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ESNext } }).outputText, filename);
  return loaded.exports;
}
const row = id => ({ id, item_name: id });
const unlocked = () => ({ returningIds: new Set(), bulkReturning: false });
function harness() {
  let current = true; const listeners = new Set(), a = row('a'), b = row('b'), duplicate = row('a'), all = [a, b, duplicate];
  const boundary = { current: () => current, subscribe: callback => { listeners.add(callback); return () => listeners.delete(callback); } };
  const owner = new (load('qolip/qolipCheckoutSelectionState.ts').QolipCheckoutSelectionState)(all, all, unlocked(), boundary);
  return { owner, listeners, a, b, duplicate, all, invalidate: () => { current = false; for (const callback of [...listeners]) callback(); }, revive: () => { current = true; } };
}

test('normal taps expand one ID, and duplicate rows with that same ID expand together', () => {
  const h = harness(); h.owner.activate(); h.owner.tap(h.a);
  assert.deepEqual(h.owner.getSnapshot().rows.map(row => row.expanded), [true, false, true]);
  h.owner.tap(h.b); assert.deepEqual(h.owner.getSnapshot().rows.map(row => row.expanded), [false, true, false]);
  h.owner.tap(h.b); assert.equal(h.owner.getSnapshot().rows.some(row => row.expanded), false); h.owner.suspend();
});

test('long press clears expansion and selects IDs; selection taps toggle and bulk uses loaded source order', () => {
  const h = harness(); h.owner.activate(); h.owner.tap(h.b); h.owner.longPress(h.b); let state = h.owner.getSnapshot();
  assert.equal(state.selectionMode, true); assert.deepEqual([...state.selectedIds], ['b']); assert.equal(state.rows.some(row => row.expanded), false);
  h.owner.tap(h.a); state = h.owner.getSnapshot(); assert.deepEqual([...state.selectedIds], ['b', 'a']);
  assert.deepEqual(state.rows.map(row => row.selected), [true, true, true]); assert.deepEqual(h.owner.bulkChoice(), [h.a, h.b, h.duplicate]);
  h.owner.tap(h.a); h.owner.tap(h.b); assert.equal(h.owner.getSnapshot().selectionMode, false); assert.equal(h.owner.bulkChoice(), null); h.owner.suspend();
});

test('filtered visible rows keep hidden selected entries and indexes follow the current visible order', () => {
  const h = harness(); h.owner.activate(); h.owner.longPress(h.a); h.owner.longPress(h.b);
  h.owner.update(h.all, [h.b], unlocked()); const state = h.owner.getSnapshot();
  assert.deepEqual(state.rows.map(row => [row.entry, row.index]), [[h.b, 0]]); assert.deepEqual(state.selectedEntries, h.all);
  assert.deepEqual(h.owner.bulkChoice(), h.all); h.owner.suspend();
});

test('reload retains only IDs present in loaded entries and rejects foreign visible rows', () => {
  const h = harness(); h.owner.activate(); h.owner.longPress(h.a); h.owner.longPress(h.b);
  h.owner.update([h.b], [h.b], unlocked()); assert.deepEqual([...h.owner.getSnapshot().selectedIds], ['b']);
  h.owner.update([h.b], [{ ...h.b }], unlocked()); assert.equal(h.owner.getSnapshot().rows[0].entry, h.b); h.owner.suspend();
});

test('real returning and bulk locks disable the source interactions without dispatching an action', () => {
  const h = harness(); h.owner.activate(); h.owner.update(h.all, h.all, { returningIds: new Set(['a']), bulkReturning: false });
  h.owner.longPress(h.a); assert.equal(h.owner.getSnapshot().selectionMode, false); h.owner.longPress(h.b);
  assert.deepEqual([...h.owner.getSnapshot().selectedIds], ['b']);
  h.owner.update(h.all, h.all, { returningIds: new Set(['a', 'b']), bulkReturning: true });
  const state = h.owner.getSnapshot(); assert.equal(state.cancelEnabled, false); assert.equal(state.bulkEnabled, false); assert.equal(state.rows[0].returning, true);
  h.owner.tap(h.b); h.owner.cancel(); assert.deepEqual([...h.owner.getSnapshot().selectedIds], ['b']); assert.equal(h.owner.bulkChoice(), null);
  h.owner.update(h.all, h.all, unlocked()); h.owner.cancel(); assert.equal(h.owner.getSnapshot().selectionMode, false); h.owner.suspend();
});

test('an invalidated original boundary clears private selection and prevents old choices after ABA', () => {
  const h = harness(), seen = []; h.owner.subscribe(() => seen.push(h.owner.getSnapshot().invalid)); h.owner.activate(); h.owner.longPress(h.a);
  h.invalidate(); assert.equal(h.owner.getSnapshot().invalid, true); assert.deepEqual(h.owner.getSnapshot().rows, []); assert.equal(h.owner.bulkChoice(), null);
  h.revive(); h.owner.tap(h.b); h.owner.update(h.all, h.all, unlocked()); assert.equal(h.owner.getSnapshot().invalid, true); assert.equal(seen.at(-1), true);
  assert.equal(h.listeners.size, 0); h.owner.suspend();
});
