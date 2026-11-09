// Tests the existing shared Paddon list reader with the real authorized-fetch retry machinery.
// Every transport here is mocked; no backend is contacted.
const assert = require('node:assert/strict'), fs = require('node:fs'), Module = require('node:module');
const path = require('node:path'), test = require('node:test'), ts = require('typescript');
function compile(name, mocks = {}) {
  const filename = path.resolve(__dirname, `../src/${name}.ts`), loaded = new Module(filename, module);
  loaded.filename = filename; loaded.paths = module.paths;
  loaded.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return loaded.exports;
}
function setup(change = 'none') {
  const session = { token: 'old', baseUrl: 'https://example.test', profile: { role: 'rezka_master', ref: 'one' },
    capabilities: ['rezka.master.access'], assigned_apparatus: ['apparatus:default:a'] };
  const scope = compile('sessionReadScope'), initial = scope.sessionReadScope(session);
  let active = true, sends = 0, guards = 0;
  const auth = { activeSessionToken: value => active && value === session ? session.token : null, refreshSession: async () => {
    session.token = 'new';
    if (change === 'role') session.profile.role = 'werka';
    if (change === 'capability') session.capabilities = [];
    if (change === 'identity') session.profile.ref = 'other';
    if (change === 'assignment') session.assigned_apparatus = ['apparatus:default:b'];
    if (change === 'account') active = false;
    return true;
  } };
  const authorized = compile('authorizedFetch', { './auth': auth });
  const controls = { productionMapResponseError: () => Error('unexpected response'), WorkerControlException: class extends Error {} };
  const api = compile('paddonManagementApi', { './authorizedFetch': authorized, './workerControlsApi': controls,
    './paddonModels': { paddonFromJson: value => value, paddonSnapshotFromJson: value => value } });
  const original = global.fetch, requests = [];
  global.fetch = async (url, init) => { sends++; requests.push({ url, init });
    return new Response(sends === 1 ? '{"error":"expired"}' : '{"paddons":[]}', { status: sends === 1 ? 401 : 200 }); };
  const beforeSend = () => { guards++; if (!active || scope.sessionReadScope(session) !== initial) throw Error('stale scope'); };
  return { session, api, beforeSend, requests, counts: () => ({ sends, guards }),
    invalidate: () => { active = false; }, restore: () => { global.fetch = original; } };
}
for (const change of ['role', 'capability', 'identity', 'assignment', 'account']) {
  test(`Paddon read does not retry 401 after ${change} changes`, async () => {
    const h = setup(change);
    try { await assert.rejects(h.api.adminPaddons(h.session, { apparatus: 'apparatus:default:a', beforeSend: h.beforeSend }));
      assert.equal(h.counts().sends, 1); }
    finally { h.restore(); }
  });
}
test('same scope permits token refresh while checking the original guard before each send', async () => {
  const h = setup();
  try {
    assert.deepEqual(await h.api.adminPaddons(h.session, { apparatus: ' apparatus:default:a ', beforeSend: h.beforeSend }), []);
    assert.deepEqual(h.counts(), { sends: 2, guards: 2 });
    for (const request of h.requests) {
      const url = new URL(request.url);
      assert.equal(url.pathname, '/v1/mobile/admin/production-maps/paddons');
      assert.deepEqual(Object.fromEntries(url.searchParams), { limit: '100', apparatus: 'apparatus:default:a' });
    }
  } finally { h.restore(); }
});
test('invalid scope before dispatch sends nothing', async () => {
  const h = setup(); h.invalidate();
  try { await assert.rejects(h.api.adminPaddons(h.session, { apparatus: 'apparatus:default:a', beforeSend: h.beforeSend }));
    assert.equal(h.counts().sends, 0); }
  finally { h.restore(); }
});
test('one-shot TypeError guard is propagated once without a request or a retry', async () => {
  const h = setup(), expected = new TypeError('guard failure'); let checks = 0;
  try { await assert.rejects(h.api.adminPaddons(h.session, { beforeSend: () => { checks++; throw expected; } }), e => e === expected);
    assert.equal(checks, 1); assert.equal(h.counts().sends, 0); }
  finally { h.restore(); }
});
test('an accidentally asynchronous guard cannot authorize a send or leak a rejection', async () => {
  const h = setup();
  try {
    for (const beforeSend of [async () => {}, async () => { throw Error('late guard rejection'); }, () => false]) {
      await assert.rejects(h.api.adminPaddons(h.session, { beforeSend }), /guard must be synchronous/);
      assert.equal(h.counts().sends, 0);
    }
    await new Promise(resolve => setImmediate(resolve));
  } finally { h.restore(); }
});
test('legacy readers retain their two-argument authorizedFetch call shape', async () => {
  const calls = [], api = compile('paddonManagementApi', { './authorizedFetch': { authorizedFetch: async (...args) => {
    calls.push(args); return new Response('{"paddons":[]}', { status: 200 }); } },
  './workerControlsApi': { productionMapResponseError: () => Error(), WorkerControlException: class extends Error {} },
  './paddonModels': { paddonFromJson: value => value, paddonSnapshotFromJson: value => value } });
  assert.deepEqual(await api.adminPaddons({}, { apparatus: ' a ' }), []);
  assert.equal(calls[0].length, 2); assert.equal(calls[0][1], '/v1/mobile/admin/production-maps/paddons?limit=100&apparatus=a');
});
