// Real Rezka witness guard, shared detail reader and authorized-fetch logic with mocked transport.
const assert = require('node:assert/strict'), fs = require('node:fs'), Module = require('node:module');
const path = require('node:path'), test = require('node:test'), ts = require('typescript');
function setup() {
  const session = { token: 'token', baseUrl: 'https://example.test', profile: { role: 'rezka_master', ref: 'master' },
    capabilities: ['rezka.master.access'], assigned_apparatus: ['apparatus:default:a'] };
  let active = true, route = true, refresh = () => true, calls = 0, catalogCalls = 0, catalogGuard, transport;
  let catalog = [{ id: 'apparatus:default:a', name: 'A', operation: 'cut', lifecycle_state: 'active', sort_order: 1, capabilities: ['cut'] }];
  const auth = { activeSessionEpoch: value => active && value === session ? 1 : null,
    activeSessionToken: value => active && value === session ? session.token : null,
    captureSessionWitness: value => active ? { session: value } : null,
    isSessionWitnessCurrent: witness => active && witness.session === session,
    registerSessionResetHook: () => () => {}, subscribeSessionWitness: () => () => {},
    refreshSession: async () => refresh() };
  const cache = new Map();
  function load(relative) {
    const file = path.resolve(__dirname, '../src', `${relative}.ts`);
    if (cache.has(file)) return cache.get(file).exports;
    const mod = new Module(file, module); cache.set(file, mod); mod.filename = file; mod.paths = module.paths;
    mod.require = id => {
      if (id === '../auth' || id === './auth') return auth;
      if (id === '../shared/appRoutes' || id === './shared/appRoutes') return {
        appRoutes: { apparatusPaddonDetail: '/detail', adminWorkerSettings: '/workers' }, canOpenRoute: () => route };
      if (id === '../apparatusApi') return { adminApparatus: async (s, options) => {
        assert.equal(s, session); assert.equal(options.limit, 10000); catalogCalls++; catalogGuard = options.beforeSend; catalogGuard(); return catalog; } };
      if (id === './workerControlsApi') return { productionMapResponseError: () => Error('server error'), WorkerControlException: class extends Error {} };
      if (id === './paddonModels') return { paddonFromJson: value => value, paddonSnapshotFromJson: value => value };
      return id.startsWith('.') ? load(path.relative(path.resolve(__dirname, '../src'), path.resolve(path.dirname(file), id))) : id === 'expo/fetch' ? require('./support/expoFetch.cjs') : require(id);
    };
    mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, file);
    return mod.exports;
  }
  const guard = load('rezka/rezkaSessionGuard'), reader = load('rezka/rezkaPaddonDetailRead'), shared = load('paddonManagementApi');
  const lifetime = load('rezka/rezkaPaddonDetailLifetime'), { RezkaPaddonDetailController } = load('rezka/rezkaPaddonDetailController');
  const snapshot = guard.captureRezkaSession(session);
  const newOwner = (apparatus = 'apparatus:default:a', code = 'P1') => reader.createRezkaPaddonDetailOwner(snapshot, apparatus, code);
  const owner = newOwner();
  const original = global.fetch; global.fetch = async (...args) => { calls++; return transport(...args); };
  return { session, snapshot, owner, newOwner, reader, shared, lifetime, RezkaPaddonDetailController,
    calls: () => calls, catalogCalls: () => catalogCalls, catalogGuard: () => catalogGuard,
    setCatalog: value => { catalog = value; }, setTransport: fn => { transport = fn; }, setRefresh: fn => { refresh = fn; },
    loseAccount: () => { active = false; }, loseRoute: () => { route = false; }, loseAssignment: () => { session.assigned_apparatus = ['apparatus:default:b']; },
    restore: () => { global.fetch = original; } };
}
const response = (status, json) => ({ status, headers: new Headers(), body: null, json });
const detail = () => ({ paddon: { code: 'P1', apparatus_id: 'apparatus:default:a' },
  items: [{ batch_id: 'W1', payload_json: { nested: ['value'] } }], available_items: [] });
