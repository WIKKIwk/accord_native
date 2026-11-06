const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
let status = 200, data = {}, call;
class MobileApiException extends Error { constructor(options) { super(options.message); Object.assign(this, options); } }
function load(file) {
  const filename = path.resolve(__dirname, '../src', file), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths;
  mod.require = name => {
    if (name === '../authorizedFetch') return { authorizedFetch: async (session, url, init, before, timeout) => {
      call = { session, url, init, timeout }; return { status, json: async () => data };
    } };
    if (name === '../shared/mobileApiException') return { MobileApiException };
    if (name === '../shared/searchNormalizer') return load('shared/searchNormalizer.ts');
    return require(name);
  };
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return mod.exports;
}
const { gscalePhotoSearchSuggestion, gscalePhotoRemoteQueries, gscalePickerRelevance } = load('gscale/gscalePhotoSearch.ts');

test('photo suggestion sends V2 multipart image and normalizes returned queries', async () => {
  status = 200; data = { display_query: ' ', background_queries: [' PET film ', 'pet film', '', 'Film'], visible_text: ' label ' };
  const suggestion = await gscalePhotoSearchSuggestion({ token: 'test' }, Uint8Array.from([0, 127, 255]), ' photo.jpg ');
  assert.deepEqual(suggestion, { displayQuery: 'PET film', backgroundQueries: ['PET film', 'Film'], visibleText: 'label' });
  assert.equal(call.url, '/v1/mobile/werka/ai-search-suggestion'); assert.equal(call.init.method, 'POST'); assert.equal(call.timeout, null);
  const boundary = call.init.headers['Content-Type'].split('boundary=')[1];
  const body = Buffer.from(call.init.body), raw = body.toString('latin1');
  assert.ok(raw.startsWith(`--${boundary}\r\ncontent-type: application/octet-stream\r\ncontent-disposition: form-data; name="image"; filename="photo.jpg"\r\n\r\n`));
  assert.ok(body.includes(Buffer.from([0, 127, 255]))); assert.ok(raw.endsWith(`\r\n--${boundary}--\r\n`));
});

test('photo errors preserve server code and empty results are rejected', async () => {
  status = 503; data = { code: 'not_configured', error: ' Not configured ' };
  await assert.rejects(gscalePhotoSearchSuggestion({}, Uint8Array.from([1]), ''), error => error.code === 'not_configured' && error.message === 'Not configured');
  status = 200; data = {};
  await assert.rejects(gscalePhotoSearchSuggestion({}, Uint8Array.from([1]), ''), error => error.code === 'no_result');
});

test('photo background queries expand in V2 order and results use primary-field relevance', () => {
  assert.deepEqual(gscalePhotoRemoteQueries(['Nestle chocolate milk', 'Chocolate bar']),
    ['Nestle', 'Chocolate', 'Nestle chocolate', 'Chocolate bar', 'Nestle chocolate milk', 'Nestle chocolate milk']);
  assert.ok(gscalePickerRelevance('PET', 'PET', '') > gscalePickerRelevance('PET', 'PET Film', ''));
  assert.ok(gscalePickerRelevance('PET', 'PET Film', '') > gscalePickerRelevance('PET', 'Other', 'PET'));
  assert.equal(gscalePickerRelevance('', 'PET'), 0);
});
