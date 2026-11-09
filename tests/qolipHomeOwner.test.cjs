const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
function modules(overrides = {}) {
  const root = path.resolve(__dirname, '../src'), cache = new Map();
  function load(name) {
    name = name.replaceAll('\\', '/');
    if (name in overrides) return overrides[name];
    if (cache.has(name)) return cache.get(name).exports;
    const filename = path.join(root, name), loaded = new Module(filename, module); cache.set(name, loaded);
    loaded.require = target => target.startsWith('.') ? load(`${path.relative(root, path.resolve(path.dirname(filename), target))}.ts`) : require(target);
    loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ESNext },
    }).outputText, filename);
    return loaded.exports;
  }
  return load;
}
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const tick = () => new Promise(resolve => setImmediate(resolve));
const session = (patch = {}) => ({ token: 'local-test-token', baseUrl: 'https://example.test', imageCacheScope: 'A',
  profile: { role: 'qolipchi', ref: 'A' }, capabilities: ['qolip.manage'], assigned_apparatus: [], assigned_apparatus_labels: [], ...patch });
const blocks = [{ name: ' Alpha ', warehouse: 'W' }, { name: 'Beta', warehouse: 'W' }];
const rows = (id, block = 'Alpha') => [{ id, block, warehouse: 'W', item_name: 'Needle', item_code: 'I', qolip_code: 'Q',
  size: 1, quantity: 1, row_letter: 'A', column_number: 1, location_label: 'A1' }];
const json = (body, status = 200) => new Response(JSON.stringify(body), { status });
function harness(options = {}) {
  const account = options.session ?? session(), calls = [], prefs = [], subscribers = new Set();
  let valid = true, active = account, blocksResponse = options.blocksResponse, locationsResponse = options.locationsResponse;
  const load = modules({
    'auth.ts': { activeSessionToken: value => value === active ? value.token : null },
    'authorizedFetch.ts': { authorizedFetch: async (value, target, init = {}, beforeSend) => {
      beforeSend?.(); calls.push({ value, target, init });
      if (target === '/v1/mobile/qolip/blocks') return blocksResponse ? blocksResponse() : json({ blocks, warehouses: ['W'], supports_cross_block_move: true });
      return locationsResponse ? locationsResponse(target) : json({ locations: rows(target, new URL(target, account.baseUrl).searchParams.get('block')) });
    } },
    'appPreferences.ts': { appPreferences: {
      getItem: async key => { prefs.push(['read', key]); return options.readOrder ? options.readOrder() : null; },
      setItem: async (key, value) => { prefs.push(['write', key, value]); if (options.saveOrder) await options.saveOrder(); },
    } },
  });
  const witness = Object.freeze({ session: account, scope: load('sessionReadScope.ts').sessionReadScope(account), epoch: 1, generation: 1 });
  const functions = { isSessionWitnessCurrent: value => value === witness && valid,
    subscribeSessionWitness: callback => {
      subscribers.add(callback);
      if (options.onSubscribe) options.onSubscribe(() => { valid = false; callback(); });
      return () => subscribers.delete(callback);
    } };
  const boundary = load('qolip/qolipHomeWitnessBoundary.ts').qolipHomeWitnessBoundary(account, witness, functions);
  const owner = load('qolip/qolipHomeOwnerRuntime.ts').createQolipHomeOwner(account, boundary);
  return { owner, load, account, boundary, witness, functions, calls, prefs, subscribers,
    setBlocksResponse: value => { blocksResponse = value; }, setLocationsResponse: value => { locationsResponse = value; },
    invalidate: () => { valid = false; for (const callback of [...subscribers]) callback(); },
    revive: () => { valid = true; active = account; }, setActive: value => { active = value; },
    close: () => owner.suspend(owner.getSnapshot().actions) };
}

