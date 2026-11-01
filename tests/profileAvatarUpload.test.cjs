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
  const calls = { requests: [], released: 0, deleted: [] };
  const session = { profile: { role: 'aparatchi', ref: 'worker-1' }, assigned_apparatus_labels: [], baseUrl: 'https://example.com' };
  let active = true;
  class FakeFile {
    constructor(uri) { this.uri = uri; this.size = options.size ?? 12345; this.name = 'avatar.jpg'; this.type = 'image/jpeg'; }
    async bytes() { return new Uint8Array([0xff, 0xd8, 0xff, 0xd9]); }
    delete() { calls.deleted.push(this.uri); if (options.cleanupThrows) throw new Error('already removed'); }
  }
  const response = options.response ?? { role: 'aparatchi', ref: 'worker-1', avatar_url: '/avatar?v=2' };
  const { uploadProfileAvatar } = loadTs('profileAvatarUpload.ts', {
    'expo-file-system': { File: FakeFile },
    'expo-image-manipulator': {
      SaveFormat: { JPEG: 'jpeg' },
      ImageManipulator: { manipulate: (uri, settings) => {
        calls.input = { uri, settings };
        return {
          async renderAsync() {
            if (options.onRender) options.onRender(() => { active = false; });
            if (options.renderThrows) throw new Error('native image failed');
            return {
              async saveAsync(settings) { calls.save = settings; return { uri: 'file:///cache/avatar.jpg' }; },
              release() { calls.released++; if (options.cleanupThrows) throw new Error('already released'); },
            };
          },
          release() { calls.released++; if (options.cleanupThrows) throw new Error('already released'); },
        };
      } },
    },
    'react-native': { Platform: { OS: 'ios' } },
    './auth': { activeSessionToken: () => active ? 'token' : null },
    './authorizedFetch': { authorizedFetch: async (...args) => {
      calls.requests.push(args);
      if (options.networkThrows) throw new TypeError('network unavailable');
      return { ok: options.ok ?? true, json: async () => response };
    } },
    './profileModel': loadTs('profileModel.ts'),
  });
  return { calls, session, uploadProfileAvatar, FakeFile };
}

class NativeFormData {
  constructor() { this.parts = []; }
  append(...part) { this.parts.push(part); }
  entries() { return this.parts[Symbol.iterator](); }
}

test('photo becomes a bounded JPEG and is uploaded as the avatar multipart field', async () => {
  const originalFormData = global.FormData;
  global.FormData = NativeFormData;
  try {
    const { calls, session, uploadProfileAvatar, FakeFile } = fixture();
    const signal = new AbortController().signal;
    const result = await uploadProfileAvatar(session, 'file:///library/photo.heic', signal);
    assert.deepEqual(calls.input, { uri: 'file:///library/photo.heic', settings: { maxWidth: 1000, maxHeight: 1000 } });
    assert.deepEqual(calls.save, { format: 'jpeg', compress: 0.82 });
    assert.equal(calls.requests.length, 1);
    const [sentSession, url, request] = calls.requests[0];
    assert.equal(sentSession, session);
    assert.equal(url, '/v1/mobile/profile/avatar');
    assert.equal(request.method, 'POST');
    assert.equal(request.headers, undefined);
    assert.equal(request.signal, signal);
    assert.equal(request.body.parts.length, 1);
    const [field, file] = request.body.parts[0];
    assert.equal(field, 'avatar');
    assert.ok(file instanceof FakeFile);
    assert.equal(file.uri, 'file:///cache/avatar.jpg');
    assert.equal(file.type, 'image/jpeg');
    assert.equal(typeof file.bytes, 'function');
    assert.equal(result.profile.avatar_url, '/avatar?v=2');
    assert.equal(calls.released, 2);
    assert.deepEqual(calls.deleted, ['file:///cache/avatar.jpg']);
  } finally { global.FormData = originalFormData; }
});

