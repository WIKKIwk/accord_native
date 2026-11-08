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
function deferred() { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; }
function windowFor(query, changes = {}) { return { kind: query.kind, limit: query.limit, search: query.search,
  epoch: 'epoch-a', scope: 'server-scope', version: 'v1', revision: 1, apparatus_id: 'apparatus:a:one',
  checked_count: 1, missing_count: 1, rows: [{ id: 'order-a', position: 0, task_state: 'missing' }],
  apparatus: [{ id: 'apparatus:a:one', name: 'One' }, { id: 'apparatus:a:two', name: 'Two' }], ...changes }; }
function setup(overrides = {}) {
  const session = { token: 'token-a', baseUrl: 'https://example.test', profile: { role: 'material_taminotchi', ref: 'user-a' },
    capabilities: ['raw_material.assign'], assigned_apparatus: [], assigned_item_groups: ['group-a'], assigned_warehouses: [] };
  let active = true, live = true, epoch = 1, loads = 0; const timers = [];
  const dart = compile('shared/dartApparatus', { '../workerControlsApi': { isCanonicalApparatusId: () => true } });
  const { SupplyTasksController } = compile('shared/supplyTasks/SupplyTasksController', {
    '../../auth': { activeSessionToken: value => active && value === session ? value.token : null,
      activeSessionEpoch: value => active && value === session ? epoch : null },
    '../../sessionReadScope': compile('sessionReadScope'), '../appRoutes': compile('shared/appRoutes'),
    '../camera/synchronousGuard': compile('shared/camera/synchronousGuard'), '../dartApparatus': dart });
  const options = { session, kind: 'material', isCurrent: () => live,
    loadWindow: async query => { loads++; return windowFor(query); },
    schedule: (callback, ms) => { const timer = { callback, ms, cancelled: false }; timers.push(timer); return timer; },
    cancel: timer => { timer.cancelled = true; }, ...overrides };
  const controller = new SupplyTasksController(options);
  return { session, options, controller, timers, calls: () => loads, deactivate: () => { active = false; },
    newEpoch: () => { epoch++; }, disposeScreen: () => { live = false; } };
}

test('activation loads once, deduplicates the same in-flight refresh, and uses the returned apparatus', async () => {
  const pending = deferred(); let calls = 0, request, guard;
  const h = setup({ loadWindow: (query, current) => { calls++; request = query; guard = current; return pending.promise; } });
  const a = h.controller.activate(), b = h.controller.refresh(); assert.equal(a, b);
  await Promise.resolve(); assert.equal(calls, 1); assert.equal(guard(), true);
  assert.deepEqual(request, { kind: 'material', apparatus: '', limit: 10, search: '' });
  pending.resolve(windowFor(request)); await a;
  const state = h.controller.getSnapshot(); assert.equal(state.loading, false); assert.equal(state.window.rows[0].id, 'order-a');
  assert.equal(state.query.apparatus, 'apparatus:a:one'); assert.equal(state.error, null); h.controller.dispose();
});

test('changing the limit while loading discards late results from the previous generation', async () => {
  const waits = [], h = setup({ loadWindow: query => { const d = deferred(); waits.push({ query, ...d }); return d.promise; } });
  const old = h.controller.activate(); await Promise.resolve(); const fresh = h.controller.selectLimit(5); await Promise.resolve();
  assert.equal(waits.length, 2); waits[1].resolve(windowFor(waits[1].query, { version: 'new' })); await fresh;
  waits[0].resolve(windowFor(waits[0].query, { version: 'old' })); await old;
  assert.equal(h.controller.getSnapshot().window.version, 'new'); assert.equal(h.controller.getSnapshot().query.limit, 5); h.controller.dispose();
});

test('only offered apparatus and V2 limit options trigger a new window', async () => {
  const seen = [], h = setup({ loadWindow: async query => { seen.push(query); return windowFor(query, { apparatus_id: query.apparatus || 'apparatus:a:one' }); } });
  await h.controller.activate(); await h.controller.selectApparatus('unoffered'); await h.controller.selectLimit(7); assert.equal(seen.length, 1);
  await h.controller.selectApparatus('apparatus:a:two'); await h.controller.selectLimit(20);
  assert.equal(seen[1].apparatus, 'apparatus:a:two'); assert.equal(seen[2].limit, 20); h.controller.dispose();
});

