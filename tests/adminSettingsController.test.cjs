const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const test = require('node:test');
const ts = require('typescript');
function load(file, mocks = {}) {
  const filename = path.resolve(__dirname, '../src', file + '.ts'), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths;
  mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return mod.exports;
}
const { AdminSettingsController, adminSettingsFieldNames, adminSettingsFieldLabels } = load('admin/adminSettingsController', { './dartJsonString': load('admin/dartJsonString') });
const defaults = () => ({ erp_url: 'https://erp.example', erp_api_key: 'fake-key', erp_api_secret: 'fake-secret',
  default_target_warehouse: 'Warehouse', default_uom: 'kg', werka_phone: 'phone', werka_name: 'Name',
  werka_avatar_url: 'avatar', werka_code: 'server-only', werka_code_locked: true, werka_code_retry_after_sec: 9, admin_phone: 'admin-phone', admin_name: 'Admin' });
const tick = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => { let resolve, reject; return { promise: new Promise((yes, no) => { resolve = yes; reject = no; }), resolve: value => resolve(value), reject: value => reject(value) }; };
function fixture(overrides = {}) {
  let current = true;
  const calls = [], deps = { isCurrent: () => current, read: async guard => { guard(); calls.push('read'); return defaults(); },
    write: async (value, guard) => { guard(); calls.push(['write', value]); return value; }, ...overrides };
  const controller = new AdminSettingsController(deps);
  return { controller, calls, retire: () => { current = false; } };
}
test('initial load fills precisely the seven source fields in source order with exact label keys', async () => {
  const f = fixture(); f.controller.start(); await tick();
  assert.equal(f.controller.getSnapshot().phase, 'content');
  assert.deepEqual(adminSettingsFieldNames, ['erp_url', 'erp_api_key', 'erp_api_secret', 'default_target_warehouse', 'default_uom', 'werka_phone', 'werka_name']);
  assert.equal(adminSettingsFieldLabels.erp_api_key, 'api_key'); assert.equal(adminSettingsFieldLabels.erp_api_secret, 'api_secret');
  assert.equal(f.controller.getSnapshot().fields.erp_api_secret, 'fake-secret');
  assert.equal(f.controller.getSnapshot().fields.werka_code, undefined); assert.equal(f.controller.getSnapshot().changed, false);
});
test('save rereads hidden fields, accepts latest editable text, trims without adding validation, and uses acknowledged form values', async () => {
  const read = deferred(), calls = []; let reads = 0;
  const f = fixture({ read: async guard => { guard(); return ++reads === 1 ? defaults() : read.promise; },
    write: async (value, guard) => { guard(); calls.push(value); return { ...value, default_uom: 'acknowledged' }; } });
  f.controller.start(); await tick();
  f.controller.change('erp_url', 'not-a-url'); f.controller.change('erp_api_key', ' ');
  const pending = f.controller.save(); assert.equal(f.controller.getSnapshot().saving, true);
  f.controller.change('werka_name', '\u0085 latest \u0085'); read.resolve({ ...defaults(), werka_avatar_url: 'latest-avatar', admin_name: 'latest-admin', werka_code_retry_after_sec: 42 });
  await pending;
  assert.equal(calls.length, 1); assert.equal(calls[0].erp_url, 'not-a-url'); assert.equal(calls[0].erp_api_key, '');
  assert.equal(calls[0].werka_name, 'latest'); assert.equal(calls[0].werka_avatar_url, 'latest-avatar');
  assert.equal(calls[0].admin_name, 'latest-admin'); assert.equal(calls[0].werka_code_retry_after_sec, 42); assert.equal(calls[0].werka_code, '');
  const state = f.controller.getSnapshot(); assert.equal(state.fields.default_uom, 'acknowledged');
  assert.equal(state.changed, true); assert.equal(state.notice, 1); assert.equal(state.saving, false);
});
test('first read failure has source retry state and retries without exposing any credentials', async () => {
  let attempts = 0; const f = fixture({ read: async () => { if (++attempts === 1) throw new Error('read'); return defaults(); } });
  f.controller.start(); await tick(); assert.equal(f.controller.getSnapshot().phase, 'error');
  assert.equal(f.controller.getSnapshot().fields.erp_api_secret, ''); await f.controller.reload();
  assert.equal(f.controller.getSnapshot().phase, 'content'); assert.equal(attempts, 2);
});
for (const failureAt of ['read', 'write']) test(`save ${failureAt} failure clears busy and never invents success/changed`, async () => {
  let reads = 0; const f = fixture({ read: async () => { if (++reads > 1 && failureAt === 'read') throw new Error('read'); return defaults(); },
    write: async () => { throw new Error('write'); } });
  f.controller.start(); await tick(); f.controller.change('werka_name', 'edited');
  await assert.rejects(f.controller.save(), new RegExp(failureAt));
  const state = f.controller.getSnapshot(); assert.equal(state.saving, false); assert.equal(state.changed, false);
  assert.equal(state.notice, null); assert.equal(state.fields.werka_name, 'edited');
});
test('overlapping reloads cannot install an old form or clear a newer loading operation', async () => {
  const old = deferred(), fresh = deferred(); let reads = 0;
  const f = fixture({ read: () => ++reads === 1 ? old.promise : fresh.promise });
  f.controller.start(); const next = f.controller.reload(); fresh.resolve({ ...defaults(), werka_name: 'fresh' }); await next;
  old.resolve(defaults()); await tick(); assert.equal(f.controller.getSnapshot().fields.werka_name, 'fresh');
});
test('session loss before save PUT scrubs fields and never sends the command', async () => {
  const pendingRead = deferred(); let reads = 0, writes = 0;
  const f = fixture({ read: () => ++reads === 1 ? Promise.resolve(defaults()) : pendingRead.promise, write: async value => { writes++; return value; } });
  f.controller.start(); await tick(); const saving = f.controller.save(), rejected = assert.rejects(saving, /session changed/);
  f.retire(); pendingRead.resolve(defaults()); await rejected;
  assert.equal(writes, 0); assert.equal(f.controller.getSnapshot().phase, 'invalidated');
  assert.equal(f.controller.getSnapshot().fields.erp_api_secret, ''); assert.equal(f.controller.getSnapshot().notice, null);
});
test('synchronous listeners can retire a saving operation before its reread begins', async () => {
  const f = fixture(); f.controller.start(); await tick();
  f.controller.subscribe(() => { if (f.controller.getSnapshot().saving) f.retire(); });
  await assert.rejects(f.controller.save(), /session changed/); assert.deepEqual(f.calls, ['read']);
});
test('duplicate save/reload and callbacks after dispose do not start new effects', async () => {
  const write = deferred(); let writes = 0;
  const f = fixture({ write: async () => { writes++; return write.promise; } }); f.controller.start(); await tick();
  const saving = f.controller.save(); await tick(); await f.controller.save(); await f.controller.reload(); assert.equal(writes, 1);
  f.controller.dispose(); let ran = false; f.controller.runCurrent(() => { ran = true; }); assert.equal(ran, false);
  write.resolve(defaults()); await assert.rejects(saving, /session changed/);
});
test('successful changed result persists across a later failure; old notices cannot dismiss a newer notice', async () => {
  const f = fixture(); f.controller.start(); await tick(); await f.controller.save(); const first = f.controller.getSnapshot().notice;
  await f.controller.save(); f.controller.dismissNotice(first); assert.equal(f.controller.getSnapshot().notice, 2);
  f.controller.dismissNotice(2); assert.equal(f.controller.getSnapshot().notice, null);
  let result; f.controller.runCurrent(() => { result = f.controller.getSnapshot().changed; }); assert.equal(result, true);
});
