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
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
function setup(implementation) {
  const session = { token: 'dummy-token', baseUrl: 'https://example.test', profile: { role: 'admin', ref: 'one' },
    capabilities: ['admin.access'], assigned_apparatus: [] };
  let active = session, epoch = 0, allowed = true, checks = 0, loads = 0;
  const calls = [], scope = compile('sessionReadScope');
  const auth = { activeSessionToken: value => value === active ? value.token : null,
    activeSessionEpoch: value => value === active ? epoch : null };
  const expo = { fetch: async (url, options) => { calls.push({ url, options }); const response = await implementation(url, options, calls.length);
    if (!response.url) Object.defineProperty(response, 'url', { value: url, configurable: true }); return response; } };
  const transport = compile('shared/scopedReadTransport', { '../auth': auth, '../sessionReadScope': scope,
    'expo/fetch': expo });
  return { session, calls, transport, opts: { isCurrent: () => { checks++; return allowed; } },
    changeEpoch: () => { epoch++; }, changeAccount: () => { active = null; }, deny: () => { allowed = false; },
    checks: () => checks, countLoad: () => loads++ };
}
test('opt-in direct GET explicitly uses Expo fetch, manual redirects and no cookies', async () => {
  const h = setup(async () => new Response('{"ok":true}', { status: 200 })), old = global.fetch;
  global.fetch = async () => { throw Error('global fetch must not be used'); };
  try {
    const response = await h.transport.scopedRead(h.session, '/v1/mobile/example', h.opts);
    assert.deepEqual(await response.json(), { ok: true }); assert.equal(h.calls.length, 1);
    const call = h.calls[0]; assert.equal(call.url, 'https://example.test/v1/mobile/example');
    assert.equal(call.options.method, 'GET'); assert.equal(call.options.redirect, 'manual');
    assert.equal(call.options.credentials, 'omit'); assert.equal(call.options.headers.Authorization, 'Bearer dummy-token');
    assert.ok(h.checks() >= 3);
  } finally { global.fetch = old; }
});

test('same-origin redirects are checked at every hop before sending', async () => {
  const h = setup(async (_url, _init, count) => count === 1
    ? new Response(null, { status: 302, headers: { location: '/v1/mobile/next?x=1' } })
    : new Response('ok', { status: 200 }));
  assert.equal(await (await h.transport.scopedRead(h.session, '/v1/mobile/start', h.opts)).text(), 'ok');
  assert.deepEqual(h.calls.map(x => x.url), ['https://example.test/v1/mobile/start', 'https://example.test/v1/mobile/next?x=1']);
  assert.ok(h.checks() >= 5);
});
for (const location of ['https://other.test/v1/mobile/leak', 'http://example.test/v1/mobile/leak',
  'https://user:password@example.test/v1/mobile/leak', '/outside-mobile', 'https://other.test/?token=dummy']) {
  test(`redirect outside the allowed origin/path is rejected before a second request: ${location.replace(/password|dummy/g, 'redacted')}`, async () => {
    const h = setup(async () => new Response(null, { status: 307, headers: { location } }));
    await assert.rejects(h.transport.scopedRead(h.session, '/v1/mobile/start', h.opts), /redirect/);
    assert.equal(h.calls.length, 1); assert.equal(new URL(h.calls[0].url).origin, h.session.baseUrl);
  });
}
test('invalid initial URLs and inactive sessions make no network request', async () => {
  for (const path of ['https://other.test/v1/mobile/x', 'http://example.test/v1/mobile/x', '/outside', '/v1/mobile/x#fragment']) {
    const h = setup(async () => new Response('ok')); await assert.rejects(h.transport.scopedRead(h.session, path, h.opts));
    assert.equal(h.calls.length, 0);
  }
  const h = setup(async () => new Response('ok')); h.changeAccount();
  await assert.rejects(h.transport.scopedRead(h.session, '/v1/mobile/x', h.opts)); assert.equal(h.calls.length, 0);
});
test('a 401 is returned without refreshing login credentials or sending a second request', async () => {
  const h = setup(async () => new Response('expired', { status: 401 }));
  const response = await h.transport.scopedRead(h.session, '/v1/mobile/x', h.opts);
  assert.equal(response.status, 401); assert.equal(h.calls.length, 1);
});
for (const change of ['role', 'capability', 'identity', 'token', 'epoch', 'account', 'caller']) {
  test(`${change} change during the first hop blocks the next redirect`, async () => {
    let h; h = setup(async () => {
      if (change === 'role') h.session.profile.role = 'werka';
      if (change === 'capability') h.session.capabilities = [];
      if (change === 'identity') h.session.profile.ref = 'other';
      if (change === 'token') h.session.token = 'new';
      if (change === 'epoch') h.changeEpoch();
      if (change === 'account') h.changeAccount();
      if (change === 'caller') h.deny();
      return new Response(null, { status: 302, headers: { location: '/v1/mobile/next' } });
    });
    await assert.rejects(h.transport.scopedRead(h.session, '/v1/mobile/start', h.opts)); assert.equal(h.calls.length, 1);
  });
}
test('scope change while buffering a response rejects its stale result', async () => {
  const buffer = deferred(); let h;
  h = setup(async () => ({ status: 200, headers: new Headers(), clone: () => ({ arrayBuffer: () => buffer.promise }) }));
  const pending = h.transport.scopedRead(h.session, '/v1/mobile/start', h.opts);
  while (!h.calls.length) await new Promise(resolve => setImmediate(resolve));
  h.changeEpoch(); buffer.resolve(new ArrayBuffer(0)); await assert.rejects(pending); assert.equal(h.calls.length, 1);
});
for (const cancellation of ['timeout', 'abort']) {
  test(`${cancellation} prevents a late response from sending a redirected request`, async () => {
    const first = deferred(), h = setup(() => first.promise), controller = new AbortController();
    const pending = h.transport.scopedRead(h.session, '/v1/mobile/start', { ...h.opts, signal: controller.signal,
      timeoutMs: cancellation === 'timeout' ? 10 : 1000 });
    while (!h.calls.length) await new Promise(resolve => setImmediate(resolve));
    if (cancellation === 'abort') controller.abort();
    await assert.rejects(pending, cancellation === 'abort' ? /cancelled/ : /timed out/);
    first.resolve(new Response(null, { status: 302, headers: { location: '/v1/mobile/next' } }));
    await new Promise(resolve => setTimeout(resolve, 20)); assert.equal(h.calls.length, 1);
  });
}
test('caller guard must return true synchronously and epoch zero is valid', async () => {
  const h = setup(async () => new Response('ok'));
  await assert.rejects(h.transport.scopedRead(h.session, '/v1/mobile/x', { isCurrent: () => false }));
  assert.equal(h.calls.length, 0);
  assert.equal((await h.transport.scopedRead(h.session, '/v1/mobile/x', h.opts)).status, 200);
});


