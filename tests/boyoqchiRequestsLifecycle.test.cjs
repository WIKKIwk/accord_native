const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
function compile(relative, mocks = {}) {
  const filename = path.resolve(__dirname, `../src/${relative}.ts`), loaded = new Module(filename, module);
  loaded.filename = filename; loaded.paths = module.paths;
  loaded.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return loaded.exports;
}
const deferred = () => { let resolve; const promise = new Promise(yes => { resolve = yes; }); return { promise, resolve }; };
const tick = () => new Promise(resolve => setImmediate(resolve));
function fixture() {
  let active = null, epoch = 1, cursor = 0;
  const hooks = [], requests = [], catalogs = [];
  const equals = (a, b) => a?.length === b?.length && a.every((value, i) => Object.is(value, b[i]));
  const react = {
    useMemo: (make, deps) => { const i = cursor++, prior = hooks[i];
      if (!prior || !equals(prior.deps, deps)) hooks[i] = { deps, value: make() }; return hooks[i].value; },
    useSyncExternalStore: (_subscribe, get) => { cursor++; return get(); },
    useEffect: (effect, deps) => { const i = cursor++, prior = hooks[i];
      if (prior && equals(prior.deps, deps)) return;
      prior?.cleanup?.(); hooks[i] = { deps, cleanup: effect() }; },
  };
  const auth = { activeSessionEpoch: session => session === active ? epoch : null,
    activeSessionToken: session => session === active ? session.token : null };
  const { sessionReadScope } = compile('sessionReadScope');
  const { BoyoqchiRequestsController } = compile('boyoqchi/boyoqchiController', { './boyoqchiLogic': { boyoqchiRequestKey: item => item.id } });
  const { useBoyoqchiRequests } = compile('boyoqchi/useBoyoqchiRequests', {
    react, '../auth': auth, '../sessionReadScope': { sessionReadScope }, './boyoqchiController': { BoyoqchiRequestsController },
    './returnedPaintApi': { boyoqchiReturnedPaintRequests: session => { const pending = deferred(); requests.push({ session, ...pending }); return pending.promise; } },
    '../apparatusApi': { adminApparatus: session => { const pending = deferred(); catalogs.push({ session, ...pending }); return pending.promise; } },
  });
  const session = () => ({ token: 'token', baseUrl: 'https://one.invalid', profile: { role: 'boyoqchi', ref: 'ref' },
    capabilities: ['boyoqchi.access'], assigned_apparatus: [] });
  return { requests, catalogs, session, setActive: value => { active = value; }, advanceEpoch: () => { epoch++; },
    render: (value, home) => { cursor = 0; return useBoyoqchiRequests(value, home); },
    unmount: () => { for (const item of hooks) item?.cleanup?.(); } };
}

test('a retained Home screen loads once and preserves expansion on refocus until explicit refresh', async () => {
  const f = fixture(), a = f.session(); f.setActive(a);
  const first = f.render(a, true), controller = first.controller;
  assert.equal(f.requests.length, 1); assert.equal(f.catalogs.length, 1);
  f.requests[0].resolve({ items: [{ id: 'one' }] }); f.catalogs[0].resolve([{ id: 'press' }]); await tick();
  controller.toggle({ id: 'one' });
  const refocused = f.render(a, true);
  assert.equal(refocused.controller, controller); assert.equal(f.requests.length, 1); assert.equal(f.catalogs.length, 1);
  assert.equal(controller.getSnapshot().expandedKey, 'one');
  const refreshing = controller.refresh(); assert.equal(f.requests.length, 2); assert.equal(controller.getSnapshot().expandedKey, null);
  f.requests[1].resolve({ items: [] }); await refreshing; assert.equal(f.catalogs.length, 1);
  f.unmount();
});

test('Astatka unmount cancels pending responses and never loads the Home catalog', async () => {
  const f = fixture(), a = f.session(); f.setActive(a); const { controller } = f.render(a, false);
  assert.equal(f.requests.length, 1); assert.equal(f.catalogs.length, 0);
  f.unmount(); f.requests[0].resolve({ items: [{ id: 'late' }] }); await tick();
  assert.deepEqual(controller.getSnapshot().items, []);
});

