const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

function loadTs(relativePath, overrides = {}) {
  const filename = path.resolve(__dirname, '../src', relativePath);
  const loaded = new Module(filename, module);
  loaded.filename = filename; loaded.paths = module.paths;
  loaded.require = name => Object.hasOwn(overrides, name) ? overrides[name] : require(name);
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
    './profileModel': loadTs('profileModel.ts'),
    './shared/profileApi': { updateNickname: async (target, nickname, signal) => {
      calls.push({ target, nickname, signal });
      if (options.failure) throw new Error('offline');
      target.profile = { role: 'aparatchi', ref: 'worker-1', display_name: options.returnedName ?? nickname };
    } },
  });
  return { calls, session, updateProfileName };
}

test('profile nickname uses the shared API and accepts the server profile', async () => {
  const { calls, session, updateProfileName } = fixture({ returnedName: 'Server name' });
  const signal = new AbortController().signal;
  const snapshot = await updateProfileName(session, '  Ali  ', signal);
  assert.equal(snapshot.profile.display_name, 'Server name');
  assert.deepEqual(calls, [{ target: session, nickname: 'Ali', signal }]);
});

test('inactive or canceled sessions do not update the nickname', async () => {
  const inactive = fixture({ inactive: true });
  await assert.rejects(inactive.updateProfileName(inactive.session, 'Ali', new AbortController().signal));
  assert.equal(inactive.calls.length, 0);
  const canceled = fixture();
  const controller = new AbortController(); controller.abort();
  await assert.rejects(canceled.updateProfileName(canceled.session, 'Ali', controller.signal));
  assert.equal(canceled.calls.length, 0);
});

test('profile nickname maps an API failure to the save error', async () => {
  const f = fixture({ failure: true });
  await assert.rejects(f.updateProfileName(f.session, 'Ali', new AbortController().signal), /saqlab bo‘lmadi/);
});
