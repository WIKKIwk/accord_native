const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const test = require('node:test');
const ts = require('typescript');
const root = path.resolve(__dirname, '../src');
const source = execFileSync('git', ['show', '21aa4a1:src/auth.ts'], { encoding: 'utf8' });
let authentication;
const authFile = path.join(root, 'auth-main-probe.ts');
const authModule = new Module(authFile, module);
authModule.require = id => {
  if (id === 'expo-secure-store') return {};
  if (id === 'react-native') return { Platform: { OS: 'web' } };
  if (id === './chunkedStorage') return { chunkedStorage: () => ({}) };
  if (id === './serverEndpointRuntime') return { initializeServerEndpoints: async () => ({ baseUrl: 'https://example.test', setBaseUrl: async () => {} }) };
  if (id === './authenticateAccount') return { authenticateAccount: () => authentication.promise };
  if (id === './shared/searchActivityStore') return { sessionAccessRole: s => s.profile.role };
  if (id === './savedAccountRuntime') return { initializeSavedAccounts: async () => { throw new Error('disabled in probe'); } };
  throw new Error(`Unexpected real-auth dependency ${id}`);
};
authModule._compile(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ESNext } }).outputText, authFile);
const auth = authModule.exports, cache = new Map();
function load(name) {
  name = name.replaceAll('\\', '/');
  if (name === 'auth.ts') return auth;
  if (name === 'shared/qolipCatalogRuntime.ts') return { qolipCatalogRuntimeFor: () => ({ invalidateDetails() {} }) };
  if (cache.has(name)) return cache.get(name).exports;
  const filename = path.join(root, name), loaded = new Module(filename, module); cache.set(name, loaded);
  loaded.require = id => id.startsWith('.') ? load(`${path.relative(root, path.resolve(path.dirname(filename), id))}.ts`) : id === 'expo/fetch' ? require('../tests/support/expoFetch.cjs') : require(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ESNext } }).outputText, filename);
  return loaded.exports;
}
const { QolipSettledHomeSessionOwner } = load('qolip/qolipSettledHomeSession.ts');
const tick = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const session = ref => ({ token: 'local-token', baseUrl: 'https://example.test', imageCacheScope: ref, profile: { role: 'qolipchi', ref }, capabilities: ['qolip.manage'], assigned_apparatus: [], assigned_apparatus_labels: [] });

test('historical auth auth binds, waits for login, and never revives invalid shell after rollback, ABA or clear', async () => {
  const a = session('A'), b = session('B'); await auth.saveSession(a);
  const first = new QolipSettledHomeSessionOwner(), closeFirst = first.activate(); await tick();
  const original = first.getSnapshot(); assert.equal(original.kind, 'ready'); assert.equal(original.session, a);
  a.token = 'rotated-local-token'; assert.equal(original.boundary.current(), true);
  authentication = deferred(); const login = auth.login('https://example.test', 'local', 'local');
  assert.equal(first.getSnapshot().kind, 'invalid'); assert.equal(original.boundary.current(), false);
  await tick(); authentication.reject(new Error('mock login failed')); await assert.rejects(login, /mock login failed/); await tick();
  assert.equal(first.getSnapshot().kind, 'invalid'); assert.equal(auth.currentSession(), a); closeFirst();

  authentication = deferred(); const login2 = auth.login('https://example.test', 'local', 'local');
  const waiting = new QolipSettledHomeSessionOwner(), closeWaiting = waiting.activate(); await tick();
  assert.equal(waiting.getSnapshot().kind, 'loading'); authentication.reject(new Error('mock login failed again'));
  await assert.rejects(login2, /mock login failed again/); await tick();
  const ready = waiting.getSnapshot(); assert.equal(ready.kind, 'ready'); assert.equal(ready.session, a);
  await auth.saveSession(b); await auth.saveSession(a); assert.equal(waiting.getSnapshot().kind, 'invalid');
  assert.equal(ready.boundary.current(), false); closeWaiting();

  const last = new QolipSettledHomeSessionOwner(), closeLast = last.activate(); await tick(); assert.equal(last.getSnapshot().kind, 'ready');
  const clearing = auth.clearSession(); assert.equal(last.getSnapshot().kind, 'invalid'); await clearing; closeLast();
});

