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
    loaded.require = target => target.startsWith('.') ? load(`${path.relative(root, path.resolve(path.dirname(filename), target))}.ts`)
      : target === 'expo/fetch' ? require('./support/expoFetch.cjs') : require(target);
    loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ESNext } }).outputText, filename);
    return loaded.exports;
  }
  return { auth, load, authCalls, setAuthentication: pending => { authentication = pending; },
    setAccountInitializer: callback => { accountInitializer = callback; }, startLogin: () => { authentication = deferred(); const promise = auth.login('https://example.test', 'local', 'local');
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
  assert.deepEqual(Object.keys(actions).sort(), ['current', 'retryBlock', 'retryBlocks', 'select', 'setSearch']);
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

test('explicit blocks retry replaces an unaided 401 without duplicate GETs or authentication', async t => {
  const h = harness(), previous = global.fetch; t.after(() => { global.fetch = previous; }); const a = session('A'); await h.auth.saveSession(a);
  const shell = new (h.load('qolip/qolipSettledHomeSession.ts').QolipSettledHomeSessionOwner)(), close = shell.activate(); await tick();
  const entry = shell.getSnapshot(), waiting = deferred(), calls = [];
  global.fetch = async (url, init) => { calls.push({ url, method: init.method });
    if (url.endsWith('/v1/mobile/qolip/blocks')) return calls.length === 1 ? new Response('{}', { status: 401 }) : waiting.promise;
    if (url.endsWith('/v1/mobile/qolip/locations?block=A')) return json({ locations: [] }); throw new Error(`Unexpected ${url}`); };
  const owner = h.load('qolip/qolipHomeOwnerRuntime.ts').createQolipHomeOwner(a, entry.boundary), actions = owner.activate();
  for (let i = 0; i < 20 && owner.getSnapshot().home.kind === 'loading'; i++) await tick();
  assert.equal(owner.getSnapshot().home.kind, 'refresh-unavailable'); assert.equal(calls.length, 1);
  actions.retryBlocks(); actions.retryBlocks(); await tick(); assert.equal(owner.getSnapshot().home.kind, 'loading'); assert.equal(calls.length, 2);
  waiting.resolve(json({ warehouses: ['W'], blocks: [{ name: 'A', warehouse: 'W' }] }));
  for (let i = 0; i < 20 && owner.getSnapshot().home.kind !== 'blocks'; i++) await tick();
  assert.equal(owner.getSnapshot().home.kind, 'blocks'); await tick(); actions.retryBlocks(); assert.equal(calls.length, 3);
  assert.deepEqual(calls.map(call => call.method), ['GET', 'GET', 'GET']); assert.equal(h.authCalls.length, 0);
  owner.suspend(actions); close();
});

test('explicit block retry replaces the rejected future once and renders its fresh result', async t => {
  const h = harness(), previous = global.fetch; t.after(() => { global.fetch = previous; }); const a = session('A'); await h.auth.saveSession(a);
  const shell = new (h.load('qolip/qolipSettledHomeSession.ts').QolipSettledHomeSessionOwner)(), close = shell.activate(); await tick();
  const entry = shell.getSnapshot(), waiting = deferred(), calls = []; let locationReads = 0;
  global.fetch = async (url, init) => { calls.push({ url, method: init.method });
    if (url.endsWith('/v1/mobile/qolip/blocks')) return json({ warehouses: ['W'], blocks: [{ name: 'A', warehouse: 'W' }] });
    if (url.endsWith('/v1/mobile/qolip/locations?block=A')) return ++locationReads === 1 ? new Response('{}', { status: 401 }) : waiting.promise;
    throw new Error(`Unexpected ${url}`); };
  const owner = h.load('qolip/qolipHomeOwnerRuntime.ts').createQolipHomeOwner(a, entry.boundary), actions = owner.activate();
  for (let i = 0; i < 20 && owner.getSnapshot().home.kind !== 'blocks'; i++) await tick();
  const old = owner.getSnapshot().blocks[0], body = new (h.load('qolip/qolipHomeBlockReadState.ts').QolipHomeBlockReadState)(old.initialLocations, owner.getSnapshot().boundary);
  body.activate(); body.bind(old.future); await assert.rejects(old.future, error => error.code === 'guarded_read_refresh_unavailable'); await tick();
  assert.equal(body.getSnapshot().refreshUnavailable, true); actions.retryBlock(' A '); actions.retryBlock('A'); await tick();
  const fresh = owner.getSnapshot().blocks[0]; assert.notEqual(fresh.future, old.future); assert.equal(locationReads, 2);
  body.bind(fresh.future); assert.equal(body.getSnapshot().loading, true);
  waiting.resolve(json({ locations: [{ id: 'fresh', block: 'A', warehouse: 'W', item_name: 'Mold', qolip_code: 'FRESH',
    size: 42, quantity: 1, location_label: 'A1' }] }));
  assert.equal((await fresh.future)[0].qolip_code, 'FRESH'); await tick(); assert.equal(body.getSnapshot().locations[0].qolip_code, 'FRESH');
  actions.retryBlock('A'); actions.retryBlock('unknown'); await tick(); assert.equal(locationReads, 2); assert.equal(h.authCalls.length, 0);
  assert.deepEqual(calls.map(call => call.method), ['GET', 'GET', 'GET']); body.suspend(); owner.suspend(actions); close();
});

test('each repeated 401 remains visible and only an explicit later retry starts another read', async t => {
  const h = harness(), previous = global.fetch; t.after(() => { global.fetch = previous; }); const a = session('A'); await h.auth.saveSession(a);
  const shell = new (h.load('qolip/qolipSettledHomeSession.ts').QolipSettledHomeSessionOwner)(), close = shell.activate(); await tick();
  const entry = shell.getSnapshot(); let blocks = 0, locations = 0;
  global.fetch = async url => { if (url.endsWith('/v1/mobile/qolip/blocks')) { blocks++; return json({ warehouses: ['W'], blocks: [{ name: 'A', warehouse: 'W' }] }); }
    if (url.endsWith('/v1/mobile/qolip/locations?block=A')) return ++locations <= 2 ? new Response('{}', { status: 401 }) : json({ locations: [] });
    throw new Error(`Unexpected ${url}`); };
  const owner = h.load('qolip/qolipHomeOwnerRuntime.ts').createQolipHomeOwner(a, entry.boundary), actions = owner.activate();
  for (let i = 0; i < 20 && owner.getSnapshot().home.kind !== 'blocks'; i++) await tick();
  const first = owner.getSnapshot().blocks[0].future; await assert.rejects(first, error => error.code === 'guarded_read_refresh_unavailable');
  await tick(); assert.equal(locations, 1); actions.retryBlock('A'); await tick();
  const second = owner.getSnapshot().blocks[0].future; assert.notEqual(second, first); await assert.rejects(second, error => error.code === 'guarded_read_refresh_unavailable');
  await tick(); await delay(30); assert.equal(locations, 2, 'no automatic retry'); actions.retryBlock('A');
  const third = owner.getSnapshot().blocks[0].future; assert.notEqual(third, second); assert.deepEqual(await third, []);
  assert.equal(locations, 3); assert.equal(blocks, 1); assert.equal(h.authCalls.length, 0); owner.suspend(actions); close();
});

test('a retry scheduled just before login invalidation neither sends nor revives after rollback', async t => {
  const h = harness(), previous = global.fetch; t.after(() => { global.fetch = previous; }); const a = session('A'); await h.auth.saveSession(a);
  const shell = new (h.load('qolip/qolipSettledHomeSession.ts').QolipSettledHomeSessionOwner)(), close = shell.activate(); await tick();
  const entry = shell.getSnapshot(); let locations = 0;
  global.fetch = async url => url.endsWith('/v1/mobile/qolip/blocks') ? json({ warehouses: ['W'], blocks: [{ name: 'A', warehouse: 'W' }] })
    : (locations++, new Response('{}', { status: 401 }));
  const owner = h.load('qolip/qolipHomeOwnerRuntime.ts').createQolipHomeOwner(a, entry.boundary), actions = owner.activate();
  for (let i = 0; i < 20 && owner.getSnapshot().home.kind !== 'blocks'; i++) await tick();
  await assert.rejects(owner.getSnapshot().blocks[0].future); await tick(); assert.equal(locations, 1);
  actions.retryBlock('A'); const login = h.startLogin(); await tick(); assert.equal(owner.getSnapshot().home.kind, 'invalid'); assert.equal(locations, 1);
  login.reject(new Error('mock login failed')); await assert.rejects(login.promise, /mock login failed/); await tick();
  actions.retryBlock('A'); actions.retryBlocks(); await tick(); assert.equal(locations, 1); assert.equal(owner.getSnapshot().home.kind, 'invalid');
  owner.suspend(actions); close();
});

test('a user retry may observe an independently started legacy refresh but never starts one', async t => {
  const h = harness(), previous = global.fetch; t.after(() => { global.fetch = previous; }); const initial = h.startLogin(); await tick();
  initial.resolve({ token: 'old-token', profile: { role: 'qolipchi', ref: 'A', capabilities: ['qolip.manage'],
    assigned_apparatus: [], assigned_apparatus_labels: [] }, werka_home: null }); const a = await initial.promise;
  const shell = new (h.load('qolip/qolipSettledHomeSession.ts').QolipSettledHomeSessionOwner)(), close = shell.activate(); await tick();
  const entry = shell.getSnapshot(), calls = []; global.fetch = async (url, init) => {
    const token = init.headers.get('authorization'); calls.push({ url, token });
    if (url.endsWith('/v1/mobile/qolip/blocks')) return token === 'Bearer new-token'
      ? json({ warehouses: ['W'], blocks: [{ name: 'A', warehouse: 'W' }] }) : new Response('{}', { status: 401 });
    if (url.endsWith('/v1/mobile/qolip/locations?block=A')) return json({ locations: [] }); throw new Error(`Unexpected ${url}`); };
  const owner = h.load('qolip/qolipHomeOwnerRuntime.ts').createQolipHomeOwner(a, entry.boundary), actions = owner.activate();
  for (let i = 0; i < 20 && owner.getSnapshot().home.kind === 'loading'; i++) await tick();
  assert.equal(owner.getSnapshot().home.kind, 'refresh-unavailable'); assert.equal(h.authCalls.length, 1);
  const authResponse = deferred(); h.setAuthentication(authResponse); const legacy = h.auth.refreshSession(a, 'old-token');
  for (let i = 0; i < 20 && h.authCalls.length < 2; i++) await tick(); assert.equal(h.authCalls.length, 2);
  actions.retryBlocks(); await tick(); assert.equal(owner.getSnapshot().home.kind, 'loading');
  authResponse.resolve({ token: 'new-token', profile: { role: 'qolipchi', ref: 'A', capabilities: ['qolip.manage'],
    assigned_apparatus: [], assigned_apparatus_labels: [] }, werka_home: null }); assert.equal(await legacy, true);
  for (let i = 0; i < 20 && owner.getSnapshot().home.kind !== 'blocks'; i++) await tick();
  assert.equal(owner.getSnapshot().home.kind, 'blocks'); assert.equal(h.authCalls.length, 2);
  assert.deepEqual(calls.filter(call => call.url.endsWith('/v1/mobile/qolip/blocks')).map(call => call.token),
    ['Bearer old-token', 'Bearer old-token', 'Bearer new-token']); owner.suspend(actions); close();
});

test('a successful block retry supersedes an older search awaiting another block', async t => {
  const h = harness(), previous = global.fetch; t.after(() => { global.fetch = previous; }); const a = session('A'); await h.auth.saveSession(a);
  const shell = new (h.load('qolip/qolipSettledHomeSession.ts').QolipSettledHomeSessionOwner)(), close = shell.activate(); await tick();
  const entry = shell.getSnapshot(), b = deferred(), nextA = deferred(); let readsA = 0, readsB = 0;
  const row = (block, label) => ({ id: block, block, warehouse: 'W', item_name: 'Mold', qolip_code: `Q-${block}`, size: 42, quantity: 1, location_label: label });
  global.fetch = async url => {
    if (url.endsWith('/v1/mobile/qolip/blocks')) return json({ warehouses: ['W'], blocks: [{ name: 'A', warehouse: 'W' }, { name: 'B', warehouse: 'W' }] });
    if (url.endsWith('/v1/mobile/qolip/locations?block=A')) return ++readsA === 1 ? new Response('{}', { status: 401 }) : nextA.promise;
    if (url.endsWith('/v1/mobile/qolip/locations?block=B')) { readsB++; return b.promise; } throw new Error(`Unexpected ${url}`);
  };
  const owner = h.load('qolip/qolipHomeOwnerRuntime.ts').createQolipHomeOwner(a, entry.boundary), actions = owner.activate();
  for (let i = 0; i < 20 && owner.getSnapshot().home.kind !== 'blocks'; i++) await tick();
  await assert.rejects(owner.getSnapshot().blocks[0].future); actions.setSearch('Mold'); await delay(200); actions.retryBlock('A'); await tick();
  assert.equal(readsA, 2); nextA.resolve(json({ locations: [row('A', 'A1')] })); await owner.getSnapshot().blocks[0].future; await tick();
  b.resolve(json({ locations: [row('B', 'B1')] }));
  for (let i = 0; i < 30; i++) { await tick(); const view = owner.getSnapshot(); if (view.home.kind === 'blocks' && view.home.tabs.every(tab => tab.matchCount === 1)) break; }
  const home = owner.getSnapshot().home; assert.equal(home.kind, 'blocks'); assert.deepEqual(home.tabs.map(tab => tab.matchCount), [1, 1]);
  assert.equal(readsB, 1); assert.equal(readsA, 2); owner.suspend(actions); close();
});

test('a blocks retry invalidated before dispatch never sends or revives after failed login', async t => {
  const h = harness(), previous = global.fetch; t.after(() => { global.fetch = previous; }); const a = session('A'); await h.auth.saveSession(a);
  const shell = new (h.load('qolip/qolipSettledHomeSession.ts').QolipSettledHomeSessionOwner)(), close = shell.activate(); await tick();
  const entry = shell.getSnapshot(); let sends = 0; global.fetch = async () => { sends++; return new Response('{}', { status: 401 }); };
  const owner = h.load('qolip/qolipHomeOwnerRuntime.ts').createQolipHomeOwner(a, entry.boundary), actions = owner.activate();
  for (let i = 0; i < 20 && owner.getSnapshot().home.kind === 'loading'; i++) await tick();
  assert.equal(owner.getSnapshot().home.kind, 'refresh-unavailable'); assert.equal(sends, 1);
  actions.retryBlocks(); const login = h.startLogin(); await tick(); assert.equal(sends, 1); assert.equal(owner.getSnapshot().home.kind, 'invalid');
  login.reject(new Error('mock login failed')); await assert.rejects(login.promise, /mock login failed/); await tick();
  actions.retryBlocks(); await tick(); assert.equal(sends, 1); owner.suspend(actions); close();
});

test('an in-flight retried block response cannot publish after login starts or rolls back', async t => {
  const h = harness(), previous = global.fetch; t.after(() => { global.fetch = previous; }); const a = session('A'); await h.auth.saveSession(a);
  const shell = new (h.load('qolip/qolipSettledHomeSession.ts').QolipSettledHomeSessionOwner)(), close = shell.activate(); await tick();
  const entry = shell.getSnapshot(), response = deferred(); let locations = 0;
  global.fetch = async url => url.endsWith('/v1/mobile/qolip/blocks') ? json({ warehouses: ['W'], blocks: [{ name: 'A', warehouse: 'W' }] })
    : ++locations === 1 ? new Response('{}', { status: 401 }) : response.promise;
  const owner = h.load('qolip/qolipHomeOwnerRuntime.ts').createQolipHomeOwner(a, entry.boundary), actions = owner.activate();
  for (let i = 0; i < 20 && owner.getSnapshot().home.kind !== 'blocks'; i++) await tick();
  const first = owner.getSnapshot().blocks[0], body = new (h.load('qolip/qolipHomeBlockReadState.ts').QolipHomeBlockReadState)(first.initialLocations, owner.getSnapshot().boundary);
  body.activate(); body.bind(first.future); await assert.rejects(first.future); await tick(); actions.retryBlock('A'); await tick();
  const replacement = owner.getSnapshot().blocks[0].future; body.bind(replacement); const rejected = assert.rejects(replacement, /qolip_read_expired/);
  assert.equal(locations, 2); const login = h.startLogin(); assert.equal(body.getSnapshot().invalid, true);
  response.resolve(json({ locations: [{ id: 'late', block: 'A', warehouse: 'W', item_name: 'Late', qolip_code: 'LATE', size: 1, quantity: 1, location_label: 'A1' }] }));
  await rejected; await tick(); assert.equal(body.getSnapshot().locations, null); login.reject(new Error('mock login failed'));
  await assert.rejects(login.promise, /mock login failed/); await tick(); assert.equal(body.getSnapshot().invalid, true);
  body.suspend(); owner.suspend(actions); close();
});

test('a redirect received during a blocks retry cannot send the next hop after invalidation', async t => {
  const h = harness(), previous = global.fetch; t.after(() => { global.fetch = previous; }); const a = session('A'); await h.auth.saveSession(a);
  const shell = new (h.load('qolip/qolipSettledHomeSession.ts').QolipSettledHomeSessionOwner)(), close = shell.activate(); await tick();
  const entry = shell.getSnapshot(), delayed = deferred(); let sends = 0;
  global.fetch = async () => ++sends === 1 ? new Response('{}', { status: 401 }) : delayed.promise;
  const owner = h.load('qolip/qolipHomeOwnerRuntime.ts').createQolipHomeOwner(a, entry.boundary), actions = owner.activate();
  for (let i = 0; i < 20 && owner.getSnapshot().home.kind === 'loading'; i++) await tick();
  actions.retryBlocks(); await tick(); assert.equal(sends, 2); const login = h.startLogin();
  delayed.resolve(new Response('', { status: 302, headers: { location: '/v1/mobile/qolip/blocks?redirected=1' } }));
  await tick(); await tick(); assert.equal(sends, 2); assert.equal(owner.getSnapshot().home.kind, 'invalid');
  login.reject(new Error('mock login failed')); await assert.rejects(login.promise, /mock login failed/); owner.suspend(actions); close();
});

test('a cold read-only shell cannot initialize saved accounts or load a persisted session', async () => {
  const h = harness(); let loads = 0, accountInitializations = 0; const loadSession = h.auth.loadSession;
  h.auth.loadSession = () => { loads++; return loadSession(); };
  h.setAccountInitializer(async () => { accountInitializations++; throw new Error('unexpected initialization'); });
  const SessionOwner = h.load('qolip/qolipSettledHomeSession.ts').QolipSettledHomeSessionOwner;
  const shell = new SessionOwner(), close = shell.activate(); await tick();
  assert.equal(shell.getSnapshot().kind, 'invalid'); assert.equal(loads, 0); assert.equal(accountInitializations, 0);
  const login = h.startLogin(); await tick(); login.resolve({ token: 'new-token', profile: { role: 'qolipchi', ref: 'A',
    capabilities: ['qolip.manage'], assigned_apparatus: [], assigned_apparatus_labels: [] }, werka_home: null });
  await login.promise; await tick(); assert.equal(shell.getSnapshot().kind, 'invalid', 'a cold shell never revives itself');
  const fresh = new SessionOwner(), closeFresh = fresh.activate(); await tick(); assert.equal(fresh.getSnapshot().kind, 'ready');
  assert.equal(loads, 0); closeFresh(); close();
});
