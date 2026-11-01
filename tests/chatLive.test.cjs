const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

function loadTs(file, overrides) {
  const filename = path.resolve(__dirname, '../src', file);
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = module.paths;
  loaded.require = name => Object.hasOwn(overrides, name) ? overrides[name] : require(name);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText, filename);
  return loaded.exports;
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function fixture(fetchTicket) {
  const sockets = [];
  const calls = [];
  let stateListener;
  let removed = false;
  let active = true;
  const appState = {
    currentState: 'active',
    addEventListener: (_, callback) => { stateListener = callback; return { remove: () => { removed = true; } }; },
  };
  class Socket {
    static OPEN = 1;
    constructor(uri) { this.uri = uri; this.readyState = Socket.OPEN; sockets.push(this); }
    send(value) { this.sent = value; }
    close() { this.readyState = 3; this.onclose?.(); }
  }
  const original = global.WebSocket;
  global.WebSocket = Socket;
  const session = { baseUrl: 'https://erp.example', token: 'private-session-token' };
  const { subscribeChatLive } = loadTs('chatLive.ts', {
    'react-native': { AppState: appState },
    './auth': { activeSessionToken: () => active ? session.token : null },
    './authorizedFetch': { authorizedFetch: async (...args) => {
      calls.push(args);
      return fetchTicket ? fetchTicket(...args) : { ok: true, json: async () => ({ ticket: `ticket-${calls.length}` }) };
    } },
  });
  return {
    session, sockets, calls, subscribeChatLive,
    state(value) { appState.currentState = value; stateListener(value); },
    logout() { active = false; },
    removed: () => removed,
    restore() { global.WebSocket = original; },
  };
}

test('live chat uses an ephemeral ticket and invalidates on ready and message events', async () => {
  const f = fixture();
  let changes = 0;
  const stop = f.subscribeChatLive(f.session, () => { changes++; });
  try {
    await sleep(0);
    assert.equal(f.calls[0][1], '/v1/mobile/chat/socket-ticket');
    assert.equal(f.calls[0][2].method, 'POST');
    const socket = f.sockets[0];
    const url = new URL(socket.uri);
    assert.equal(url.protocol, 'wss:');
    assert.equal(url.pathname, '/v1/mobile/chat/live');
    assert.equal(url.searchParams.get('ticket'), 'ticket-1');
    assert.ok(!socket.uri.includes(f.session.token));
    socket.onopen();
    socket.onmessage({ data: JSON.stringify({ event: 'chat.ready' }) });
    socket.onmessage({ data: JSON.stringify({ event: 'chat.message.created' }) });
    await sleep(130);
    assert.equal(changes, 1);
    stop();
    assert.equal(f.removed(), true);
    assert.equal(socket.readyState, 3);
    socket.onmessage({ data: JSON.stringify({ event: 'chat.message.created' }) });
    await sleep(130);
    assert.equal(changes, 1);
  } finally { stop(); f.restore(); }
});

test('backgrounding cancels a pending ticket and resume requests a fresh one', async () => {
  let resolveFirst;
  const first = new Promise(resolve => { resolveFirst = resolve; });
  let count = 0;
  const f = fixture(async () => {
    count++;
    if (count === 1) return first;
    return { ok: true, json: async () => ({ ticket: 'fresh' }) };
  });
  const stop = f.subscribeChatLive(f.session, () => {});
  try {
    f.state('background');
    assert.equal(f.calls[0][2].signal.aborted, true);
    f.state('active');
    await sleep(0);
    resolveFirst({ ok: true, json: async () => ({ ticket: 'stale' }) });
    await sleep(0);
    assert.equal(f.sockets.length, 1);
    assert.equal(new URL(f.sockets[0].uri).searchParams.get('ticket'), 'fresh');
  } finally { stop(); f.restore(); }
});

test('an open chat sends a heartbeat before the server idle timeout', async t => {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval'] });
  const f = fixture();
  const stop = f.subscribeChatLive(f.session, () => {});
  try {
    await new Promise(resolve => setImmediate(resolve));
    const socket = f.sockets[0];
    socket.onopen();
    socket.onmessage({ data: JSON.stringify({ event: 'chat.ready' }) });
    t.mock.timers.tick(25000);
    assert.equal(socket.sent, '{"type":"ping"}');
  } finally { stop(); f.restore(); }
});

test('closing or malformed live data reconnects with a fresh ticket', async () => {
  const f = fixture();
  const stop = f.subscribeChatLive(f.session, () => {});
  try {
    await sleep(0);
    f.sockets[0].onmessage({ data: 'null' });
    await sleep(1100);
    assert.equal(f.sockets.length, 2);
    assert.equal(new URL(f.sockets[1].uri).searchParams.get('ticket'), 'ticket-2');
  } finally { stop(); f.restore(); }
});

test('logout prevents a pending ticket from opening a socket', async () => {
  let resolveTicket;
  const pending = new Promise(resolve => { resolveTicket = resolve; });
  const f = fixture(async () => pending);
  const stop = f.subscribeChatLive(f.session, () => {});
  try {
    f.logout();
    resolveTicket({ ok: true, json: async () => ({ ticket: 'stale' }) });
    await sleep(0);
    assert.equal(f.sockets.length, 0);
  } finally { stop(); f.restore(); }
});
