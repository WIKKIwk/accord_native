const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
function load(file, overrides = {}) {
  const filename = path.resolve(__dirname, '../src', file + '.ts');
  const mod = new Module(filename, module); mod.filename = filename; mod.paths = module.paths;
  mod.require = name => Object.hasOwn(overrides, name) ? overrides[name] : require(name);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return mod.exports;
}
const controls = load('workerControlsApi', { './authorizedFetch': {}, './sessionReadScope': {} });
const exception = load('shared/mobileApiException');
const errorApi = load('admin/adminApiError', { '../shared/mobileApiException': exception });
const dart = load('admin/dartJsonString');
function fixture() {
  const requests = []; let status = 200, payload = {};
  const api = load('admin/apparatusCollection', {
    '../authorizedFetch': { authorizedFetch: async (session, url, init = {}) => {
      requests.push({ session, url, init }); return new Response(status === 204 ? null : JSON.stringify(payload), { status });
    } },
    '../shared/mobileApiException': exception, '../workerControlsApi': controls, './adminApiError': errorApi, './dartJsonString': dart,
  });
  return { ...api, requests, setResponse(value, code = 200) { payload = value; status = code; } };
}
const session = { token: 'test' };
const id = 'apparatus-collection:0123456789abcdef0123456789abcdef';
const a = 'apparatus:default:bosma_7', b = 'apparatus:default:bosma_8';
const record = { id, name: ' Bosma A ', apparatus_ids: [` ${b} `, a, b], revision: 2.9 };

// V2's selected test ran independently at f119; its test-mode CRUD is not implemented here.
test('apparatus collection parses, trims and preserves first member order', () => {
  const api = fixture();
  const parsed = api.adminApparatusCollectionFromJson(record);
  assert.deepEqual(parsed, { id, name: 'Bosma A', apparatusIds: [b, a], revision: 2 });
  assert.equal(Object.isFrozen(parsed.apparatusIds), true);
  assert.equal(api.adminApparatusCollectionFromJson({ ...record, name: '\u0085Bosma\u0085' }).name, 'Bosma');
  assert.throws(() => api.adminApparatusCollectionFromJson({ ...record, id: 'not-collection' }), /Invalid apparatus collection/);
  assert.throws(() => api.adminApparatusCollectionFromJson({ ...record, revision: '2' }), TypeError);
  assert.throws(() => api.adminApparatusCollectionFromJson({ ...record, apparatus_ids: ['bad'] }), /Invalid collection apparatus id/);
});
// Source-derived mocked HTTP checks, not a V2 recording or a live request.
test('collection listing handles old-server 404 and V2 failure codes', async () => {
  const api = fixture(); api.setResponse(null, 404);
  assert.deepEqual(await api.adminApparatusCollections(session), []);
  api.setResponse([record]);
  assert.equal((await api.adminApparatusCollections(session))[0].id, id);
  api.setResponse([null]); await assert.rejects(api.adminApparatusCollections(session), TypeError);
  api.setResponse({}, 503); await assert.rejects(api.adminApparatusCollections(session), error =>
    error.code === 'apparatus_collections_list_failed' && error.message === 'Aparat guruhlari yuklanmadi (HTTP 503)');
});
test('collection creation validates runes and raw member count before normalizing', async () => {
  const api = fixture(); api.setResponse(record);
  await assert.rejects(api.adminCreateApparatusCollection(session, '\u0085 \u0085', []), error => error.code === 'apparatus_collection_name_required');
  await assert.rejects(api.adminCreateApparatusCollection(session, '😀'.repeat(81), []), error => error.code === 'apparatus_collection_name_too_long');
  await assert.rejects(api.adminCreateApparatusCollection(session, 'Valid', Array(501).fill(a)), error => error.code === 'apparatus_collection_too_many_apparatus');
  await assert.rejects(api.adminCreateApparatusCollection(session, 'Valid', [a, 'bad']), error => error.code === 'apparatus_id_invalid');
  assert.equal(api.requests.length, 0);
  await api.adminCreateApparatusCollection(session, '\u0085' + '😀'.repeat(80) + '\u0085', [` ${b} `, a, b]);
  assert.equal(api.requests[0].init.method, 'POST');
  assert.deepEqual(JSON.parse(api.requests[0].init.body), { name: '😀'.repeat(80), apparatus_ids: [a, b] });
});
test('update and delete send expected revision, escaped ID and source errors', async () => {
  const api = fixture(); api.setResponse(record);
  const collection = { id: '  collection/1  ', name: 'old', apparatusIds: [], revision: 7 };
  await api.adminUpdateApparatusCollection(session, collection, '  New ', [b, a, b]);
  assert.equal(api.requests[0].url, '/v1/mobile/admin/apparatus-collections/collection%2F1');
  assert.equal(api.requests[0].init.method, 'PUT');
  assert.deepEqual(JSON.parse(api.requests[0].init.body), { expected_revision: 7, name: 'New', apparatus_ids: [a, b] });
  api.setResponse({}, 409); await assert.rejects(api.adminDeleteApparatusCollection(session, collection), e =>
    e.code === 'apparatus_collection_delete_failed' && e.statusCode === 409 && e.message === 'Aparat guruhi o‘chirilmadi (HTTP 409)');
  assert.equal(api.requests[1].init.method, 'DELETE');
  assert.deepEqual(JSON.parse(api.requests[1].init.body), { expected_revision: 7 });
  api.setResponse(null, 204); await api.adminDeleteApparatusCollection(session, collection);
});
