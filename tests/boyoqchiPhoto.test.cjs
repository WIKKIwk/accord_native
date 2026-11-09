const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
function load(mocks) {
  const filename = path.resolve(__dirname, '../src/boyoqchi/returnedPaintPhoto.ts'), loaded = new Module(filename, module);
  loaded.filename = filename; loaded.paths = module.paths;
  loaded.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'),
    { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return loaded.exports;
}
function setup({ permission = true, failDownload = false } = {}) {
  const calls = [];
  class Directory { constructor(_root, name) { this.name = name; this.exists = false; }
    create() { calls.push('directory-create'); this.exists = true; } delete() { calls.push('directory-delete'); this.exists = false; } }
  class File { constructor(root, name) { this.uri = `file:///${root.name}/${name}`; }
    create() { calls.push('file-create'); } write(bytes) { calls.push(`file-write:${bytes.length}`); } }
  const client = load({
    'expo-crypto': { randomUUID: () => 'unique' },
    'expo-file-system': { Directory, File, Paths: { cache: {} } },
    'expo-media-library': { requestPermissionsAsync: async writeOnly => { calls.push(`permission:${writeOnly}`); return { granted: permission }; },
      Asset: { create: async uri => { calls.push(`asset:${uri}`); } } },
    './returnedPaintApi': { downloadReturnedPaintImage: async () => { calls.push('download'); if (failDownload) throw Error('offline'); return Uint8Array.of(1, 2); } },
  });
  return { calls, client };
}
const image = { image_name: 'qoldiq.jpg', image_mime: 'image/jpeg' };

test('photo save requests only write access, only after user invokes the action', async () => {
  const { calls, client } = setup();
  assert.deepEqual(calls, []);
  await client.saveReturnedPaintImageToPhotos({}, image);
  assert.deepEqual(calls, ['download', 'permission:true', 'directory-create', 'file-create', 'file-write:2',
    'asset:file:///returned-paint-unique/qoldiq.jpg', 'directory-delete']);
});

test('denied permission and download failure do not create a photo', async () => {
  const denied = setup({ permission: false });
  await assert.rejects(denied.client.saveReturnedPaintImageToPhotos({}, image), /photo_permission_denied/);
  assert.deepEqual(denied.calls, ['download', 'permission:true']);
  const offline = setup({ failDownload: true });
  await assert.rejects(offline.client.saveReturnedPaintImageToPhotos({}, image), /offline/);
  assert.deepEqual(offline.calls, ['download']);
});
