const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

const filename = path.resolve(__dirname, '../src/profileModel.ts');
const loaded = new Module(filename, module);
loaded.filename = filename;
loaded.paths = module.paths;
loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText, filename);

const { initialProfileSnapshot, profileSnapshotFromResponse, profileDisplay, profileAvatarSource } = loaded.exports;

function session(profile = {}) {
  return {
    baseUrl: 'https://mes.example.com', imageCacheScope: 'first-login',
    profile: { ref: 'worker-1', role: 'aparatchi', display_name: 'Ali', ...profile },
    assigned_apparatus_labels: ['Bosma 1'],
  };
}

test('profile refresh accepts only the active account and retains optional assignments', () => {
  const current = session();
  assert.equal(profileSnapshotFromResponse(current, { ref: 'other', role: 'aparatchi' }), null);
  assert.equal(profileSnapshotFromResponse(current, { ref: 'worker-1', role: 'admin' }), null);
  const refreshed = profileSnapshotFromResponse(current, { ref: 'worker-1', role: 'aparatchi', display_name: 'Vali' });
  assert.equal(profileDisplay(refreshed).name, 'Vali');
  assert.deepEqual(refreshed.apparatusLabels, ['Bosma 1']);
});

test('profile display follows the role and tolerates missing values', () => {
  const admin = profileDisplay(initialProfileSnapshot(session({ role: 'admin', display_name: '', legal_name: 'Aziza' })));
  assert.equal(admin.name, 'Aziza');
  assert.equal(admin.role, 'Administrator');
  assert.equal(admin.phone, '');
  assert.equal(profileDisplay(initialProfileSnapshot(session({ role: 'customer' }))).role, 'Mijoz');
});

test('werka profile names are normalized as in V2', () => {
  const details = profileDisplay(initialProfileSnapshot(session({ role: 'werka', display_name: ' Werka ', legal_name: 'WERKA' })));
  assert.equal(details.name, 'Wmanager');
  assert.equal(details.legalName, '');
  const other = profileDisplay(initialProfileSnapshot(session({ role: 'customer', display_name: 'Werka' })));
  assert.equal(other.name, 'Werka');
});

test('avatar requests stay on the session server and omit tokens from the URL and cache key', () => {
  const current = session({ avatar_url: 'https://elsewhere.example/avatar?token=secret&v=42' });
  const source = profileAvatarSource(current, current.profile);
  assert.equal(source.uri, 'https://mes.example.com/v1/mobile/profile/avatar/view?v=42');
  assert.ok(!source.cacheKey.includes('secret'));
  assert.notEqual(source.cacheKey, profileAvatarSource({ ...current, imageCacheScope: 'second-login' }, current.profile).cacheKey);
  assert.equal(profileAvatarSource({ ...current, baseUrl: 'http://mes.example.com' }, current.profile), null);
});