test('verified catalog and detail produce an immutable, issued binding for the original witness', async () => {
  const h = setup(); let request;
  h.setTransport(async url => { request = String(url); return response(200, async () => detail()); });
  try {
    const binding = await h.reader.readRezkaPaddonDetail(h.newOwner(' apparatus:default:a ', ' P1 '));
    const url = new URL(request); assert.equal(url.pathname, '/v1/mobile/admin/production-maps/paddons/detail');
    assert.equal(url.searchParams.get('code'), 'P1'); assert.equal(h.catalogCalls(), 1); assert.equal(h.calls(), 1);
    assert.equal(h.reader.isRezkaPaddonDetailBinding(binding, h.snapshot), true);
    assert.equal(h.reader.isRezkaPaddonDetailBinding({ ...binding }, h.snapshot), false);
    assert.equal(h.reader.isRezkaPaddonDetailBinding(binding, { ...h.snapshot }), false);
    assert.ok(Object.isFrozen(binding)); assert.ok(Object.isFrozen(binding.data)); assert.ok(Object.isFrozen(binding.data.items[0].payload_json.nested));
    assert.ok(Object.isFrozen(binding.catalog[0].capabilities)); assert.equal(Reflect.set(binding.data.paddon, 'code', 'other'), false);
    h.loseAccount(); assert.equal(h.reader.isRezkaPaddonDetailBinding(binding, h.snapshot), false);
  } finally { h.restore(); }
});
test('deep decoded metadata is frozen without recursive stack growth', async () => {
  const h = setup(), value = detail(); let cursor = {}, root = cursor;
  for (let i = 0; i < 12000; i++) { cursor.next = {}; cursor = cursor.next; }
  value.items[0].payload_json = root; h.setTransport(async () => response(200, async () => value));
  try { const binding = await h.reader.readRezkaPaddonDetail(h.owner);
    assert.ok(Object.isFrozen(binding.data.items[0].payload_json)); assert.ok(Object.isFrozen(cursor)); }
  finally { h.restore(); }
});
test('closing the old view while its catalog is pending blocks its detail send even when a same-account view opens', async () => {
  const h = setup(); let release;
  h.setCatalog(new Promise(resolve => { release = resolve; }));
  h.setTransport(async () => response(200, async () => detail()));
  try {
    const pending = h.reader.readRezkaPaddonDetail(h.owner); assert.equal(h.catalogCalls(), 1);
    h.owner.close(); const newer = h.newOwner();
    release([{ id: 'apparatus:default:a', name: 'A', operation: 'cut', lifecycle_state: 'active', sort_order: 1 }]);
    await assert.rejects(pending, e => e.name === 'RezkaScopeChanged'); assert.equal(h.calls(), 0);
    const binding = await h.reader.readRezkaPaddonDetail(newer);
    assert.equal(h.reader.isRezkaPaddonDetailBinding(binding, h.snapshot), true); assert.equal(h.calls(), 1); newer.close();
  } finally { h.restore(); }
});
test('a catalog error after view closure is redacted and never starts a detail request', async () => {
  const h = setup(); let reject;
  h.setCatalog(new Promise((_resolve, fail) => { reject = fail; }));
  h.setTransport(async () => { throw Error('unexpected detail request'); });
  try {
    const pending = h.reader.readRezkaPaddonDetail(h.owner); h.owner.close(); reject(Error('old catalog error'));
    await assert.rejects(pending, e => e.name === 'RezkaScopeChanged'); assert.equal(h.calls(), 0);
  } finally { h.restore(); }
});
test('a suspended attempt waits after the catalog before sending detail, then resumes once', async () => {
  const h = setup(); let release, entered; let sending = true;
  const waiting = new Promise(resolve => { entered = resolve; });
  const control = { isCurrent: () => true, canSend: () => sending,
    waitForSend: () => { sending = false; entered(); return new Promise(resolve => { release = resolve; }); } };
  h.setTransport(async () => response(200, async () => detail()));
  try {
    const pending = h.reader.readRezkaPaddonDetail(h.owner, control); await waiting; assert.equal(h.calls(), 0);
    sending = true; release(); const binding = await pending; assert.equal(h.calls(), 1);
    assert.equal(h.reader.isRezkaPaddonDetailBinding(binding, h.snapshot), true);
  } finally { h.restore(); }
});
test('the real adapter and controller pause between reads and never send after disposal', async () => {
  for (const action of ['resume', 'dispose']) {
    const h = setup(); let release; h.setCatalog(new Promise(resolve => { release = resolve; }));
    h.setTransport(async () => response(200, async () => detail()));
    const controller = new h.RezkaPaddonDetailController({ isCurrent: () => true, createOwner: () => h.owner,
      ownerCurrent: owner => !!h.lifetime.rezkaPaddonDetailOwnerInput(owner), subscribeOwner: h.lifetime.subscribeRezkaPaddonDetailOwner,
      load: h.reader.readRezkaPaddonDetail, accept: binding => h.reader.isRezkaPaddonDetailBinding(binding, h.snapshot) });
    try {
      controller.resume(); const pending = controller.start(); await new Promise(resolve => setImmediate(resolve)); controller.suspend();
      release([{ id: 'apparatus:default:a', name: 'A', operation: 'cut', lifecycle_state: 'active', sort_order: 1 }]);
      await new Promise(resolve => setImmediate(resolve)); assert.equal(h.calls(), 0);
      if (action === 'resume') controller.resume(); else controller.dispose();
      await pending; assert.equal(h.calls(), action === 'resume' ? 1 : 0);
      assert.equal(controller.getSnapshot().phase, action === 'resume' ? 'ready' : 'invalid');
    } finally { controller.dispose(); h.restore(); }
  }
});
test('a superseded or closed attempt cannot publish a stale wait error or send detail', async () => {
  for (const reason of ['generation', 'view']) {
    const h = setup(); let reject, entered, current = true;
    const waiting = new Promise(resolve => { entered = resolve; });
    const control = { isCurrent: () => current, canSend: () => true,
      waitForSend: () => { entered(); return new Promise((_resolve, fail) => { reject = fail; }); } };
    h.setTransport(async () => { throw Error('unexpected detail request'); });
    try {
      const pending = h.reader.readRezkaPaddonDetail(h.owner, control); await waiting;
      if (reason === 'generation') current = false; else h.owner.close(); reject(Error('old wait error'));
      await assert.rejects(pending, e => e.name === 'RezkaScopeChanged'); assert.equal(h.calls(), 0);
    } finally { h.restore(); }
  }
});
test('a superseded attempt cannot publish even if a newer attempt uses the same view owner', async () => {
  const h = setup(); let release, entered, oldCurrent = true;
  const waiting = new Promise(resolve => { entered = resolve; });
  const oldControl = { isCurrent: () => oldCurrent, canSend: () => true,
    waitForSend: () => { entered(); return new Promise(resolve => { release = resolve; }); } };
  h.setTransport(async () => response(200, async () => detail()));
  try {
    const old = h.reader.readRezkaPaddonDetail(h.owner, oldControl); await waiting; oldCurrent = false;
    const newer = await h.reader.readRezkaPaddonDetail(h.owner, { isCurrent: () => true, canSend: () => true, waitForSend: async () => {} });
    release(); await assert.rejects(old, e => e.name === 'RezkaScopeChanged'); assert.equal(h.calls(), 1);
    assert.equal(h.reader.isRezkaPaddonDetailBinding(newer, h.snapshot), true);
  } finally { h.restore(); }
});
test('throwing, asynchronous or reentrant attempt guards cannot authorize a send', async () => {
  for (const kind of ['throw', 'async-current', 'async-send', 'reentrant-close']) {
    const h = setup(); h.setTransport(async () => { throw Error('unexpected detail request'); });
    const control = { isCurrent: kind === 'throw' ? () => { throw Error('stop'); }
      : kind === 'async-current' ? async () => { throw Error('late'); } : () => true,
    canSend: kind === 'async-send' ? async () => { throw Error('late'); }
      : kind === 'reentrant-close' ? () => { h.owner.close(); return true; } : () => true,
    waitForSend: async () => {} };
    try { await assert.rejects(h.reader.readRezkaPaddonDetail(h.owner, control), e => e.name === 'RezkaScopeChanged');
      await new Promise(resolve => setImmediate(resolve)); assert.equal(h.calls(), 0); }
    finally { h.restore(); }
  }
});
test('a closed or forged view cannot read or revive an old binding under the same account', async () => {
  const h = setup(); h.setTransport(async () => response(200, async () => detail())); let notifications = 0;
  try {
    const old = await h.reader.readRezkaPaddonDetail(h.owner);
    h.reader.subscribeRezkaPaddonDetailBinding(old, () => { throw Error('view failure'); });
    h.reader.subscribeRezkaPaddonDetailBinding(old, async () => { throw Error('late view failure'); });
    const unsubscribe = h.reader.subscribeRezkaPaddonDetailBinding(old, () => { notifications++; });
    h.owner.close(); h.owner.close(); await new Promise(resolve => setImmediate(resolve)); assert.equal(notifications, 1); unsubscribe();
    assert.equal(h.reader.isRezkaPaddonDetailBinding(old, h.snapshot), false);
    await assert.rejects(h.reader.readRezkaPaddonDetail(h.owner), e => e.name === 'RezkaScopeChanged');
    await assert.rejects(h.reader.readRezkaPaddonDetail({ close() {} }), e => e.name === 'RezkaScopeChanged');
    const newer = h.newOwner(), fresh = await h.reader.readRezkaPaddonDetail(newer);
    assert.equal(h.reader.isRezkaPaddonDetailBinding(old, h.snapshot), false);
    assert.equal(h.reader.isRezkaPaddonDetailBinding(fresh, h.snapshot), true); newer.close();
  } finally { h.restore(); }
});
test('the real issued binding notifies its mounted access subscription when the view closes', async () => {
  const h = setup(); h.setTransport(async () => response(200, async () => detail())); let get, cleanup, notifications = 0;
  try {
    const binding = await h.reader.readRezkaPaddonDetail(h.owner);
    const mocks = { react: { useCallback: fn => fn, useRef: value => ({ current: value }),
      useSyncExternalStore: (subscribe, read) => { get = read; cleanup = subscribe(() => { notifications++; }); return read(); } },
    '../auth': { registerSessionResetHook: () => () => {}, subscribeSessionWitness: () => () => {} },
    '../shared/appRoutes': { appRoutes: { apparatusPaddonDetail: '/detail' }, canOpenRoute: () => true },
    './rezkaSessionGuard': { isRezkaSessionCurrent: () => true }, './rezkaPaddonDetailRead': h.reader };
    const filename = path.resolve(__dirname, '../src/rezka/useRezkaPaddonDetailAccess.ts'), mod = new Module(filename, module);
    mod.filename = filename; mod.paths = module.paths; mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : id === 'expo/fetch' ? require('./support/expoFetch.cjs') : require(id);
    mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
    assert.equal(mod.exports.useRezkaPaddonDetailAccess(h.snapshot, binding), true);
    h.owner.close(); assert.equal(notifications, 1); assert.equal(get(), false); cleanup();
  } finally { h.restore(); }
});
test('blank or unassigned inputs, inactive or non-cut catalog entries never send detail', async () => {
  for (const kind of ['blank-code', 'blank-apparatus', 'unassigned', 'inactive', 'non-cut']) {
    const h = setup(); h.setTransport(async () => { throw Error('unexpected detail request'); });
    if (kind === 'inactive') h.setCatalog([{ id: 'apparatus:default:a', name: 'A', operation: 'cut', lifecycle_state: 'retired', sort_order: 1 }]);
    if (kind === 'non-cut') h.setCatalog([{ id: 'apparatus:default:a', name: 'A', operation: 'print', lifecycle_state: 'active', sort_order: 1 }]);
    try {
      await assert.rejects(h.reader.readRezkaPaddonDetail(h.newOwner(kind === 'blank-apparatus' ? '' : kind === 'unassigned' ? 'apparatus:default:b' : 'apparatus:default:a',
        kind === 'blank-code' ? '' : 'P1')));
      assert.equal(h.calls(), 0, kind); assert.equal(h.catalogCalls(), ['inactive', 'non-cut'].includes(kind) ? 1 : 0, kind);
    } finally { h.restore(); }
  }
});
test('a mismatched returned code or apparatus is rejected rather than bound', async () => {
  for (const changed of ['code', 'apparatus']) {
    const h = setup(); h.setTransport(async () => response(200, async () => ({ ...detail(), paddon: {
      code: changed === 'code' ? 'P2' : 'P1', apparatus_id: changed === 'apparatus' ? 'apparatus:default:b' : 'apparatus:default:a' } })));
    try { await assert.rejects(h.reader.readRezkaPaddonDetail(h.owner), h.reader.RezkaPaddonDetailUnavailable);
      assert.equal(h.calls(), 1); }
    finally { h.restore(); }
  }
});
for (const loss of ['account', 'assignment', 'route']) {
  test(`${loss} loss during catalog return prevents the detail request`, async () => {
    const h = setup(); h.setTransport(async () => { throw Error('unexpected request'); });
    // Invalidate immediately after the catalog's initial guard and before the awaiting continuation.
    const pending = h.reader.readRezkaPaddonDetail(h.owner);
    if (loss === 'account') h.loseAccount(); else if (loss === 'assignment') h.loseAssignment(); else h.loseRoute();
    try { await assert.rejects(pending, e => e.name === 'RezkaScopeChanged'); assert.equal(h.calls(), 0); }
    finally { h.restore(); }
  });
}
test('401 assignment change prevents a detail retry', async () => {
  const h = setup(); h.setTransport(async () => response(401, async () => ({})));
  h.setRefresh(() => { h.loseAssignment(); return true; });
  try { await assert.rejects(h.reader.readRezkaPaddonDetail(h.owner), e => e.name === 'RezkaScopeChanged');
    assert.equal(h.calls(), 1); }
  finally { h.restore(); }
});
test('closing the original view during 401 refresh prevents a detail retry', async () => {
  const h = setup(); h.setTransport(async () => response(401, async () => ({})));
  h.setRefresh(() => { h.owner.close(); return true; });
  try { await assert.rejects(h.reader.readRezkaPaddonDetail(h.owner), e => e.name === 'RezkaScopeChanged');
    assert.equal(h.calls(), 1); }
  finally { h.restore(); }
});
test('same-scope token refresh permits the guarded detail retry', async () => {
  const h = setup(); let attempts = 0;
  h.setTransport(async () => ++attempts === 1 ? response(401, async () => ({})) : response(200, async () => detail()));
  h.setRefresh(() => { h.session.token = 'refreshed'; return true; });
  try { const binding = await h.reader.readRezkaPaddonDetail(h.owner);
    assert.equal(h.reader.isRezkaPaddonDetailBinding(binding, h.snapshot), true); assert.equal(h.calls(), 2); }
  finally { h.restore(); }
});
test('a throwing or asynchronous optional guard cannot dispatch a detail request', async () => {
  const h = setup(), expected = new TypeError('stop'); let checks = 0;
  h.setTransport(async () => { throw Error('unexpected fetch'); });
  try {
    await assert.rejects(h.shared.adminPaddonDetail(h.session, 'P1', { beforeSend: () => { checks++; throw expected; } }), e => e === expected);
    assert.equal(checks, 1);
    for (const beforeSend of [async () => {}, async () => { throw Error('late'); }, () => false])
      await assert.rejects(h.shared.adminPaddonDetail(h.session, 'P1', { beforeSend }), /guard must be synchronous/);
    await new Promise(resolve => setImmediate(resolve)); assert.equal(h.calls(), 0);
  } finally { h.restore(); }
});
for (const result of ['success', 'server-error', 'bad-json']) for (const loss of ['account', 'assignment', 'route', 'view']) {
  test(`${loss} change during ${result} body decoding never publishes detail or stale error`, async () => {
    const h = setup(); let release, entered; const parsing = new Promise(resolve => { entered = resolve; });
    h.setTransport(async () => response(result === 'server-error' ? 500 : 200, () => {
      entered(); return new Promise((resolve, reject) => { release = () => result === 'bad-json' ? reject(new SyntaxError('bad body'))
        : resolve(result === 'success' ? detail() : { error: 'old account' }); });
    }));
    try {
      const pending = h.reader.readRezkaPaddonDetail(h.owner); await parsing;
      if (loss === 'account') h.loseAccount(); else if (loss === 'assignment') h.loseAssignment();
      else if (loss === 'route') h.loseRoute(); else h.owner.close();
      release();
      await assert.rejects(pending, e => e.name === 'RezkaScopeChanged' && e.mayHaveExecuted === false); assert.equal(h.calls(), 1);
    } finally { h.restore(); }
  });
}
test('unchanged witness preserves server and malformed-body failures', async () => {
  for (const result of ['server-error', 'bad-json']) {
    const h = setup(); h.setTransport(async () => response(result === 'server-error' ? 500 : 200,
      async () => { if (result === 'bad-json') throw new SyntaxError('bad body'); return { error: 'failure' }; }));
    try { await assert.rejects(h.reader.readRezkaPaddonDetail(h.owner),
      result === 'bad-json' ? /bad body/ : /server error/); }
    finally { h.restore(); }
  }
});
