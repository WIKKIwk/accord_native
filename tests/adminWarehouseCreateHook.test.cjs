/* global __dirname */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const test = require('node:test');
const ts = require('typescript');
function load(file, mocks = {}) {
  const filename = path.resolve(__dirname, '../src', file + '.ts'), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths; mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename); return mod.exports;
}
const { AdminWarehouseCreateController } = load('admin/adminWarehouseCreateController', { '../shared/camera/synchronousGuard': load('shared/camera/synchronousGuard'),
  './adminWarehouseAssignees': { adminWarehouseAssigneeSearch: users => users, adminWarehouseRoleForUser: user => user.principal_role }, './dartJsonString': load('admin/dartJsonString') });
const deferred = () => { let resolve; return { promise: new Promise(yes => { resolve = yes; }), resolve: value => resolve(value) }; };
const tick = () => new Promise(resolve => setImmediate(resolve));
function fixture(overrides = {}) {
  let focused = true, current = true, slot = 0, notify;
  const slots = [], pending = [], calls = [], user = { id: 'person', name: 'Name', principal_role: 'werka' };
  const controller = new AdminWarehouseCreateController({ isCurrent: () => current,
    users: async () => { calls.push('users'); return [user]; }, create: async () => { calls.push('create'); }, assign: async () => { calls.push('assign'); },
    onSaved: async () => { calls.push('saved'); }, onClose: () => { calls.push('close'); }, ...overrides });
  const owner = { controller, current: () => current };
  const memo = (make, deps) => { const index = slot++, old = slots[index]; if (!old || deps.some((value, i) => value !== old.deps[i])) slots[index] = { deps, value: make() }; return slots[index].value; };
  const effect = (create, deps) => { const index = slot++, old = slots[index]; if (!old || deps.some((value, i) => value !== old.deps[i])) {
    const value = { deps, create, cleanup: old?.cleanup }; slots[index] = value; pending.push(() => { value.cleanup?.(); value.cleanup = create(); });
  } };
  const react = { useMemo: memo, useRef: value => memo(() => ({ current: value }), []), useEffect: effect, useLayoutEffect: effect, useSyncExternalStore: (_subscribe, get) => get() };
  const { useAdminWarehouseCreate } = load('admin/useAdminWarehouseCreate', { react, 'expo-router': { useIsFocused: () => focused },
    '../auth': { subscribeSessionWitness: fn => { notify = fn; return () => calls.push('unsubscribe'); } },
    '../shared/localization': { adminText: key => key, localizedGetter: key => key }, '../shared/localization/runtime': { localeController: { locale: 'uz', addListener() {} } },
    './adminWarehouseCreateSession': { adminWarehouseCreateSession: () => owner } });
  const props = { session: {}, witness: {}, isCurrent: () => current, onSaved: async () => {}, onClose() {} };
  const Harness = () => { slot = 0; const value = useAdminWarehouseCreate(props); pending.splice(0).forEach(run => run()); return value; };
  const unmount = () => slots.forEach(value => value?.cleanup?.());
  return { calls, user, controller, render: Harness, unmount, replay: () => { unmount(); slots.forEach(value => { if (value?.create) value.cleanup = value.create(); }); },
    focus: value => { focused = value; }, retire: () => { current = false; notify(); } };
}
test('actual hook attach-cleanup-attach keeps controller usable while canceling detached cached user load', async () => {
  const stale = deferred(); let reads = 0; const f = fixture({ users: async () => ++reads === 1 ? stale.promise : [f.user] });
  const initial = f.render(); initial.controller.changeName('before replay'); const pending = initial.controller.openPicker();
  f.replay(); const afterReplay = f.render(); assert.equal(afterReplay.current, true); assert.equal(f.controller.isCurrent(), true);
  assert.equal(afterReplay.state.name, ''); stale.resolve([f.user]); await pending; assert.equal(f.controller.getSnapshot().picker, null);
  await afterReplay.controller.openPicker(); const picker = f.controller.getSnapshot().picker;
  assert.equal(reads, 2); afterReplay.controller.selectUser(picker.id, f.user); afterReplay.controller.changeName('Storage'); afterReplay.save(); await tick();
  assert.deepEqual(f.calls.filter(value => !['unsubscribe'].includes(value)), ['create', 'assign', 'saved', 'close']); f.unmount();
});
test('blur and unmount fence every retained dialog, name, save, search and picker callback independently from account scope', async () => {
  const f = fixture(), old = f.render(); await old.controller.openPicker(); const picker = f.controller.getSnapshot().picker;
  f.focus(false); assert.equal(f.render().current, false); assert.equal(f.controller.isCurrent(), true);
  old.controller.changeName('stale'); old.controller.searchPicker(picker.id, 'stale'); old.controller.selectUser(picker.id, f.user);
  old.controller.dismissPicker(picker.id); old.controller.closeButton(); old.controller.dismissDialog(); old.save(); await old.controller.openPicker();
  assert.equal(f.controller.getSnapshot().name, ''); assert.equal(f.controller.getSnapshot().picker, picker); assert.deepEqual(f.calls, ['users']);
  f.focus(true); const fresh = f.render(); fresh.controller.selectUser(picker.id, f.user); fresh.controller.changeName('Storage');
  f.unmount(); old.controller.dismissDialog(); fresh.save(); assert.deepEqual(f.calls, ['users', 'unsubscribe']); assert.equal(f.controller.getSnapshot().selected, null);
});
test('generic native callbacks retained across same-owner cleanup/start cannot affect the new dialog lifetime', async () => {
  const f = fixture(), stale = f.render(); f.replay(); const fresh = f.render();
  stale.controller.changeName('old lifetime'); stale.controller.closeButton(); stale.controller.dismissDialog(); stale.save(); await stale.controller.openPicker();
  assert.deepEqual(f.calls, ['unsubscribe']); assert.equal(f.controller.getSnapshot().name, ''); assert.equal(f.controller.getSnapshot().phase, 'content');
  fresh.controller.changeName('new lifetime'); await fresh.controller.openPicker(); const picker = f.controller.getSnapshot().picker;
  fresh.controller.selectUser(picker.id, f.user); fresh.save(); await tick(); assert.equal(f.calls.includes('create'), true); assert.equal(f.calls.includes('close'), true); f.unmount();
});
test('account retirement is sticky across effect replay and removes the modal with no stale success callbacks', async () => {
  const pendingCreate = deferred(), f = fixture({ create: async () => { f.calls.push('create'); await pendingCreate.promise; } });
  const view = f.render(); await view.controller.openPicker(); view.controller.selectUser(f.controller.getSnapshot().picker.id, f.user); view.controller.changeName('Storage'); view.save();
  f.retire(); assert.equal(f.render().current, false); f.replay(); assert.equal(f.controller.isCurrent(), false); pendingCreate.resolve(); await tick();
  assert.equal(f.calls.includes('assign'), false); assert.equal(f.calls.includes('saved'), false); assert.equal(f.calls.includes('close'), false); f.unmount();
});
