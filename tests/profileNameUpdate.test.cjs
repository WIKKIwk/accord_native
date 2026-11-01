const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

function loadTs(relativePath, overrides = {}) {
  const filename = path.resolve(__dirname, '../src', relativePath);
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = module.paths;
  loaded.require = (name) => Object.hasOwn(overrides, name) ? overrides[name] : require(name);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText, filename);
  return loaded.exports;
}

function fixture(options = {}) {
  const calls = [];
  const session = { profile: { role: 'aparatchi', ref: 'worker-1' }, assigned_apparatus_labels: [] };
  const { updateProfileName } = loadTs('profileNameUpdate.ts', {
    './auth': { activeSessionToken: () => options.inactive ? null : 'token' },
    './authorizedFetch': { authorizedFetch: async (...args) => {
      calls.push(args);
      return { ok: options.ok ?? true, json: async () => options.response ?? { role: 'aparatchi', ref: 'worker-1', display_name: 'Ali' } };
    } },
    './profileModel': loadTs('profileModel.ts'),
  });
  return { calls, session, updateProfileName };
}

test('saving the display name uses the existing nickname API', async () => {
  const { calls, session, updateProfileName } = fixture();
  const signal = new AbortController().signal;
  const snapshot = await updateProfileName(session, '  Ali  ', signal);
  assert.equal(snapshot.profile.display_name, 'Ali');
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], session);
  assert.equal(calls[0][1], '/v1/mobile/profile');
  assert.deepEqual(calls[0][2], {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: '{"nickname":"Ali"}', signal,
  });
});

test('blank names and inactive or canceled sessions never reach the server', async () => {
  const blank = fixture();
  await assert.rejects(blank.updateProfileName(blank.session, '  ', new AbortController().signal));
  assert.equal(blank.calls.length, 0);
  const inactive = fixture({ inactive: true });
  await assert.rejects(inactive.updateProfileName(inactive.session, 'Ali', new AbortController().signal));
  assert.equal(inactive.calls.length, 0);
  const canceled = fixture();
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(canceled.updateProfileName(canceled.session, 'Ali', controller.signal));
  assert.equal(canceled.calls.length, 0);
});

test('a server response must match the active account and confirm the new name', async () => {
  for (const response of [
    { role: 'aparatchi', ref: 'other', display_name: 'Ali' },
    { role: 'aparatchi', ref: 'worker-1', display_name: 'Old name' },
  ]) {
    const { session, updateProfileName } = fixture({ response });
    await assert.rejects(updateProfileName(session, 'Ali', new AbortController().signal), /tasdiqlamadi/);
  }
});
