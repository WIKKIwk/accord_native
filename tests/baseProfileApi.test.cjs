const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const test = require('node:test');
const ts = require('typescript');
function load(file, overrides = {}) {
  const filename = path.resolve(__dirname, '../src', file + '.ts');
  const mod = new Module(filename, module); mod.filename = filename; mod.paths = module.paths;
  mod.require = name => Object.hasOwn(overrides, name) ? overrides[name] : name === './profileSessionGuard' ? load('shared/profileSessionGuard') : require(name);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return mod.exports;
}
function fixture(status = 200) {
  const calls = [], saved = [];
  const parser = load('authenticateAccount', { './workerControlsApi': { isCanonicalApparatusId: () => true } });
  const api = load('shared/profileApi', { '../auth': { saveSession: async s => saved.push({ ...s }) },
    '../authenticateAccount': parser, '../authorizedFetch': { authorizedFetch: async (s, p, init, beforeSend, timeout) => {
      calls.push({ route: p, ...init, timeout }); return { status, json: async () => ({ role: 'aparatchi', ref: 'one',
        display_name: 'New', capabilities: ['apparatus.queue.read'], assigned_item_groups: ['A'] }) };
    } } });
  const session = { token: 'token', profile: { role: 'aparatchi', ref: 'one' }, capabilities: [],
    assigned_apparatus: [], assigned_apparatus_labels: [], baseUrl: 'https://example.test', imageCacheScope: 'x' };
  return { ...api, session, calls, saved };
}

test('nickname update preserves the supplied string and updates the current profile', async () => {
  const f = fixture();
  const profile = await f.updateNickname(f.session, ' New ');
  assert.equal(f.calls[0].route, '/v1/mobile/profile');
  assert.deepEqual(JSON.parse(f.calls[0].body), { nickname: ' New ' });
  assert.equal(profile.display_name, 'New');
  assert.deepEqual(f.session.capabilities, ['apparatus.queue.read']);
  assert.deepEqual(f.session.assigned_item_groups, ['A']);
  assert.equal(f.saved.length, 1);
});

test('avatar upload sends the V2 multipart file and byte content', async () => {
  const f = fixture();
  await f.uploadAvatar(f.session, [0, 255, 13, 10], 'name"\n.png');
  const call = f.calls[0];
  assert.equal(call.route, '/v1/mobile/profile/avatar');
  assert.equal(call.timeout, null);
  const boundary = call.headers['Content-Type'].split('boundary=')[1];
  assert.equal(boundary.length, 70);
  const bytes = Buffer.from(call.body);
  const head = Buffer.from(`--${boundary}\r\ncontent-type: application/octet-stream\r\ncontent-disposition: form-data; name="avatar"; filename="name%22%0D%0A.png"\r\n\r\n`);
  assert.deepEqual(bytes.subarray(0, head.length), head);
  assert.deepEqual(bytes.subarray(head.length, head.length + 4), Buffer.from([0, 255, 13, 10]));
  assert.equal(bytes.subarray(head.length + 4).toString(), `\r\n--${boundary}--\r\n`);
  assert.equal(f.saved.length, 1);
});

test('profile mutations require status 200 and do not persist failed responses', async () => {
  const f = fixture(201);
  await assert.rejects(f.updateNickname(f.session, 'name'), /Nickname update failed/);
  await assert.rejects(f.uploadAvatar(f.session, [], 'avatar.jpg'), /Avatar upload failed/);
  assert.equal(f.saved.length, 0);
});
