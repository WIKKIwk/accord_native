const test = require('node:test');
const assert = require('node:assert/strict');
const { loader } = require('./support/workerQueueTransport.cjs');
const origin = 'https://example.test';
const url = 'wss://example.test/v1/mobile/admin/production-maps/live?token=secret&protocol=state_delta_v2&worker_scope=true';
function harness(available = true) {
  const callbacks = new Map(), stopped = [], resets = new Set(); let sequence = 0, removed = 0;
  const native = {
    addListener(_name, callback) { const key = ++sequence; callbacks.set(key, callback); return { remove() { callbacks.delete(key); removed++; } }; },
    open() { return String(sequence); }, stop(id) { stopped.push(id); },
  };
  const session = { baseUrl: origin, token: 'secret', profile: { role: 'aparatchi', ref: 'worker' } };
  const api = loader({ '../modules/accord-production-live/src/AccordProductionLiveModule': { productionLiveNativeModule: () => available ? native : null },
    './auth': { activeSessionToken: session => session.token, registerSessionResetHook: callback => { resets.add(callback); return () => resets.delete(callback); } },
  })('workerLiveTransport');
  return { api, session, callbacks, stopped, resets, get removed() { return removed; },
    emit(event) { for (const callback of [...callbacks.values()]) callback(event); } };
}

test('production native transport permits only current HTTPS server worker endpoint and token', () => {
  const h = harness();
  assert.equal(h.api.workerLiveDestination(h.session, url), url);
  for (const bad of [
    url.replace('wss:', 'ws:'), url.replace('example.test', 'evil.test'), url.replace('/production-maps/live', '/production-maps/live/'),
    url.replace('/admin/production-maps/live', '/chat/live'), `${url}&token=second`, `${url}&ticket=other`, `${url}#fragment`,
    url.replace('token=secret', 'token=other'), url.replace('wss://', 'wss://user:password@'),
  ]) assert.throws(() => h.api.workerLiveDestination(h.session, bad), /Invalid production live destination/);
});

test('native session event ownership and teardown prevent stale native publication', async () => {
  const h = harness(), socket = h.api.openWorkerLiveSocket(h.session, url); const messages = [];
  socket.onmessage = event => messages.push(event.data);
  h.emit({ session: 'wrong', type: 'open', value: '' }); assert.equal(socket.readyState, 0);
  h.emit({ session: '1', type: 'open', value: '' });
  h.emit({ session: '1', type: 'message', value: 'first' }); assert.deepEqual(messages, ['first']);
  h.session.profile.ref = 'new-worker';
  h.emit({ session: '1', type: 'message', value: 'late' });
  assert.equal(socket.readyState, 3); assert.deepEqual(h.stopped, ['1']); assert.equal(h.removed, 1);
  assert.equal(h.resets.size, 0); socket.close(); assert.deepEqual(h.stopped, ['1']);
  await Promise.resolve(); assert.deepEqual(messages, ['first']);
});

test('native handshake status is structured so forbidden cannot reconnect indefinitely', () => {
  const h = harness(), socket = h.api.openWorkerLiveSocket(h.session, url); const errors = [];
  socket.onerror = event => errors.push(event.error);
  h.emit({ session: '1', type: 'error', value: '', statusCode: 403 });
  assert.equal(errors[0].statusCode, 403); assert.equal(errors[0].code, 'forbidden');
  socket.close();
});

test('old development binaries use an actual WebSocket fallback rather than a simulated socket', () => {
  const h = harness(false), original = global.WebSocket;
  global.WebSocket = class { constructor(value) { this.url = value; } };
  try { assert.equal(h.api.openWorkerLiveSocket(h.session, url).url, url); }
  finally { global.WebSocket = original; }
});