test('owner construction/render has no request, preference or subscription side effects; activation reuses real Home/cache', async t => {
  const h = harness(); t.after(h.close);
  assert.equal(h.owner.getSnapshot().home.kind, 'loading'); assert.equal(h.calls.length, 0); assert.equal(h.prefs.length, 0); assert.equal(h.subscribers.size, 0);
  const actions = h.owner.activate(); assert.ok(actions); assert.equal(h.owner.activate(), actions); await tick();
  const first = h.owner.getSnapshot(); assert.equal(first.home.kind, 'blocks'); assert.deepEqual(first.blocks.map(block => block.key), ['alpha', 'beta']);
  assert.deepEqual(h.calls.map(call => call.target), ['/v1/mobile/qolip/blocks', '/v1/mobile/qolip/locations?block=Alpha', '/v1/mobile/qolip/locations?block=Beta']);
  assert.equal(h.prefs.length, 1); assert.equal(h.subscribers.size, 1);
  actions.select(1); const second = h.owner.getSnapshot();
  assert.equal(second.home.selected.key, 'beta'); assert.equal(second.blocks[0].future, first.blocks[0].future); assert.equal(second.blocks[1].future, first.blocks[1].future);
  actions.reorder(0, 1); await tick();
  const reordered = h.owner.getSnapshot(); assert.deepEqual(reordered.blocks.map(block => block.key), ['beta', 'alpha']);
  assert.equal(reordered.home.selected.key, 'beta'); assert.equal(reordered.blocks[1].future, first.blocks[0].future);
  assert.deepEqual(h.prefs[1], ['write', 'qolip.home.block_order', '["beta","alpha"]']);
  assert.equal(h.calls.length, 3, 'select/reorder does not create a second read cache or mutation');
});

test('owner keeps raw controlled search immediate while existing Home owns 160ms query/count work and Clear', async t => {
  const h = harness(); t.after(h.close); const actions = h.owner.activate(); await tick();
  actions.setSearch(' Needle  '); assert.equal(h.owner.getSnapshot().search, ' Needle  '); assert.equal(h.owner.getSnapshot().home.tabs[0].matchCount, 0);
  await new Promise(resolve => setTimeout(resolve, 190));
  assert.equal(h.owner.getSnapshot().search, ' Needle  '); assert.equal(h.owner.getSnapshot().home.tabs[0].matchCount, 1);
  assert.equal(h.owner.getSnapshot().home.tabs[1].matchCount, 1); assert.equal(h.calls.length, 3);
  actions.setSearch(''); assert.equal(h.owner.getSnapshot().search, ''); assert.deepEqual(h.owner.getSnapshot().home.cellCounts, {});
});

test('owner manual refresh replaces only the real requested future and supplies existing resolved initial data', async t => {
  const h = harness(); t.after(h.close); const actions = h.owner.activate(); await tick();
  const first = h.owner.getSnapshot(), next = deferred(); h.setLocationsResponse(() => next.promise);
  const refreshing = actions.refreshBlock(' Alpha '), waiting = h.owner.getSnapshot();
  assert.notEqual(waiting.blocks[0].future, first.blocks[0].future); assert.equal(waiting.blocks[1].future, first.blocks[1].future);
  assert.deepEqual(waiting.blocks[0].initialLocations, await first.blocks[0].future);
  next.resolve(json({ locations: rows('new') })); await refreshing; assert.deepEqual(await waiting.blocks[0].future, rows('new'));
  assert.equal(h.calls.length, 4);
});

test('owner revision refresh reuses quiet refresh and preserves settled cached futures on a failed location read', async t => {
  const h = harness(); t.after(h.close); const actions = h.owner.activate(); await tick(); const first = h.owner.getSnapshot();
  actions.routeChanged(true); actions.appResumed(); await tick(); assert.equal(h.calls.length, 3, 'real Home cooldown still applies');
  h.setLocationsResponse(() => new Response('offline', { status: 503 })); actions.locationsChanged(); await tick();
  assert.equal(h.calls.length, 6); assert.equal(h.owner.getSnapshot().blocks[0].future, first.blocks[0].future); assert.equal(h.owner.getSnapshot().home.kind, 'blocks');
});

