const assert = require('node:assert/strict');
const test = require('node:test');
const { authHarness, loadTs, mountLive, tick, until } = require('./support/chatSecureHarness.cjs');
const profile = token => ({ token, profile: { role: 'customer', ref: 'one' }, capabilities: ['customer.access'] });
const response = value => new Response(JSON.stringify(value));

// @v2 MobileApi._sendAuthorized, _reauthenticateFromStorage and chatLiveUri.
test('ticket and ordinary concurrent 401s share V2 reauthentication and each retry only once', async t => {
  const original = global.fetch; t.after(() => { global.fetch = original; });
  let logins = 0, releaseRefresh;
  const calls = [];
  global.fetch = async (url, init) => {
    calls.push({ url, init });
    if (url.endsWith('/auth/login')) {
      if (++logins === 1) return response(profile('old'));
      return new Promise(resolve => { releaseRefresh = () => resolve(response(profile('new'))); });
    }
    if (init.headers.get('authorization') === 'Bearer old') return new Response('{}', { status: 401 });
    return response(url.endsWith('/socket-ticket') ? { ticket: 'fresh-ticket' } : {});
  };
  const auth = authHarness(), session = await auth.login('https://example.test', 'synthetic-phone', 'synthetic-code');
  const transport = loadTs('authorizedFetch.ts', { './auth': auth }), live = mountLive(auth, transport);
  const stop = live.subscribeChatLive(session, () => {}); t.after(stop);
  const ordinary = transport.authorizedFetch(session, '/v1/mobile/me');
  await until(() => !!releaseRefresh); releaseRefresh();
  await ordinary; await until(() => live.opens.length === 1);
  assert.equal(logins, 2);
  assert.deepEqual(live.opens[0], { id: '1', origin: 'https://example.test', ticket: 'fresh-ticket' });
  assert.equal(session.token, 'new');
  const saved = await auth.testAccountStore.sessionFor(auth.testAccountStore.activeAccountId);
  assert.equal(saved.token, 'new');
  const tickets = calls.filter(call => call.url.endsWith('/socket-ticket'));
  assert.deepEqual(tickets.map(call => call.init.headers.get('authorization')), ['Bearer old', 'Bearer new']);
  for (const call of calls) {
    assert.equal(call.init.credentials, 'omit'); assert.equal(call.init.redirect, 'manual');
    if (call.url.endsWith('/auth/login')) assert.deepEqual(JSON.parse(call.init.body), { phone: 'synthetic-phone', code: 'synthetic-code' });
  }
  assert.ok(tickets.every(call => call.init.method === 'POST' && call.init.body === undefined));
});

test('failed stored-account refresh clears the active account and starts no socket', async t => {
  const original = global.fetch; t.after(() => { global.fetch = original; });
  let logins = 0, tickets = 0;
  global.fetch = async url => {
    if (url.endsWith('/auth/login')) return ++logins === 1 ? response(profile('old')) : new Response('{}', { status: 401 });
    tickets++; return new Response('{}', { status: 401 });
  };
  const auth = authHarness(), session = await auth.login('https://example.test', 'synthetic-phone', 'synthetic-code');
  const live = mountLive(auth), stop = live.subscribeChatLive(session, () => {}); t.after(stop);
  await until(() => auth.currentSession() === null);
  assert.equal(logins, 2); assert.equal(tickets, 1);
  assert.equal(auth.testAccountStore.activeAccountId, null); assert.deepEqual(live.opens, []);
});

test('a login POST redirect is returned as failure without following it or sharing cookies', async t => {
  const calls = [];
  const account = loadTs('authenticateAccount.ts', {
    './workerControlsApi': { isCanonicalApparatusId: () => true },
    'expo/fetch': { fetch: async (url, init) => { calls.push({ url, init }); return new Response(null,
      { status: 302, headers: { location: 'https://elsewhere.test/capture' } }); } },
  });
  const original = global.fetch; global.fetch = () => { throw new Error('RN fetch must not be selected'); };
  t.after(() => { global.fetch = original; });
  await assert.rejects(account.authenticateAccount('https://example.test', 'synthetic-phone', 'synthetic-code'), error => error.statusCode === 302);
  assert.equal(calls.length, 1); assert.equal(calls[0].url, 'https://example.test/v1/mobile/auth/login');
  assert.equal(calls[0].init.redirect, 'manual'); assert.equal(calls[0].init.credentials, 'omit');
});

test('a ticket retry returning 401 is not followed by a second login within the attempt', async t => {
  const original = global.fetch; t.after(() => { global.fetch = original; });
  let logins = 0, tickets = 0;
  global.fetch = async url => url.endsWith('/auth/login') ? response(profile(`token-${++logins}`))
    : (tickets++, new Response('{}', { status: 401 }));
  const auth = authHarness(), session = await auth.login('https://example.test', 'synthetic-phone', 'synthetic-code');
  const live = mountLive(auth), stop = live.subscribeChatLive(session, () => {}); t.after(stop);
  await until(() => tickets === 2); await tick(); await tick();
  assert.equal(logins, 2); assert.deepEqual(live.opens, []);
});

test('ticket, saved-account login and retry retain V2 separate 10-second deadlines', async t => {
  const original = global.fetch; t.after(() => { global.fetch = original; });
  global.fetch = async () => response(profile('old'));
  const auth = authHarness(), session = await auth.login('https://example.test', 'synthetic-phone', 'synthetic-code');
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let phases = 0;
  global.fetch = async (url, init) => {
    phases++;
    await new Promise(resolve => setTimeout(resolve, 9000));
    if (url.endsWith('/auth/login')) return response(profile('new'));
    return init.headers.get('authorization') === 'Bearer old' ? new Response('{}', { status: 401 }) : response({ ticket: 'after-refresh' });
  };
  const live = mountLive(auth), stop = live.subscribeChatLive(session, () => {}); t.after(stop);
  await until(() => phases === 1); t.mock.timers.tick(9000);
  await until(() => phases === 2); t.mock.timers.tick(9000);
  await until(() => phases === 3); t.mock.timers.tick(9000);
  await until(() => live.opens.length === 1);
  assert.equal(live.opens[0].ticket, 'after-refresh');
});
