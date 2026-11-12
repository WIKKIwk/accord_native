const assert = require('node:assert/strict'), test = require('node:test');
const { load } = require('./support/workerOrderScreen.cjs');
const error = load('shared/mobileApiException.ts');
function setup(platform = 'android') {
  const calls = [], h = { current: true, granted: true, picked: { canceled: false, assets: [{ uri: 'file:photo', width: 100, height: 200 }] }, bytes: new Uint8Array([1]) };
  const context = { resize: value => calls.push(['resize', value]), renderAsync: async () => {
    if (h.renderWait) await h.renderWait;
    return { saveAsync: async options => { calls.push(['save', options]); return { uri: 'file:resized' }; } };
  } };
  class File {
    constructor(uri) { this.uri = uri; }
    async bytes() { calls.push(['read', this.uri]); if (h.readWait) await h.readWait; if (h.readError) throw h.readError; return h.bytes; }
  }
  const api = load('workerReturnedPaintPhoto.ts', {
    'expo-image-picker': { requestCameraPermissionsAsync: async () => { calls.push(['permission']); return { granted: h.granted }; },
      launchCameraAsync: async options => { calls.push(['camera', options]); return h.picked; },
      launchImageLibraryAsync: async options => { calls.push(['gallery', options]); return h.picked; } },
    'expo-image-manipulator': { SaveFormat: { PNG: 'png', WEBP: 'webp', JPEG: 'jpeg' }, ImageManipulator: { manipulate: uri => { calls.push(['manipulate', uri]); return context; } } },
    'expo-file-system': { File }, 'react-native': { Platform: { OS: platform } }, './shared/mobileApiException': error,
  });
  return Object.assign(h, { api, calls, valid: () => h.current });
}
test('native paint pickers retain image-only source quality and cancellation performs no preparation', async () => {
  const h = setup();
  assert.equal((await h.api.selectWorkerReturnedPaintPhoto('camera', h.valid)).uri, 'file:photo');
  assert.deepEqual(h.calls, [['permission'], ['camera', { mediaTypes: ['images'], quality: 0.84 }]]);
  h.calls.length = 0; h.picked = { canceled: true, assets: null };
  assert.equal(await h.api.selectWorkerReturnedPaintPhoto('gallery', h.valid), null);
  assert.deepEqual(h.calls, [['gallery', { mediaTypes: ['images'], quality: 0.84 }]]);
  h.current = false; assert.equal(await h.api.selectWorkerReturnedPaintPhoto('camera', h.valid), null); assert.equal(h.calls.length, 1);
});
test('paint preparation bounds the larger dimension, retains supported MIME and reads the resized native file', async () => {
  const h = setup();
  const result = await h.api.prepareWorkerReturnedPaintPhoto({ uri: 'file:photo', width: 4000, height: 2000, fileName: 'label.png', mimeType: 'image/png' }, h.valid);
  assert.deepEqual(h.calls, [['manipulate', 'file:photo'], ['resize', { width: 1800 }], ['save', { compress: 0.84, format: 'png' }], ['read', 'file:resized']]);
  assert.equal(result.filename, 'label.png'); assert.equal(result.mime, 'image/png'); assert.deepEqual(result.bytes, new Uint8Array([1]));
  h.calls.length = 0;
  await h.api.prepareWorkerReturnedPaintPhoto({ uri: 'file:photo', width: 2000, height: 4000, fileName: 'camera.heic', mimeType: 'image/heic' }, h.valid);
  assert.deepEqual(h.calls[1], ['resize', { height: 1800 }]); assert.equal(h.calls[2][1].format, 'jpeg');
});
test('Android and iOS read selected file and content URIs, never the 404 response body from fetch', async () => {
  for (const platform of ['android', 'ios']) {
    for (const uri of ['file:///cache/selected.jpg', 'content://picker/selected']) {
      const h = setup(platform), original = global.fetch;
      h.bytes = Uint8Array.from([0xff, 0xd8, 0xff, 0x01]);
      global.fetch = async () => { throw Error('native file must not use fetch'); };
      try {
        const result = await h.api.prepareWorkerReturnedPaintPhoto({ uri, width: 10, height: 10, fileName: 'selected.jpg', mimeType: 'image/jpeg' }, h.valid);
        assert.deepEqual(result.bytes, h.bytes); assert.deepEqual(h.calls, [['read', uri]]);
      } finally { global.fetch = original; }
    }
  }
});
test('small photo MIME fallback and exact empty/6MB source guards are preserved', async () => {
  const h = setup(), asset = { uri: 'file:small', width: 10, height: 10, fileName: 'small.webp' };
  assert.equal((await h.api.prepareWorkerReturnedPaintPhoto(asset, h.valid)).mime, 'image/webp');
  assert.equal((await h.api.prepareWorkerReturnedPaintPhoto({ ...asset, mimeType: 'application/octet-stream' }, h.valid)).mime, 'image/webp');
  for (const [size, code, message] of [[0, 'returned_paint_image_empty', 'Tanlangan rasm bo‘sh'], [6 * 1024 * 1024 + 1, 'returned_paint_image_too_large', 'Rasm hajmi 6 MB dan oshmasligi kerak']]) {
    h.bytes = new Uint8Array(size);
    await assert.rejects(h.api.prepareWorkerReturnedPaintPhoto(asset, h.valid), failure => failure.code === code && failure.message === message);
  }
  h.bytes = new Uint8Array(6 * 1024 * 1024); assert.equal((await h.api.prepareWorkerReturnedPaintPhoto(asset, h.valid)).bytes.length, 6 * 1024 * 1024);
});
test('web photo preparation rejects a failed fetch instead of uploading its error body', async () => {
  const h = setup('web'), original = global.fetch, asset = { uri: 'blob:chosen', width: 10, height: 10, fileName: 'a.png' };
  try {
    global.fetch = async () => ({ ok: false, arrayBuffer: async () => new TextEncoder().encode('File not found').buffer });
    await assert.rejects(h.api.prepareWorkerReturnedPaintPhoto(asset, h.valid), /image_read_failed/);
    global.fetch = async () => ({ ok: true, arrayBuffer: async () => Uint8Array.from([4, 5]).buffer });
    assert.deepEqual((await h.api.prepareWorkerReturnedPaintPhoto(asset, h.valid)).bytes, Uint8Array.from([4, 5]));
  } finally { global.fetch = original; }
});
test('retirement during resize or file read prevents uploading an old selection', async () => {
  for (const phase of ['resize', 'read']) {
    const h = setup(); let resume;
    const pendingWait = new Promise(resolve => { resume = resolve; });
    if (phase === 'resize') h.renderWait = pendingWait; else h.readWait = pendingWait;
    const pending = h.api.prepareWorkerReturnedPaintPhoto({ uri: 'file:photo', width: phase === 'resize' ? 4000 : 40, height: 20 }, h.valid);
    if (phase === 'read') await new Promise(setImmediate);
    h.current = false; resume(); assert.equal(await pending, null);
    assert.equal(h.calls.some(([name]) => name === 'read'), phase === 'read');
  }
});
test('missing native file rejects before any bytes can be uploaded', async () => {
  const h = setup(); h.readError = new Error('file unavailable');
  await assert.rejects(h.api.prepareWorkerReturnedPaintPhoto({ uri: 'file:missing', width: 10, height: 10 }, h.valid), /file unavailable/);
  assert.deepEqual(h.calls, [['read', 'file:missing']]);
});
