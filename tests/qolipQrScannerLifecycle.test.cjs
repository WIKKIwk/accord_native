const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const tick = () => new Promise(resolve => setImmediate(resolve));
function deferred() { let resolve; const promise = new Promise(done => { resolve = done; }); return { resolve, promise }; }
function fixture(mode = 'cell') {
  const slots = [], tasks = [], results = [], notices = [], calls = [], watchers = new Set(), cache = new Map();
  let cursor = 0, focused = true, focusCleanup, appListener, valid = true, closes = 0, cameraActive;
  const response = deferred(), session = { token: 'token', baseUrl: 'https://example.test', imageCacheScope: 'A',
    profile: { role: 'qolipchi', ref: 'A' }, capabilities: ['qolip.manage'], assigned_apparatus: [], assigned_apparatus_labels: [] };
  const boundary = { current: () => valid, subscribe: callback => { watchers.add(callback); return () => watchers.delete(callback); } };
  const same = (a, b) => a && b && a.length === b.length && a.every((x, i) => x === b[i]);
  const react = {
    useRef: value => { const i = cursor++; return slots[i] ?? (slots[i] = { current: value }); },
    useState: value => { const i = cursor++; if (!(i in slots)) slots[i] = typeof value === 'function' ? value() : value;
      return [slots[i], next => { slots[i] = typeof next === 'function' ? next(slots[i]) : next; }]; },
    useCallback: (fn, deps) => { const i = cursor++; if (!same(slots[i]?.deps, deps)) slots[i] = { value: fn, deps }; return slots[i].value; },
    useEffect: (setup, deps) => { const i = cursor++, old = slots[i]; if (!same(old?.deps, deps)) tasks.push(() => {
      old?.cleanup?.(); slots[i] = { deps, cleanup: setup() }; }); },
    useSyncExternalStore: (_subscribe, get) => { cursor++; return get(); },
  };
  react.useLayoutEffect = react.useEffect;
  const camera = { stop: async () => { calls.push('stop'); }, restart: async () => { assert.equal(cameraActive, true); calls.push('restart'); return true; },
    cameraFailed: () => false };
  const mocks = {
    react, 'expo-router': { useFocusEffect: callback => react.useEffect(() => {
      focusCleanup = focused ? callback() : null;
      return () => { focusCleanup?.(); focusCleanup = null; };
    }, [callback, focused]) },
    'react-native': { AppState: { currentState: 'active', addEventListener: (_name, callback) => { appListener = callback; return { remove() { appListener = null; } }; } } },
    'auth.ts': { activeSessionToken: value => value === session ? value.token : null },
    'qolip/useQolipQrCamera.ts': { useQolipQrCamera: active => { cameraActive = active; return camera; } },
    'qolip/useQolipText.ts': { useQolipText: () => ({ text: value => value }) },
    'qolip/useQolipNotice.ts': { useQolipNotice: () => ({ message: '', show: message => notices.push(message) }) },
    'qolip/qolipQrApi.ts': { qolipCellQrLookup: async (account, qr, guard) => {
      assert.equal(account, session); assert.equal(guard(), true); calls.push(['lookup', qr]); return response.promise;
    } },
  };
  const root = path.resolve(__dirname, '../src');
  function load(file) {
    if (Object.hasOwn(mocks, file)) return mocks[file];
    if (cache.has(file)) return cache.get(file).exports;
    const filename = path.join(root, file), mod = new Module(filename, module); cache.set(file, mod);
    mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : id.startsWith('.')
      ? load(`${path.relative(root, path.resolve(path.dirname(filename), id))}.ts`) : require(id);
    mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
    return mod.exports;
  }
  const { useQolipQrScanner } = load('qolip/useQolipQrScanner.ts');
  let props = { mode, session, boundary, onClose: () => { closes++; }, onResult: value => results.push(value) };
  const render = patch => { props = { ...props, ...patch }; cursor = 0; const value = useQolipQrScanner(props); while (tasks.length) tasks.shift()(); return value; };
  return { render, results, notices, calls, response, closes: () => closes,
    blur: () => { focused = false; focusCleanup?.(); focusCleanup = null; }, focus: () => { focused = true; },
    app: state => appListener(state), expire: () => { valid = false; for (const callback of watchers) callback(); },
    revive: () => { valid = true; for (const callback of watchers) callback(); },
    unmount: () => { slots.forEach(slot => slot?.cleanup?.()); } };
}
async function start(f) { f.render(); f.render(); await tick(); return f.render(); }

test('a focused cell scanner uses the opening session and returns the real lookup result', async t => {
  const f = fixture(); t.after(f.unmount); const flow = await start(f);
  assert.equal(flow.active, true); assert.equal(flow.title, 'scanner.title.cell');
  flow.detect(' CELL ', 'display', flow.state.generation); await tick();
  assert.ok(f.calls.some(call => Array.isArray(call) && call[0] === 'lookup' && call[1] === 'CELL'));
  const cell = { id: 'c', row_letter: 'A', column_number: 1 }; f.response.resolve(cell); await tick(); assert.deepEqual(f.results, [cell]);
});
test('a covered page ignores delayed lookup completion and cannot close a newer route', async t => {
  const f = fixture(); t.after(f.unmount); const flow = await start(f);
  flow.detect('CELL', 'display', flow.state.generation); await tick(); f.blur(); flow.close();
  f.response.resolve({ id: 'late' }); await tick(); assert.deepEqual(f.results, []); assert.equal(f.closes(), 0); assert.equal(f.render().active, false);
});
test('background/resume rejects an old camera generation and resumes with the same original witness', async t => {
  const f = fixture('raw'); t.after(f.unmount); const old = await start(f);
  f.app('background'); f.render(); f.app('active'); f.render(); await tick(); const current = f.render();
  old.detect('OLD', 'display', old.state.generation); assert.deepEqual(f.results, []);
  current.detect('NEW', 'display', current.state.generation); await tick(); assert.deepEqual(f.results, ['NEW']);
});
test('an observed account ABA and a replaced page binding remain retired', async t => {
  const f = fixture('raw'); t.after(f.unmount); const old = await start(f);
  f.expire(); f.render(); f.revive(); assert.equal(f.render().valid, false);
  old.detect('OLD', 'display', old.state.generation); old.close(); await tick(); assert.deepEqual(f.results, []); assert.equal(f.closes(), 0);
  const other = fixture('raw'); t.after(other.unmount); const prior = await start(other);
  other.render({ boundary: { current: () => true, subscribe: () => () => {} } }); prior.close();
  assert.equal(other.closes(), 0); assert.equal(other.render().valid, false);
});