test('owner read errors show the existing retry branch; retry uses actual Home reload and cached bodies', async t => {
  const h = harness({ blocksResponse: () => new Response('offline', { status: 503 }) }); t.after(h.close);
  const actions = h.owner.activate(); await tick(); assert.equal(h.owner.getSnapshot().home.kind, 'retry'); assert.deepEqual(h.owner.getSnapshot().blocks, []);
  h.setBlocksResponse(() => json({ blocks, warehouses: ['W'] })); await actions.retry(); await tick(); assert.equal(h.owner.getSnapshot().home.kind, 'blocks');
  assert.equal(h.calls.filter(call => call.target === '/v1/mobile/qolip/blocks').length, 2);
});

test('owner invalidates immediately on the original witness event, clearing raw search, bodies and every old action without recapture', async () => {
  const h = harness(), actions = h.owner.activate(); await tick(); actions.setSearch('private'); const before = h.owner.getSnapshot();
  let bodyInvalidations = 0; before.boundary.subscribe(() => bodyInvalidations++); h.invalidate();
  const after = h.owner.getSnapshot(); assert.equal(after.home.kind, 'invalid'); assert.equal(after.search, ''); assert.deepEqual(after.blocks, []); assert.equal(bodyInvalidations, 1);
  let invoked = false; actions.invoke(() => { invoked = true; }); actions.setSearch('old'); actions.select(1); actions.reorder(0, 1);
  await actions.retry(); await actions.refreshBlock('Alpha'); actions.locationsChanged(); actions.appResumed();
  assert.equal(invoked, false); assert.equal(h.calls.length, 3); assert.equal(h.prefs.length, 1); assert.equal(h.subscribers.size, 0);
  h.revive(); assert.equal(h.owner.activate(), null); assert.equal(h.boundary.current(), false); assert.equal(h.owner.getSnapshot().home.kind, 'invalid');
});

test('failing observers cannot suppress retained-body or owner invalidation notifications', async () => {
  const h = harness(), changes = [], bodyChanges = [], actions = h.owner.activate(); await tick();
  const before = h.owner.getSnapshot();
  h.owner.subscribe(() => { throw new Error('owner observer'); });
  h.owner.subscribe(async () => { throw new Error('async owner observer'); });
  h.owner.subscribe(() => changes.push(h.owner.getSnapshot().home.kind));
  before.boundary.subscribe(() => { throw new Error('body observer'); });
  before.boundary.subscribe(async () => { throw new Error('async body observer'); });
  before.boundary.subscribe(() => bodyChanges.push('invalid'));
  h.invalidate(); await tick(); assert.equal(h.owner.getSnapshot().home.kind, 'invalid');
  assert.deepEqual(bodyChanges, ['invalid']); assert.equal(changes.at(-1), 'invalid'); assert.equal(actions.current(), false);
});

test('throwing boundary/controller cleanup cannot prevent body and owner invalidation', () => {
  const h = harness(), { QolipHomeOwnerState } = h.load('qolip/qolipHomeOwnerState.ts');
  let valid = true, signal, disposed = 0, bodyNotified = 0, ownerNotified = 0;
  const boundary = { current: () => valid, subscribe: listener => { signal = listener; return () => { throw new Error('boundary cleanup'); }; } };
  const controller = { getSnapshot: () => ({ invalid: false, loading: true, snapshot: null }), subscribe: () => () => { throw new Error('home cleanup'); },
    start: async () => {}, invalidateSession: () => { throw new Error('controller invalidation'); }, dispose: () => { disposed++; } };
  const owner = new QolipHomeOwnerState(boundary, () => controller); owner.subscribe(() => ownerNotified++);
  const actions = owner.activate(), retained = owner.getSnapshot().boundary; retained.subscribe(() => bodyNotified++);
  valid = false; signal(); assert.equal(owner.getSnapshot().home.kind, 'invalid'); assert.equal(actions.current(), false);
  assert.equal(disposed, 1); assert.equal(bodyNotified, 1); assert.ok(ownerNotified > 0);
});

test('a witness invalidated while blocks are pending cannot read preferences or launch location futures on completion', async () => {
  const pending = deferred(), h = harness({ blocksResponse: () => pending.promise }); h.owner.activate(); await tick(); h.invalidate();
  pending.resolve(json({ blocks, warehouses: ['W'] })); await tick(); assert.equal(h.prefs.length, 0); assert.equal(h.calls.length, 1); assert.equal(h.owner.getSnapshot().home.kind, 'invalid');
});

