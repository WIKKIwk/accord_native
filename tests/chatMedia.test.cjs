/* global __dirname, Buffer */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

function load(file, mocks = {}) {
  const filename = path.resolve(__dirname, '../src', file);
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = module.paths;
  loaded.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText, filename);
  return loaded.exports;
}

function fixture(handler, bytes = Buffer.from([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])) {
  const files = new Map([['file:///picked', bytes]]);
  class FakeFile {
    constructor(uri) { this.uri = uri; }
    get exists() { return files.has(this.uri); }
    get size() { return files.get(this.uri)?.length ?? 0; }
    delete() { files.delete(this.uri); }
    open() {
      let offset = 0;
      return {
        get offset() { return offset; }, set offset(value) { offset = value; },
        async readBytes(length) {
          const part = files.get('file:///picked').subarray(offset, offset + Math.min(length, 3));
          offset += part.length;
          return Uint8Array.from(part);
        },
        close() {},
      };
    }
  }
  const session = { token: 'private-token', baseUrl: 'https://erp.example', imageCacheScope: 'scope', profile: { role: 'aparatchi', ref: 'worker-1' } };
  let active = true;
  let serial = 0;
  const calls = [];
  const api = load('chatMedia.ts', {
    'expo-crypto': { randomUUID: () => `uuid-${++serial}` },
    'expo-file-system': { File: FakeFile, FileMode: { ReadOnly: 'r' } },
    'expo-image-manipulator': { ImageManipulator: { manipulate: () => ({
      renderAsync: async () => ({ saveAsync: async () => { files.set('file:///converted', bytes); return { uri: 'file:///converted' }; }, release() {} }),
      release() {},
    }) }, SaveFormat: { JPEG: 'jpeg' } },
    './auth': { activeSessionToken: () => active ? session.token : null },
    './authorizedFetch': { authorizedFetch: async (...args) => { calls.push(args); return handler(...args); } },
    './chatModel': load('chatModel.ts'),
  });
  return { ...api, session, calls, files, logout: () => { active = false; } };
}

const response = payload => ({ ok: true, status: 200, json: async () => payload });
function serverMedia(draft, status = 'pending', extra = {}) {
  return { media_id: 'media-1', upload_id: 'upload-1', conversation_id: 'c1', client_upload_id: draft.clientUploadId,
    kind: draft.kind, size_bytes: draft.sizeBytes, upload_mode: draft.kind === 'video' ? 'chunked' : 'single', status, ...extra };
}
function confirmed(draft, body = '') {
  return { message: { message_id: 'm1', conversation_id: 'c1', client_message_id: draft.clientMessageId,
    sender_role: 'aparatchi', sender_ref: 'worker-1', sequence: 1, type: draft.kind, body, created_at_unix: 1,
    attachment: { kind: draft.kind, media_id: 'media-1' } } };
}
const imageAsset = { uri: 'file:///picked', type: 'image', fileName: 'photo.png', mimeType: 'image/png', width: 1, height: 1 };
const videoAsset = { uri: 'file:///picked', type: 'video', fileName: 'clip.mov', mimeType: 'video/quicktime', width: 1, height: 1, duration: 1000 };

test('an image is uploaded and sent only after a matching server confirmation', async () => {
  let draft;
  const f = fixture(async (_session, url, init = {}) => {
    if (url.endsWith('/uploads')) return response({ media: serverMedia(draft), upload: {
      strategy: 'local_proxy', method: 'PUT', url: '/v1/mobile/chat/conversations/c1/media/uploads/upload-1/content', headers: { 'content-type': 'image/png' },
    } });
    if (url.endsWith('/content')) { assert.deepEqual([...new Uint8Array(init.body)], [...f.files.get('file:///picked')]); return response({}); }
    if (url.endsWith('/complete')) return response({ media: serverMedia(draft, 'ready') });
    if (url.endsWith('/messages')) { assert.deepEqual(JSON.parse(init.body), { client_message_id: draft.clientMessageId, body: 'Izoh', media_id: 'media-1' }); return response(confirmed(draft, 'Izoh')); }
    throw new Error(`unexpected path ${url}`);
  });
  draft = await f.prepareChatMedia(imageAsset);
  const message = await f.sendChatMedia(f.session, 'c1', draft, ' Izoh ', new AbortController().signal, () => {});
  assert.equal(message.attachment.kind, 'image');
  assert.equal(message.attachment.mediaId, 'media-1');
  assert.equal(message.caption, 'Izoh');
  assert.deepEqual(f.calls.map(call => call[1].split('/').pop()), ['uploads', 'content', 'complete', 'messages']);
});

test('video uploads only missing bounded chunks with the required inclusive ranges', async () => {
  let draft;
  const chunks = [];
  const f = fixture(async (_session, url, init = {}) => {
    if (url.endsWith('/uploads')) return response({ media: serverMedia(draft, 'pending', { uploaded_chunks: [{ chunk_index: 0 }] }), upload: {
      strategy: 'resumable_chunks', method: 'PUT', url: '/v1/mobile/chat/conversations/c1/media/uploads/upload-1/chunks/{chunk_index}',
      chunk_size_bytes: 4, total_chunks: 3, headers: { 'content-type': 'application/octet-stream' },
    } });
    if (url.includes('/chunks/')) { chunks.push({ url, headers: init.headers, bytes: [...new Uint8Array(init.body)] }); return response({ media: serverMedia(draft) }); }
    if (url.endsWith('/complete')) return response({ media: serverMedia(draft, 'ready') });
    if (url.endsWith('/messages')) return response(confirmed(draft));
    throw new Error(`unexpected path ${url}`);
  });
  draft = await f.prepareChatMedia(videoAsset);
  const message = await f.sendChatMedia(f.session, 'c1', draft, '', new AbortController().signal, () => {});
  assert.equal(message.attachment.kind, 'video');
  assert.deepEqual(chunks.map(item => [item.url.split('/').pop(), item.headers['Content-Range'], item.bytes]), [
    ['1', 'bytes 4-7/10', [4, 5, 6, 7]], ['2', 'bytes 8-9/10', [8, 9]],
  ]);
});

