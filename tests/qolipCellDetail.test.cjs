const assert = require('node:assert/strict'), fs = require('node:fs'), Module = require('node:module'), path = require('node:path');
const test = require('node:test'), ts = require('typescript');
function load(file, mocks = {}) {
  const filename = path.resolve(__dirname, '../src/qolip', file), m = new Module(filename, module); m.require = id => id in mocks ? mocks[id] : require(id);
  m._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename); return m.exports;
}
const common = load('qolipApiCommon.ts', { '../shared/mobileApiException': {} });
const grid = load('qolipGridLogic.ts', { './qolipApiCommon': common });
const lifetime = load('qolipLocationChoiceLifetime.ts', { './qolipApiCommon': common });
const { QolipCellDetailState, qolipCellDetailRowLabel } = load('qolipCellDetailState.ts', { './qolipApiCommon': common, './qolipGridLogic': grid, './qolipLocationChoiceLifetime': lifetime });
const item = (id, patch = {}) => ({ id, item_name: ' Name ', qolip_code: ' Q ', size: 0, quantity: 1, location_label: 'A1', ...patch });
function setup(options = {}) {
  const first = item('same'), duplicate = item('same', { qolip_code: 'other' }), third = item('other'), listeners = new Set(); let current = true;
  const boundary = { current: () => current, subscribe: fn => { listeners.add(fn); return () => listeners.delete(fn); } };
  const state = new QolipCellDetailState({ cellLabel: 'A1', items: [first, duplicate, third], unplaced: [item('unplaced')], movableIn: [item('move')], ...options }, boundary);
  return { state, first, duplicate, third, listeners, boundary, invalidate: () => { current = false; [...listeners].forEach(fn => fn()); }, revive: () => { current = true; } };
}
test('cell detail row labels preserve raw values and empty mold-code separators, without the picker location suffix', () => {
  assert.deepEqual(qolipCellDetailRowLabel(item('a'), '1 ta'), { title: ' Name ', subtitle: ' Q  • 0 • 1 ta' });
  assert.deepEqual(qolipCellDetailRowLabel(item('a', { item_name: ' \u0085 ', qolip_code: '' }), '1 ta'), { title: '', subtitle: ' • 0 • 1 ta' });
});
test('initial detail projection retains source rows, cell header, alternatives and action order contract without subscribing or dispatching', () => {
  const h = setup(), state = h.state.getSnapshot(); assert.equal(state.selectionMode, false); assert.deepEqual(state.header, { kind: 'cell', label: 'A1' });
  assert.deepEqual(state.rows.map(row => row.item), [h.first, h.duplicate, h.third]); assert.equal(state.rows[0].item, h.first);
  assert.equal(state.unplacedCount, 1); assert.equal(state.movableInCount, 1); assert.equal(state.footerEnabled, true); assert.equal(h.listeners.size, 0);
  assert.equal(h.state.itemChoice('take', h.first), null); assert.equal(h.state.footerChoice('add'), null);
});
test('normal row taps do nothing; long-press toggles all duplicate-ID rows and counts original selected entries, not unique IDs', () => {
  const h = setup(); h.state.activate(); h.state.tap(h.first); assert.equal(h.state.getSnapshot().selectionMode, false);
  h.state.toggle(h.first); const state = h.state.getSnapshot(); assert.equal(state.selectedIds.size, 1); assert.equal(state.selectionMode, true);
  assert.deepEqual(state.selectedItems, [h.first, h.duplicate]); assert.deepEqual(state.header, { kind: 'selection', count: 2 });
  assert.deepEqual(state.rows.map(row => [row.selected, row.showActions, row.actionsEnabled]), [[true, false, false], [true, false, false], [false, true, false]]);
  h.state.tap(h.duplicate); assert.equal(h.state.getSnapshot().selectionMode, false); assert.equal(h.state.getSnapshot().footerEnabled, true); h.state.suspend();
});
test('selection tap toggles rows, bulk result keeps source order even when selected in reverse order', () => {
  const h = setup(); h.state.activate(); h.state.toggle(h.third); h.state.tap(h.first);
  const bulk = h.state.bulkChoice(); assert.equal(bulk.kind, 'bulk-move'); assert.deepEqual(bulk.items, [h.first, h.duplicate, h.third]); assert.equal(bulk.items[0], h.first);
  h.state.tap(h.third); assert.deepEqual(h.state.bulkChoice().items, [h.first, h.duplicate]); h.state.suspend();
});
test('selection disables every item/footer choice while retaining the bulk choice; leaving it restores source choices', () => {
  const h = setup(); h.state.activate(); h.state.toggle(h.first);
  for (const kind of ['add', 'place-unplaced', 'move-in']) assert.equal(h.state.footerChoice(kind), null);
  for (const kind of ['take', 'move-out']) assert.equal(h.state.itemChoice(kind, h.third), null);
  assert.ok(h.state.bulkChoice()); h.state.toggle(h.duplicate);
  assert.deepEqual(h.state.itemChoice('move-out', h.third), { kind: 'move-out', item: h.third }); assert.deepEqual(h.state.itemChoice('take', h.first), { kind: 'take', item: h.first });
  for (const kind of ['add', 'place-unplaced', 'move-in']) assert.deepEqual(h.state.footerChoice(kind), { kind });
  assert.equal(h.state.bulkChoice(), null); h.state.suspend();
});
test('missing alternative lists remove their choices but never invent an empty message or suppress Add', () => {
  const h = setup({ items: [], unplaced: [], movableIn: [] }); h.state.activate(); const state = h.state.getSnapshot();
  assert.deepEqual(state.rows, []); assert.deepEqual(state.header, { kind: 'cell', label: 'A1' }); assert.equal(state.unplacedCount, 0); assert.equal(state.movableInCount, 0);
  assert.equal(h.state.footerChoice('place-unplaced'), null); assert.equal(h.state.footerChoice('move-in'), null); assert.deepEqual(h.state.footerChoice('add'), { kind: 'add' }); h.state.suspend();
});
test('row identity is original object plus exact untrimmed/case-sensitive ID; clones and unknown actions cannot return a choice', () => {
  const one = item(' x '), two = item('x'), three = item('X'), h = setup({ items: [one, two, three] }); h.state.activate();
  h.state.toggle(one); assert.deepEqual(h.state.getSnapshot().rows.map(row => row.selected), [true, false, false]); h.state.toggle(one);
  assert.equal(h.state.itemChoice('take', { ...one }), null); assert.equal(h.state.itemChoice('delete', one), null); assert.equal(h.state.footerChoice('unknown'), null); h.state.suspend();
});
test('invalidation removes private rows/header/counts and blocks every old choice without recapturing through ABA', () => {
  const h = setup(); h.state.activate(); h.state.toggle(h.first); h.invalidate(); const state = h.state.getSnapshot();
  assert.equal(state.invalid, true); assert.deepEqual(state.rows, []); assert.deepEqual(state.selectedItems, []); assert.equal(state.header.label, '');
  h.revive(); h.state.activate(); h.state.toggle(h.third); assert.equal(h.state.getSnapshot().invalid, true); assert.equal(h.state.bulkChoice(), null);
  assert.equal(h.state.itemChoice('take', h.first), null); assert.equal(h.state.footerChoice('add'), null); assert.equal(h.listeners.size, 0); h.state.suspend();
});
test('subscriptions update once per selection and lifecycle cleanup rejects a queued choice', () => {
  const h = setup(); let changes = 0; h.state.subscribe(() => changes++); h.state.activate(); h.state.activate(); assert.equal(h.listeners.size, 1);
  h.state.toggle(h.first); assert.equal(changes, 1); h.state.suspend(); assert.equal(h.listeners.size, 0); assert.equal(h.state.bulkChoice(), null);
  h.state.activate(); assert.deepEqual(h.state.bulkChoice().items, [h.first, h.duplicate]); h.state.suspend();
});
test('failing detail observers do not suppress later selection and invalidation notifications', async () => {
  const h = setup(), seen = []; h.state.subscribe(() => { throw new Error('observer'); });
  h.state.subscribe(async () => { throw new Error('async observer'); }); h.state.subscribe(() => seen.push(h.state.getSnapshot().invalid));
  h.state.activate(); h.state.toggle(h.first); h.invalidate(); await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(seen, [false, true]); assert.equal(h.state.getSnapshot().invalid, true); h.state.suspend();
});
test('unmounted detail hook exposes source choices only through a required current callback, never a mutation call', () => {
  const effects = [], choices = [], h = setup(), props = { boundary: h.boundary, cellLabel: 'A1', choose: value => choices.push(value) };
  const hook = load('useQolipCellDetail.ts', { react: { useMemo: fn => fn(), useSyncExternalStore: (_s, get) => get(), useLayoutEffect: fn => effects.push(fn) },
    './qolipCellDetailState': { QolipCellDetailState: class { constructor(options, boundary) { assert.equal(options, props); assert.equal(boundary, props.boundary); return h.state; } } } }).useQolipCellDetail;
  const view = hook(props); view.add(); assert.deepEqual(choices, []); const cleanup = effects[0]();
  view.moveOut(h.first); view.placeUnplaced(); view.moveIn(); view.add(); view.take(h.third);
  assert.deepEqual(choices.map(value => value.kind), ['move-out', 'place-unplaced', 'move-in', 'add', 'take']); assert.equal(choices[0].item, h.first);
  h.state.toggle(h.first); view.moveSelected(); assert.deepEqual(choices.at(-1).items, [h.first, h.duplicate]); h.invalidate(); view.moveSelected(); assert.equal(choices.length, 6); cleanup();
});
