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
      return id.startsWith('.') ? load(path.relative(path.resolve(__dirname, '../src'), path.resolve(path.dirname(file), id))) : require(id);
    };
    mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, file);
    return mod.exports;
  }
  const guard = load('rezka/rezkaSessionGuard'), reader = load('rezka/rezkaPaddonDetailRead'), shared = load('paddonManagementApi');
  const snapshot = guard.captureRezkaSession(session);
  const original = global.fetch; global.fetch = async (...args) => { calls++; return transport(...args); };
  return { session, snapshot, reader, shared, calls: () => calls, catalogCalls: () => catalogCalls, catalogGuard: () => catalogGuard,
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
    const binding = await h.reader.readRezkaPaddonDetail(h.snapshot, ' apparatus:default:a ', ' P1 ');
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
  try { const binding = await h.reader.readRezkaPaddonDetail(h.snapshot, 'apparatus:default:a', 'P1');
    assert.ok(Object.isFrozen(binding.data.items[0].payload_json)); assert.ok(Object.isFrozen(cursor)); }
  finally { h.restore(); }
});
test('blank or unassigned inputs, inactive or non-cut catalog entries never send detail', async () => {
  for (const kind of ['blank-code', 'blank-apparatus', 'unassigned', 'inactive', 'non-cut']) {
    const h = setup(); h.setTransport(async () => { throw Error('unexpected detail request'); });
    if (kind === 'inactive') h.setCatalog([{ id: 'apparatus:default:a', name: 'A', operation: 'cut', lifecycle_state: 'retired', sort_order: 1 }]);
    if (kind === 'non-cut') h.setCatalog([{ id: 'apparatus:default:a', name: 'A', operation: 'print', lifecycle_state: 'active', sort_order: 1 }]);
    try {
      await assert.rejects(h.reader.readRezkaPaddonDetail(h.snapshot, kind === 'blank-apparatus' ? '' : kind === 'unassigned' ? 'apparatus:default:b' : 'apparatus:default:a',
        kind === 'blank-code' ? '' : 'P1'));
      assert.equal(h.calls(), 0, kind); assert.equal(h.catalogCalls(), ['inactive', 'non-cut'].includes(kind) ? 1 : 0, kind);
    } finally { h.restore(); }
  }
});
test('a mismatched returned code or apparatus is rejected rather than bound', async () => {
  for (const changed of ['code', 'apparatus']) {
    const h = setup(); h.setTransport(async () => response(200, async () => ({ ...detail(), paddon: {
      code: changed === 'code' ? 'P2' : 'P1', apparatus_id: changed === 'apparatus' ? 'apparatus:default:b' : 'apparatus:default:a' } })));
    try { await assert.rejects(h.reader.readRezkaPaddonDetail(h.snapshot, 'apparatus:default:a', 'P1'), h.reader.RezkaPaddonDetailUnavailable);
      assert.equal(h.calls(), 1); }
    finally { h.restore(); }
  }
});
for (const loss of ['account', 'assignment', 'route']) {
  test(`${loss} loss during catalog return prevents the detail request`, async () => {
    const h = setup(); h.setTransport(async () => { throw Error('unexpected request'); });
    // Invalidate immediately after the catalog's initial guard and before the awaiting continuation.
    const pending = h.reader.readRezkaPaddonDetail(h.snapshot, 'apparatus:default:a', 'P1');
    if (loss === 'account') h.loseAccount(); else if (loss === 'assignment') h.loseAssignment(); else h.loseRoute();
    try { await assert.rejects(pending, e => e.name === 'RezkaScopeChanged'); assert.equal(h.calls(), 0); }
    finally { h.restore(); }
  });
}
test('401 assignment change prevents a detail retry', async () => {
  const h = setup(); h.setTransport(async () => response(401, async () => ({})));
  h.setRefresh(() => { h.loseAssignment(); return true; });
  try { await assert.rejects(h.reader.readRezkaPaddonDetail(h.snapshot, 'apparatus:default:a', 'P1'), e => e.name === 'RezkaScopeChanged');
    assert.equal(h.calls(), 1); }
  finally { h.restore(); }
});
test('same-scope token refresh permits the guarded detail retry', async () => {
  const h = setup(); let attempts = 0;
  h.setTransport(async () => ++attempts === 1 ? response(401, async () => ({})) : response(200, async () => detail()));
  h.setRefresh(() => { h.session.token = 'refreshed'; return true; });
  try { const binding = await h.reader.readRezkaPaddonDetail(h.snapshot, 'apparatus:default:a', 'P1');
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
for (const result of ['success', 'server-error', 'bad-json']) for (const loss of ['account', 'assignment', 'route']) {
  test(`${loss} change during ${result} body decoding never publishes detail or stale error`, async () => {
    const h = setup(); let release, entered; const parsing = new Promise(resolve => { entered = resolve; });
    h.setTransport(async () => response(result === 'server-error' ? 500 : 200, () => {
      entered(); return new Promise((resolve, reject) => { release = () => result === 'bad-json' ? reject(new SyntaxError('bad body'))
        : resolve(result === 'success' ? detail() : { error: 'old account' }); });
    }));
    try {
      const pending = h.reader.readRezkaPaddonDetail(h.snapshot, 'apparatus:default:a', 'P1'); await parsing;
      if (loss === 'account') h.loseAccount(); else if (loss === 'assignment') h.loseAssignment(); else h.loseRoute();
      release();
      await assert.rejects(pending, e => e.name === 'RezkaScopeChanged' && e.mayHaveExecuted === false); assert.equal(h.calls(), 1);
    } finally { h.restore(); }
  });
}
test('unchanged witness preserves server and malformed-body failures', async () => {
  for (const result of ['server-error', 'bad-json']) {
    const h = setup(); h.setTransport(async () => response(result === 'server-error' ? 500 : 200,
      async () => { if (result === 'bad-json') throw new SyntaxError('bad body'); return { error: 'failure' }; }));
    try { await assert.rejects(h.reader.readRezkaPaddonDetail(h.snapshot, 'apparatus:default:a', 'P1'),
      result === 'bad-json' ? /bad body/ : /server error/); }
    finally { h.restore(); }
  }
});
