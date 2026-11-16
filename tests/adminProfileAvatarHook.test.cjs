const assert = require('node:assert/strict');
const test = require('node:test');
const { load, strings, l10n, deferred, tick } = require('./adminUsersSupport.cjs');
const strict = load('shared/camera/synchronousGuard'), model = load('admin/adminProfileAvatarModel', { './dartJsonString': strings });
const { AdminProfileAvatarController } = load('admin/adminProfileAvatarController', { '../shared/camera/synchronousGuard': strict, './adminProfileAvatarModel': model, './dartJsonString': strings });
function fixture(t) {
  let valid = true, focused = true, cursor = 0, notify; const slots = [], effects = [], reads = [], forgotten = [], cached = new Map();
  const equal = (a, b) => a && b && a.length === b.length && a.every((value, i) => Object.is(value, b[i]));
  const memo = (create, deps) => { const index = cursor++, old = slots[index]; if (!old || !equal(old.deps, deps)) slots[index] = { deps, value: create() }; return slots[index].value; };
  const effect = (create, deps) => { const index = cursor++, old = slots[index]; if (!old || !equal(old.deps, deps)) effects.push(() => { old?.cleanup?.(); slots[index] = { deps, cleanup: create() }; }); };
  const react = { useMemo: memo, useCallback: (fn, deps) => memo(() => fn, deps), useRef: value => { const index = cursor++; return slots[index] ??= { current: value }; },
    useLayoutEffect: effect, useEffect: effect, useSyncExternalStore: (_subscribe, get) => get() };
  const controller = new AdminProfileAvatarController({ isCurrent: () => valid, cached: url => cached.get(url) ?? null,
    read: (url, guard, signal) => { guard(); const wait = deferred(); reads.push({ url, guard, signal, ...wait }); return wait.promise; }, forget: (...args) => forgotten.push(args.slice(0, 2)) });
  const owner = { controller, namespace: 'original namespace', current: () => valid }, hook = load('admin/useAdminProfileAvatar', { react,
    '../auth': { subscribeSessionWitness: listener => { notify = listener; return () => {}; } }, '../shared/camera/synchronousGuard': strict, '../shared/localization': l10n,
    '../shared/localization/runtime': { localeController: { locale: 'uz', addListener: () => () => {} } }, './adminProfileAvatarSession': { adminProfileAvatarSession: () => owner }, './adminProfileAvatarModel': model });
  const props = { session: {}, witness: {}, isCurrent: () => valid, canInteract: () => focused, avatarUrl: 'https://images.example/a', fallbackText: 'AV', displayName: '', size: 92 };
  const render = () => { cursor = 0; effects.length = 0; const value = hook.useAdminProfileAvatar(props); for (const commit of [...effects]) commit(); return value; };
  const cleanup = () => { for (const slot of slots) if (slot?.cleanup) { slot.cleanup(); slot.cleanup = null; slot.deps = null; } };
  t.after(cleanup); return { props, render, controller, reads, forgotten, cached, cleanup, retire: () => { valid = false; notify?.(); }, focus: value => { focused = value; } };
}
test('actual avatar hook opens source initials/default title and preserves captured preview during URL/title parent rebuilds', async t => {
  const f = fixture(t); f.render(); const original = f.render(); original.open(); const preview = f.controller.getSnapshot().preview;
  assert.equal(preview.displayName, 'AV'); f.props.avatarUrl = 'https://images.example/b'; f.props.displayName = 'New name'; f.render(); const newThumbnail = f.render();
  assert.equal(newThumbnail.state.preview.displayName, 'AV'); assert.equal(newThumbnail.state.preview.url, 'https://images.example/a'); assert.equal(f.reads.length, 2);
  f.reads[0].resolve('uri-a'); f.reads[1].resolve('uri-b'); await tick(); const loaded = f.render(); assert.equal(loaded.state.uri, 'uri-b'); assert.equal(loaded.state.preview.uri, 'uri-a');
  loaded.close(preview.id); newThumbnail.open(); assert.equal(f.controller.getSnapshot().preview.displayName, 'New name');
});
test('parent blur blocks new preview openings while owned reads/preview close retain original account lifetime authority', async t => {
  const f = fixture(t); f.render(); const beforeBlur = f.render(); beforeBlur.open(); const id = f.controller.getSnapshot().preview.id;
  f.focus(false); const blurred = f.render(); assert.equal(blurred.current(), true); assert.equal(blurred.interactive(), false); assert.equal(blurred.previewCurrent(id), true);
  f.reads[0].resolve('original image'); await tick(); assert.equal(f.controller.getSnapshot().preview.uri, 'original image'); blurred.close(id); beforeBlur.open(); assert.equal(f.controller.getSnapshot().preview, null);
  f.focus(true); f.render().open(); assert.ok(f.controller.getSnapshot().preview);
});
test('stale avatar native callbacks cannot retarget new props or controller generation after StrictMode cleanup+reattach', async t => {
  const f = fixture(t); f.render(); const first = f.render(); first.open(); const oldId = f.controller.getSnapshot().preview.id;
  f.props.avatarUrl = 'https://images.example/b'; f.render(); const updated = f.render(); updated.close(oldId); first.open(); assert.equal(f.controller.getSnapshot().preview, null);
  updated.open(); f.cleanup(); f.render(); const fresh = f.render(); updated.open(); updated.close(oldId); updated.imageFailed('thumbnail', 'uri'); assert.equal(f.controller.getSnapshot().preview, null); assert.deepEqual(f.forgotten, []);
  fresh.open(); assert.ok(f.controller.getSnapshot().preview.id > oldId); assert.equal(f.reads[0].signal.aborted, true);
});
test('changed native interaction callback is checked strictly but focus/async/reentrant false does not retire account reads', t => {
  const f = fixture(t); f.render(); const old = f.render(); f.props.canInteract = async () => true; const async = f.render(); old.open(); async.open(); assert.equal(f.controller.getSnapshot().preview, null); assert.equal(async.current(), true);
  let recursive; f.props.canInteract = () => { recursive.interactive(); return true; }; recursive = f.render(); recursive.open(); assert.equal(f.controller.getSnapshot().preview, null); assert.equal(recursive.current(), true);
  f.props.canInteract = () => true; f.render().open(); assert.ok(f.controller.getSnapshot().preview);
});
test('retirement aborts image and scrubs preview; retained display/error/dismiss acknowledgements cannot affect new state', async t => {
  const f = fixture(t); f.render(); const old = f.render(); old.open(); const id = f.controller.getSnapshot().preview.id; f.retire();
  assert.equal(f.reads[0].signal.aborted, true); f.reads[0].resolve('late secret'); await tick(); assert.equal(old.current(), false); assert.equal(old.previewCurrent(id), false); assert.equal(old.imageCurrent('thumbnail', 'late secret'), false);
  old.imageFailed(id, 'late secret'); old.close(id); old.open(); assert.equal(f.controller.getSnapshot().uri, null); assert.equal(f.controller.getSnapshot().preview, null); assert.deepEqual(f.forgotten, []);
});
test('source size/fallback label changes do not abort account-owned image or replace existing preview snapshot', t => {
  const f = fixture(t); f.render(); f.render().open(); const id = f.controller.getSnapshot().preview.id; f.props.size = 40; f.props.fallbackText = 'XY'; const updated = f.render();
  assert.equal(updated.size, 40); assert.equal(updated.fallbackText, 'XY'); assert.equal(updated.state.preview.displayName, 'AV'); assert.equal(updated.state.preview.id, id); assert.equal(f.reads.length, 1); assert.equal(f.reads[0].signal.aborted, false);
});
