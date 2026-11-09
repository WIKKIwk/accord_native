const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const test = require('node:test');
const ts = require('typescript');
const filename = path.resolve(__dirname, '../src/authorizedFetch.ts');
const mod = new Module(filename, module); mod.filename = filename; mod.paths = module.paths;
mod.require = name => name === './auth' ? { activeSessionToken: s => s.token, refreshSession: async () => false } : name === 'expo/fetch' ? require('./support/expoFetch.cjs') : require(name);
mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
const { authorizedFetch } = mod.exports;
const session = { baseUrl: 'https://example.test', token: 'token' };

test('GET follows same-origin redirects and strips credentials across origins', async () => {
  const original = global.fetch, calls = [];
  global.fetch = async (url, init) => { calls.push({ url, headers: new Headers(init.headers), redirect: init.redirect, credentials: init.credentials });
    return calls.length === 1 ? new Response(null, { status: 302, headers: { location: '/v1/mobile/next' } })
      : calls.length === 2 ? new Response(null, { status: 307, headers: { location: 'https://other.test/path' } })
        : new Response('ok'); };
  try {
    assert.equal((await authorizedFetch(session, '/v1/mobile/start', { headers: { Cookie: 'x', 'Proxy-Authorization': 'y' } })).status, 200);
    assert.equal(calls.length, 3); assert.equal(calls[0].redirect, 'manual'); assert.equal(calls[0].credentials, 'omit');
    assert.equal(calls[1].headers.get('authorization'), 'Bearer token');
    for (const header of ['authorization', 'cookie', 'proxy-authorization']) assert.equal(calls[2].headers.get(header), null);
  } finally { global.fetch = original; }
});

test('mutations do not follow redirects and unsafe destinations are rejected', async () => {
  const original = global.fetch; let calls = 0;
  global.fetch = async () => { calls++; return new Response(null, { status: 302, headers: { location: 'http://other.test/path' } }); };
  try {
    assert.equal((await authorizedFetch(session, '/v1/mobile/start', { method: 'POST' })).status, 302); assert.equal(calls, 1);
    await assert.rejects(authorizedFetch(session, '/v1/mobile/start'), /redirect requires HTTPS/);
    await assert.rejects(authorizedFetch(session, 'https://user@example.test/v1/mobile/start'), /API manzili/);
  } finally { global.fetch = original; }
});

test('GET redirect chains obey the V2 limit', async () => {
  const original = global.fetch; let calls = 0;
  global.fetch = async () => { calls++; return new Response(null, { status: 302, headers: { location: '/v1/mobile/again' } }); };
  try { await assert.rejects(authorizedFetch(session, '/v1/mobile/start'), /Too many API redirects/); assert.equal(calls, 6); }
  finally { global.fetch = original; }
});
