const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const root = path.resolve(__dirname, '../src');
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const tick = () => new Promise(resolve => setImmediate(resolve));
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const json = value => new Response(JSON.stringify(value), { status: 200 });
const session = ref => ({ token: 'local-token', baseUrl: 'https://example.test', imageCacheScope: ref, profile: { role: 'qolipchi', ref },
  capabilities: ['qolip.manage'], assigned_apparatus: [], assigned_apparatus_labels: [] });
function harness() {
  let authentication; let accountInitializer = async () => { throw new Error('disabled in probe'); }; const authCalls = []; const authFile = path.join(root, 'auth.ts'), authModule = new Module(authFile, module);
  authModule.require = id => {
    if (id === 'expo-secure-store') return {};
    if (id === 'react-native') return { Platform: { OS: 'web' } };
    if (id === './chunkedStorage') return { chunkedStorage: () => ({}) };
    if (id === './serverEndpointRuntime') return { initializeServerEndpoints: async () => ({ baseUrl: 'https://example.test', setBaseUrl: async () => {} }) };
    if (id === './authenticateAccount') return { authenticateAccount: (...args) => { authCalls.push(args); return authentication.promise; } };
    if (id === './shared/searchActivityStore') return { sessionAccessRole: s => s.profile.role };
    if (id === './savedAccountRuntime') return { initializeSavedAccounts: (...args) => accountInitializer(...args) };
    throw new Error(`Unexpected auth dependency ${id}`);
  };
  authModule._compile(ts.transpileModule(fs.readFileSync(authFile, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ESNext } }).outputText, authFile);
  const auth = authModule.exports, cache = new Map();
  function load(name) {
    name = name.replaceAll('\\', '/'); if (name === 'auth.ts') return auth;
    if (name === 'appPreferences.ts') return { appPreferences: { getItem: async () => null } };
    if (cache.has(name)) return cache.get(name).exports;
    const filename = path.join(root, name), loaded = new Module(filename, module); cache.set(name, loaded);
    loaded.require = target => target.startsWith('.') ? load(`${path.relative(root, path.resolve(path.dirname(filename), target))}.ts`) : require(target);
    loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ESNext } }).outputText, filename);
    return loaded.exports;
  }
  return { auth, load, authCalls, setAccountInitializer: callback => { accountInitializer = callback; }, startLogin: () => { authentication = deferred(); const promise = auth.login('https://example.test', 'local', 'local');
    return { promise, resolve: authentication.resolve, reject: authentication.reject }; } };
}

test('real shared witness binds the initial read-only Home owner and closes on failed-login ABA', async t => {
  const h = harness(), previous = global.fetch, calls = []; t.after(() => { global.fetch = previous; });
  const a = session('A'); await h.auth.saveSession(a);
  global.fetch = async (url, init) => {
    calls.push({ url, method: init.method ?? 'GET' });
    if (url.endsWith('/v1/mobile/qolip/blocks')) return json({ warehouses: ['W'], blocks: [{ name: 'A', warehouse: 'W' }] });
    if (url.endsWith('/v1/mobile/qolip/locations?block=A')) return json({ locations: [{ id: 'l1', block: 'A', warehouse: 'W',
      item_name: 'Mold', qolip_code: 'Q-1', size: 42, quantity: 1, location_label: 'A1' }] });
    throw new Error(`Unexpected request ${url}`);
  };
  const shell = new (h.load('qolip/qolipSettledHomeSession.ts').QolipSettledHomeSessionOwner)(), closeShell = shell.activate(); await tick();
  const entry = shell.getSnapshot(); assert.equal(entry.kind, 'ready');
  const owner = h.load('qolip/qolipHomeOwnerRuntime.ts').createQolipHomeOwner(a, entry.boundary), actions = owner.activate();
  assert.deepEqual(Object.keys(actions).sort(), ['current', 'select', 'setSearch']);
  await tick(); await tick(); let view = owner.getSnapshot(); assert.equal(view.home.kind, 'blocks'); assert.equal(view.blocks.length, 1);
  assert.equal((await view.blocks[0].future)[0].qolip_code, 'Q-1'); actions.setSearch('Mold'); await delay(200); await tick();
  view = owner.getSnapshot(); assert.equal(view.home.tabs[0].matchCount, 1);
  const login = h.startLogin(); assert.equal(owner.getSnapshot().home.kind, 'invalid');
  await tick(); login.reject(new Error('mock login failed')); await assert.rejects(login.promise, /mock login failed/); await tick();
  actions.setSearch('stale'); actions.select(0); assert.equal(owner.getSnapshot().home.kind, 'invalid');
  assert.deepEqual(calls.map(call => call.method), ['GET', 'GET']); owner.suspend(actions); closeShell();
});