test('account replacement cancels the old screen and cannot publish its late responses', async () => {
  const f = fixture(), a = f.session(), b = f.session(); b.profile.ref = 'other'; f.setActive(a);
  const old = f.render(a, true).controller; f.setActive(b);
  const next = f.render(b, true).controller; assert.notEqual(old, next); assert.equal(f.requests.length, 2);
  f.requests[0].resolve({ items: [{ id: 'old' }] }); f.catalogs[0].resolve([{ id: 'old' }]);
  f.requests[1].resolve({ items: [{ id: 'new' }] }); f.catalogs[1].resolve([{ id: 'new' }]); await tick();
  assert.deepEqual(old.getSnapshot().items, []); assert.deepEqual(old.getSnapshot().apparatus, []);
  assert.equal(next.getSnapshot().items[0].id, 'new'); assert.equal(next.getSnapshot().apparatus[0].id, 'new');
  f.unmount();
});

test('epoch rollback and same-object capability changes reject pending results before a rerender', async () => {
  const f = fixture(), a = f.session(), b = f.session(); f.setActive(a); const first = f.render(a, false).controller;
  f.advanceEpoch(); f.setActive(b); f.setActive(a); f.requests[0].resolve({ items: [{ id: 'stale-epoch' }] }); await tick();
  assert.deepEqual(first.getSnapshot().items, []);
  const second = f.render(a, false).controller; assert.notEqual(first, second);
  a.capabilities.push('other.access'); f.requests[1].resolve({ items: [{ id: 'stale-scope' }] }); await tick();
  assert.deepEqual(second.getSnapshot().items, []);
  const third = f.render(a, false).controller; assert.notEqual(second, third);
  f.requests[2].resolve({ items: [{ id: 'current' }] }); await tick(); assert.equal(third.getSnapshot().items[0].id, 'current');
  f.unmount();
});

test('same-session 401 refresh publishes the retried response using the new token', async () => {
  const a = { token: 'old-token', baseUrl: 'https://one.invalid', profile: { role: 'boyoqchi', ref: 'ref' },
    capabilities: ['boyoqchi.access'], assigned_apparatus: [] }, calls = [], hooks = []; let cursor = 0;
  const auth = { activeSessionEpoch: session => session === a ? 7 : null,
    activeSessionToken: session => session === a ? session.token : null,
    refreshSession: async (session, failed) => { assert.equal(failed, 'old-token'); session.token = 'new-token'; return true; } };
  const { sessionReadScope } = compile('sessionReadScope');
  const { BoyoqchiRequestsController } = compile('boyoqchi/boyoqchiController', { './boyoqchiLogic': { boyoqchiRequestKey: item => item.id } });
  const transport = compile('authorizedFetch', { './auth': auth });
  const controls = { isCanonicalApparatusId: value => value === 'apparatus:default:bosma_7' };
  const model = compile('boyoqchi/returnedPaintModel', { '../workerControlsApi': controls });
  const api = compile('boyoqchi/returnedPaintApi', { '../authorizedFetch': transport, '../workerControlsApi': controls, './returnedPaintModel': model });
  const equal = (x, y) => x?.length === y?.length && x.every((value, i) => Object.is(value, y[i]));
  const react = { useMemo: (make, deps) => { const i = cursor++; if (!hooks[i] || !equal(hooks[i].deps, deps)) hooks[i] = { deps, value: make() }; return hooks[i].value; },
    useSyncExternalStore: (_sub, get) => { cursor++; return get(); }, useEffect: (effect, deps) => { const i = cursor++;
      if (!hooks[i] || !equal(hooks[i].deps, deps)) { hooks[i]?.cleanup?.(); hooks[i] = { deps, cleanup: effect() }; } } };
  const { useBoyoqchiRequests } = compile('boyoqchi/useBoyoqchiRequests', { react, '../auth': auth,
    '../sessionReadScope': { sessionReadScope }, './boyoqchiController': { BoyoqchiRequestsController },
    './returnedPaintApi': api, '../apparatusApi': {} });
  const originalFetch = global.fetch;
  global.fetch = async (_url, init) => {
    calls.push(init.headers.get('authorization'));
    return calls.length === 1 ? new Response('{}', { status: 401 }) : new Response(JSON.stringify({ items: [{ id: 'ok',
      apparatus: 'apparatus:default:bosma_7', sender_role: 'aparatchi', created_at_unix: 100, items: [] }], has_more: false }), { status: 200 });
  };
  try {
    cursor = 0; const first = useBoyoqchiRequests(a, false); await tick(); await tick();
    assert.deepEqual(calls, ['Bearer old-token', 'Bearer new-token']);
    assert.equal(first.controller.getSnapshot().phase, 'ready'); assert.equal(first.controller.getSnapshot().items[0].id, 'ok');
    cursor = 0; const rerender = useBoyoqchiRequests(a, false); assert.equal(rerender.controller, first.controller);
    for (const item of hooks) item?.cleanup?.();
  } finally { global.fetch = originalFetch; }
});