test('a lost send response retries the existing ready upload and keeps the message id', async () => {
  let draft;
  let messages = 0;
  const f = fixture(async (_session, url, init = {}) => {
    if (url.endsWith('/uploads')) return response({ media: serverMedia(draft), upload: {
      strategy: 'local_proxy', method: 'PUT', url: '/v1/mobile/chat/conversations/c1/media/uploads/upload-1/content', headers: {},
    } });
    if (url.endsWith('/content')) return response({});
    if (url.endsWith('/complete') || url.endsWith('/upload-1')) return response({ media: serverMedia(draft, 'ready') });
    if (url.endsWith('/messages')) {
      assert.equal(JSON.parse(init.body).client_message_id, draft.clientMessageId);
      if (++messages === 1) throw new Error('connection lost');
      return response(confirmed(draft));
    }
    throw new Error(`unexpected path ${url}`);
  });
  draft = await f.prepareChatMedia(imageAsset);
  await assert.rejects(f.sendChatMedia(f.session, 'c1', draft, '', new AbortController().signal, () => {}));
  await f.sendChatMedia(f.session, 'c1', draft, '', new AbortController().signal, () => {});
  assert.equal(messages, 2);
  assert.equal(f.calls.filter(call => call[1].endsWith('/uploads')).length, 1);
});

test('a failed media processing attempt can be retried with a fresh upload', async () => {
  let draft;
  let uploads = 0;
  const f = fixture(async (_session, url) => {
    if (url.endsWith('/uploads')) {
      uploads++;
      return response({ media: serverMedia(draft), upload: {
        strategy: 'local_proxy', method: 'PUT', url: '/v1/mobile/chat/conversations/c1/media/uploads/upload-1/content', headers: {},
      } });
    }
    if (url.endsWith('/content')) return response({});
    if (url.endsWith('/complete')) return response({ media: serverMedia(draft, uploads === 1 ? 'failed' : 'ready') });
    if (url.endsWith('/messages')) return response(confirmed(draft));
    throw new Error(`unexpected path ${url}`);
  });
  draft = await f.prepareChatMedia(imageAsset);
  const uploadId = draft.clientUploadId;
  const messageId = draft.clientMessageId;
  await assert.rejects(f.sendChatMedia(f.session, 'c1', draft, '', new AbortController().signal, () => {}), /Media tayyorlanmadi/);
  assert.notEqual(draft.clientUploadId, uploadId);
  assert.equal(draft.clientMessageId, messageId);
  await f.sendChatMedia(f.session, 'c1', draft, '', new AbortController().signal, () => {});
  assert.equal(uploads, 2);
});

test('direct storage uploads never forward the session authorization', async () => {
  let draft;
  const originalFetch = global.fetch;
  let externalHeaders;
  global.fetch = async (url, init) => { assert.equal(url, 'https://storage.example/upload?signature=abc'); externalHeaders = init.headers; return { ok: true }; };
  try {
    const f = fixture(async (_session, url) => {
      if (url.endsWith('/uploads')) return response({ media: serverMedia(draft), upload: {
        strategy: 'direct_put', method: 'PUT', url: 'https://storage.example/upload?signature=abc', headers: { Authorization: 'bad-value' },
      } });
      if (url.endsWith('/complete')) return response({ media: serverMedia(draft, 'ready') });
      if (url.endsWith('/messages')) return response(confirmed(draft));
      throw new Error('unexpected path');
    });
    draft = await f.prepareChatMedia(imageAsset);
    await f.sendChatMedia(f.session, 'c1', draft, '', new AbortController().signal, () => {});
    assert.equal(externalHeaders.get('Authorization'), null);
  } finally { global.fetch = originalFetch; }
});

test('picker validates duration and converts unsupported iOS photos to JPEG', async () => {
  const f = fixture(() => { throw new Error('unexpected network'); });
  await assert.rejects(f.prepareChatMedia({ ...videoAsset, duration: 600001 }), /10 daqiqadan/);
  const image = await f.prepareChatMedia({ ...imageAsset, fileName: 'photo.heic', mimeType: 'image/heic' });
  assert.equal(image.contentType, 'image/jpeg');
  assert.equal(image.temporary, true);
  f.discardChatMedia(image);
  assert.equal(f.files.has('file:///converted'), false);
});

test('media tickets are confined to the active server and selected media', async () => {
  const f = fixture(async () => response({ url: '/v1/mobile/chat/media/media-1/content?ticket=short-lived' }));
  const url = await f.chatMediaTicket(f.session, 'media-1');
  assert.equal(new URL(url).origin, f.session.baseUrl);
  const unsafe = fixture(async () => response({ url: 'https://evil.example/v1/mobile/chat/media/media-1/content?ticket=x' }));
  await assert.rejects(unsafe.chatMediaTicket(unsafe.session, 'media-1'), /manzili noto‘g‘ri/);
});
