const assert = require('node:assert/strict');
const test = require('node:test');
const { mountLive, tick, until } = require('./support/chatSecureHarness.cjs');
function fixture() {
  let active, count = 0;
  const hooks = new Set(), requests = [], resolvers = [];
  const session = { baseUrl: 'https://erp.example', token: 'synthetic', profile: { role: 'customer', ref: 'a' } };
  active = session;
  const auth = { activeSessionToken: value => active === value ? value.token : null,
    registerSessionResetHook: hook => { hooks.add(hook); return () => hooks.delete(hook); } };
  const live = mountLive(auth, { authorizedFetch: async (_session, path, init) => {
    requests.push({ path, ...init }); count++;
    return new Promise(resolve => { resolvers.push(resolve); });
  } });
  return { ...live, session, requests, count: () => count,
    ticket: (index, ticket) => resolvers[index]({ ok: true, json: async () => ({ ticket }) }),
    reset: async () => { for (const hook of [...hooks]) await hook(); }, activate: value => { active = value; },
  };
}

test('account reset cancels a pending ticket before any native or RN socket can open', async t => {
  const f = fixture(), original = global.WebSocket;
  global.WebSocket = class { constructor() { throw new Error('RN socket must not open'); } };
  t.after(() => { global.WebSocket = original; });
  const stop = f.subscribeChatLive(f.session, () => {}); t.after(stop);
  await f.reset(); assert.equal(f.requests[0].signal.aborted, true);
  f.activate(null); f.ticket(0, 'stale-ticket'); await tick(); await tick();
  assert.deepEqual(f.opens, []);
});

test('background cancels the old ticket and resume opens a fresh native connection', async t => {
  const f = fixture(), stop = f.subscribeChatLive(f.session, () => {}); t.after(stop);
  f.state('background'); assert.equal(f.requests[0].signal.aborted, true);
  f.state('active'); assert.equal(f.requests.length, 2);
  f.ticket(0, 'stale-ticket'); await tick(); assert.deepEqual(f.opens, []);
  f.ticket(1, 'fresh-ticket'); await until(() => f.opens.length === 1);
  assert.equal(f.opens[0].ticket, 'fresh-ticket');
  f.event('1', 'open'); await f.reset(); assert.deepEqual(f.stops, ['1']);
});

test('all decoded maps mark the connection ready, while binary data never becomes an application event', async t => {
  const f = fixture(), states = [], events = [];
  const stop = f.subscribeChatLive(f.session, () => {}, value => events.push(value), { onStateChange: value => states.push(value) }); t.after(stop);
  f.ticket(0, 'fresh-ticket'); await until(() => f.opens.length === 1);
  f.event('1', 'open'); f.event('1', 'message', JSON.stringify({ event: 'chat.resync_required' }));
  assert.equal(states.at(-1), 'ready'); assert.deepEqual(events, [{ event: 'chat.resync_required' }]);
  await f.reset(); f.event('1', 'message', JSON.stringify({ event: 'chat.message.created' }));
  assert.equal(events.length, 1);
});
