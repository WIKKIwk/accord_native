const assert = require('node:assert/strict'), test = require('node:test');
const { load } = require('./support/workerOrderScreen.cjs');
const error = load('shared/mobileApiException.ts');
function setup() {
  const calls = [], h = { current: true, granted: true, picked: { canceled: false, assets: [{ uri: 'file:photo', width: 100, height: 200 }] }, bytes: new Uint8Array([1]) };
  const context = { resize: value => calls.push(['resize', value]), renderAsync: async () => {
    if (h.renderWait) await h.renderWait;
    return { saveAsync: async options => { calls.push(['save', options]); return { uri: 'file:resized' }; } };
  } };
  const api = load('workerReturnedPaintPhoto.ts', {
    'expo-image-picker': { requestCameraPermissionsAsync: async () => { calls.push(['permission']); return { granted: h.granted }; },
      launchCameraAsync: async options => { calls.push(['camera', options]); return h.picked; },
      launchImageLibraryAsync: async options => { calls.push(['gallery', options]); return h.picked; } },
    'expo-image-manipulator': { SaveFormat: { PNG: 'png', WEBP: 'webp', JPEG: 'jpeg' }, ImageManipulator: { manipulate: uri => { calls.push(['manipulate', uri]); return context; } } },
    './shared/mobileApiException': error,
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
test('paint preparation bounds the larger dimension, retains supported MIME and source quality', async () => {
  const h = setup(), original = global.fetch;
  global.fetch = async uri => { h.calls.push(['read', uri]); return { arrayBuffer: async () => h.bytes.buffer }; };
  try {
    const result = await h.api.prepareWorkerReturnedPaintPhoto({ uri: 'file:photo', width: 4000, height: 2000, fileName: 'label.png', mimeType: 'image/png' }, h.valid);
    assert.deepEqual(h.calls, [['manipulate', 'file:photo'], ['resize', { width: 1800 }], ['save', { compress: 0.84, format: 'png' }], ['read', 'file:resized']]);
    assert.equal(result.filename, 'label.png'); assert.equal(result.mime, 'image/png'); assert.deepEqual(result.bytes, new Uint8Array([1]));
    h.calls.length = 0;
    await h.api.prepareWorkerReturnedPaintPhoto({ uri: 'file:photo', width: 2000, height: 4000, fileName: 'camera.heic', mimeType: 'image/heic' }, h.valid);
    assert.deepEqual(h.calls[1], ['resize', { height: 1800 }]); assert.equal(h.calls[2][1].format, 'jpeg');
  } finally { global.fetch = original; }
});
test('small photo MIME fallback and exact empty/6MB source guards are preserved', async () => {
  const h = setup(), original = global.fetch, asset = { uri: 'file:small', width: 10, height: 10, fileName: 'small.webp' };
  global.fetch = async () => ({ arrayBuffer: async () => h.bytes.buffer });
  try {
    assert.equal((await h.api.prepareWorkerReturnedPaintPhoto(asset, h.valid)).mime, 'image/webp'); assert.equal(h.calls.length, 0);
    assert.equal((await h.api.prepareWorkerReturnedPaintPhoto({ ...asset, mimeType: 'application/octet-stream' }, h.valid)).mime, 'image/webp');
    for (const [size, code, message] of [[0, 'returned_paint_image_empty', 'Tanlangan rasm bo‘sh'], [6 * 1024 * 1024 + 1, 'returned_paint_image_too_large', 'Rasm hajmi 6 MB dan oshmasligi kerak']]) {
      h.bytes = new Uint8Array(size);
      await assert.rejects(h.api.prepareWorkerReturnedPaintPhoto(asset, h.valid), failure => failure.code === code && failure.message === message);
    }
    h.bytes = new Uint8Array(6 * 1024 * 1024); assert.equal((await h.api.prepareWorkerReturnedPaintPhoto(asset, h.valid)).bytes.length, 6 * 1024 * 1024);
  } finally { global.fetch = original; }
});
test('retirement during resize prevents reading or uploading the old selection', async () => {
  const h = setup(), original = global.fetch; let resume, reads = 0;
  h.renderWait = new Promise(resolve => { resume = resolve; });
  global.fetch = async () => { reads++; throw Error('must not read retired photo'); };
  try {
    const pending = h.api.prepareWorkerReturnedPaintPhoto({ uri: 'file:photo', width: 4000, height: 2000 }, h.valid);
    h.current = false; resume(); assert.equal(await pending, null); assert.equal(reads, 0);
  } finally { global.fetch = original; }
});