test('real shared witness blocks an initial GET after transition', async t => {
  const h = harness(), previous = global.fetch; t.after(() => { global.fetch = previous; }); const a = session('A'); await h.auth.saveSession(a);
  const shell = new (h.load('qolip/qolipSettledHomeSession.ts').QolipSettledHomeSessionOwner)(), close = shell.activate(); await tick();
  const entry = shell.getSnapshot(); let sends = 0; global.fetch = async () => { sends++; return new Response('{}', { status: 401 }); };
  const read = h.load('qolip/qolipBlocksApi.ts').qolipBlocksData(a, entry.boundary.current), login = h.startLogin();
  await assert.rejects(read, /qolip_read_expired/); assert.equal(sends, 0); await tick(); login.reject(new Error('mock login failed'));
  await assert.rejects(login.promise, /mock login failed/); close();
});

test('opt-in witness stops a same-origin redirect after invalidation', async t => {
  const h = harness(), previous = global.fetch; t.after(() => { global.fetch = previous; }); const a = session('A'); await h.auth.saveSession(a);
  const shell = new (h.load('qolip/qolipSettledHomeSession.ts').QolipSettledHomeSessionOwner)(), close = shell.activate(); await tick();
  const entry = shell.getSnapshot(), delayed = deferred(), calls = [];
  global.fetch = async (url, init) => { calls.push({ url, authorization: init.headers.get('authorization') });
    return calls.length === 1 ? delayed.promise : json({ warehouses: [], blocks: [] }); };
  const read = h.load('qolip/qolipBlocksApi.ts').qolipBlocksData(a, entry.boundary.current); await tick(); assert.equal(calls.length, 1);
  const login = h.startLogin(); assert.equal(entry.boundary.current(), false);
  delayed.resolve(new Response('', { status: 302, headers: { location: '/v1/mobile/qolip/blocks?redirected=1' } }));
  await assert.rejects(read, /qolip_read_expired/); assert.equal(calls.length, 1, 'no redirected send after invalidation');
  await tick(); login.reject(new Error('mock login failed')); await assert.rejects(login.promise, /mock login failed/); close();
});

test('a delayed block-body read never publishes after the captured witness changes or rolls back', async t => {
  const h = harness(), previous = global.fetch; t.after(() => { global.fetch = previous; });
  const a = session('A'); await h.auth.saveSession(a);
  const shell = new (h.load('qolip/qolipSettledHomeSession.ts').QolipSettledHomeSessionOwner)(), close = shell.activate(); await tick();
  const entry = shell.getSnapshot(), delayed = deferred(), calls = [];
  global.fetch = async (url, init) => {
    calls.push({ url, method: init.method ?? 'GET' });
    if (url.endsWith('/v1/mobile/qolip/blocks')) return json({ warehouses: ['W'], blocks: [{ name: 'A', warehouse: 'W' }] });
    if (url.endsWith('/v1/mobile/qolip/locations?block=A')) return delayed.promise;
    throw new Error(`Unexpected request ${url}`);
  };
  const owner = h.load('qolip/qolipHomeOwnerRuntime.ts').createQolipHomeOwner(a, entry.boundary), actions = owner.activate();
  await tick(); await tick(); const view = owner.getSnapshot(); assert.equal(view.home.kind, 'blocks'); assert.equal(view.blocks.length, 1);
  const body = new (h.load('qolip/qolipHomeBlockReadState.ts').QolipHomeBlockReadState)(view.blocks[0].initialLocations, view.boundary);
  body.activate(); body.bind(view.blocks[0].future); assert.equal(body.getSnapshot().loading, true);
  const login = h.startLogin(); assert.equal(owner.getSnapshot().home.kind, 'invalid'); assert.equal(body.getSnapshot().invalid, true);
  delayed.resolve(json({ locations: [{ id: 'later', block: 'A', warehouse: 'W', item_name: 'Late mold', qolip_code: 'LATE', size: 42,
    quantity: 1, location_label: 'A1' }] }));
  await assert.rejects(view.blocks[0].future, /qolip_read_expired/); await tick();
  assert.deepEqual(body.getSnapshot(), { locations: null, loading: false, error: false, invalid: true });
  await tick(); login.reject(new Error('mock login failed')); await assert.rejects(login.promise, /mock login failed/); await tick();
  assert.equal(owner.getSnapshot().home.kind, 'invalid'); assert.equal(body.getSnapshot().invalid, true);
  assert.deepEqual(calls.map(call => call.method), ['GET', 'GET']); body.suspend(); owner.suspend(actions); close();
});

