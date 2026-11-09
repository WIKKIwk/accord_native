const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const test = require('node:test');
const ts = require('typescript');
function load(file, overrides = {}) {
  const filename = path.resolve(__dirname, '../src', file + '.ts');
  const mod = new Module(filename, module); mod.filename = filename; mod.paths = module.paths;
  mod.require = name => Object.hasOwn(overrides, name) ? overrides[name] : require(name);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return mod.exports;
}
const saved = load('savedAccountStore');
const { AccountSwitchController } = load('shared/accountSwitchController', { '../savedAccountStore': saved });
const profile = ref => ({ role: 'aparatchi', ref, capabilities: ['apparatus.queue.read'] });
function memory() { const data = new Map(); return { getItem: async key => data.get(key) ?? null, setItem: async (key, val) => data.set(key, val), removeItem: async key => data.delete(key) }; }
async function fixture(options = {}) {
  const store = new saved.SavedAccountStore(memory(), memory(), async value => Buffer.from(value).toString('hex'));
  await store.load();
  const first = await store.upsertAuthenticated({ baseUrl: 'https://erp.example.com', profile: profile('a'), token: 'token-a', phone: 'a', code: '40', makeActive: true });
  const second = await store.upsertAuthenticated({ baseUrl: 'https://erp.example.com', profile: profile('b'), token: 'token-b', phone: 'b', code: '41', makeActive: false });
  let current = { token: 'token-a', profile: profile('a') }; const events = [];
  const environment = {
    current: () => current, snapshot: () => current,
    restore: async snapshot => { current = snapshot; },
    activate: async target => { current = { token: target.token, profile: target.account.profile }; if (options.failActivation) throw new Error('activation failed'); },
    clear: async () => { current = null; },
    unregisterCurrentPush: async () => { events.push(`unregister:${current?.profile.ref}`); },
    unlockAfterSwitch: async () => { events.push(`unlock:${current?.profile.ref}`); },
    syncCurrentPush: async () => { events.push(`sync:${current?.profile.ref}`); },
    logoutSavedSession: async target => { events.push(`logout:${target.token}`); },
    clearAfterLogout: async () => { events.push(`clear:${current?.profile.ref}`); },
  };
  return { store, first, second, environment, events, current: () => current, controller: new AccountSwitchController(store, environment) };
}

// @v2-test test/account_switch_controller_test.dart
test('saved account switching preserves push and activation order', async () => {
  const f = await fixture();
  const result = await f.controller.switchTo(f.second.id);
  assert.equal(result.ref, 'b'); assert.equal(f.store.activeAccountId, f.second.id);
  assert.equal(f.current().token, 'token-b');
  assert.deepEqual(f.events, ['unregister:a', 'unlock:b', 'sync:b']);
});

test('failed activation rolls both store and session back', async () => {
  const f = await fixture({ failActivation: true });
  await assert.rejects(f.controller.switchTo(f.second.id), /activation failed/);
  assert.equal(f.store.activeAccountId, f.first.id);
  assert.equal(f.current().token, 'token-a');
});

test('add keeps the old account and logout removes only the active one', async () => {
  const f = await fixture();
  await f.controller.addAndSwitch({ baseUrl: 'https://erp.example.com', profile: profile('c'), token: 'token-c', phone: 'c', code: '42' });
  assert.equal(f.store.accounts.length, 3);
  f.events.length = 0;
  await f.controller.logoutCurrent();
  assert.equal(f.current(), null); assert.equal(f.store.activeAccountId, null);
  assert.deepEqual(f.events, ['unregister:c', 'logout:token-c', 'clear:c']);
  assert.ok(await f.store.sessionFor(f.first.id)); assert.ok(await f.store.sessionFor(f.second.id));
});

test('reauthentication cannot silently switch to a different identity', async () => {
  const f = await fixture();
  f.environment.reauthenticate = async () => ({ token: 'new', profile: profile('other') });
  await assert.rejects(f.controller.switchTo(f.second.id), /identity does not match/);
  assert.equal(f.store.activeAccountId, f.first.id); assert.equal(f.current().token, 'token-a');
});

test('controllers sharing a store reject overlapping operations', async () => {
  const f = await fixture(); let resume, entered;
  const waiting = new Promise(resolve => { resume = resolve; });
  const started = new Promise(resolve => { entered = resolve; });
  f.environment.unregisterCurrentPush = async () => { entered(); await waiting; };
  const pending = f.controller.switchTo(f.second.id); await started;
  assert.equal(f.controller.switching, true);
  const other = new AccountSwitchController(f.store, f.environment);
  assert.equal(other.switching, true);
  await assert.rejects(other.switchTo(f.second.id), /already in progress/);
  resume(); await pending; assert.equal(other.switching, false);
});

test('optional transition observer starts before account work and ends after success or failure', async () => {
  const f = await fixture(); const events = []; let release, signal; const entered = new Promise(resolve => { signal = resolve; });
  f.environment.beginSessionTransition = () => { events.push('begin'); return () => events.push('end'); };
  f.environment.reauthenticate = async () => { events.push('reauth'); signal(); await new Promise(resolve => { release = resolve; });
    return { token: 'token-b2', profile: profile('b') }; };
  const pending = f.controller.switchTo(f.second.id); assert.deepEqual(events, ['begin']); await entered;
  assert.deepEqual(events, ['begin', 'reauth']); release(); await pending; assert.deepEqual(events, ['begin', 'reauth', 'end']);
  const bad = await fixture({ failActivation: true }); const failed = [];
  bad.environment.beginSessionTransition = () => { failed.push('begin'); return () => failed.push('end'); };
  await assert.rejects(bad.controller.switchTo(bad.second.id), /activation failed/); assert.deepEqual(failed, ['begin', 'end']);
});

test('selecting the current account remains a no-op; witness observers conservatively invalidate', async () => {
  const f = await fixture(), notifications = [];
  f.environment.beginSessionTransition = () => { notifications.push('begin'); return () => notifications.push('end'); };
  const result = await f.controller.switchTo(f.first.id);
  assert.equal(result.ref, 'a'); assert.equal(f.current().token, 'token-a'); assert.equal(f.store.activeAccountId, f.first.id);
  assert.deepEqual(f.events, []); assert.deepEqual(notifications, ['begin', 'end']);
});

test('a rejected overlapping switch ends only its own observer, preserving the first transition', async () => {
  const f = await fixture(), notifications = []; let resume, entered;
  const waiting = new Promise(resolve => { resume = resolve; }), started = new Promise(resolve => { entered = resolve; });
  let id = 0; f.environment.beginSessionTransition = () => { const n = ++id; notifications.push(`begin-${n}`); return () => notifications.push(`end-${n}`); };
  f.environment.unregisterCurrentPush = async () => { entered(); await waiting; };
  const first = f.controller.switchTo(f.second.id); await started;
  await assert.rejects(new AccountSwitchController(f.store, f.environment).switchTo(f.second.id), /already in progress/);
  assert.deepEqual(notifications, ['begin-1', 'begin-2', 'end-2']); resume(); await first;
  assert.deepEqual(notifications, ['begin-1', 'begin-2', 'end-2', 'end-1']);
});
