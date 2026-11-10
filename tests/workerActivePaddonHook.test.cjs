const assert = require('node:assert/strict'), fs = require('node:fs'), Module = require('node:module'), path = require('node:path'), test = require('node:test'), ts = require('typescript');
function compile(file, mocks = {}) {
  const filename = path.resolve(__dirname, '../src', file), mod = new Module(filename, module); mod.filename = filename; mod.paths = module.paths;
  mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename); return mod.exports;
}
const { WorkerActivePaddon } = compile('workerActivePaddon.ts'), { sessionReadScope } = compile('sessionReadScope.ts');
const tick = () => new Promise(setImmediate);
function hooks() {
  let index = 0; const slots = [], effects = [], changed = (a, b) => !a || a.length !== b.length || a.some((value, i) => value !== b[i]);
  const effect = (fn, deps) => { const i = index++, old = slots[i]; if (!old || changed(old.deps, deps)) { const next = slots[i] = { deps }; effects.push(() => { old?.cleanup?.(); next.cleanup = fn(); }); } };
  const react = { useState: initial => { const i = index++; slots[i] ??= { value: initial }; return [slots[i].value, value => { slots[i].value = value; }]; },
    useMemo: (fn, deps) => { const i = index++; if (!slots[i] || changed(slots[i].deps, deps)) slots[i] = { value: fn(), deps }; return slots[i].value; },
    useCallback: (fn, deps) => react.useMemo(() => fn, deps), useSyncExternalStore: (_sub, get) => get(), useEffect: effect };
  return { react, begin: () => { index = 0; }, flush: () => { while (effects.length) effects.shift()(); }, dispose: () => slots.forEach(value => value?.cleanup?.()) };
}
function setup() {
  const react = hooks(), apparatus = 'apparatus:default:cut', h = { valid: true, events: [], visible: true, revision: '1', code: '00001' };
  h.session = { baseUrl: 'https://example.test', token: 'token', profile: { role: 'aparatchi', ref: 'one' }, capabilities: ['apparatus.queue.read'], assigned_apparatus: [apparatus] };
  const p = key => key;
  const { useWorkerActivePaddon } = compile('components/useWorkerActivePaddon.ts', {
    react: react.react, 'expo-router': { useFocusEffect: fn => react.react.useEffect(fn, [fn]) },
    'react-native': { AppState: { currentState: 'active', addEventListener: (_name, fn) => { h.app = fn; return { remove() {} }; } }, Platform: { OS: 'ios' }, ToastAndroid: {} },
    '../auth': { captureSessionWitness: () => ({}), isSessionWitnessCurrent: () => h.valid, subscribeSessionWitness: fn => { h.witness = fn; return () => {}; } },
    '../sessionReadScope': { sessionReadScope }, '../workerActivePaddon': { WorkerActivePaddon },
    '../workerPaddonRevision': { workerPaddonRevision: { subscribe: fn => { h.paddonNotify = fn; return () => {}; } } },
    '../paddonsApi': { activeRezkaPaddon: async (session, id, guard) => { assert(guard()); h.events.push(['GET', id]); return h.code; } },
    '../paddonManagementApi': { adminPaddons: async (session, options) => { options.beforeSend(); h.events.push(['LIST', options]); return [{ apparatus_id: apparatus, code: '00001', locked_at_unix: null, contains_peremotka: false, item_count: 2 }]; } },
    '../activePaddonSetApi': { setActiveRezkaPaddon: async (_session, id, code, guard) => { assert(guard()); h.events.push(['PUT', id, code]); h.code = code; return code; } },
    '../shared/productionDataRevisionRuntime': { productionDataRevision: { isCurrentScope: true, subscribe: fn => { h.notify = fn; return () => {}; } } },
    './useWorkerOrderText': { useWorkerOrderText: () => ({ p }) } });
  h.render = () => { react.begin(); h.model = useWorkerActivePaddon(h.session, apparatus, h.visible, h.revision); react.flush(); return h.model; };
  h.dispose = react.dispose; h.render(); return h;
}
test('hook performs one initial GET and uses the V2 scoped selectable list contract', async () => {
  const h = setup(); await tick(); assert.equal(h.events.length, 1); h.render(); assert.equal(h.model.label, 'worker.paddon.active.selected');
  await h.model.controller.open(); const input = h.events.find(event => event[0] === 'LIST')[1];
  assert.deepEqual({ limit: input.limit, apparatus: input.apparatus, selectable_only: input.selectable_only }, { limit: 200, apparatus: 'apparatus:default:cut', selectable_only: true });
  h.dispose();
});
test('native route visibility, app resume and live queue revisions refresh the existing owner', async () => {
  const h = setup(); await tick(); h.visible = false; h.render(); h.notify(); await tick(); assert.equal(h.events.length, 1);
  h.app('background'); h.visible = true; h.render(); await tick(); assert.equal(h.events.length, 1);
  h.app('active'); await tick(); assert.equal(h.events.length, 2); const owner = h.model.controller;
  h.revision = '2'; h.render(); await tick(); assert.equal(h.events.length, 3); assert.equal(h.model.controller, owner); h.dispose();
});
test('lost auth witness closes an open native picker before a queued old row can write', async () => {
  const h = setup(); await h.model.controller.open(); h.valid = false; h.witness(); await h.model.controller.choose('00001');
  assert.equal(h.model.controller.getSnapshot().picker, 'closed'); assert.equal(h.events.some(event => event[0] === 'PUT'), false); h.dispose();
});
test('in-place assignment loss changes the owner and prevents an old queued choice', async () => {
  const h = setup(); await h.model.controller.open(); const previous = h.model.controller;
  h.session.assigned_apparatus = []; h.render(); assert.notEqual(previous, h.model.controller); await previous.choose('00001');
  assert.equal(previous.getSnapshot().picker, 'closed'); assert.equal(h.events.some(event => event[0] === 'PUT'), false); h.dispose();
});

test('a scoped membership or print-lock notification refreshes the active Paddon authority', async () => {
  const h = setup(); await tick(); const before = h.events.length;
  h.paddonNotify('another account'); await tick(); assert.equal(h.events.length, before);
  h.paddonNotify(sessionReadScope(h.session)); await tick(); assert.equal(h.events.length, before + 1); h.dispose();
});
