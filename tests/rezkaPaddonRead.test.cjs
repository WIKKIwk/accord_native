// Uses the real role witness guard, shared list reader and authorized-fetch code with mocked transport.
const assert = require('node:assert/strict'), fs = require('node:fs'), Module = require('node:module');
const path = require('node:path'), test = require('node:test'), ts = require('typescript');
function setup() {
  const session = { token: 'token', baseUrl: 'https://example.test', profile: { role: 'rezka_master', ref: 'master' },
    capabilities: ['rezka.master.access'], assigned_apparatus: ['apparatus:default:a'] };
  let active = true, route = true, refresh = () => true, calls = 0, transport;
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
        appRoutes: { apparatusPaddons: '/apparatus-paddons', adminWorkerSettings: '/workers' }, canOpenRoute: () => route };
      if (id === './workerControlsApi') return { productionMapResponseError: () => Error('server error'), WorkerControlException: class extends Error {} };
      if (id === './paddonModels') return { paddonFromJson: value => value, paddonSnapshotFromJson: value => value };
      return id.startsWith('.') ? load(path.relative(path.resolve(__dirname, '../src'), path.resolve(path.dirname(file), id))) : require(id);
    };
    mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, file);
    return mod.exports;
  }
  const guard = load('rezka/rezkaSessionGuard'), reader = load('rezka/rezkaPaddonRead'), snapshot = guard.captureRezkaSession(session);
  const original = global.fetch;
  global.fetch = async (...args) => { calls++; return transport(...args); };
  return { session, snapshot, reader, calls: () => calls, setTransport: fn => { transport = fn; },
    setRefresh: fn => { refresh = fn; }, loseAccount: () => { active = false; }, loseRoute: () => { route = false; },
    loseAssignment: () => { session.assigned_apparatus = ['apparatus:default:b']; },
    restore: () => { global.fetch = original; } };
}
const response = (status, json) => ({ status, headers: new Headers(), body: null, json });
test('only the captured assigned apparatus may be requested, and the query uses the existing list reader', async () => {
  const h = setup(); let requested;
  h.setTransport(async url => { requested = String(url); return response(200, async () => ({ paddons: [{ code: 'P1' }] })); });
  try {
    await assert.rejects(h.reader.readRezkaPaddons(h.snapshot, 'unknown'), e => e.name === 'RezkaScopeChanged');
    await assert.rejects(h.reader.readRezkaPaddons(h.snapshot, '  '), e => e.name === 'RezkaScopeChanged');
    assert.equal(h.calls(), 0);
    assert.deepEqual(await h.reader.readRezkaPaddons(h.snapshot, ' apparatus:default:a '), [{ code: 'P1' }]);
    const url = new URL(requested); assert.equal(url.pathname, '/v1/mobile/admin/production-maps/paddons');
    assert.deepEqual(Object.fromEntries(url.searchParams), { limit: '100', apparatus: 'apparatus:default:a' });
  } finally { h.restore(); }
});
test('a 401 refresh that changes assignment cannot send a second request', async () => {
  const h = setup(); h.setTransport(async () => response(401, async () => ({})));
  h.setRefresh(() => { h.session.assigned_apparatus = ['apparatus:default:b']; return true; });
  try { await assert.rejects(h.reader.readRezkaPaddons(h.snapshot, 'apparatus:default:a'), e => e.name === 'RezkaScopeChanged');
    assert.equal(h.calls(), 1); }
  finally { h.restore(); }
});
for (const result of ['success', 'server-error', 'bad-json']) for (const loss of ['account', 'assignment', 'route']) {
  test(`${loss} change during ${result} body processing redacts data or error`, async () => {
    const h = setup(); let release, entered;
    const parsing = new Promise(resolve => { entered = resolve; });
    h.setTransport(async () => response(result === 'server-error' ? 500 : 200, () => {
      entered(); return new Promise((resolve, reject) => { release = () => result === 'bad-json' ? reject(new SyntaxError('bad body'))
        : resolve(result === 'success' ? { paddons: [{ code: 'old-account' }] } : { error: 'old-account' }); });
    }));
    try {
      const pending = h.reader.readRezkaPaddons(h.snapshot, 'apparatus:default:a'); await parsing;
      if (loss === 'account') h.loseAccount(); else if (loss === 'assignment') h.loseAssignment(); else h.loseRoute();
      release();
      await assert.rejects(pending, e => e.name === 'RezkaScopeChanged' && e.mayHaveExecuted === false);
      assert.equal(h.calls(), 1);
    } finally { h.restore(); }
  });
}
test('unchanged scope preserves an actual server or parsing failure', async () => {
  for (const result of ['server-error', 'bad-json']) {
    const h = setup(); h.setTransport(async () => response(result === 'server-error' ? 500 : 200,
      async () => { if (result === 'bad-json') throw new SyntaxError('bad body'); return { error: 'failure' }; }));
    try { await assert.rejects(h.reader.readRezkaPaddons(h.snapshot, 'apparatus:default:a'),
      result === 'bad-json' ? /bad body/ : /server error/); }
    finally { h.restore(); }
  }
});
test('lost Paddon route fails before transport', async () => {
  const h = setup(); h.loseRoute();
  try { await assert.rejects(h.reader.readRezkaPaddons(h.snapshot, 'apparatus:default:a'), e => e.name === 'RezkaScopeChanged');
    assert.equal(h.calls(), 0); }
  finally { h.restore(); }
});
