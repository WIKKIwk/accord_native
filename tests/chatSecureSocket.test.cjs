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

function fixture(available = true) {
  let active, sequence = 0;
  const hooks = new Set(), callbacks = [], calls = [];
  const native = {
    addListener: (_name, callback) => { callbacks.push(callback); return { remove() {} }; },
    open: (origin, ticket) => { const id = String(++sequence); calls.push(['open', id, origin, ticket]); return id; },
    stop: id => calls.push(['stop', id]),
    send: (id, value) => { calls.push(['send', id, value]); return true; },
  };
  const api = load('shared/chat/chatSecureSocket.ts', {
    '../../../modules/accord-chat-secure/src/AccordChatSecureModule': { chatSecureNativeModule: () => available ? native : null },
    '../../auth': { activeSessionToken: session => active === session ? session.token : null,
      registerSessionResetHook: hook => { hooks.add(hook); return () => hooks.delete(hook); } },
  });
  const session = { baseUrl: 'https://erp.example', token: 'synthetic-session', profile: { role: 'customer', ref: 'a' } };
  active = session;
  return { ...api, session, calls, callbacks, activate: value => { active = value; },
    reset: async () => { for (const hook of [...hooks]) await hook(); },
    event: event => { for (const callback of callbacks) callback(event); } };
}

test('secure destination is exactly the active session origin and fixed Chat path', () => {
  const f = fixture();
  assert.deepEqual(f.secureChatDestination(f.session, 'wss://erp.example/v1/mobile/chat/live?ticket=synthetic'),
    { origin: 'https://erp.example', ticket: 'synthetic' });
  for (const url of ['ws://erp.example/v1/mobile/chat/live?ticket=synthetic', 'wss://other.example/v1/mobile/chat/live?ticket=synthetic',
    'wss://user@erp.example/v1/mobile/chat/live?ticket=synthetic', 'wss://erp.example/elsewhere?ticket=synthetic',
    'wss://erp.example/v1/mobile/chat/live?ticket=one&ticket=two', 'wss://erp.example/v1/mobile/chat/live?ticket=synthetic#fragment']) {
    assert.throws(() => f.secureChatDestination(f.session, url));
  }
  f.activate(null);
  assert.throws(() => f.secureChatDestination(f.session, 'wss://erp.example/v1/mobile/chat/live?ticket=synthetic'));
});

test('missing development module fails closed without opening a socket', () => {
  const f = fixture(false);
  assert.equal(f.secureChatAvailable(), false);
  assert.throws(() => f.secureChatSocket(f.session, 'wss://erp.example/v1/mobile/chat/live?ticket=synthetic'), /development build/);
  assert.deepEqual(f.calls, []);
});

test('old queued events after reset and a new account cannot reach the new or old socket', async () => {
  const f = fixture();
  const first = f.secureChatSocket(f.session, 'wss://erp.example/v1/mobile/chat/live?ticket=synthetic-a');
  const oldMessages = [], newMessages = [];
  first.onmessage = event => oldMessages.push(event.data);
  f.event({ session: '1', type: 'open', value: '' });
  first.send('synthetic-ping');
  await f.reset();
  const nextSession = { ...f.session, profile: { role: 'customer', ref: 'b' } };
  f.activate(nextSession);
  const second = f.secureChatSocket(nextSession, 'wss://erp.example/v1/mobile/chat/live?ticket=synthetic-b');
  second.onmessage = event => newMessages.push(event.data);
  f.event({ session: '2', type: 'open', value: '' });
  // Simulate delivery of a callback that had already been queued before listener removal.
  f.event({ session: '1', type: 'message', value: 'old-private-event' });
  f.event({ session: '2', type: 'message', value: 'new-event' });
  assert.deepEqual(oldMessages, []);
  assert.deepEqual(newMessages, ['new-event']);
  assert.deepEqual(f.calls.filter(call => call[0] === 'open').map(call => call[1]), ['1', '2']);
  assert.ok(f.calls.some(call => call[0] === 'stop' && call[1] === '1'));
  second.close();
  await Promise.resolve();
});

test('a session change without a reset still rejects and stops a late native event', () => {
  const f = fixture();
  const socket = f.secureChatSocket(f.session, 'wss://erp.example/v1/mobile/chat/live?ticket=synthetic');
  let messages = 0;
  socket.onmessage = () => messages++;
  f.event({ session: '1', type: 'open', value: '' });
  f.activate({ ...f.session, profile: { role: 'customer', ref: 'b' } });
  f.event({ session: '1', type: 'message', value: 'stale' });
  assert.equal(messages, 0);
  assert.ok(f.calls.some(call => call[0] === 'stop' && call[1] === '1'));
});

test('native send false closes the socket and the live controller reconnects with a fresh ticket', async t => {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval'] });
  const hooks = new Set(), callbacks = [], opened = [], stopped = [];
  const session = { baseUrl: 'https://erp.example', token: 'synthetic', profile: { role: 'customer', ref: 'a' } };
  const auth = { activeSessionToken: value => value === session ? value.token : null,
    registerSessionResetHook: hook => { hooks.add(hook); return () => hooks.delete(hook); } };
  const native = { addListener: (_name, callback) => { callbacks.push(callback); return { remove() {} }; },
    open: (_origin, ticket) => { const id = String(opened.length + 1); opened.push([id, ticket]); return id; },
    stop: id => stopped.push(id), send: () => false };
  const adapter = load('shared/chat/chatSecureSocket.ts', {
    '../../../modules/accord-chat-secure/src/AccordChatSecureModule': { chatSecureNativeModule: () => native }, '../../auth': auth,
  });
  let ticket = 0;
  const live = load('chatLive.ts', { './auth': auth,
    'react-native': { AppState: { currentState: 'active', addEventListener: () => ({ remove() {} }) } },
    './authorizedFetch': { authorizedFetch: async () => ({ ok: true, json: async () => ({ ticket: `synthetic-${++ticket}` }) }) } });
  const Original = global.WebSocket;
  global.WebSocket = class { static OPEN = 1; constructor() { throw new Error('legacy socket must not open'); } };
  const stop = live.subscribeChatLive(session, () => {}, undefined, { socketFactory: url => adapter.secureChatSocket(session, url) });
  try {
    await new Promise(resolve => setImmediate(resolve));
    callbacks[0]({ session: '1', type: 'open', value: '' });
    callbacks[0]({ session: '1', type: 'message', value: '{"event":"chat.ready"}' });
    t.mock.timers.tick(25000);
    await Promise.resolve();
    assert.deepEqual(stopped, ['1']);
    t.mock.timers.tick(1000);
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(opened, [['1', 'synthetic-1'], ['2', 'synthetic-2']]);
  } finally { stop(); global.WebSocket = Original; }
});
