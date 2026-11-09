const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const tick = () => new Promise(resolve => setImmediate(resolve));
const rawSet = () => ({ set_id: 'S-1', fingerprint: 'fp', name: 'Name', warehouse: 'W', item_code: 'I', item_name: 'Product',
  members: [{ item_code: 'I', item_name: 'Product', qolip_code: 'Q-1' }], products: [] });
const json = (body, status = 200) => new Response(JSON.stringify(body), { status });
function harness(refresh = async () => false, transport) {
  const root = path.resolve(__dirname, '../src'), cache = new Map(), account = { token: 'local-token', baseUrl: 'https://example.test', profile: { ref: 'A' } };
  let active = account;
  const overrides = { 'auth.ts': { activeSessionToken: value => value === active ? value.token : null, refreshSession: refresh },
    'sessionReadScope.ts': { sessionReadScope: () => 'scope' },
    'shared/qolipCatalogRuntime.ts': { qolipCatalogRuntimeFor: () => ({ applyResponse() {} }) },
    ...(transport ? { 'authorizedFetch.ts': { authorizedFetch: transport } } : {}) };
  function load(name) {
    name = name.replaceAll('\\', '/'); if (name in overrides) return overrides[name]; if (cache.has(name)) return cache.get(name).exports;
    const filename = path.join(root, name), loaded = new Module(filename, module); cache.set(name, loaded);
    loaded.require = target => target.startsWith('.') ? load(`${path.relative(root, path.resolve(path.dirname(filename), target))}.ts`) : target === 'expo/fetch' ? require('./support/expoFetch.cjs') : require(target);
    loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ESNext } }).outputText, filename);
    return loaded.exports;
  }
  return { account, read: load('qolip/qolipSetsApi.ts').qolipManagedSets, load, setActive: value => { active = value; } };
}

test('guarded sets GET retains the source endpoint and checks before initial and 401 retry sends', async t => {
  const h = harness(async () => { h.account.token = 'refreshed'; return true; }); let calls = 0, checks = 0;
  const previous = global.fetch; t.after(() => { global.fetch = previous; });
  global.fetch = async (url, init) => { calls++; assert.equal(url, 'https://example.test/v1/mobile/qolip/sets');
    assert.equal(init.redirect, 'manual'); assert.equal(init.credentials, 'omit');
    return calls === 1 ? json({}, 401) : json({ sets: [rawSet()] }); };
  const rows = await h.read(h.account, () => { checks++; return true; });
  assert.equal(rows[0].set.id, 'S-1'); assert.equal(calls, 2); assert.ok(checks >= 7);
});

test('invalidation during setup or refresh prevents the initial or 401 retry send', async t => {
  let current = true, calls = 0; const refresh = deferred(), h = harness(() => refresh.promise);
  const previous = global.fetch; t.after(() => { global.fetch = previous; }); global.fetch = async () => { calls++; return json({}, 401); };
  const setup = h.read(h.account, () => current); current = false;
  await assert.rejects(setup, /qolip_read_expired/); assert.equal(calls, 0);
  current = true; const retry = h.read(h.account, () => current); await tick(); assert.equal(calls, 1);
  current = false; h.account.token = 'refreshed'; refresh.resolve(true);
  await assert.rejects(retry, /qolip_read_expired/); assert.equal(calls, 1);
});

test('test token introduced by a refresh cannot be used for a retry', async t => {
  const h = harness(async () => { h.account.token = 'test-mode-token'; return true; }); let calls = 0;
  const previous = global.fetch; t.after(() => { global.fetch = previous; }); global.fetch = async () => { calls++; return json({}, 401); };
  await assert.rejects(h.read(h.account, () => true), /test mode is not yet ported/); assert.equal(calls, 1);
});

test('invalidated response, status, error, JSON, list and parsed fields never expose stale sets', async () => {
  for (const stage of ['response', 'status', 'error', 'json', 'list', 'field']) {
    let current = true, reads = 0; const pending = deferred();
    const h = harness(undefined, async (_s, _p, _i, beforeSend) => {
      beforeSend();
      if (stage === 'response') return pending.promise;
      if (stage === 'status') return { get status() { current = false; return 200; }, json: async () => { reads++; return {}; } };
      if (stage === 'error' || stage === 'json') return { status: stage === 'error' ? 409 : 200, json: async () => { reads++; return pending.promise; } };
      const item = rawSet();
      if (stage === 'field') Object.defineProperty(item, 'set_id', { get() { current = false; return 'private'; } });
      const payload = stage === 'list' ? { get sets() { current = false; return []; } } : { sets: [item] };
      return { status: 200, json: async () => payload };
    });
    const promise = h.read(h.account, () => current);
    if (['response', 'error', 'json'].includes(stage)) {
      await tick(); current = false;
      pending.resolve(stage === 'response' ? { status: 200, json: async () => { reads++; return { sets: [] }; } } : { sets: [] });
    }
    await assert.rejects(promise, /qolip_read_expired/, stage);
    if (stage === 'response' || stage === 'status') assert.equal(reads, 0);
  }
});

test('throwing, asynchronous and reentrant guards fail closed before dispatch', async t => {
  const h = harness(); let calls = 0; const previous = global.fetch; t.after(() => { global.fetch = previous; });
  global.fetch = async () => { calls++; return json({ sets: [] }); };
  for (const guard of [() => false, () => { throw new Error('bad'); }, async () => true, async () => { throw new Error('async'); }]) {
    await assert.rejects(h.read(h.account, guard));
  }
  const { assertQolipReadCurrent } = h.load('qolip/qolipApiCommon.ts');
  const reentrant = () => { try { assertQolipReadCurrent(reentrant); } catch {} return true; };
  await assert.rejects(h.read(h.account, reentrant), /qolip_read_expired/); assert.equal(calls, 0);
});