test('effect replay creates a fresh controller but never replaces the captured shared witness', async t => {
  const h = harness(), previous = global.fetch; t.after(() => { global.fetch = previous; });
  const a = session('A'); await h.auth.saveSession(a);
  const shell = new (h.load('qolip/qolipSettledHomeSession.ts').QolipSettledHomeSessionOwner)(), close = shell.activate(); await tick();
  const entry = shell.getSnapshot(); let requests = 0;
  global.fetch = async url => { requests++; return url.endsWith('/v1/mobile/qolip/blocks')
    ? json({ warehouses: ['W'], blocks: [{ name: 'A', warehouse: 'W' }] }) : json({ locations: [] }); };
  const owner = h.load('qolip/qolipHomeOwnerRuntime.ts').createQolipHomeOwner(a, entry.boundary), first = owner.activate();
  await tick(); await tick(); assert.equal(owner.getSnapshot().home.kind, 'blocks'); owner.suspend(first);
  const second = owner.activate(); await tick(); await tick(); assert.notEqual(second, first); assert.equal(first.current(), false);
  assert.equal(second.current(), true); assert.equal(owner.getSnapshot().home.kind, 'blocks'); assert.equal(requests, 4);
  const login = h.startLogin(); assert.equal(second.current(), false); assert.equal(owner.getSnapshot().home.kind, 'invalid');
  await tick(); login.reject(new Error('mock login failed')); await assert.rejects(login.promise, /mock login failed/); await tick();
  assert.equal(owner.activate(), null); assert.equal(owner.getSnapshot().home.kind, 'invalid'); owner.suspend(second); close();
});

test('a 401 arriving after witness invalidation cannot start credential refresh', async t => {
  const h = harness(), previous = global.fetch; t.after(() => { global.fetch = previous; });
  const initial = h.startLogin(); await tick();
  initial.resolve({ token: 'local-token', profile: { role: 'qolipchi', ref: 'A', capabilities: ['qolip.manage'],
    assigned_apparatus: [], assigned_apparatus_labels: [] }, werka_home: null });
  const a = await initial.promise;
  const shell = new (h.load('qolip/qolipSettledHomeSession.ts').QolipSettledHomeSessionOwner)(), close = shell.activate(); await tick();
  const entry = shell.getSnapshot(), delayed = deferred(); assert.equal(entry.kind, 'ready');
  global.fetch = async () => delayed.promise;
  const read = h.load('qolip/qolipBlocksApi.ts').qolipBlocksData(a, entry.boundary.current);
  const observedRead = assert.rejects(read, /qolip_read_expired/); await tick();
  const changing = h.startLogin(); await tick(); assert.equal(entry.boundary.current(), false); assert.equal(h.authCalls.length, 2);
  delayed.resolve(new Response('{}', { status: 401 }));
  await observedRead; await tick(); assert.equal(h.authCalls.length, 2, 'the old read did not enter credential refresh');
  changing.reject(new Error('mock login failed')); await assert.rejects(changing.promise, /mock login failed/); close();
});

