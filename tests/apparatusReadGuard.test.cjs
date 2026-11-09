const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
function compile(name, mocks = {}) {
  const filename = path.resolve(__dirname, `../src/${name}.ts`), loaded = new Module(filename, module);
  loaded.filename = filename; loaded.paths = module.paths;
  loaded.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return loaded.exports;
}
function setup(change) {
  const session = { token: 'old', baseUrl: 'https://example.test', profile: { role: 'admin', ref: 'one' },
    capabilities: ['admin.access'], assigned_apparatus: [] };
  let active = true, calls = 0, guards = 0;
  const scope = compile('sessionReadScope'), initialScope = scope.sessionReadScope(session);
  const auth = { activeSessionToken: value => active && value === session ? session.token : null, refreshSession: async () => {
    session.token = 'new';
    if (change === 'role') session.profile.role = 'werka';
    if (change === 'capability') session.capabilities = [];
    if (change === 'identity') session.profile.ref = 'other';
    if (change === 'account') active = false;
    return true;
  } };
  const authorized = compile('authorizedFetch', { './auth': auth });
  const controls = compile('workerControlsApi', { './authorizedFetch': authorized, './sessionReadScope': scope });
  const apparatus = compile('apparatusApi', { './authorizedFetch': authorized, './workerControlsApi': controls });
  const original = global.fetch;
  global.fetch = async () => { calls++; return new Response(calls === 1 ? '{"error":"expired"}' : '[]',
    { status: calls === 1 ? 401 : 200, headers: { 'content-type': 'application/json' } }); };
  const guard = () => { guards++; if (!active || scope.sessionReadScope(session) !== initialScope) throw Error('Sessiya o‘zgardi'); };
  return { session, apparatus, guard, counts: () => ({ calls, guards }), restore: () => { global.fetch = original; } };
}
for (const change of ['role', 'capability', 'identity', 'account']) {
  test(`apparatus read does not retry a 401 after ${change} changes`, async () => {
    const h = setup(change);
    try { await assert.rejects(h.apparatus.adminApparatus(h.session, { beforeSend: h.guard })); assert.equal(h.counts().calls, 1); }
    finally { h.restore(); }
  });
}
test('apparatus read permits a token-only refresh and checks before both sends', async () => {
  const h = setup('none');
  try { assert.deepEqual(await h.apparatus.adminApparatus(h.session, { beforeSend: h.guard }), []);
    assert.deepEqual(h.counts(), { calls: 2, guards: 2 }); }
  finally { h.restore(); }
});
test('a guard TypeError is preserved and is never retried as a transient network error', async () => {
  const h = setup('none'), error = new TypeError('scope invalid'); let guards = 0;
  try { await assert.rejects(h.apparatus.readApparatus(h.session, '/v1/mobile/admin/apparatus', true, undefined,
    () => { guards++; throw error; }), value => value === error); assert.equal(guards, 1); assert.equal(h.counts().calls, 0); }
  finally { h.restore(); }
});
test('legacy apparatus readers keep their original authorizedFetch call shape', async () => {
  const lengths = [], authorized = { authorizedFetch: async (...args) => { lengths.push(args.length); return new Response('[]', { status: 200 }); } };
  const controls = { isCanonicalApparatusId: () => true, WorkerControlException: class extends Error {} };
  const apparatus = compile('apparatusApi', { './authorizedFetch': authorized, './workerControlsApi': controls });
  assert.deepEqual(await apparatus.adminApparatus({}), []); assert.deepEqual(lengths, [3]);
});

test('a changed scope blocks a transient-status retry before a second request', async () => {
  const h = setup('none'); let requests = 0;
  global.fetch = async () => { requests++; h.session.capabilities = []; return new Response('temporary', { status: 503 }); };
  try { await assert.rejects(h.apparatus.adminApparatus(h.session, { retryTransient: true, beforeSend: h.guard }));
    assert.equal(requests, 1); assert.equal(h.counts().guards, 2); }
  finally { h.restore(); }
});

test('legacy abort remains terminal and does not retry the request', async () => {
  let calls = 0; const abort = new AbortController();
  const authorized = { authorizedFetch: async (_session, _path, init) => {
    calls++; return new Promise((_resolve, reject) => {
      if (init.signal.aborted) return reject(new Error('aborted'));
      init.signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
    });
  } };
  const controls = { isCanonicalApparatusId: () => true, WorkerControlException: class extends Error {} };
  const api = compile('apparatusApi', { './authorizedFetch': authorized, './workerControlsApi': controls });
  const pending = api.readApparatus({}, '/v1/mobile/admin/apparatus', true, abort.signal);
  abort.abort(); await assert.rejects(pending, /aborted/); assert.equal(calls, 1);
});
