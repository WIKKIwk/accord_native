const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const test = require('node:test');
const ts = require('typescript');
function load(file, mocks = {}) {
  const filename = path.resolve(__dirname, '../src', file + '.ts'), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths;
  mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : id === './profileSessionGuard' ? load('shared/profileSessionGuard') : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return mod.exports;
}

test('avatar cache fetches the profile URL without sending the account token', async () => {
  const original = global.fetch, requests = [];
  global.fetch = async (url, init) => { requests.push({ url, init }); return new Response(Uint8Array.of(1, 2, 3), { status: 200, headers: { 'content-type': 'image/png' } }); };
  try {
    const runtime = load('shared/profileAvatarRuntime', {
      '../auth': { activeSessionToken: () => 'secret', registerSessionResetHook: () => {} },
      '../profileModel': load('profileModel'), './profileAvatarCache': load('shared/profileAvatarCache'),
    });
    const profile = { role: 'werka', ref: 'one', avatar_url: 'https://cdn.example/avatar.png?version=7' };
    const session = { baseUrl: 'https://example.test', imageCacheScope: 'scope', profile };
    assert.equal(await runtime.ensureProfileAvatar(session, profile), 'data:image/png;base64,AQID');
    assert.equal(requests[0].url, profile.avatar_url);
    assert.equal(requests[0].init.credentials, 'omit');
    assert.equal(requests[0].init.headers, undefined);
    global.fetch = async () => { throw Error('offline'); };
    assert.equal(await runtime.refreshProfileAvatar(session, profile), 'data:image/png;base64,AQID');
  } finally { global.fetch = original; }
});
