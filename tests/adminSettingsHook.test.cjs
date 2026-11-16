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
const l10n = load('shared/localization/index', { './catalog.json': require('../src/shared/localization/catalog.json') });
function fixture(platform = 'android', withAvailability = false) {
  let focused = true, active = true, allowed = true, slot = 0, witnessChanged, hardware;
  const slots = [], effects = [], cleanups = [], calls = [];
  let snapshot = { phase: 'content', fields: {}, changed: false, notice: null };
  const memo = (make, deps) => { const index = slot++, old = slots[index]; if (!old || deps.some((value, i) => value !== old.deps[i])) slots[index] = { deps, value: make() }; return slots[index].value; };
  const effect = (fn, deps) => { const index = slot++, old = slots[index]; if (!old || deps.some((value, i) => value !== old.deps[i])) {
    slots[index] = { deps }; effects.push(() => { cleanups[index]?.(); cleanups[index] = fn(); });
  } };
  const controller = { getSnapshot: () => snapshot, subscribe: () => () => {}, isCurrent: () => active,
    start: () => calls.push('start'), dispose: () => { active = false; calls.push('dispose'); }, invalidate: () => { active = false; snapshot = { ...snapshot, phase: 'invalidated' }; calls.push('invalidate'); },
    runCurrent: action => { if (active) action(); }, change: (...args) => calls.push(['change', ...args]), reload: () => { calls.push('reload'); return Promise.resolve(); },
    save: () => { calls.push('save'); return Promise.resolve(); }, dismissNotice() {} };
  let destinations = new Set(['/additional']);
  const owner = { controller, current: () => active }, props = { session: {}, witness: {}, isCurrent: () => active,
    navigation: { icon: 'back', label: 'Back', onPress: changed => calls.push(['back', changed]) }, onNavigate: route => calls.push(['navigate', route]), ...(withAvailability ? { isRouteAvailable: route => destinations.has(route) } : {}) };
  const react = { useMemo: memo, useCallback: (fn, deps) => memo(() => fn, deps), useRef: value => memo(() => ({ current: value }), []),
    useEffect: effect, useLayoutEffect: effect, useSyncExternalStore: (_subscribe, get) => get() };
  const expo = { useIsFocused: () => focused, useFocusEffect: fn => effect(() => focused ? fn() : undefined, [focused, fn]) };
  const { useAdminSettings } = load('admin/useAdminSettings', { react, 'expo-router': expo,
    'react-native': { Platform: { OS: platform }, BackHandler: { addEventListener: (_event, fn) => { hardware = fn; return { remove() { calls.push('remove-back'); } }; } } },
    '../auth': { subscribeSessionWitness: listener => { witnessChanged = listener; return () => calls.push('unsub'); } },
    '../shared/appRoutes': { appRoutes: { adminAdditionalSettings: '/additional', adminPushConfig: '/push' }, canOpenRoute: () => allowed },
    '../shared/profileSessionGuard': load('shared/profileSessionGuard'), '../shared/localization/runtime': { localeController: { locale: 'uz', addListener() {} } }, '../shared/localization': l10n,
    './adminSettingsSession': { adminSettingsSession: () => owner } });
  const render = () => { slot = 0; const value = useAdminSettings(props); effects.splice(0).forEach(fn => fn()); return value; };
  return { calls, render, setFocused: value => { focused = value; }, setAllowed: value => { allowed = value; },
    setDestinations: value => { destinations = new Set(value); }, retire: () => { active = false; witnessChanged(); }, changed: () => { snapshot = { ...snapshot, changed: true }; }, witness: () => witnessChanged(), hardware: () => hardware,
    unmount: () => cleanups.forEach(fn => fn?.()) };
}
test('settings back passes latest changed value and focus ownership blocks retained navigation, save, edit and retry callbacks', () => {
  const f = fixture(), old = f.render(), back = f.hardware(); f.changed(); old.navigation.onPress(); assert.deepEqual(f.calls.at(-1), ['back', true]);
  f.setFocused(false); f.render(); const before = f.calls.length;
  old.navigation.onPress(); old.navigate('/additional'); old.save(); old.change('erp_url', 'stale'); old.reload();
  assert.equal(back(), false); assert.equal(f.calls.length, before);
  f.setFocused(true); const fresh = f.render(); fresh.save(); fresh.change('erp_url', 'fresh'); fresh.reload(); fresh.navigate('/additional');
  assert.deepEqual(f.calls.slice(-4), ['save', ['change', 'erp_url', 'fresh'], 'reload', ['navigate', '/additional']]);
});
test('settings callbacks and hardware back retire on account transition and unmount', () => {
  const f = fixture(), old = f.render(), back = f.hardware(); f.retire();
  assert.ok(f.calls.includes('invalidate')); f.unmount(); const before = f.calls.length;
  old.navigation.onPress(); old.save(); old.reload(); old.change('erp_url', 'stale'); assert.equal(back(), false); assert.equal(f.calls.length, before);
});
test('iOS registers no Android global back handler and current capability gates navigation', () => {
  const f = fixture('ios'), model = f.render(); assert.equal(f.hardware(), undefined);
  f.setAllowed(false); model.navigate('/push'); assert.ok(!f.calls.some(call => Array.isArray(call) && call[0] === 'navigate'));
});

test('settings optional route availability removes held links and rechecks old callbacks before dispatch', () => {
  const f = fixture('android', true), model = f.render(); assert.equal(model.additional, true); assert.equal(model.push, false);
  model.navigate('/push'); assert.ok(!f.calls.some(call => Array.isArray(call) && call[0] === 'navigate'));
  f.setDestinations([]); model.navigate('/additional');
  assert.ok(!f.calls.some(call => Array.isArray(call) && call[0] === 'navigate'));
  const next = f.render(); assert.equal(next.additional, false); assert.equal(next.push, false);
});