test('historical auth witness reaches the existing guarded Home reader and stops initial/401-retry reads after transition', async t => {
  const previousFetch = global.fetch, previousRefresh = auth.refreshSession;
  t.after(() => { global.fetch = previousFetch; auth.refreshSession = previousRefresh; });
  const a = session('A'); await auth.saveSession(a);
  const shell = new QolipSettledHomeSessionOwner(), close = shell.activate(); await tick();
  const entry = shell.getSnapshot(); assert.equal(entry.kind, 'ready');
  const read = load('qolip/qolipBlocksApi.ts').qolipBlocksData; let sends = 0;
  const refresh = deferred(); auth.refreshSession = () => refresh.promise;
  global.fetch = async () => { sends++; return { status: 401, headers: new Headers(), json: async () => ({}) }; };
  const request = read(a, entry.boundary.current); await tick(); assert.equal(sends, 1);
  authentication = deferred(); const switching = auth.login('https://example.test', 'local', 'local');
  assert.equal(shell.getSnapshot().kind, 'invalid'); assert.equal(auth.currentSession(), a); refresh.resolve(true);
  await assert.rejects(request, /qolip_read_expired/); assert.equal(sends, 1);
  await tick(); authentication.reject(new Error('mock login failed')); await assert.rejects(switching, /mock login failed/);
  await assert.rejects(read(a, entry.boundary.current)); assert.equal(sends, 1); close();
});

test('historical auth witness invalidates an active guarded checkout reader before delayed data returns', async t => {
  const oldFetch = global.fetch; t.after(() => { global.fetch = oldFetch; });
  const a = session('A'); await auth.saveSession(a);
  const shell = new QolipSettledHomeSessionOwner(), closeShell = shell.activate(); await tick();
  const entry = shell.getSnapshot(); assert.equal(entry.kind, 'ready');
  const delayed = deferred(); let calls = 0;
  global.fetch = async url => { calls++; assert.equal(url, 'https://example.test/v1/mobile/qolip/checkouts?status=open&limit=200'); return delayed.promise; };
  const owner = load('qolip/qolipCheckoutReadRuntime.ts').createQolipCheckoutRead(a, entry.boundary), closeOwner = owner.activate();
  await tick(); assert.equal(calls, 1); authentication = deferred();
  const pendingLogin = auth.login('https://example.test', 'local', 'local'); assert.equal(owner.getSnapshot().invalid, true);
  delayed.resolve({ status: 200, headers: new Headers(), json: async () => ({ checkouts: [{ id: 'private' }] }) });
  await tick(); assert.equal(owner.getSnapshot().invalid, true); authentication.reject(new Error('mock login failed'));
  await assert.rejects(pendingLogin, /mock login failed/); await tick(); assert.equal(owner.getSnapshot().invalid, true);
  closeOwner(); closeShell();
});

test('historical auth witness composes checkout old/new loads without authorizing a stale action', async t => {
  const oldFetch = global.fetch; t.after(() => { global.fetch = oldFetch; });
  const a = session('A'); await auth.saveSession(a); const shell = new QolipSettledHomeSessionOwner(), closeShell = shell.activate(); await tick();
  const entry = shell.getSnapshot(); assert.equal(entry.kind, 'ready');
  const role = load('qolip/qolipCheckoutReadRuntime.ts').qolipCheckoutBoundary(a, entry.boundary);
  const lock = { returningIds: new Set(), bulkReturning: false };
  const selection = new (load('qolip/qolipCheckoutSelectionState.ts').QolipCheckoutSelectionState)([], [], lock, role);
  const pending = [], readApi = load('qolip/qolipCheckoutApi.ts').qolipCheckouts;
  global.fetch = async () => { const next = deferred(); pending.push(next); return next.promise; };
  const read = new (load('qolip/qolipCheckoutReadState.ts').QolipCheckoutReadState)(role,
    guard => readApi(a, { status: 'open', limit: 200 }, guard), rows => selection.recordLoaded(rows));
  const owner = new (load('qolip/qolipCheckoutViewState.ts').QolipCheckoutViewState)(read, selection, lock), stop = owner.activate();
  const response = rows => new Response(JSON.stringify({ checkouts: rows }), { status: 200 });
  await tick(); pending[0].resolve(response([{ id: 'a', item_name: 'first', status: 'open' }])); await tick();
  let state = owner.getSnapshot(); state.actions.longPress(state.read.entries[0]);
  const old = read.reload(), recent = read.reload(); await tick();
  pending[2].resolve(response([{ id: 'a', item_name: 'displayed', status: 'open' }])); await recent;
  pending[1].resolve(response([{ id: 'a', item_name: 'stale', status: 'open' }])); await old;
  state = owner.getSnapshot(); assert.equal(state.read.entries[0].item_name, 'displayed'); assert.equal(state.selection.selectedEntries[0].item_name, 'stale');
  assert.equal('bulkChoice' in state.actions, false); assert.equal('return' in state.actions, false);
  const next = read.reload(); await tick(); authentication = deferred(); const login = auth.login('https://example.test', 'local', 'local');
  assert.equal(owner.getSnapshot().invalid, true); pending[3].resolve(response([{ id: 'private', status: 'open' }])); await next;
  await tick(); authentication.reject(new Error('mock login failed')); await assert.rejects(login, /mock login failed/);
  assert.equal(owner.getSnapshot().invalid, true); stop(); closeShell();
});

