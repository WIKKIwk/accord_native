const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
function load(file, mocks = {}) {
  const filename = path.resolve(__dirname, '../src', file + '.ts'), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths;
  mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return mod.exports;
}
const controls = load('workerControlsApi', { './authorizedFetch': {}, './sessionReadScope': {} }), exception = load('shared/mobileApiException');
const apparatus = load('apparatusApi', { './authorizedFetch': {}, './workerControlsApi': controls }), dart = load('admin/dartJsonString'), uri = load('admin/dartUri');
const errors = load('admin/adminApiError', { '../shared/mobileApiException': exception });
const station = 'apparatus:default:asset-005', session = { token: 'mock' };
const projection = { apparatus_id: station, source_revision: 7, source_aasx_sha256: 'a'.repeat(64),
  display: { display_name: 'Flexo', catalog_order: 5 }, capabilities: { print: 3 }, execution_profile: { operation: 'print', technology: 'flexographic' } };
function fixture() {
  let response = new Response('{}', { status: 200 }), onSend; const calls = [];
  const transport = { authorizedFetch: async (account, url, init, guard) => { calls.push({ account, url, init, guard }); guard?.(); if (onSend) await onSend(); return response; } };
  const request = load('admin/adminProductionRequest', { '../authorizedFetch': transport, '../workerControlsApi': controls, '../shared/mobileApiException': exception });
  const api = load('admin/apparatusCanonicalReadApi', { '../apparatusApi': apparatus, '../authorizedFetch': transport, './adminApiError': errors,
    './adminProductionRequest': request, './dartJsonString': dart, './dartUri': uri });
  return { ...api, calls, setResponse: value => { response = value; }, onSend: value => { onSend = value; } };
}
// Dart SDK Uri.encodeComponent source documents RFC 2396 and UTF-8 replacement; this is not a Flutter recording.
test('path component encoding follows Dart for all ASCII, Unicode and malformed UTF-16', () => {
  for (let code = 0; code < 128; code++) {
    const char = String.fromCharCode(code), expected = /[A-Za-z0-9._~!()*'-]/.test(char) ? char : `%${code.toString(16).toUpperCase().padStart(2, '0')}`;
    assert.equal(uri.dartUriComponent(char), expected, `ASCII ${code}`);
  }
  assert.equal(uri.dartUriComponent('😀\ud800/\udc00'), '%F0%9F%98%80%EF%BF%BD%2F%EF%BF%BD');
});
test('canonical read trims and encodes the ID, then reuses the existing apparatus projection', async () => {
  const f = fixture(); f.setResponse(new Response(JSON.stringify(projection), { status: 200 }));
  const result = await f.adminCanonicalApparatus(session, '\u0085apparatus:default:a/b ~*\u0085');
  assert.equal(f.calls[0].url, '/v1/mobile/admin/apparatus/apparatus%3Adefault%3Aa%2Fb%20~*');
  assert.equal(f.calls[0].init, undefined); assert.equal(result.id, station); assert.equal(result.kind, 'flexo');
  f.setResponse(new Response(JSON.stringify(projection), { status: 200 })); await f.adminCanonicalApparatus(session, '');
  assert.equal(f.calls[1].url, '/v1/mobile/admin/apparatus/'); // V2 does not prevalidate this read's ID.
});
test('canonical read preserves source fallback errors and rejects malformed projection', async () => {
  const f = fixture(); f.setResponse(new Response('{}', { status: 404 }));
  await assert.rejects(f.adminCanonicalApparatus(session, station), error => error instanceof exception.MobileApiException &&
    error.code === 'apparatus_load_failed' && error.message === 'Aparat ma’lumotlari yuklanmadi (HTTP 404)');
  f.setResponse(new Response('{}', { status: 200 })); await assert.rejects(f.adminCanonicalApparatus(session, station), TypeError);
});
test('checked guard rejects async results, session changes and stale parsed responses', async () => {
  const f = fixture(); let allowed = true; const guard = () => { if (!allowed) throw new Error('scope changed'); };
  await assert.rejects(f.adminCanonicalApparatus(session, station, async () => false), /Invalid admin guard/); assert.equal(f.calls.length, 0);
  f.onSend(async () => { allowed = false; }); await assert.rejects(f.adminCanonicalApparatus(session, station, guard), /scope changed/);
  allowed = true; f.onSend(null); f.setResponse({ status: 200, async json() { allowed = false; return projection; } });
  await assert.rejects(f.adminCanonicalApparatus(session, station, guard), /scope changed/);
  allowed = true; f.setResponse({ status: 404, async json() { allowed = false; return {}; } });
  await assert.rejects(f.adminCanonicalApparatus(session, station, guard), /scope changed/);
});