test('a preference read completing after invalidation cannot publish blocks or create location requests', async () => {
  const pending = deferred(), h = harness({ readOrder: () => pending.promise }); h.owner.activate(); await tick(); assert.equal(h.prefs.length, 1);
  h.invalidate(); pending.resolve('["beta"]'); await tick(); assert.equal(h.calls.length, 1); assert.equal(h.owner.getSnapshot().home.kind, 'invalid');
});

test('synchronous invalidation during registration closes the subscription before any read', () => {
  const h = harness({ onSubscribe: invalidate => invalidate() }); assert.equal(h.owner.activate(), null); assert.equal(h.calls.length, 0); assert.equal(h.prefs.length, 0);
  assert.equal(h.subscribers.size, 0); assert.equal(h.owner.getSnapshot().home.kind, 'invalid');
});

test('effect cleanup/recreation uses a fresh controller lifetime, not a new witness, and old callbacks/futures cannot revive', async t => {
  const oldLocations = deferred(), h = harness({ locationsResponse: () => oldLocations.promise }); t.after(h.close);
  const oldActions = h.owner.activate(); await tick(); const oldSnapshot = h.owner.getSnapshot(); h.owner.suspend(oldActions);
  assert.equal(oldActions.current(), false); assert.equal(oldSnapshot.boundary.current(), false); assert.equal(h.subscribers.size, 0);
  h.setLocationsResponse(() => json({ locations: rows('current') })); const actions = h.owner.activate(); assert.notEqual(actions, oldActions); await tick();
  const current = h.owner.getSnapshot(); assert.notEqual(current.boundary, oldSnapshot.boundary); assert.equal(current.home.kind, 'blocks');
  let invoked = false; oldActions.invoke(() => { invoked = true; }); await oldActions.refreshBlock('Alpha'); oldActions.reorder(0, 1);
  oldLocations.resolve(json({ locations: rows('old-private') })); await tick();
  assert.equal(invoked, false); assert.equal(h.calls.length, 6); assert.equal(h.prefs.filter(call => call[0] === 'write').length, 0);
  await assert.rejects(oldSnapshot.blocks[0].future, /qolip_read_expired/); assert.deepEqual(await current.blocks[0].future, rows('current'));
  h.owner.suspend(oldActions); assert.equal(actions.current(), true, 'a late old cleanup cannot stop the new lifetime');
});

test('wrong role, missing capability, inactive session and fake test token fail closed without starting any Home work', () => {
  for (const account of [session({ profile: { role: 'admin', ref: 'A' } }), session({ capabilities: [] }), session({ token: 'test-mode-token' }), session({ token: '' })]) {
    const h = harness({ session: account }); assert.equal(h.owner.activate(), null); assert.equal(h.owner.getSnapshot().home.kind, 'invalid'); assert.equal(h.calls.length, 0); assert.equal(h.prefs.length, 0);
  }
  const h = harness(); h.setActive(session()); assert.equal(h.owner.activate(), null); assert.equal(h.calls.length, 0);
});

test('the injected witness checker receives the exact original witness, is never captured here, and rejects scope ABA permanently', () => {
  const h = harness(); assert.equal(h.boundary.current(), true); h.account.assigned_warehouses = ['changed']; assert.equal(h.boundary.current(), false);
  delete h.account.assigned_warehouses; h.revive(); assert.equal(h.boundary.current(), false);
  let seen; const fresh = harness(), adapter = fresh.load('qolip/qolipHomeWitnessBoundary.ts').qolipHomeWitnessBoundary;
  const boundary = adapter(fresh.account, fresh.witness, { isSessionWitnessCurrent: witness => { seen = witness; return true; }, subscribeSessionWitness: () => () => {} });
  assert.equal(boundary.current(), true); assert.equal(seen, fresh.witness);
});

