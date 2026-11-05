const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

const filename = path.resolve(__dirname, '../src/savedAccountStore.ts');
const loaded = new Module(filename, module);
loaded.filename = filename; loaded.paths = module.paths;
loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText, filename);
const { SavedAccountStore, savedAccountId } = loaded.exports;
const sha256 = async value => crypto.createHash('sha256').update(value).digest('hex');

function storage() {
  const values = new Map(), failures = [];
  const check = (operation, key) => {
    const index = failures.findIndex(item => item.operation === operation && item.key === key);
    if (index >= 0) { failures.splice(index, 1); throw Error('storage failure'); }
  };
  return { values, fail: (operation, key) => failures.push({ operation, key }),
    getItem: async key => { check('get', key); return values.get(key) ?? null; },
    setItem: async (key, value) => { check('set', key); values.set(key, value); },
    removeItem: async key => { check('remove', key); values.delete(key); } };
}
const account = (ref, overrides = {}) => ({ baseUrl: 'https://EXAMPLE.test/', profile: { role: 'aparatchi', ref },
  token: ` token-${ref} `, phone: ` phone-${ref} `, code: ` code-${ref} `, makeActive: false, ...overrides });

test('saved accounts persist separately from secrets and restore the active identity', async () => {
  const prefs = storage(), secrets = storage(), store = new SavedAccountStore(prefs, secrets, sha256);
  const first = await store.upsertAuthenticated(account('one', { makeActive: true, lastUsedAt: new Date('2025-01-01T00:00:00Z') }));
  const second = await store.upsertAuthenticated(account('two', { lastUsedAt: new Date('2026-01-01T00:00:00Z') }));
  assert.equal(first.id, 'https://example.test|aparatchi|one');
  assert.equal(store.activeAccountId, first.id);
  assert.deepEqual(store.accounts.map(value => value.id), [second.id, first.id]);
  assert.equal(prefs.values.get('saved_accounts_v1').includes('token-one'), false);
  const restored = new SavedAccountStore(prefs, secrets, sha256);
  await restored.load();
  assert.equal(restored.activeAccountId, first.id);
  assert.equal((await restored.sessionFor(first.id)).token, 'token-one');
  assert.equal((await restored.sessionFor(second.id)).phone, 'phone-two');
  await restored.activate(second.id, new Date('2027-01-01T00:00:00Z'));
  assert.equal(restored.activeAccountId, second.id);
  assert.equal(restored.accountsForEndpoint('https://example.test').length, 2);
});

test('saved account loading skips malformed records and invalid active ids', async () => {
  const prefs = storage(), secrets = storage();
  const valid = { id: 'https://example.test|aparatchi|one', base_url: 'https://example.test',
    profile: { role: 'aparatchi', ref: 'one' }, last_used_at: '2026-01-01T00:00:00.000Z' };
  prefs.values.set('saved_accounts_v1', JSON.stringify([valid, { ...valid, id: 'wrong' }, {}, null]));
  prefs.values.set('saved_accounts_active_id_v1', 'missing');
  const store = new SavedAccountStore(prefs, secrets, sha256);
  await store.load();
  assert.equal(store.accounts.length, 1);
  assert.equal(store.activeAccountId, null);
  assert.throws(() => savedAccountId('http://example.test', valid.profile), /HTTPS/);
});

test('failed upsert restores the previous metadata and encrypted credentials', async () => {
  const prefs = storage(), secrets = storage(), store = new SavedAccountStore(prefs, secrets, sha256);
  const first = await store.upsertAuthenticated(account('one', { makeActive: true }));
  prefs.fail('set', 'saved_accounts_v1');
  await assert.rejects(store.upsertAuthenticated(account('one', { token: 'replacement', code: 'new' })), /storage failure/);
  assert.equal(store.activeAccountId, first.id);
  const restored = await store.sessionFor(first.id);
  assert.equal(restored.token, 'token-one');
  assert.equal(restored.code, 'code-one');
});

test('failed activation rolls the active identity back', async () => {
  const prefs = storage(), secrets = storage(), store = new SavedAccountStore(prefs, secrets, sha256);
  const first = await store.upsertAuthenticated(account('one', { makeActive: true }));
  const second = await store.upsertAuthenticated(account('two'));
  prefs.fail('set', 'saved_accounts_active_id_v1');
  await assert.rejects(store.activate(second.id), /storage failure/);
  assert.equal(store.activeAccountId, first.id);
  assert.equal(prefs.values.get('saved_accounts_active_id_v1'), first.id);
});

test('failed secret deletion is retried on the next store load', async () => {
  const prefs = storage(), secrets = storage(), store = new SavedAccountStore(prefs, secrets, sha256);
  const first = await store.upsertAuthenticated(account('one', { makeActive: true }));
  const key = `saved_account_secret_v1:${await sha256(first.id)}`;
  secrets.fail('remove', key);
  await store.remove(first.id);
  assert.equal(store.activeAccountId, null);
  assert.ok(secrets.values.has(key));
  assert.equal(JSON.parse(prefs.values.get('saved_account_pending_secret_deletions_v1'))[first.id], key);
  const restored = new SavedAccountStore(prefs, secrets, sha256);
  await restored.load();
  assert.equal(secrets.values.has(key), false);
  assert.equal(prefs.values.has('saved_account_pending_secret_deletions_v1'), false);
});

test('account operations reject concurrent switching and profile identity changes', async () => {
  const store = new SavedAccountStore(storage(), storage(), sha256);
  const first = await store.upsertAuthenticated(account('one'));
  let release;
  const active = store.runAccountOperation(() => new Promise(resolve => { release = resolve; }));
  await assert.rejects(store.runAccountOperation(async () => {}), /already in progress/);
  release(); await active;
  await assert.rejects(store.updateProfile(first.id, { role: 'aparatchi', ref: 'other' }), /identity changed/);
});

test('legacy session migration saves credentials before removing old login fields', async () => {
  const prefs = storage(), secrets = storage(), store = new SavedAccountStore(prefs, secrets, sha256);
  prefs.values.set('app_session_token', ' old-token ');
  prefs.values.set('app_session_profile', JSON.stringify({ role: 'aparatchi', ref: 'one', phone: 'profile-phone' }));
  prefs.values.set('last_login_phone', ' phone ');
  prefs.values.set('last_login_code', ' code ');
  assert.equal(await store.migrateLegacySession('https://example.test'), true);
  const session = await store.sessionFor(store.activeAccountId);
  assert.equal(session.token, 'old-token');
  assert.equal(session.phone, 'phone');
  assert.equal(session.code, 'code');
  assert.equal(prefs.values.has('last_login_phone'), false);
  assert.equal(prefs.values.has('last_login_code'), false);
});
