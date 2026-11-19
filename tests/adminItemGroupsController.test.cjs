/* global __dirname */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
function load(file, mocks = {}) {
  const filename = path.resolve(__dirname, '../src', file), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths; mod.require = name => Object.hasOwn(mocks, name) ? mocks[name] : require(name);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename); return mod.exports;
}
const dart = load('admin/dartJsonString.ts'), sync = load('shared/camera/synchronousGuard.ts');
const normalize = load('shared/searchNormalizer.ts');
const engine = load('qolip/qolipSearchEngine.ts', { '../shared/searchNormalizer': normalize });
const relevance = load('qolip/qolipSearchRelevance.ts', { './qolipSearchEngine': engine });
const model = load('admin/itemGroupsModel.ts', { './dartJsonString': dart, '../qolip/qolipSearchRelevance': relevance });
const { ItemGroupsController } = load('admin/itemGroupsController.ts', { './dartJsonString': dart, './itemGroupsModel': model, '../shared/camera/synchronousGuard': sync });
const tick = () => new Promise(resolve => setImmediate(resolve));
function deferred() { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
const row = (name, parent = '', is_group = true) => ({ name, item_group_name: name, parent_item_group: parent, is_group });
function fixture() {
  let current = true; const calls = [], groups = ['All Item Groups', 'B', 'A'];
  const deps = { isCurrent: () => current,
    groups: async (guard, witness) => { guard(); assert.equal(witness(), true); calls.push('groups'); return groups; },
    tree: async (guard, witness) => { guard(); assert.equal(witness(), true); calls.push('tree'); return [row('All Item Groups'), row('A', 'All Item Groups')]; },
    items: async (group, offset, guard) => { guard(); calls.push(['items', group, offset]); return [{ code: group, name: group, uom: 'kg' }]; },
    create: async (name, parent, isGroup, guard) => { guard(); calls.push(['create', name, parent, isGroup]); return row(name, parent, isGroup); },
    move: async (name, parent, guard) => { guard(); calls.push(['move', name, parent]); return { ...row(name, parent), item_group_name: 'Shown ' + name }; },
  };
  const controller = new ItemGroupsController(deps); controller.start();
  return { controller, deps, calls, groups, expire: () => { current = false; }, revive: () => { current = true; } };
}
test('tree roots preserve source insertion, first duplicate, raw labels, orphans and cycle behavior', () => {
  const roots = model.itemGroupsTree([row('Root'), row('Root', '', false), row('Child', 'Root'), row('Orphan', 'missing'), row('A', 'B'), row('B', 'A'), row(' ')]);
  assert.deepEqual(roots.map(node => node.entry.name), ['Root', 'Orphan']); assert.equal(roots[0].entry.is_group, true);
  assert.deepEqual(roots[0].children.map(node => node.entry.name), ['Child']);
  assert.deepEqual(model.itemGroupsVisibleTree(roots, new Set(['Root'])).map(value => [value.node.entry.name, value.depth]), [['Root', 0], ['Child', 1], ['Orphan', 0]]);
});
test('parent merging/default, move exclusions and 50-row local picker follow source case and ordering', () => {
  assert.deepEqual(model.itemGroupsMerge([' A ', '', 'A', 'a'], ['B', ' A ']), ['A', 'a', 'B']);
  assert.equal(model.itemGroupsCreateParent(['A', 'All Item Groups'], null), 'All Item Groups'); assert.equal(model.itemGroupsCreateParent(['A'], null), 'A');
  assert.deepEqual(model.itemGroupsMoveChoices([' B ', 'A', 'All Item Groups', 'A'], 'A'), { groups: ['A', 'B'], parents: ['All Item Groups', 'B'] });
  const names = Array.from({ length: 70 }, (_, i) => `Group ${i}`); assert.equal(model.itemGroupsPickerPage(names, '').items.length, 50);
  assert.equal(model.itemGroupsPickerPage(names, '').hasMore, true); assert.deepEqual(model.itemGroupsPickerPage(names, '\u0085GROUP 69\u0085').items, ['Group 69']);
});
test('parent and tree futures settle independently, failed tree shows its own state', async () => {
  const f = fixture(); await tick(); assert.deepEqual(f.calls, ['groups', 'tree']);
  f.deps.tree = async () => { throw new Error('offline'); }; await f.controller.reload();
  assert.equal(f.controller.getSnapshot().parentsPhase, 'ready'); assert.equal(f.controller.getSnapshot().treePhase, 'error');
});
test('create dialog defaults, cancellation and stale field callbacks preserve the next dialog', async () => {
  const f = fixture(); await tick(); await f.controller.open('create'); const dialog = f.controller.getSnapshot().dialog;
  assert.equal(dialog.parent, 'All Item Groups'); assert.equal(dialog.isGroup, true);
  f.controller.setName(dialog.id, 'Old'); f.controller.openPicker(dialog.id, 'createParent'); const picker = f.controller.getSnapshot().picker;
  f.controller.finishPicker(picker.id, null); assert.equal(f.controller.getSnapshot().dialog.parent, 'All Item Groups');
  f.controller.closeDialog(dialog.id); await f.controller.open('create'); const next = f.controller.getSnapshot().dialog;
  f.controller.setName(dialog.id, 'late'); f.controller.setIsGroup(dialog.id, false); f.controller.openPicker(dialog.id, 'createParent');
  assert.equal(f.controller.getSnapshot().dialog.name, ''); assert.equal(f.controller.getSnapshot().dialog.isGroup, true); assert.equal(f.controller.getSnapshot().picker, null); assert.notEqual(next.id, dialog.id);
});
test('create is silent on blank fields, blocks duplicate save and closes after server acknowledgement', async () => {
  const f = fixture(); await tick(); await f.controller.open('create'); const id = f.controller.getSnapshot().dialog.id;
  await f.controller.submit(id); assert.equal(f.calls.some(Array.isArray), false);
  const response = deferred(); f.deps.create = async (name, parent, isGroup, guard) => { guard(); f.calls.push(['create', name, parent, isGroup]); return response.promise; };
  f.controller.setName(id, '\u0085 New \u0085'); const pending = f.controller.submit(id); await f.controller.submit(id);
  assert.equal(f.controller.getSnapshot().dialog.saving, true); assert.deepEqual(f.calls.at(-1), ['create', 'New', 'All Item Groups', true]);
  response.resolve({ ...row('New'), item_group_name: 'Alias' }); await pending; await tick();
  assert.equal(f.controller.getSnapshot().dialog, null); assert.ok(f.controller.getSnapshot().parents.includes('Alias')); assert.equal(f.controller.getSnapshot().notice.key, 'item_group.saved');
});
test('failed create keeps its draft and uses source error interpolation without a fake success', async () => {
  const f = fixture(); await tick(); await f.controller.open('create'); const id = f.controller.getSnapshot().dialog.id;
  f.controller.setName(id, 'New'); f.deps.create = async () => { throw new Error('Admin item group create failed'); }; await f.controller.submit(id);
  assert.equal(f.controller.getSnapshot().dialog.name, 'New'); assert.equal(f.controller.getSnapshot().dialog.saving, false);
  assert.deepEqual(f.controller.getSnapshot().notice.values, { error: 'Exception: Admin item group create failed' });
});
test('a dismissed pending create can refresh the screen without closing a later dialog', async () => {
  const f = fixture(); await tick(); await f.controller.open('create'); const first = f.controller.getSnapshot().dialog.id, response = deferred();
  f.deps.create = async () => response.promise; f.controller.setName(first, 'New'); const pending = f.controller.submit(first); f.controller.closeDialog(first);
  await f.controller.open('move'); const next = f.controller.getSnapshot().dialog.id; response.resolve(row('New')); await pending;
  assert.equal(f.controller.getSnapshot().dialog.id, next); assert.equal(f.controller.getSnapshot().dialog.kind, 'move');
});
test('move picks source group and different parent, stays open after success and reports shown name', async () => {
  const f = fixture(); await tick(); await f.controller.open('move'); const id = f.controller.getSnapshot().dialog.id;
  await f.controller.submit(id); assert.equal(f.calls.some(Array.isArray), false);
  f.controller.openPicker(id, 'moveGroup'); let picker = f.controller.getSnapshot().picker;
  assert.deepEqual(picker.groups, ['A', 'B']); f.controller.finishPicker(picker.id, 'A');
  f.controller.openPicker(id, 'moveParent'); picker = f.controller.getSnapshot().picker;
  assert.deepEqual(picker.groups, ['All Item Groups', 'B']); f.controller.finishPicker(picker.id, 'B'); await f.controller.submit(id);
  assert.deepEqual(f.calls.find(value => Array.isArray(value)), ['move', 'A', 'B']); assert.equal(f.controller.getSnapshot().dialog.id, id);
  assert.equal(f.controller.getSnapshot().dialog.saving, false); assert.deepEqual(f.controller.getSnapshot().notice.values, { name: 'Shown A' });
});
test('move group selection resets a matching parent to root and leaves unrelated parents selected', async () => {
  const f = fixture(); await tick(); await f.controller.open('move'); const id = f.controller.getSnapshot().dialog.id;
  f.controller.openPicker(id, 'moveParent'); let picker = f.controller.getSnapshot().picker; f.controller.finishPicker(picker.id, 'A');
  f.controller.openPicker(id, 'moveGroup'); picker = f.controller.getSnapshot().picker; f.controller.finishPicker(picker.id, 'A');
  assert.equal(f.controller.getSnapshot().dialog.parent, 'All Item Groups');
});
test('closing a pending parent move suppresses its old callback and does not refresh a new dialog', async () => {
  const f = fixture(); await tick(); await f.controller.open('move'); const id = f.controller.getSnapshot().dialog.id, pendingMove = deferred();
  for (const [field, value] of [['moveGroup', 'A'], ['moveParent', 'B']]) { f.controller.openPicker(id, field); const picker = f.controller.getSnapshot().picker; f.controller.finishPicker(picker.id, value); }
  f.deps.move = async () => pendingMove.promise; const pending = f.controller.submit(id); f.controller.closeDialog(id); await f.controller.open('create');
  const count = f.calls.length; pendingMove.resolve(row('A', 'B')); await pending; assert.equal(f.calls.length, count); assert.equal(f.controller.getSnapshot().notice, null);
});
test('items use 40-row pages, append in order, retain earlier rows on failure and retry from page zero', async () => {
  const f = fixture(); await tick(); const pages = [Array.from({ length: 40 }, (_, i) => ({ code: String(i) })), [{ code: '40' }]];
  f.deps.items = async (group, offset, guard) => { guard(); f.calls.push(['items', group, offset]); return pages.shift(); };
  f.controller.selectGroup('A'); await tick(); assert.equal(f.controller.getSnapshot().hasMore, true);
  const scroll = { contentHeight: 1000, viewportHeight: 400 };
  f.controller.itemsScrolled({ ...scroll, offset: 179 });
  f.controller.setTab('tree'); f.controller.itemsScrolled({ ...scroll, offset: 180 });
  assert.deepEqual(f.calls.filter(Array.isArray), [['items', 'A', 0]]);
  f.controller.setTab('items'); f.controller.itemsScrolled({ ...scroll, offset: 180 });
  f.controller.itemsScrolled({ ...scroll, offset: 181 });
  await tick();
  assert.equal(f.controller.getSnapshot().items.length, 41); assert.equal(f.controller.getSnapshot().hasMore, false);
  assert.deepEqual(f.calls.filter(Array.isArray), [['items', 'A', 0], ['items', 'A', 40]]);
});
test('item page responses after group ABA, unmount or account switch never settle into the new group', async () => {
  const f = fixture(); await tick(); const first = deferred(), second = deferred(); let request = 0;
  f.deps.items = async () => ++request === 1 ? first.promise : second.promise;
  f.controller.selectGroup('A'); f.controller.selectGroup('B'); f.controller.selectGroup('A');
  first.resolve([{ code: 'old' }]); second.resolve([{ code: 'fresh' }]); await tick(); assert.deepEqual(f.controller.getSnapshot().items, [{ code: 'fresh' }]);
  const late = deferred(); f.deps.items = async () => late.promise; f.controller.selectGroup('B'); f.expire(); late.resolve([{ code: 'wrong-account' }]); await tick();
  assert.notDeepEqual(f.controller.getSnapshot().items, [{ code: 'wrong-account' }]); f.revive(); f.controller.selectGroup('A'); assert.equal(f.controller.getSnapshot().selectedGroup, 'B');
});
test('synchronous account retirement on saving prevents dispatch, and old picker results cannot write', async () => {
  const f = fixture(); await tick(); await f.controller.open('create'); const id = f.controller.getSnapshot().dialog.id; f.controller.setName(id, 'New');
  f.controller.subscribe(() => { if (f.controller.getSnapshot().dialog?.saving) f.expire(); }); await f.controller.submit(id);
  assert.equal(f.calls.some(Array.isArray), false);
});
test('StrictMode cleanup and replay restart valid screen while invalidation never revives it', async () => {
  const f = fixture(); await tick(); f.controller.dispose(); f.controller.start(); await tick(); assert.equal(f.controller.getSnapshot().treePhase, 'ready');
  f.controller.invalidate(); f.controller.dispose(); f.controller.start(); assert.equal(f.controller.getSnapshot().valid, false); await f.controller.open('create'); assert.equal(f.controller.getSnapshot().dialog, null);
});
test('a next-page failure retains earlier rows, disables auto retry and explicit retry restarts at zero', async () => {
  const f = fixture(); await tick(); let page = 0;
  f.deps.items = async (group, offset) => { f.calls.push(['items', group, offset]); if (page++ === 0) return Array(40).fill({ code: 'A' }); if (page === 2) throw new Error('offline'); return [{ code: 'fresh' }]; };
  f.controller.selectGroup('A'); await tick(); await f.controller.loadItems(false);
  assert.equal(f.controller.getSnapshot().items.length, 40); assert.equal(f.controller.getSnapshot().itemsError, true); assert.equal(f.controller.getSnapshot().hasMore, false);
  const count = f.calls.length; await f.controller.loadItems(false); assert.equal(f.calls.length, count);
  await f.controller.loadItems(true); assert.deepEqual(f.calls.at(-1), ['items', 'A', 0]); assert.deepEqual(f.controller.getSnapshot().items, [{ code: 'fresh' }]);
});
test('native page blur suspends transient dialogs and rejects background writes without retiring account reads', async () => {
  const f = fixture(); let focused = true; f.deps.canInteract = () => focused; await tick(); await f.controller.open('create');
  const id = f.controller.getSnapshot().dialog.id; f.controller.setName(id, 'New'); focused = false; f.controller.suspendInteraction();
  await f.controller.submit(id); await f.controller.open('move'); assert.equal(f.controller.getSnapshot().dialog, null); assert.equal(f.calls.some(Array.isArray), false);
  await f.controller.reload(); assert.equal(f.controller.getSnapshot().treePhase, 'ready');
  focused = true; await f.controller.open('create'); assert.ok(f.controller.getSnapshot().dialog); assert.equal(f.controller.getSnapshot().valid, true);
});
test('group picker keeps source 220ms debounce and loaded-page relevance, and cancels timers on dismiss', async () => {
  const f = fixture(); await tick(); f.groups.push('prefix A', 'A'); await f.controller.open('create'); const id = f.controller.getSnapshot().dialog.id;
  f.controller.openPicker(id, 'createParent'); const picker = f.controller.getSnapshot().picker;
  const originalSet = global.setTimeout, originalClear = global.clearTimeout; let fire, delay, cleared = 0;
  global.setTimeout = (callback, ms) => { fire = callback; delay = ms; return 77; }; global.clearTimeout = () => { cleared++; };
  try {
    f.controller.pickerSearch(picker.id, 'A'); assert.equal(delay, 220); assert.equal(f.controller.getSnapshot().picker.loadedQuery, '');
    fire(); assert.equal(f.controller.getSnapshot().picker.loadedQuery, 'A'); assert.equal(f.controller.pickerRows().items[0], 'A');
    f.controller.pickerSearch(picker.id, 'other'); f.controller.finishPicker(picker.id, null); assert.ok(cleared); fire(); assert.equal(f.controller.getSnapshot().picker, null);
  } finally { global.setTimeout = originalSet; global.clearTimeout = originalClear; }
});
test('blur/resume cannot revive the original pending command or publish its old success notice', async () => {
  const f = fixture(); let focused = true; f.deps.canInteract = () => focused; await tick(); await f.controller.open('create');
  const id = f.controller.getSnapshot().dialog.id, response = deferred(); f.controller.setName(id, 'New'); f.deps.create = async () => response.promise;
  const pending = f.controller.submit(id); focused = false; f.controller.suspendInteraction(); focused = true; await f.controller.open('move');
  response.resolve(row('New')); await pending;
  assert.equal(f.controller.getSnapshot().dialog.kind, 'move'); assert.equal(f.controller.getSnapshot().notice, null);
});
test('finishing a picker publishes its value atomically and cannot change a synchronously opened next dialog', async () => {
  const f = fixture(); await tick(); await f.controller.open('create'); const id = f.controller.getSnapshot().dialog.id;
  f.controller.openPicker(id, 'createParent'); const picker = f.controller.getSnapshot().picker;
  const unsubscribe = f.controller.subscribe(() => {
    const state = f.controller.getSnapshot();
    if (!state.picker && state.dialog?.id === id) {
      f.controller.closeDialog(id); void f.controller.open('create');
    }
  });
  f.controller.finishPicker(picker.id, 'B'); unsubscribe();
  assert.notEqual(f.controller.getSnapshot().dialog.id, id); assert.equal(f.controller.getSnapshot().dialog.parent, null);
  await tick(); assert.equal(f.controller.getSnapshot().dialog.parent, 'All Item Groups');
});