test('an unaided 401 reaches the source error branch without credentials or account lookup', async t => {
  const h = harness(), previous = global.fetch; t.after(() => { global.fetch = previous; });
  const initial = h.startLogin(); await tick();
  initial.resolve({ token: 'local-token', profile: { role: 'qolipchi', ref: 'A', capabilities: ['qolip.manage'],
    assigned_apparatus: [], assigned_apparatus_labels: [] }, werka_home: null });
  const a = await initial.promise;
  const shell = new (h.load('qolip/qolipSettledHomeSession.ts').QolipSettledHomeSessionOwner)(), close = shell.activate(); await tick();
  const entry = shell.getSnapshot(); let lookups = 0, sends = 0;
  h.setAccountInitializer(async () => { lookups++; throw new Error('unexpected account lookup'); });
  global.fetch = async () => { sends++; return new Response('{}', { status: 401 }); };
  const owner = h.load('qolip/qolipHomeOwnerRuntime.ts').createQolipHomeOwner(a, entry.boundary), actions = owner.activate();
  for (let i = 0; i < 10 && owner.getSnapshot().home.kind === 'loading'; i++) await tick();
  assert.equal(owner.getSnapshot().home.kind, 'refresh-unavailable'); assert.equal(owner.getSnapshot().blocks.length, 0);
  assert.equal(lookups, 0); assert.equal(h.authCalls.length, 1); assert.equal(h.auth.activeSessionToken(a), 'local-token'); assert.equal(sends, 1);
  owner.suspend(actions); close();
});

test('a new login and new owner recover a block whose old location future failed with 401', async t => {
  const h = harness(), previous = global.fetch; t.after(() => { global.fetch = previous; }); const a = session('A'); await h.auth.saveSession(a);
  let locations = 0; global.fetch = async url => {
    if (url.endsWith('/v1/mobile/qolip/blocks')) return json({ warehouses: ['W'], blocks: [{ name: 'A', warehouse: 'W' }] });
    if (url.endsWith('/v1/mobile/qolip/locations?block=A')) return ++locations === 1 ? new Response('{}', { status: 401 })
      : json({ locations: [{ id: 'new', block: 'A', warehouse: 'W', item_name: 'Mold', qolip_code: 'NEW', size: 42, quantity: 1, location_label: 'A1' }] });
    throw new Error(`Unexpected request ${url}`);
  };
  let shell = new (h.load('qolip/qolipSettledHomeSession.ts').QolipSettledHomeSessionOwner)(), close = shell.activate(); await tick();
  let entry = shell.getSnapshot(), owner = h.load('qolip/qolipHomeOwnerRuntime.ts').createQolipHomeOwner(a, entry.boundary), actions = owner.activate();
  await tick(); await tick(); const oldView = owner.getSnapshot(); assert.equal(oldView.home.kind, 'blocks');
  const body = new (h.load('qolip/qolipHomeBlockReadState.ts').QolipHomeBlockReadState)(oldView.blocks[0].initialLocations, oldView.boundary);
  body.activate(); body.bind(oldView.blocks[0].future); await assert.rejects(oldView.blocks[0].future,
    error => error.code === 'guarded_read_refresh_unavailable'); await tick();
  assert.equal(body.getSnapshot().refreshUnavailable, true); assert.equal(body.getSnapshot().locations, null);
  const login = h.startLogin(); await tick(); assert.equal(owner.getSnapshot().home.kind, 'invalid');
  login.resolve({ token: 'new-token', profile: { role: 'qolipchi', ref: 'A', capabilities: ['qolip.manage'],
    assigned_apparatus: [], assigned_apparatus_labels: [] }, werka_home: null });
  const next = await login.promise; body.suspend(); owner.suspend(actions); close();
  shell = new (h.load('qolip/qolipSettledHomeSession.ts').QolipSettledHomeSessionOwner)(); close = shell.activate(); await tick();
  entry = shell.getSnapshot(); owner = h.load('qolip/qolipHomeOwnerRuntime.ts').createQolipHomeOwner(next, entry.boundary); actions = owner.activate();
  await tick(); await tick(); const fresh = owner.getSnapshot(); assert.equal(fresh.home.kind, 'blocks');
  assert.equal((await fresh.blocks[0].future)[0].qolip_code, 'NEW'); assert.equal(locations, 2); owner.suspend(actions); close();
});