test('ASCII search debounces 250ms, cancels earlier input and submits Dart-trimmed lowercase', async () => {
  const seen = [], h = setup({ loadWindow: async query => { seen.push(query); return windowFor(query); } });
  await h.controller.activate(); assert.equal(h.controller.setSearchInput('  FIRST  '), true); assert.equal(h.controller.setSearchInput('  NEXT  '), true);
  assert.equal(h.timers[0].cancelled, true); assert.equal(h.timers[1].ms, 250); h.timers[1].callback(); await h.controller.refresh();
  assert.equal(seen.length, 2); assert.equal(seen[1].search, 'next'); assert.equal(h.controller.getSnapshot().searchInput, '  NEXT  '); h.controller.dispose();
});

test('Unicode search debounces and retains Uzbek and Cyrillic input', async () => {
  const seen = [], h = setup({ loadWindow: async query => { seen.push(query); return windowFor(query); } });
  await h.controller.activate(); assert.equal(h.controller.setSearchInput('safe'), true);
  assert.equal(h.controller.setSearchInput('  O‘ZBEK ЎЗБЕК ҚИЁС ҒОЗ ҲАҚ ЁШ  '), true);
  assert.equal(h.timers[0].cancelled, true); assert.equal(h.timers[1].ms, 250); h.timers[1].callback(); await h.controller.refresh();
  assert.equal(seen[1].search, 'o‘zbek ўзбек қиёс ғоз ҳақ ёш');
  assert.equal(h.controller.getSnapshot().searchInput, '  O‘ZBEK ЎЗБЕК ҚИЁС ҒОЗ ҲАҚ ЁШ  '); h.controller.dispose();
});

test('401/403 clear visible rows; other failures preserve the previous window and allow retry', async () => {
  for (const statusCode of [401, 403, 500, undefined]) {
    let fail = false; const h = setup({ loadWindow: async query => { if (fail) throw { statusCode }; return windowFor(query); } });
    await h.controller.activate(); fail = true; await h.controller.refresh();
    const state = h.controller.getSnapshot(); assert.equal(state.loading, false); assert.ok(state.error);
    assert.equal(state.window === null, statusCode === 401 || statusCode === 403);
    fail = false; await h.controller.refresh(); assert.equal(h.controller.getSnapshot().window.rows[0].id, 'order-a'); h.controller.dispose();
  }
});

test('query mismatch or an already retired server epoch is rejected without replacing the last good window', async () => {
  const epochs = ['epoch-a', 'epoch-b', 'epoch-a', 'epoch-c']; let index = 0;
  const h = setup({ loadWindow: async query => windowFor(query, { epoch: epochs[index++], ...(index === 4 ? { limit: 50 } : {}) }) });
  await h.controller.activate(); await h.controller.refresh(); assert.equal(h.controller.getSnapshot().window.epoch, 'epoch-b');
  await h.controller.refresh(); assert.equal(h.controller.getSnapshot().window.epoch, 'epoch-b'); assert.ok(h.controller.getSnapshot().error);
  await h.controller.refresh(); assert.equal(h.controller.getSnapshot().window.epoch, 'epoch-b'); assert.ok(h.controller.getSnapshot().error); h.controller.dispose();
});

for (const change of ['role', 'identity', 'permission', 'groups', 'warehouses', 'epoch', 'account', 'screen']) {
  test(`in-flight result is not published after ${change} changes`, async () => {
    const wait = deferred(), h = setup({ loadWindow: () => wait.promise });
    const pending = h.controller.activate(); await Promise.resolve();
    if (change === 'role') h.session.profile.role = 'admin';
    if (change === 'identity') h.session.profile.ref = 'other';
    if (change === 'permission') h.session.capabilities = [];
    if (change === 'groups') h.session.assigned_item_groups = ['other'];
    if (change === 'warehouses') h.session.assigned_warehouses = ['other'];
    if (change === 'epoch') h.newEpoch();
    if (change === 'account') h.deactivate();
    if (change === 'screen') h.disposeScreen();
    wait.resolve(windowFor(h.controller.getSnapshot().query)); await pending;
    assert.equal(h.controller.getSnapshot().window, null); h.controller.dispose();
  });
}

test('invalidating a screen clears prior rows, cancels search and ignores late responses', async () => {
  const next = deferred(); let calls = 0;
  const h = setup({ loadWindow: async query => ++calls === 1 ? windowFor(query) : next.promise });
  await h.controller.activate(); assert.equal(h.controller.getSnapshot().window.rows[0].id, 'order-a');
  h.controller.setSearchInput('pending'); const pending = h.controller.refresh(); await Promise.resolve();
  h.controller.invalidate(); assert.equal(h.timers[0].cancelled, true); assert.equal(h.controller.getSnapshot().window, null);
  next.resolve(windowFor(h.controller.getSnapshot().query)); await pending; assert.equal(h.controller.getSnapshot().window, null);
  await h.controller.activate(); assert.equal(calls, 2); h.controller.dispose();
});