test('throwing/async witness predicates and asynchronous boundary subscriptions cannot authorize the owner', async () => {
  for (const read of [() => { throw new Error('guard'); }, async () => true, async () => { throw new Error('guard'); }]) {
    const h = harness(), adapter = h.load('qolip/qolipHomeWitnessBoundary.ts').qolipHomeWitnessBoundary;
    const boundary = adapter(h.account, h.witness, { isSessionWitnessCurrent: read, subscribeSessionWitness: () => () => {} });
    assert.equal(boundary.current(), false);
  }
  const h = harness(), { QolipHomeOwnerState } = h.load('qolip/qolipHomeOwnerState.ts'); let stops = 0;
  const controller = { getSnapshot: () => ({ invalid: false, loading: true, snapshot: null }), invalidateSession() {}, dispose() {} };
  const owner = new QolipHomeOwnerState({ current: () => true, subscribe: async () => () => { stops++; } }, () => controller);
  assert.equal(owner.activate(), null); await tick(); assert.equal(stops, 1); assert.equal(owner.getSnapshot().home.kind, 'invalid');
});

for (const reader of ['blocks', 'locations']) {
  function readerHarness(refresh = async () => false) {
    const account = session(), events = []; let active = account;
    const load = modules({ 'auth.ts': { activeSessionToken: value => value === active ? value.token : null,
      refreshSession: async (...args) => { events.push('refresh'); return refresh(...args); } } });
    const read = reader === 'blocks' ? load('qolip/qolipBlocksApi.ts').qolipBlocksData : (account, guard) => load('qolip/qolipLocationsApi.ts').qolipLocations(account, ' Alpha ', guard);
    return { read, account, events, load, setActive: value => { active = value; } };
  }
  test(`${reader} Home GET opts into the unchanged real authorizedFetch initial/401-retry guard`, async t => {
    const h = readerHarness(async account => { account.token = 'refreshed-local'; return true; }); let calls = 0, guards = 0;
    const oldFetch = global.fetch; t.after(() => { global.fetch = oldFetch; });
    global.fetch = async (_url, init) => { calls++; assert.equal(init.redirect, 'manual'); assert.equal(init.credentials, 'omit');
      return calls === 1 ? json({}, 401) : json(reader === 'blocks' ? { blocks } : { locations: rows('read') }); };
    const result = await h.read(h.account, () => { guards++; return true; }); assert.ok(result); assert.equal(calls, 2); assert.deepEqual(h.events, ['refresh']); assert.ok(guards >= 6);
  });
  test(`${reader} Home GET cannot retry after the witness changes during a pending 401 refresh`, async t => {
    const refresh = deferred(), h = readerHarness(() => refresh.promise); let current = true, calls = 0;
    const oldFetch = global.fetch; t.after(() => { global.fetch = oldFetch; }); global.fetch = async () => { calls++; return json({}, 401); };
    const reading = h.read(h.account, () => current); await tick(); current = false; h.account.token = 'refreshed-local'; refresh.resolve(true);
    await assert.rejects(reading, /qolip_read_expired/); assert.equal(calls, 1);
  });
  test(`${reader} Home GET rejects a fake test token introduced by refresh before the retry dispatch`, async t => {
    const h = readerHarness(async account => { account.token = 'test-mode-token'; return true; }); let calls = 0;
    const oldFetch = global.fetch; t.after(() => { global.fetch = oldFetch; }); global.fetch = async () => { calls++; return json({}, 401); };
    await assert.rejects(h.read(h.account, () => true), /test mode is not yet ported/); assert.equal(calls, 1);
  });
  test(`${reader} Home GET checks lifetime after JSON completion and parsing, not only before sending`, async t => {
    const account = session(), pending = deferred(); let current = true, jsonReads = 0;
    const load = modules({ 'auth.ts': { activeSessionToken: value => value.token }, 'authorizedFetch.ts': { authorizedFetch: async (_s, _p, _i, beforeSend) => {
      beforeSend(); return { status: 200, json: () => { jsonReads++; return pending.promise; } };
    } } });
    const api = reader === 'blocks' ? load('qolip/qolipBlocksApi.ts').qolipBlocksData : (s, g) => load('qolip/qolipLocationsApi.ts').qolipLocations(s, 'Alpha', g);
    const reading = api(account, () => current); await tick(); assert.equal(jsonReads, 1); current = false;
    pending.resolve(reader === 'blocks' ? { blocks } : { locations: rows('late') }); await assert.rejects(reading, /qolip_read_expired/);
  });
  test(`${reader} Home GET fails closed for false, throwing, async or reentrant read predicates before any request`, async t => {
    const h = readerHarness(); let calls = 0; const oldFetch = global.fetch; t.after(() => { global.fetch = oldFetch; }); global.fetch = async () => { calls++; return json({}); };
    for (const guard of [() => false, () => { throw new Error('guard failed'); }, async () => true, async () => { throw new Error('async'); }]) await assert.rejects(h.read(h.account, guard));
    const { assertQolipReadCurrent } = h.load('qolip/qolipApiCommon.ts'); const guard = () => { try { assertQolipReadCurrent(guard); } catch {} return true; };
    await assert.rejects(h.read(h.account, guard), /qolip_read_expired/); assert.equal(calls, 0);
  });
}

