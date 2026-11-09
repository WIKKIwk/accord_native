const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
function load(name, dependencies = {}) {
  const filename = path.resolve(__dirname, '../src', name), m = new Module(filename, module);
  m.require = key => key in dependencies ? dependencies[key] : require(key);
  m._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return m.exports;
}
const { QolipDataRevision } = load('shared/qolipDataRevision.ts');
test('Qolip location revision increments once per notification and supports unsubscribe', () => {
  const revision = new QolipDataRevision(), values = [], unsubscribe = revision.subscribe(() => values.push(revision.locations));
  revision.notifyLocationsChanged(); revision.notifyLocationsChanged(); unsubscribe(); revision.notifyLocationsChanged();
  assert.deepEqual(values, [1, 2]); assert.equal(revision.locations, 3);
});

test('revision notification continues after a listener fails and defers newly added listeners', () => {
  const revision = new QolipDataRevision(), calls = [], oldError = console.error;
  try {
    console.error = () => {};
    revision.subscribe(() => { calls.push('bad'); throw new Error('listener'); });
    let remove;
    revision.subscribe(() => { calls.push('add'); remove ??= revision.subscribe(() => calls.push('new')); });
    revision.subscribe(() => calls.push('last'));
    revision.notifyLocationsChanged(); assert.deepEqual(calls, ['bad', 'add', 'last']);
    revision.notifyLocationsChanged(); assert.deepEqual(calls, ['bad', 'add', 'last', 'bad', 'add', 'last', 'new']);
    remove();
  } finally { console.error = oldError; }
});

test('home runtime uses existing app preferences, current scope and an after-frame scheduler', async () => {
  const saved = new Map(), calls = [], session = { profile: { role: 'qolipchi', ref: 'A' } }; let active = session, deps, preserve;
  class FakeState { constructor(input, isPreserved) { deps = input; preserve = isPreserved; } }
  const { createQolipHomeState } = load('qolip/qolipHomeRuntime.ts', {
    '../auth': { currentSession: () => active }, '../appPreferences': { appPreferences: {
      getItem: async key => saved.get(key) ?? null, setItem: async (key, value) => saved.set(key, value) } },
    '../sessionReadScope': { sessionReadScope: value => `scope:${value.profile.ref}` },
    './qolipBlocksApi': { qolipBlocksData: value => { calls.push(['blocks', value]); return Promise.resolve({}); } },
    './qolipLocationsApi': { qolipLocations: (value, block) => { calls.push(['locations', value, block]); return Promise.resolve([]); } },
    './qolipHomeLogic': { qolipHomeBlockOrderKey: 'qolip.home.block_order' }, './qolipHomeState': { QolipHomeState: FakeState },
  });
  createQolipHomeState(session); assert.equal(preserve, true); assert.equal(deps.scope(), 'scope:A'); assert.equal(deps.valid(), true);
  assert.deepEqual(await deps.readOrder(), []); await deps.saveOrder(['b', 'a']); assert.equal(saved.get('qolip.home.block_order'), '["b","a"]');
  assert.deepEqual(await deps.readOrder(), ['b', 'a']); saved.set('qolip.home.block_order', '[1]'); await assert.rejects(deps.readOrder(), TypeError);
  await deps.blocks(); await deps.locations('B'); assert.deepEqual(calls, [['blocks', session], ['locations', session, 'B']]);
  active = { profile: { role: 'qolipchi', ref: 'B' } }; assert.equal(deps.scope(), 'scope:B'); assert.equal(deps.valid(), false);
  const oldRaf = global.requestAnimationFrame, frames = []; let fired = false;
  try { global.requestAnimationFrame = callback => { frames.push(callback); return frames.length; };
    deps.afterFrame(() => { fired = true; }); assert.equal(fired, false); frames.shift()(); assert.equal(fired, false);
    frames.shift()(); assert.equal(fired, true);
  } finally { global.requestAnimationFrame = oldRaf; }
  createQolipHomeState({ profile: { role: 'admin' } }); assert.equal(preserve, false);
});

test('home hook connects revision, focus, resume and pre-switch reset and tears them down', async () => {
  const calls = [], effects = [], listeners = {}; let focus;
  const controller = { subscribe: () => () => {}, getSnapshot: () => ({ invalid: false }), displayBlocks: [],
    activate: () => calls.push('activate'), start: async () => { calls.push('start'); }, dispose: () => calls.push('dispose'),
    locationsChanged: () => calls.push('locations'), invalidateSession: () => calls.push('invalidate'),
    routeChanged: value => calls.push(`route:${value}`), appResumed: () => calls.push('resume') };
  const { useQolipHome } = load('qolip/useQolipHome.ts', {
    'expo-router': { useFocusEffect: callback => { focus = callback; } },
    react: { useCallback: fn => fn, useEffect: fn => effects.push(fn), useMemo: fn => fn(), useSyncExternalStore: (_sub, get) => get() },
    'react-native': { AppState: { addEventListener: (_type, callback) => { listeners.app = callback; return { remove: () => calls.push('removeApp') }; } } },
    '../auth': { registerSessionResetHook: callback => { listeners.reset = callback; return () => calls.push('removeReset'); } },
    '../shared/qolipDataRevision': { qolipDataRevision: { subscribe: callback => { listeners.revision = callback; return () => calls.push('removeRevision'); } } },
    './qolipHomeRuntime': { createQolipHomeState: () => controller },
  });
  assert.equal(useQolipHome({}).controller, controller); const cleanup = effects[0](), unfocus = focus();
  listeners.revision(); listeners.app('background'); listeners.app('active'); await listeners.reset(); unfocus(); cleanup();
  assert.deepEqual(calls, ['activate', 'start', 'route:true', 'locations', 'resume', 'invalidate', 'route:false',
    'removeApp', 'removeReset', 'removeRevision', 'dispose']);
});