test('async or reentrant lifetime callbacks fail closed before reader invocation', async () => {
  for (const current of [() => 1, () => Promise.resolve(true), () => Promise.reject(Error('async guard')), () => { throw Error('guard'); }]) {
    let calls = 0; const h = setup({ isCurrent: current, loadWindow: async query => { calls++; return windowFor(query); } });
    await h.controller.activate(); assert.equal(calls, 0); assert.equal(h.controller.getSnapshot().active, false); h.controller.dispose();
  }
  const h = setup(); h.options.isCurrent = () => true; // Constructor captured its original closure.
  h.disposeScreen(); await h.controller.activate(); assert.equal(h.calls(), 0); h.controller.dispose();
  await new Promise(resolve => setImmediate(resolve));
});

test('characterization: without a session-change event already displayed rows remain stale', async () => {
  const h = setup(); await h.controller.activate(); h.session.assigned_item_groups = ['new-group'];
  assert.equal(h.controller.getSnapshot().window.rows[0].id, 'order-a');
  h.controller.invalidate(); assert.equal(h.controller.getSnapshot().window, null); h.controller.dispose();
});

test('characterization: unobserved same-snapshot ABA remains undetected', async () => {
  const wait = deferred(), h = setup({ loadWindow: () => wait.promise }); const pending = h.controller.activate(); await Promise.resolve();
  h.session.capabilities = []; h.session.capabilities = ['raw_material.assign']; wait.resolve(windowFor(h.controller.getSnapshot().query)); await pending;
  assert.equal(h.controller.getSnapshot().window.rows[0].id, 'order-a'); h.controller.dispose();
});

test('Dart edge whitespace is removed before search normalization', async () => {
  const seen = [], h = setup({ loadWindow: async query => { seen.push(query); return windowFor(query); } });
  await h.controller.activate(); assert.equal(h.controller.setSearchInput('\u0085 NEXT \u0085'), true);
  h.timers[0].callback(); await h.controller.refresh(); assert.equal(seen[1].search, 'next'); h.controller.dispose();
});

test('scope changes in returned window getters cannot publish data', async () => {
  const h = setup({ loadWindow: async query => {
    const next = windowFor(query); Object.defineProperty(next, 'apparatus_id', { get() { h.session.assigned_item_groups = ['other']; return 'apparatus:a:one'; } });
    return next;
  } });
  await h.controller.activate(); assert.equal(h.controller.getSnapshot().window, null); h.controller.dispose();
});

test('a reentrant reader lifetime callback invalidation prevents late publication', async () => {
  let h; const wait = deferred(); h = setup({ loadWindow: (_query, current) => { assert.equal(current(), true); h.controller.invalidate(); return wait.promise; } });
  const pending = h.controller.activate(); await Promise.resolve(); wait.resolve(windowFor(h.controller.getSnapshot().query)); await pending;
  assert.equal(h.controller.getSnapshot().window, null); assert.equal(h.controller.getSnapshot().active, false); h.controller.dispose();
});

test('a same-session token refresh with unchanged epoch and scope keeps the task request usable', async () => {
  const wait = deferred(), h = setup({ loadWindow: () => wait.promise });
  const pending = h.controller.activate(); await Promise.resolve(); h.session.token = 'fresh-token';
  wait.resolve(windowFor(h.controller.getSnapshot().query)); await pending;
  assert.equal(h.controller.canInteract(), true); assert.equal(h.controller.getSnapshot().window.rows[0].id, 'order-a'); h.controller.dispose();
});

test('a login epoch change and rollback to the same session cannot revive the old controller', async () => {
  const wait = deferred(), h = setup({ loadWindow: () => wait.promise });
  const pending = h.controller.activate(); await Promise.resolve(); h.newEpoch();
  // Same object and token are restored by a hypothetical login rollback, but the epoch remains advanced.
  h.session.token = 'token-a'; wait.resolve(windowFor(h.controller.getSnapshot().query)); await pending;
  assert.equal(h.controller.canInteract(), false); assert.equal(h.controller.getSnapshot().window, null); h.controller.dispose();
});