for (const reader of ['blocks', 'locations']) {
  test(`${reader} read cannot dispatch after the deferred API setup yields, or parse after a stale transport response`, async () => {
    for (const invalidateDuring of ['setup', 'response']) {
      let current = true, calls = 0, jsonReads = 0; const transport = deferred(), account = session();
      const load = modules({ 'auth.ts': { activeSessionToken: value => value.token }, 'authorizedFetch.ts': { authorizedFetch: async (_s, _p, _i, beforeSend) => {
        beforeSend(); calls++; return transport.promise;
      } } });
      const read = reader === 'blocks' ? load('qolip/qolipBlocksApi.ts').qolipBlocksData : (s, g) => load('qolip/qolipLocationsApi.ts').qolipLocations(s, 'Alpha', g);
      const promise = read(account, () => current);
      if (invalidateDuring === 'response') await tick();
      current = false; transport.resolve({ status: 200, json: async () => { jsonReads++; return {}; } });
      await assert.rejects(promise, /qolip_read_expired/); assert.equal(calls, invalidateDuring === 'setup' ? 0 : 1); assert.equal(jsonReads, 0);
    }
  });
  test(`${reader} read rechecks the boundary after parsing a result`, async () => {
    let current = true;
    const payload = reader === 'blocks' ? { blocks: [{ get name() { current = false; return 'Alpha'; } }] }
      : { locations: [{ get id() { current = false; return 'private'; } }] };
    const load = modules({ 'auth.ts': { activeSessionToken: value => value.token }, 'authorizedFetch.ts': { authorizedFetch: async (_s, _p, _i, beforeSend) => {
      beforeSend(); return { status: 200, json: async () => payload };
    } } });
    const read = reader === 'blocks' ? load('qolip/qolipBlocksApi.ts').qolipBlocksData : (s, g) => load('qolip/qolipLocationsApi.ts').qolipLocations(s, 'Alpha', g);
    await assert.rejects(read(session(), () => current), /qolip_read_expired/);
  });
}

test('malformed saved block ordering uses real Home retry and never creates location requests', async t => {
  const h = harness({ readOrder: () => '[1]' }); t.after(h.close); h.owner.activate(); await tick();
  assert.equal(h.owner.getSnapshot().home.kind, 'retry'); assert.equal(h.calls.length, 1); assert.equal(h.prefs.length, 1);
});

test('an unawaited order save failure or later invalidation never reports success or leaves an unhandled rejection', async () => {
  const pending = deferred(), h = harness({ saveOrder: () => pending.promise }), actions = h.owner.activate(); await tick();
  actions.reorder(0, 1); assert.equal(h.prefs.filter(value => value[0] === 'write').length, 1); h.invalidate(); pending.reject(new Error('storage failed'));
  await tick(); assert.equal(h.owner.getSnapshot().home.kind, 'invalid'); actions.reorder(1, 0); assert.equal(h.prefs.length, 2);
});
