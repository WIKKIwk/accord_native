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
  loaded.require = name => Object.hasOwn(overrides, name) ? overrides[name] : name === './shared/profileSessionGuard' ? loadTs('shared/profileSessionGuard.ts') : require(name);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText, filename);
  return loaded.exports;
}

function fixture(options = {}) {
  const calls = { uploads: [], released: 0, deleted: [] };
  const session = { profile: { role: 'aparatchi', ref: 'worker-1' }, assigned_apparatus_labels: [], baseUrl: 'https://example.com' };
  let active = true;
  class FakeFile {
    constructor(uri) { this.uri = uri; this.name = 'source.jpg'; }
    async bytes() { return new Uint8Array(options.empty ? [] : [0xff, 0xd8, 0xff, 0xd9]); }
    delete() { calls.deleted.push(this.uri); }
  }
  const { uploadProfileAvatar } = loadTs('profileAvatarUpload.ts', {
    'expo-file-system': { File: FakeFile },
    'expo-image-manipulator': { SaveFormat: { JPEG: 'jpeg' }, ImageManipulator: { manipulate: (uri, settings) => {
      calls.input = { uri, settings };
      return { async renderAsync() {
        if (options.onRender) options.onRender(() => { active = false; });
        return { async saveAsync(settings) { calls.save = settings; return { uri: 'file:///cache/avatar.jpg' }; },
          release() { calls.released++; } };
      }, release() { calls.released++; } };
    } } },
    'react-native': { Platform: { OS: 'ios' } },
    './auth': { activeSessionToken: () => active ? 'token' : null },
    './shared/profileApi': { uploadAvatar: async (target, bytes, filename, signal) => {
      calls.uploads.push({ target, bytes: [...bytes], filename, signal });
      if (options.networkThrows) throw new Error('offline');
      target.profile = { role: 'aparatchi', ref: 'worker-1', avatar_url: '' };
    } },
    './shared/profileAvatarRuntime': { cacheProfileAvatarBytes: (target, profile, bytes) => { calls.cached = [...bytes]; } },
    './profileModel': loadTs('profileModel.ts'),
  });
  return { calls, session, uploadProfileAvatar };
}

test('photo preparation uses V2 bounds and quality before the shared multipart API', async () => {
  const { calls, session, uploadProfileAvatar } = fixture();
  const signal = new AbortController().signal;
  const result = await uploadProfileAvatar(session, 'file:///library/photo.heic', signal, 'photo.heic');
  assert.deepEqual(calls.input, { uri: 'file:///library/photo.heic', settings: { maxWidth: 1000, maxHeight: 1000 } });
  assert.deepEqual(calls.save, { format: 'jpeg', compress: 0.82 });
  assert.deepEqual(calls.uploads, [{ target: session, bytes: [255, 216, 255, 217], filename: 'photo.heic', signal }]);
  assert.equal(result.profile.avatar_url, '');
  assert.deepEqual(calls.cached, [255, 216, 255, 217]);
  assert.equal(calls.released, 2);
  assert.deepEqual(calls.deleted, ['file:///cache/avatar.jpg']);
});

test('an empty selected image is not uploaded', async () => {
  const f = fixture({ empty: true });
  await assert.rejects(f.uploadProfileAvatar(f.session, 'file:///photo.jpg', new AbortController().signal), /o‘qib bo‘lmadi/);
  assert.equal(f.calls.uploads.length, 0);
});

test('photo upload stops when the session changes during preparation', async () => {
  const f = fixture({ onRender: logout => logout() });
  await assert.rejects(f.uploadProfileAvatar(f.session, 'file:///photo.jpg', new AbortController().signal));
  assert.equal(f.calls.uploads.length, 0);
  assert.equal(f.calls.released, 2);
});

test('photo upload reports an API failure and releases temporary resources', async () => {
  const f = fixture({ networkThrows: true });
  await assert.rejects(f.uploadProfileAvatar(f.session, 'file:///photo.jpg', new AbortController().signal), /Serverga ulanib bo‘lmadi/);
  assert.equal(f.calls.uploads.length, 1);
  assert.equal(f.calls.released, 2);
});
