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
const controls = load('workerControlsApi', { './authorizedFetch': {}, './sessionReadScope': {} });
const exception = load('shared/mobileApiException'), dart = load('admin/dartJsonString'), uri = load('admin/dartUri');
const worker = load('workerLaminationRemainders', { './workerControlsApi': controls, './workerProgressBatch': {} });
const layerModel = load('admin/layerRemainderModel', { '../workerLaminationRemainders': worker });
const session = { token: 'mock' }, source = { source_kind: 'progress_batch', source_id: 'source', session_id: 'session', revision: 7,
  source_net_kg: 50, source_meter: 1500 }, remainder = { operation_id: 'r', source_kind: 'progress_batch', source_id: 'source',
  remaining_net_kg: 20, remaining_meter: 600, recorded_by: { display_name: 'Operator' } };
function fixture() {
  let response = new Response('{}', { status: 200 }), onSend; const calls = [];
  const request = load('admin/adminProductionRequest', { '../authorizedFetch': { authorizedFetch: async (account, url, init, guard) => {
    calls.push({ account, url, init, guard }); guard?.(); if (onSend) await onSend(); return response;
  } }, '../workerControlsApi': controls, '../shared/mobileApiException': exception });
  const api = load('admin/layerRemainderApi', { '../workerControlsApi': controls, '../workerLaminationRemainders': worker,
    '../shared/mobileApiException': exception, './adminProductionRequest': request, './dartJsonString': dart, './dartUri': uri, './layerRemainderModel': layerModel });
  return { ...api, calls, setResponse: value => { response = value; }, onSend: value => { onSend = value; } };
}
// Source-derived Node mocks, not a new f119 Flutter recording.
test('read validates before sending, encodes both parameters and decodes the V2 snapshot', async () => {
  const f = fixture(); f.setResponse(new Response(JSON.stringify({ sources: [source], remainders: [remainder] }), { status: 200 }));
  const result = await f.adminLayerRemainders(session, '\u0085apparatus:default:a~*\u0085', " Order ~*!()'&=é ");
  assert.equal(f.calls[0].url, '/v1/mobile/admin/production-maps/layer-remainders?apparatus=apparatus%3Adefault%3Aa~%2A&order_id=Order+~%2A%21%28%29%27%26%3D%C3%A9');
  assert.equal(f.calls[0].init, undefined); assert.equal(result.sources[0].source_id, 'source');
  for (const [apparatus, order] of [['bad', 'order'], ['apparatus:default:a', '\u0085 \u0085']])
    await assert.rejects(f.adminLayerRemainders(session, apparatus, order), error => error instanceof exception.MobileApiException &&
      error.code === 'layer_remainder_context_invalid' && error.message === 'Buyurtma yoki aparat noto‘g‘ri');
  assert.equal(f.calls.length, 1);
});
test('response and scope changes follow the shared guarded request path', async () => {
  const f = fixture(); let current = true; const guard = () => { if (!current) throw new Error('scope changed'); };
  f.setResponse(new Response(JSON.stringify({ error: 'layer_remainder_failed' }), { status: 503 }));
  await assert.rejects(f.adminLayerRemainders(session, 'apparatus:default:a', 'order', guard), error => error.statusCode === 503);
  f.setResponse({ status: 200, async json() { current = false; return { sources: [source] }; } });
  await assert.rejects(f.adminLayerRemainders(session, 'apparatus:default:a', 'order', guard), /scope changed/);
  const before = f.calls.length; await assert.rejects(f.adminLayerRemainders(session, 'bad', '', guard), /scope changed/);
  assert.equal(f.calls.length, before);
});

test('an async or value-returning guard is rejected before validation and transport', async () => {
  const f = fixture();
  for (const guard of [() => false, async () => false, async () => { throw new Error('rejected'); }])
    await assert.rejects(f.adminLayerRemainders(session, 'bad', '', guard), /Invalid admin guard/);
  assert.equal(f.calls.length, 0); await new Promise(resolve => setImmediate(resolve));
});