test('an unexpectedly different response URL is rejected, though post-response detection cannot undo a native leak', async () => {
  const h = setup(async () => { const response = new Response('body');
    Object.defineProperty(response, 'url', { value: 'https://other.test/v1/mobile/x' }); return response; });
  await assert.rejects(h.transport.scopedRead(h.session, '/v1/mobile/x', h.opts), /javob manzili/); assert.equal(h.calls.length, 1);
});

test('redirect limit and a pre-aborted request fail closed', async () => {
  const h = setup(async () => new Response(null, { status: 302, headers: { location: '/v1/mobile/again' } }));
  await assert.rejects(h.transport.scopedRead(h.session, '/v1/mobile/start', h.opts), /Too many/); assert.equal(h.calls.length, 6);
  const stopped = setup(async () => new Response('ok')), signal = new AbortController(); signal.abort();
  await assert.rejects(stopped.transport.scopedRead(stopped.session, '/v1/mobile/x', { ...stopped.opts, signal: signal.signal }));
  assert.equal(stopped.calls.length, 0);
});

test('an asynchronous caller guard is rejected instead of silently trusted', async () => {
  const h = setup(async () => new Response('ok'));
  await assert.rejects(h.transport.scopedRead(h.session, '/v1/mobile/x', { isCurrent: async () => true })); assert.equal(h.calls.length, 0);
});

test('a synchronous caller callback cannot mutate scope during the last check and still send', async () => {
  const h = setup(async () => new Response('ok')); let checks = 0;
  await assert.rejects(h.transport.scopedRead(h.session, '/v1/mobile/x', { isCurrent: () => {
    if (++checks === 3) h.session.capabilities = []; return true;
  } }));
  assert.equal(h.calls.length, 0);
});

test('an accidentally rejected async caller guard fails closed without an unhandled rejection', async () => {
  const h = setup(async () => new Response('ok'));
  await assert.rejects(h.transport.scopedRead(h.session, '/v1/mobile/x', { isCurrent: async () => { throw Error('async guard'); } }));
  await new Promise(resolve => setImmediate(resolve)); assert.equal(h.calls.length, 0);
});

test('encoded slash, backslash and double-encoded path segments fail before any redirected send', async () => {
  for (const encoded of ['/v1/mobile/%2F..%2Fadmin', '/v1/mobile/%5c..%5cadmin', '/v1/mobile/%252F..%252Fadmin']) {
    const initial = setup(async () => new Response('ok'));
    await assert.rejects(initial.transport.scopedRead(initial.session, encoded, initial.opts)); assert.equal(initial.calls.length, 0);
    const redirected = setup(async () => new Response(null, { status: 302, headers: { location: encoded } }));
    await assert.rejects(redirected.transport.scopedRead(redirected.session, '/v1/mobile/start', redirected.opts));
    assert.equal(redirected.calls.length, 1);
  }
});

test('a mocked internal native-dispatch gap can send an old token to the trusted origin before the stale response is rejected', async () => {
  const entered = deferred(), release = deferred(), dispatched = []; let h;
  h = setup(async (url, options) => {
    entered.resolve(); await release.promise;
    dispatched.push({ origin: new URL(url).origin, authorization: options.headers.Authorization });
    return new Response('ok');
  });
  const pending = h.transport.scopedRead(h.session, '/v1/mobile/start', h.opts);
  await entered.promise; h.changeEpoch(); release.resolve();
  await assert.rejects(pending); assert.deepEqual(dispatched, [{ origin: 'https://example.test', authorization: 'Bearer dummy-token' }]);
});
