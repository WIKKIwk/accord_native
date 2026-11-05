const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
function load(name, mocks = {}) {
  const filename = path.resolve(__dirname, `../src/${name}.ts`), loaded = new Module(filename, module);
  loaded.filename = filename; loaded.paths = module.paths;
  loaded.require = id => Object.hasOwn(mocks, id) ? mocks[id] : id.startsWith('./') ? load(id.slice(2), mocks) : require(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return loaded.exports;
}
const auth = { activeSessionToken: session => session.token ?? null };
test('register trims token while preserving platform and accepts any 2xx', async () => {
  let sent;
  const client = load('chatDeviceTokenApi', { './auth': auth, './authorizedFetch': { authorizedFetch: async (_s, path, init) => { sent = { path, ...init }; return { status: 204 }; } } });
  await client.chatRegisterDeviceToken({}, ' push ', 'android');
  assert.equal(sent.path, '/v1/mobile/chat/device-token');
  assert.deepEqual(JSON.parse(sent.body), { token: 'push', platform: 'android' });
});
test('unregister uses current token once and does nothing without one', async () => {
  const original = global.fetch; let sent;
  global.fetch = async (url, init) => { sent = { url, ...init }; return { status: 403, json: async () => ({ error: 'forbidden' }) }; };
  try {
    const client = load('chatDeviceTokenApi', { './auth': auth, './authorizedFetch': {} });
    await client.chatUnregisterDeviceToken({ baseUrl: 'https://example.test' }, 'x'); assert.equal(sent, undefined);
    await assert.rejects(client.chatUnregisterDeviceToken({ baseUrl: 'https://example.test', token: 'session' }, ' push '), e => e.code === 'forbidden');
    assert.equal(sent.url, 'https://example.test/v1/mobile/chat/device-token?token=push');
    assert.equal(sent.headers.Authorization, 'Bearer session');
  } finally { global.fetch = original; }
});
