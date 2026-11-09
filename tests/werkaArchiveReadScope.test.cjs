// Real authorizedFetch control flow with fake accounts and local fetch doubles. No network is contacted.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const base = path.resolve(__dirname, '../src');
const fakeSession = ref => ({ baseUrl: 'https://example.invalid', token: `fake-${ref}`, profile: { role: 'werka', ref },
  capabilities: ['werka.access'], assigned_apparatus: [], assigned_item_groups: [], assigned_warehouses: [] });
function setup(onRefresh) {
  let active = fakeSession('A'), refreshes = 0, epoch = 0;
  const auth = { currentSession: () => active, activeSessionEpoch: session => session === active ? epoch : null,
    activeSessionToken: session => session === active ? session.token : null,
    refreshSession: async session => { refreshes++; onRefresh?.(session); return true; } };
  const cache = new Map();
  function load(file) {
    const filename = path.resolve(file.endsWith('.ts') ? file : `${file}.ts`);
    if (cache.has(filename)) return cache.get(filename);
    const loaded = new Module(filename); loaded.filename = filename; loaded.paths = require.main.paths; cache.set(filename, loaded.exports);
    loaded.require = name => name === '../auth' || name === './auth' ? auth
      : name.startsWith('.') ? load(path.resolve(path.dirname(filename), name)) : name === 'expo/fetch' ? require('./support/expoFetch.cjs') : require(name);
    loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
    cache.set(filename, loaded.exports); return loaded.exports;
  }
  return { get session() { return active; }, switchTo: value => { active = value; }, advanceEpoch: () => { epoch++; },
    get refreshes() { return refreshes; }, api: load(`${base}/werka/werkaArchiveApi.ts`) };
}
const query = { kind: 'sent', period: 'yearly' };
const validArchive = { kind: 'sent', period: 'yearly', summary: { record_count: 1 }, items: [{ id: 'one' }] };
const invoke = (h, kind) => kind === 'archive' ? h.api.werkaArchive(h.session, query) : h.api.downloadWerkaArchivePdf(h.session, query);
const scopeError = error => error.code === 'session_scope_changed';

test('missing permission prevents either archive read from making its first send', async () => {
  const saved = globalThis.fetch;
  try {
    for (const kind of ['archive', 'pdf']) {
      const h = setup(); let sends = 0; h.session.capabilities = [];
      globalThis.fetch = async () => { sends++; return new Response('{}'); };
      await assert.rejects(invoke(h, kind), scopeError); assert.equal(sends, 0);
    }
  } finally { globalThis.fetch = saved; }
});

test('401 refresh changing permission, role or epoch cannot retry either read', async () => {
  const saved = globalThis.fetch;
  try {
    for (const kind of ['archive', 'pdf']) for (const change of ['permission', 'role', 'epoch']) {
      let h, sends = 0;
      h = setup(session => { if (change === 'permission') session.capabilities = [];
        else if (change === 'role') session.profile.role = 'customer'; else h.advanceEpoch(); });
      globalThis.fetch = async () => { sends++; return new Response('{}', { status: 401 }); };
      await assert.rejects(invoke(h, kind), scopeError); assert.equal(sends, 1); assert.equal(h.refreshes, 1);
    }
  } finally { globalThis.fetch = saved; }
});

test('same-scope 401 refresh may retry and decode archive or PDF', async () => {
  const saved = globalThis.fetch;
  try {
    for (const kind of ['archive', 'pdf']) {
      const h = setup(session => { session.token = 'fake-refreshed'; }), headers = [];
      globalThis.fetch = async (_url, init) => {
        headers.push(new Headers(init.headers).get('authorization'));
        if (headers.length === 1) return new Response('{}', { status: 401 });
        return kind === 'archive' ? new Response(JSON.stringify(validArchive))
          : new Response(new Uint8Array([37, 80, 68, 70]), { headers: { 'content-type': 'application/pdf' } });
      };
      const result = await invoke(h, kind);
      assert.deepEqual(headers, ['Bearer fake-A', 'Bearer fake-refreshed']);
      if (kind === 'archive') assert.equal(result.items[0].id, 'one');
      else assert.deepEqual([...result.bytes], [37, 80, 68, 70]);
    }
  } finally { globalThis.fetch = saved; }
});

