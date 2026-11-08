const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

function load(file, mocks) {
  const filename = path.resolve(__dirname, '../src', file);
  const loaded = new Module(filename, module); loaded.filename = filename; loaded.paths = module.paths;
  loaded.require = name => Object.hasOwn(mocks, name) ? mocks[name] : require(name);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return loaded.exports;
}
const tick = () => new Promise(resolve => setImmediate(resolve));

function fixture() {
  let appListener, active;
  const hooks = new Set(), calls = [], sockets = [], resolvers = [];
  const session = { baseUrl: 'https://erp.example', token: 'synthetic', profile: { role: 'customer', ref: 'a' } };
  active = session;
  const auth = { activeSessionToken: value => active === value ? value.token : null,
    registerSessionResetHook: hook => { hooks.add(hook); return () => hooks.delete(hook); } };
  const appState = { currentState: 'active', addEventListener: (_type, cb) => { appListener = cb; return { remove() {} }; } };
  const chatLive = load('chatLive.ts', { './auth': auth, 'react-native': { AppState: appState },
    './authorizedFetch': { authorizedFetch: async (_session, _path, options) => {
      calls.push(options.signal);
      return new Promise(resolve => { resolvers.push(resolve); });
    } } });
  const secure = load('shared/chat/secureChatLive.ts', { '../../auth': auth, '../../chatLive': chatLive,
    './chatSecureReadiness': { secureChatUnavailableReason: () => null },
    './chatSecureSocket': { SECURE_CHAT_UNAVAILABLE: 'development build required', secureChatAvailable: () => true,
      secureChatSocket: (_session, uri) => { const socket = { uri, readyState: 1, send() {}, close() { this.readyState = 3; this.onclose?.(); } };
        sockets.push(socket); return socket; } } });
  return { ...secure, session, calls, sockets, state: value => { appState.currentState = value; appListener(value); },
    ticket: (index, value) => resolvers[index]({ ok: true, json: async () => ({ ticket: value }) }),
    reset: async () => { for (const hook of [...hooks]) await hook(); }, activate: value => { active = value; } };
}

test('account reset aborts a pending ticket before a secure or legacy socket can open', async () => {
  const f = fixture();
  const Original = global.WebSocket;
  global.WebSocket = class { constructor() { throw new Error('legacy socket must not open'); } };
  const stop = f.subscribeSecureChatLive(f.session, () => {});
  try {
    await f.reset();
    assert.equal(f.calls[0].aborted, true);
    f.activate(null);
    f.ticket(0, 'stale-synthetic-ticket');
    await tick(); await tick();
    assert.equal(f.sockets.length, 0);
  } finally { stop(); global.WebSocket = Original; }
});

test('the unresolved secure ticket/refresh policy stops before ticket or socket work', () => {
  let attempts = 0;
  const session = { token: 'synthetic' };
  const secure = load('shared/chat/secureChatLive.ts', {
    '../../auth': { activeSessionToken: () => 'synthetic', registerSessionResetHook: () => () => {} },
    '../../chatLive': { subscribeChatLive: () => { attempts++; return () => {}; } },
    './chatSecureReadiness': { secureChatUnavailableReason: () => 'secure authentication unavailable' },
    './chatSecureSocket': { secureChatSocket: () => { attempts++; } },
  });
  assert.throws(() => secure.subscribeSecureChatLive(session, () => {}), /secure authentication unavailable/);
  assert.equal(attempts, 0);
});

test('background cancels the old ticket and resume creates only the secure socket', async () => {
  const f = fixture();
  const Original = global.WebSocket;
  global.WebSocket = class { static OPEN = 1; constructor() { throw new Error('legacy socket must not open'); } };
  const stop = f.subscribeSecureChatLive(f.session, () => {});
  try {
    f.state('background');
    assert.equal(f.calls[0].aborted, true);
    f.state('active');
    assert.equal(f.calls.length, 2);
    f.ticket(0, 'stale-synthetic-ticket');
    await tick();
    assert.equal(f.sockets.length, 0);
    f.ticket(1, 'fresh-synthetic-ticket');
    await tick(); await tick();
    assert.equal(f.sockets.length, 1);
    assert.equal(new URL(f.sockets[0].uri).searchParams.get('ticket'), 'fresh-synthetic-ticket');
  } finally { stop(); global.WebSocket = Original; }
});
