const assert = require('node:assert/strict');
const test = require('node:test');
const { load, strings, checked, deferred, entry } = require('./adminUsersSupport.cjs');
const exceptions = load('shared/mobileApiException');
const chat = load('chatModel');
const model = load('admin/adminProfileChatModel', { '../shared/mobileApiException': exceptions, './dartJsonString': strings });
const target = Object.freeze({ role: 'supplier', ref: ' raw ref ', displayName: ' Name ', avatarUrl: ' raw image ' });
const response = () => ({ conversation_id: 'c1', peer: { role: target.role, ref: target.ref.trim(), display_name: 'Server' } });
function api(fetch, parser = chat) {
  return load('admin/adminProfileChatApi', { '../authorizedFetch': { authorizedFetch: fetch }, '../chatModel': parser,
    '../shared/mobileApiException': exceptions, './adminProductionRequest': checked,
    './adminProfileChatModel': model, './dartJsonString': strings });
}
function fixture(fetch, parser) {
  let valid = true;
  const session = { token: 't', baseUrl: 'https://erp.example', profile: { role: 'admin', ref: 'a' } };
  const guard = () => { if (!valid) throw Error('retired'); };
  return { session, guard, retire: () => { valid = false; }, api: api(fetch, parser) };
}
const openTarget = { ...target, ref: target.ref.trim() };
test('Admin profile target follows source trim/self comparison while preserving raw title/avatar', () => {
  const session = { profile: { role: 'supplier', ref: ' SAME\u0085' } };
  assert.equal(model.adminProfileChatTarget(session, null), null);
  assert.equal(model.adminProfileChatTarget(session, entry('\u0085 \u00a0')), null);
  assert.equal(model.adminProfileChatTarget(session, entry(' SAME ')), null);
  const original = { ...entry(' same ', ' Name '), avatar_url: ' image ' };
  const result = model.adminProfileChatTarget(session, original);
  assert.deepEqual(result, { role: 'supplier', ref: 'same', displayName: ' Name ', avatarUrl: ' image ' });
  assert.equal(Object.isFrozen(result), true);
  assert.notEqual(model.adminProfileChatTarget({ profile: { role: 'admin', ref: 'SAME' } }, entry('SAME')), null);
});
test('direct Admin DM request keeps exact role/ref payload and authentic response decoder', async () => {
  const calls = [], f = fixture(async (...args) => { calls.push(args); return { status: 201, json: async () => response() }; });
  const result = await f.api.openAdminProfileChatConversation(f.session, openTarget, f.guard);
  assert.equal(result.id, 'c1'); assert.equal(result.title, 'Server');
  const [session, path, init, guard, timeout, options] = calls[0]; guard();
  assert.equal(session, f.session); assert.equal(path, '/v1/mobile/chat/conversations/dm');
  assert.equal(init.method, 'POST'); assert.deepEqual(JSON.parse(init.body), { role: 'supplier', ref: 'raw ref' });
  assert.deepEqual(init.headers, { 'Content-Type': 'application/json' });
  assert.equal(timeout, undefined); assert.equal(options, undefined);
});
test('original target snapshot survives a caller mutation while the DM body is pending', async () => {
  const pending = deferred(), mutable = { ...openTarget };
  const f = fixture(async () => ({ status: 200, json: () => pending.promise }));
  const promise = f.api.openAdminProfileChatConversation(f.session, mutable, f.guard);
  mutable.ref = 'replacement'; mutable.displayName = 'Changed'; pending.resolve(response());
  assert.equal((await promise).id, 'c1');
});
test('missing, async and stale guards cannot send a DM request', async () => {
  let sends = 0; const f = fixture(async () => { sends++; throw Error('unexpected send'); });
  await assert.rejects(f.api.openAdminProfileChatConversation(f.session, openTarget), TypeError);
  await assert.rejects(f.api.openAdminProfileChatConversation(f.session, openTarget, async () => {}), TypeError);
  f.retire(); await assert.rejects(f.api.openAdminProfileChatConversation(f.session, openTarget, f.guard), /retired/);
  assert.equal(sends, 0);
});
test('account retirement after response or body suppresses both success and failure publication', async () => {
  for (const status of [200, 403]) for (const when of ['response', 'body']) {
    let f; f = fixture(async () => { if (when === 'response') f.retire(); return { status, json: async () => {
      if (when === 'body') f.retire(); return status === 200 ? response() : { error: 'chat_forbidden' };
    } }; });
    await assert.rejects(f.api.openAdminProfileChatConversation(f.session, openTarget, f.guard), /retired/);
  }
});
test('retirement during malformed body or conversation getter takes precedence over decoding errors', async () => {
  for (const status of [200, 500]) {
    let f; f = fixture(async () => ({ status, json: async () => { f.retire(); throw SyntaxError('bad body'); } }));
    await assert.rejects(f.api.openAdminProfileChatConversation(f.session, openTarget, f.guard), /retired/);
  }
  let g; g = fixture(async () => ({ status: 200, json: async () => ({ get conversation_id() { g.retire(); throw Error('getter'); } }) }));
  await assert.rejects(g.api.openAdminProfileChatConversation(g.session, openTarget, g.guard), /retired/);
});
test('source accepts every 2xx status and rejects other statuses with exact Dart error strings', async () => {
  for (const status of [200, 201, 202, 299]) {
    const f = fixture(async () => ({ status, json: async () => response() }));
    assert.equal((await f.api.openAdminProfileChatConversation(f.session, openTarget, f.guard)).id, 'c1');
  }
  for (const [payload, code] of [[{ error: ' raw code ' }, ' raw code '], [{ error: '' }, ''], [{ error: 7 }, '7'],
    [{ error: { key: [1, true] } }, '{key: [1, true]}'], [{ error: null }, 'chat_create_failed'], [[], 'chat_create_failed']]) {
    const f = fixture(async () => ({ status: 403, json: async () => payload }));
    await assert.rejects(f.api.openAdminProfileChatConversation(f.session, openTarget, f.guard), error =>
      error instanceof exceptions.MobileApiException && error.code === code && error.message === 'Chat so‘rovi bajarilmadi' && error.statusCode === 403);
  }
  const invalid = fixture(async () => ({ status: 503, json: async () => { throw SyntaxError('bad'); } }));
  await assert.rejects(invalid.api.openAdminProfileChatConversation(invalid.session, openTarget, invalid.guard), error => error.code === 'chat_create_failed');
});
test('only transport network/timeout failures acquire source transient message; stale transport errors remain retired', async () => {
  const timeout = Object.assign(Error('timeout'), { name: 'TimeoutError' });
  for (const error of [new TypeError('offline'), timeout]) {
    const f = fixture(async () => { throw error; });
    await assert.rejects(f.api.openAdminProfileChatConversation(f.session, openTarget, f.guard), value =>
      value instanceof model.AdminProfileChatTransportFailure && model.adminProfileChatFailureMessage(value) === 'Ulanish uzildi. Internetni tekshirib, qayta yuboring.');
  }
  const original = Error('other'), f = fixture(async () => { throw original; });
  await assert.rejects(f.api.openAdminProfileChatConversation(f.session, openTarget, f.guard), value => value === original);
  let g; g = fixture(async () => { g.retire(); throw new TypeError('offline'); });
  await assert.rejects(g.api.openAdminProfileChatConversation(g.session, openTarget, g.guard), /retired/);
});
test('existing shared decoder peer/ID restrictions remain explicit rather than silently manufacturing a destination', async () => {
  for (const value of [{ conversation_id: 'c1' }, { ...response(), peer: { role: 'supplier', ref: 'other' } }, { ...response(), conversation_id: '..' }]) {
    const f = fixture(async () => ({ status: 200, json: async () => value }));
    await assert.rejects(f.api.openAdminProfileChatConversation(f.session, openTarget, f.guard), /Suhbatni ochib bo‘lmadi/);
  }
});
test('source failure-code messages precede status fallbacks; arbitrary MobileApiException text remains raw', () => {
  const make = (code, statusCode, message = ' raw ') => new exceptions.MobileApiException({ code, statusCode, message });
  assert.equal(model.adminProfileChatFailureMessage(make('chat_forbidden', 500)), 'Bu suhbatga xabar yuborish ruxsati yo‘q.');
  assert.equal(model.adminProfileChatFailureMessage(make('other', 429)), 'Juda ko‘p urinish bo‘ldi. Birozdan keyin qayta yuboring.');
  assert.equal(model.adminProfileChatFailureMessage(make('other', 503)), 'Server xatosi. Xabar saqlandi, qayta yuborishingiz mumkin.');
  assert.equal(model.adminProfileChatFailureMessage(make('other', 403)), ' raw ');
  assert.equal(model.adminProfileChatFailureMessage(Error('other')), 'Xabar yuborilmadi. Qayta urinib ko‘ring.');
});
test('actual authorizedFetch checks the original owner before a 401 retry and does not opt a POST into guarded reads', async () => {
  for (const retireDuringRefresh of [false, true]) {
    let current = true, token = 'old', sends = 0, refreshes = 0;
    const guard = () => { if (!current) throw Error('retired'); };
    const session = { baseUrl: 'https://erp.example', token, profile: { role: 'admin', ref: 'a' } };
    const transport = load('authorizedFetch', { 'expo/fetch': { fetch: async (_url, init) => {
      sends++; assert.equal(init.method, 'POST'); assert.equal(init.headers.get('Authorization'), `Bearer ${token}`);
      return { status: sends === 1 ? 401 : 200, json: async () => response() };
    } }, './auth': { activeSessionToken: () => token, refreshSession: async () => {
      refreshes++; token = 'new'; if (retireDuringRefresh) current = false; return session;
    }, joinRefreshForGuardedRead: () => { throw Error('a mutation must not join guarded read refresh'); } } });
    const a = load('admin/adminProfileChatApi', { '../authorizedFetch': transport, '../chatModel': chat,
      '../shared/mobileApiException': exceptions, './adminProductionRequest': checked,
      './adminProfileChatModel': model, './dartJsonString': strings });
    const promise = a.openAdminProfileChatConversation(session, openTarget, guard);
    if (retireDuringRefresh) await assert.rejects(promise, /retired/); else assert.equal((await promise).id, 'c1');
    assert.equal(refreshes, 1); assert.equal(sends, retireDuringRefresh ? 1 : 2);
  }
});