test('the avatar part is accepted by Expo SDK 58 multipart conversion', async () => {
  const originalFormData = global.FormData;
  global.FormData = NativeFormData;
  try {
    const { calls, session, uploadProfileAvatar } = fixture();
    await uploadProfileAvatar(session, 'file:///photo.heic', new AbortController().signal);
    const filename = path.resolve(__dirname, '../node_modules/expo/src/winter/fetch/convertFormData.ts');
    const loaded = new Module(filename, module);
    loaded.filename = filename;
    loaded.paths = module.paths;
    loaded.require = (name) => name === '../../utils/blobUtils' ? {} : require(name);
    loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS },
    }).outputText, filename);
    const { body } = await loaded.exports.convertFormDataAsync(calls.requests[0][2].body, 'TESTBOUNDARY');
    const encoded = Buffer.from(body);
    assert.match(encoded.toString('latin1'), /content-disposition: form-data; name="avatar"; filename="avatar\.jpg"/);
    assert.match(encoded.toString('latin1'), /content-type: image\/jpeg/);
    assert.ok(encoded.includes(Buffer.from([0xff, 0xd8, 0xff, 0xd9])));
  } finally { global.FormData = originalFormData; }
});

test('never upload after the session changes while the photo is being processed', async () => {
  const { calls, session, uploadProfileAvatar } = fixture({ onRender: (logout) => logout() });
  await assert.rejects(uploadProfileAvatar(session, 'file:///photo.heic', new AbortController().signal));
  assert.equal(calls.requests.length, 0);
  assert.equal(calls.released, 2);
  assert.deepEqual(calls.deleted, ['file:///cache/avatar.jpg']);
});

test('reject oversized images before contacting the server', async () => {
  const { calls, session, uploadProfileAvatar } = fixture({ size: 5 * 1024 * 1024 });
  await assert.rejects(uploadProfileAvatar(session, 'file:///photo.heic', new AbortController().signal), /juda katta/);
  assert.equal(calls.requests.length, 0);
  assert.deepEqual(calls.deleted, ['file:///cache/avatar.jpg']);
});

test('do not accept a response for a different account or one without a saved avatar', async () => {
  const originalFormData = global.FormData;
  global.FormData = NativeFormData;
  try {
    for (const response of [
      { role: 'aparatchi', ref: 'other', avatar_url: '/avatar' },
      { role: 'aparatchi', ref: 'worker-1', avatar_url: '' },
    ]) {
      const { session, uploadProfileAvatar } = fixture({ response });
      await assert.rejects(uploadProfileAvatar(session, 'file:///photo.heic', new AbortController().signal), /tasdiqlamadi/);
    }
  } finally { global.FormData = originalFormData; }
});

test('cleanup errors do not hide a successful server upload', async () => {
  const originalFormData = global.FormData;
  global.FormData = NativeFormData;
  try {
    const { calls, session, uploadProfileAvatar } = fixture({ cleanupThrows: true });
    const snapshot = await uploadProfileAvatar(session, 'file:///photo.heic', new AbortController().signal);
    assert.equal(snapshot.profile.avatar_url, '/avatar?v=2');
    assert.equal(calls.requests.length, 1);
    assert.equal(calls.released, 2);
    assert.deepEqual(calls.deleted, ['file:///cache/avatar.jpg']);
  } finally { global.FormData = originalFormData; }
});

test('preparation and network failures receive distinct actionable messages', async () => {
  const preparation = fixture({ renderThrows: true });
  await assert.rejects(preparation.uploadProfileAvatar(preparation.session, 'file:///photo.heic', new AbortController().signal), /tayyorlab bo‘lmadi/);
  assert.equal(preparation.calls.requests.length, 0);
  assert.equal(preparation.calls.released, 1);

  const originalFormData = global.FormData;
  global.FormData = NativeFormData;
  try {
    const network = fixture({ networkThrows: true });
    await assert.rejects(network.uploadProfileAvatar(network.session, 'file:///photo.heic', new AbortController().signal), /Serverga ulanib bo‘lmadi/);
    assert.equal(network.calls.requests.length, 1);
    assert.equal(network.calls.released, 2);
    assert.deepEqual(network.calls.deleted, ['file:///cache/avatar.jpg']);
  } finally { global.FormData = originalFormData; }
});
