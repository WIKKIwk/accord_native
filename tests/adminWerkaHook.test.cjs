const assert = require('node:assert/strict');
const test = require('node:test');
const { load, strings, l10n, flush, deferred } = require('./adminUsersSupport.cjs');
const strict = load('shared/camera/synchronousGuard');
const { AdminWerkaController } = load('admin/adminWerkaController', { '../shared/camera/synchronousGuard': strict, './dartJsonString': strings });
const presentation = load('admin/adminWerkaPresentation', { './dartJsonString': strings });
const settings = { werka_name: 'Original', werka_phone: '123', werka_code: ' raw ', werka_code_retry_after_sec: 0, werka_avatar_url: '' };
function fixture(t, platform = 'android') {
  let valid = true, focused = true, locale = 'uz', cursor = 0; const slots = [], effects = [], handlers = new Set(), ownedBacks = new Set(), backs = [], calls = [];
  const equal = (left, right) => !!left && !!right && left.length === right.length && left.every((value, index) => Object.is(value, right[index]));
  const memo = (create, deps) => { const index = cursor++, old = slots[index]; if (!old || !equal(old.deps, deps)) slots[index] = { deps, value: create() }; return slots[index].value; };
  const effect = (callback, deps) => { const index = cursor++, old = slots[index]; if (!old || !equal(old.deps, deps)) effects.push(() => { old?.cleanup?.(); slots[index] = { deps, cleanup: callback() }; }); };
  const react = { useMemo: memo, useCallback: (fn, deps) => memo(() => fn, deps), useRef: value => { const index = cursor++; return slots[index] ??= { current: value }; },
    useSyncExternalStore: (_subscribe, get) => get(), useLayoutEffect: effect, useEffect: effect };
  const deps = { isCurrent: () => valid, read: async () => settings, write: async (input, guard) => { guard(); calls.push(input); return { ...settings, werka_code: 'saved' }; },
    regenerate: async guard => { guard(); calls.push('regen'); return settings; }, copy: async (code, guard) => { guard(); calls.push(['copy', code]); },
    everySecond: () => 1, cancelTimer() {} };
  const controller = new AdminWerkaController(deps), owner = { controller, current: () => valid };
  const hook = load('admin/useAdminWerka', { react, '../shared/camera/synchronousGuard': strict, './AdminOwnedBackContext': { useAdminOwnedBack: handler => effect(() => { ownedBacks.add(handler); return () => ownedBacks.delete(handler); }, [handler]) }, 'expo-router': { useIsFocused: () => focused, useFocusEffect: callback => effect(callback, [callback]) },
    'react-native': { Platform: { OS: platform }, BackHandler: { addEventListener: (_event, handler) => { handlers.add(handler); return { remove: () => handlers.delete(handler) }; } } },
    '../auth': { subscribeSessionWitness: () => () => {} }, '../shared/localization': l10n,
    '../shared/localization/runtime': { localeController: { get locale() { return locale; }, addListener() { return () => {}; } } },
    './adminWerkaSession': { createAdminWerkaSession: () => owner }, './adminWerkaPresentation': presentation, './dartJsonString': strings });
  const props = { session: {}, witness: {}, isCurrent: () => valid, onBack: changed => backs.push(changed) };
  const render = () => { cursor = 0; effects.length = 0; const model = hook.useAdminWerka(props); for (const commit of [...effects]) commit(); return model; };
  const cleanup = () => { for (const slot of slots) if (slot?.cleanup) { slot.cleanup(); slot.cleanup = null; slot.deps = null; } };
  t.after(() => { cleanup(); controller.dispose(); });
  return { render, controller, deps, props, calls, backs, handlers, ownedBacks, cleanup, focus: value => { focused = value; }, locale: value => { locale = value; }, retire: () => { valid = false; } };
}
test('Werka hook locale parent rebuild reads live drafts while copy/dismiss notice leaves source header unchanged', async t => {
  const f = fixture(t); f.render(); await flush(); const first = f.render(); first.changeName('Draft'); first.changePhone('456');
  await f.controller.copy(); const copied = f.render(); assert.equal(copied.displayName, 'Original'); assert.equal(copied.fields.phone, '123');
  f.locale('en'); const translated = f.render(); assert.equal(translated.displayName, 'Draft'); assert.equal(translated.fields.phone, '456');
  f.controller.dismissNotice(f.controller.getSnapshot().copiedNotice); assert.equal(f.render().displayName, 'Draft');
  assert.deepEqual(f.calls.at(-1), ['copy', ' raw ']);
});
test('Werka focus gates user events while an original pending write may settle and return its changed result', async t => {
  const pending = deferred(), f = fixture(t); f.deps.write = async () => pending.promise; f.render(); await flush(); const first = f.render();
  const saving = first.save(); f.focus(false); f.render(); first.changeName('Hidden'); first.toggle(); first.regenerate(); first.back();
  assert.equal(f.controller.currentFields.name, 'Original'); assert.deepEqual(f.calls, []); assert.deepEqual(f.backs, []);
  pending.resolve({ ...settings, werka_code: 'ack' }); assert.equal(await saving, true); f.focus(true); const returned = f.render(); returned.back(); assert.deepEqual(f.backs, [true]);
});
test('Werka stale native hook callbacks cannot act after cleanup/reattachment or account retirement', async t => {
  const f = fixture(t); f.render(); await flush(); const original = f.render(); f.cleanup(); f.render(); await flush(); const fresh = f.render();
  original.changeName('stale'); original.toggle(); original.regenerate(); original.copy(); original.back(); assert.equal(await original.save(), false);
  assert.equal(f.controller.currentFields.name, 'Original'); assert.deepEqual(f.calls, []); assert.deepEqual(f.backs, []);
  fresh.changeName('fresh'); fresh.toggle(); assert.equal(f.controller.currentFields.name, 'fresh');
  f.retire(); fresh.back(); assert.equal(await fresh.save(), false); assert.deepEqual(f.backs, []);
});
test('Werka changed-back intercepts Android hardware back only while focused; iOS installs no hardware handler', async t => {
  const f = fixture(t); f.render(); await flush(); f.render(); assert.equal(f.handlers.size, 1); assert.equal([...f.handlers][0](), true); assert.deepEqual(f.backs, [false]);
  f.focus(false); f.render(); assert.equal([...f.handlers][0](), false); assert.deepEqual(f.backs, [false]);
  const ios = fixture(t, 'ios'); ios.render(); await flush(); ios.render(); assert.equal(ios.handlers.size, 0);
});
test('Werka original host interaction fences queued actions and real owned Back while accepted save stays alive', async t => {
  const f = fixture(t), pending = deferred(); let allowed = true; f.props.canInteract = () => allowed; f.deps.write = () => pending.promise;
  f.render(); await flush(); const model = f.render(), saving = model.save(); allowed = false;
  model.changeName('hidden'); model.toggle(); model.regenerate(); model.copy(); [...f.ownedBacks][0](); assert.equal([...f.handlers][0](), false);
  assert.equal(model.current(), true); assert.deepEqual(f.backs, []); assert.equal(f.controller.currentFields.name, 'Original');
  pending.resolve({ ...settings, werka_name: 'saved' }); assert.equal(await saving, true); allowed = true; f.render(); [...f.ownedBacks][0](); assert.deepEqual(f.backs, [true]);
});
test('Werka async or reentrant retiring host interaction cannot invoke native Back', async t => {
  for (const mode of ['async', 'retire']) {
    const f = fixture(t); f.props.canInteract = mode === 'async' ? async () => true : () => { f.retire(); return true; };
    f.render(); await flush(); f.render(); [...f.ownedBacks][0](); assert.equal([...f.handlers][0](), false); assert.deepEqual(f.backs, []);
  }
});