test('account, permission or epoch change during body decoding suppresses both results', async () => {
  const saved = globalThis.fetch;
  try {
    for (const kind of ['archive', 'pdf']) for (const change of ['account', 'permission', 'epoch']) {
      const h = setup(); let release, signal;
      const started = new Promise(resolve => { signal = resolve; });
      const body = new Promise(resolve => { release = resolve; });
      const response = { status: 200, headers: new Headers(), json: () => { signal(); return body; },
        arrayBuffer: () => { signal(); return body; } };
      globalThis.fetch = async () => response;
      const pending = invoke(h, kind); await started;
      if (change === 'account') h.switchTo(fakeSession('B'));
      else if (change === 'permission') h.session.capabilities = []; else h.advanceEpoch();
      release(kind === 'archive' ? validArchive : new Uint8Array([37, 80]).buffer);
      await assert.rejects(pending, scopeError);
    }
  } finally { globalThis.fetch = saved; }
});

test('scope changes during synchronous archive projection override even a thrown parse error', async () => {
  const saved = globalThis.fetch;
  try {
    for (const throws of [false, true]) {
      const h = setup(), value = { ...validArchive };
      Object.defineProperty(value, 'kind', { get() { h.advanceEpoch(); if (throws) throw Error('old parse'); return 'sent'; } });
      globalThis.fetch = async () => ({ status: 200, json: async () => value });
      await assert.rejects(h.api.werkaArchive(h.session, query), scopeError);
    }
  } finally { globalThis.fetch = saved; }
});

test('scope change while reading PDF headers prevents the body from being consumed', async () => {
  const saved = globalThis.fetch, h = setup(); let reads = 0;
  try {
    globalThis.fetch = async () => ({ status: 200, headers: { get: () => { h.advanceEpoch(); return null; } },
      arrayBuffer: async () => { reads++; return new Uint8Array([1]).buffer; } });
    await assert.rejects(h.api.downloadWerkaArchivePdf(h.session, query), scopeError); assert.equal(reads, 0);
  } finally { globalThis.fetch = saved; }
});

test('scope changes during rejected body reads override the old read error', async () => {
  const saved = globalThis.fetch;
  try {
    for (const kind of ['archive', 'pdf']) {
      const h = setup(); let reject, signal;
      const started = new Promise(resolve => { signal = resolve; });
      const body = new Promise((_, fail) => { reject = fail; });
      globalThis.fetch = async () => ({ status: 200, headers: new Headers(),
        json: () => { signal(); return body; }, arrayBuffer: () => { signal(); return body; } });
      const pending = invoke(h, kind); await started; h.advanceEpoch(); reject(Error('old body'));
      await assert.rejects(pending, scopeError);
    }
  } finally { globalThis.fetch = saved; }
});

test('scope changes during a rejected request override the old network error', async () => {
  const saved = globalThis.fetch;
  try {
    for (const kind of ['archive', 'pdf']) {
      const h = setup(); let reject, signal;
      const started = new Promise(resolve => { signal = resolve; });
      globalThis.fetch = () => { signal(); return new Promise((_, fail) => { reject = fail; }); };
      const pending = invoke(h, kind); await started; h.advanceEpoch(); reject(Error('old network error'));
      await assert.rejects(pending, scopeError);
    }
  } finally { globalThis.fetch = saved; }
});

test('scope change during a throwing PDF header read overrides the old header error', async () => {
  const saved = globalThis.fetch, h = setup();
  try {
    globalThis.fetch = async () => ({ status: 200, headers: { get: () => { h.advanceEpoch(); throw Error('old header'); } } });
    await assert.rejects(h.api.downloadWerkaArchivePdf(h.session, query), scopeError);
  } finally { globalThis.fetch = saved; }
});
