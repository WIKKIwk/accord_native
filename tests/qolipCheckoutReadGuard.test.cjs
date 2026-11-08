const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const tick = () => new Promise(resolve => setImmediate(resolve));
function harness(refresh = async () => false) {
  const root = path.resolve(__dirname, '../src'), cache = new Map(), account = { token: 'local-token', baseUrl: 'https://example.test', profile: { ref: 'A' } };
  let active = account;
  const overrides = { 'auth.ts': { activeSessionToken: value => value === active ? value.token : null, refreshSession: refresh },
    'sessionReadScope.ts': { sessionReadScope: () => 'scope' },
    'shared/qolipCatalogRuntime.ts': { qolipCatalogRuntimeFor: () => ({ invalidateDetails() {} }) } };
  function load(name) {
    name = name.replaceAll('\\', '/'); if (name in overrides) return overrides[name];
    if (cache.has(name)) return cache.get(name).exports;
    const filename = path.join(root, name), loaded = new Module(filename, module); cache.set(name, loaded);
    loaded.require = target => target.startsWith('.') ? load(`${path.relative(root, path.resolve(path.dirname(filename), target))}.ts`) : require(target);
    loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ESNext } }).outputText, filename);
    return loaded.exports;
  }
  return { account, read: load('qolip/qolipCheckoutApi.ts').qolipCheckouts, load, setActive: value => { active = value; } };
}
const json = (body, status = 200) => new Response(JSON.stringify(body), { status });

test('guarded checkout GET preserves V2 query and uses existing initial and 401-retry transport guards', async t => {
  const h = harness(async () => { h.account.token = 'refreshed'; return true; }); let calls = 0, checks = 0;
  const previous = global.fetch; t.after(() => { global.fetch = previous; });
  global.fetch = async (url, init) => { calls++; assert.equal(url, 'https://example.test/v1/mobile/qolip/checkouts?status=open&limit=200');
    assert.equal(init.redirect, 'manual'); assert.equal(init.credentials, 'omit');
    return calls === 1 ? json({}, 401) : json({ checkouts: [{ id: '1', status: 'open' }] }); };
  const rows = await h.read(h.account, { status: 'open', limit: 200 }, () => { checks++; return true; });
  assert.equal(rows[0].id, '1'); assert.equal(calls, 2); assert.ok(checks >= 7);
});

test('invalidation during asynchronous setup or 401 refresh prevents the initial or retry dispatch', async t => {
  let current = true, calls = 0; const refresh = deferred(), h = harness(() => refresh.promise);
  const previous = global.fetch; t.after(() => { global.fetch = previous; });
  global.fetch = async () => { calls++; return json({}, 401); };
  const setup = h.read(h.account, {}, () => current); current = false;
  await assert.rejects(setup, /qolip_read_expired/); assert.equal(calls, 0);
  current = true; const retry = h.read(h.account, {}, () => current); await tick(); assert.equal(calls, 1);
  current = false; h.account.token = 'refreshed'; refresh.resolve(true);
  await assert.rejects(retry, /qolip_read_expired/); assert.equal(calls, 1);
});

test('test token introduced during refresh is rejected before a 401 retry', async t => {
  const h = harness(async () => { h.account.token = 'test-mode-token'; return true; }); let calls = 0;
  const previous = global.fetch; t.after(() => { global.fetch = previous; }); global.fetch = async () => { calls++; return json({}, 401); };
  await assert.rejects(h.read(h.account, {}, () => true), /test mode is not yet ported/); assert.equal(calls, 1);
});

test('response, error JSON, success JSON and parsed field invalidation cannot expose stale data', async () => {
  for (const stage of ['response', 'status', 'error', 'json', 'field', 'list']) {
    let current = true, reads = 0; const pending = deferred(), account = { token: 'x' };
    // Use an isolated API with a controlled existing transport, so no native request or backend is involved.
    const root = path.resolve(__dirname, '../src'), cache = new Map();
    const overrides = { 'auth.ts': { activeSessionToken: value => value.token }, 'sessionReadScope.ts': { sessionReadScope: () => 'scope' },
      'shared/qolipCatalogRuntime.ts': { qolipCatalogRuntimeFor: () => ({ invalidateDetails() {} }) },
      'authorizedFetch.ts': { authorizedFetch: async (_s, _p, _i, beforeSend) => { beforeSend();
        if (stage === 'response') return pending.promise;
        if (stage === 'status') return { get status() { current = false; return 200; }, json: async () => { reads++; return {}; } };
        if (stage === 'error') return { status: 409, json: async () => { reads++; return pending.promise; } };
        if (stage === 'json') return { status: 200, json: async () => { reads++; return pending.promise; } };
        const payload = stage === 'field' ? { checkouts: [{ get id() { current = false; return 'private'; } }] }
          : { get checkouts() { current = false; return null; } };
        return { status: 200, json: async () => payload };
      } } };
    function load(name) {
      name = name.replaceAll('\\', '/'); if (name in overrides) return overrides[name]; if (cache.has(name)) return cache.get(name).exports;
      const filename = path.join(root, name), module = new Module(filename); cache.set(name, module);
      module.require = target => target.startsWith('.') ? load(`${path.relative(root, path.resolve(path.dirname(filename), target))}.ts`) : require(target);
      module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ESNext } }).outputText, filename);
      return module.exports;
    }
    const read = load('qolip/qolipCheckoutApi.ts').qolipCheckouts, promise = read(account, {}, () => current);
    if (['response', 'error', 'json'].includes(stage)) {
      await tick(); current = false;
      pending.resolve(stage === 'response' ? { status: 200, json: async () => { reads++; return {}; } } : { checkouts: [] });
    }
    await assert.rejects(promise, /qolip_read_expired/, stage);
    if (stage === 'response' || stage === 'status') assert.equal(reads, 0);
  }
});

test('throwing, asynchronous and reentrant predicates fail closed before dispatch', async t => {
  const h = harness(); let calls = 0; const previous = global.fetch; t.after(() => { global.fetch = previous; });
  global.fetch = async () => { calls++; return json({ checkouts: [] }); };
  for (const guard of [() => false, () => { throw new Error('bad'); }, async () => true, async () => { throw new Error('async'); }]) {
    await assert.rejects(h.read(h.account, {}, guard));
  }
  const { assertQolipReadCurrent } = h.load('qolip/qolipApiCommon.ts');
  const reentrant = () => { try { assertQolipReadCurrent(reentrant); } catch {} return true; };
  await assert.rejects(h.read(h.account, {}, reentrant), /qolip_read_expired/); assert.equal(calls, 0);
});