test('historical auth original witness stops role-local catalog initial and 401-retry sends across failed login', async t => {
  const previousFetch = global.fetch, previousRefresh = auth.refreshSession;
  t.after(() => { global.fetch = previousFetch; auth.refreshSession = previousRefresh; });
  const a = session('A'); await auth.saveSession(a); let sends = 0;
  global.fetch = async () => { sends++; return new Response('{}', { status: 401 }); };
  let shell = new QolipSettledHomeSessionOwner(), close = shell.activate(); await tick();
  let entry = shell.getSnapshot(); assert.equal(entry.kind, 'ready');
  let readers = load('qolip/qolipCatalogReadApi.ts').createQolipCatalogReaders(a, entry.boundary);
  const beforeInitial = readers.page({}, () => true); authentication = deferred();
  let login = auth.login('https://example.test', 'local', 'local');
  await assert.rejects(beforeInitial, /qolip_read_expired/); assert.equal(sends, 0);
  await tick(); authentication.reject(new Error('mock login failed')); await assert.rejects(login, /mock login failed/); close();
  await assert.rejects(readers.details('id', () => true));

  shell = new QolipSettledHomeSessionOwner(); close = shell.activate(); await tick(); entry = shell.getSnapshot(); assert.equal(entry.kind, 'ready');
  readers = load('qolip/qolipCatalogReadApi.ts').createQolipCatalogReaders(a, entry.boundary);
  const refresh = deferred(); auth.refreshSession = () => refresh.promise;
  const beforeRetry = readers.details('id', () => true); await tick(); assert.equal(sends, 1);
  authentication = deferred(); login = auth.login('https://example.test', 'local', 'local'); refresh.resolve(true);
  await assert.rejects(beforeRetry, /qolip_read_expired/); assert.equal(sends, 1);
  await tick(); authentication.reject(new Error('mock login failed')); await assert.rejects(login, /mock login failed/);
  await assert.rejects(readers.page({}, () => true)); assert.equal(sends, 1); close();
});

test('historical auth witness stops the catalog open-reworks 401 retry across failed login', async t => {
  const previousFetch = global.fetch, previousRefresh = auth.refreshSession;
  t.after(() => { global.fetch = previousFetch; auth.refreshSession = previousRefresh; });
  const a = session('A'); await auth.saveSession(a);
  const shell = new QolipSettledHomeSessionOwner(), close = shell.activate(); await tick();
  const entry = shell.getSnapshot(); assert.equal(entry.kind, 'ready');
  const readers = load('qolip/qolipCatalogReadApi.ts').createQolipCatalogReaders(a, entry.boundary), refresh = deferred();
  auth.refreshSession = () => refresh.promise; let sends = 0;
  global.fetch = async url => { sends++; assert.equal(url, 'https://example.test/v1/mobile/qolip/reworks?status=open'); return new Response('{}', { status: 401 }); };
  const request = readers.reworks(() => true); await tick(); assert.equal(sends, 1);
  authentication = deferred(); const login = auth.login('https://example.test', 'local', 'local'); refresh.resolve(true);
  await assert.rejects(request, /qolip_read_expired/); assert.equal(sends, 1);
  await tick(); authentication.reject(new Error('mock login failed')); await assert.rejects(login, /mock login failed/);
  await assert.rejects(readers.reworks(() => true)); assert.equal(sends, 1); close();
});
