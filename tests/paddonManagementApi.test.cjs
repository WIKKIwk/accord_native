const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
function load(name, mocks = {}) {
  const filename = path.resolve(__dirname, `../src/${name}.ts`);
  const loaded = new Module(filename, module);
  loaded.filename = filename; loaded.paths = module.paths;
  loaded.require = id => Object.hasOwn(mocks, id) ? mocks[id] : id.startsWith('./') ? load(id.slice(2), mocks) : require(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return loaded.exports;
}
function api(fetch) { return load('paddonManagementApi', { './authorizedFetch': { authorizedFetch: fetch } }); }

// V2 has no recorded HTTP creation request; the request follows the baseline source.
test('paddon creation trims fields, omits a blank apparatus and decodes the result', async () => {
  let url, body;
  const client = api(async (_session, requested, init) => {
    url = requested; body = JSON.parse(init.body);
    return new Response('{"paddon":{"id":"p1","code":"P1"}}', { status: 200 });
  });
  const paddon = await client.adminPaddonCreate({}, { location: ' warehouse ', note: ' note ', apparatus: '  ' });
  assert.equal(url, '/v1/mobile/admin/production-maps/paddons/create');
  assert.deepEqual(body, { location: 'warehouse', note: 'note' });
  assert.equal(paddon.code, 'P1');
  await client.adminPaddonCreate({}, { apparatus: ' apparatus:default:asset-005 ' });
  assert.deepEqual(body, { location: '', note: '', apparatus: 'apparatus:default:asset-005' });
});

test('paddon creation rejects a missing returned paddon', async () => {
  const client = api(async () => new Response('{}', { status: 200 }));
  await assert.rejects(client.adminPaddonCreate({}), error => error.code === 'paddon_create' && error.message === 'Paddon yaratilmadi');
});

// V2 has no recorded HTTP deletion request; the request follows the baseline source.
test('paddon deletion sends the trimmed code and preserves server errors', async () => {
  let requested, status = 200;
  const client = api(async (_session, url, init) => {
    requested = { url, method: init.method, body: JSON.parse(init.body) };
    return new Response(status === 200 ? '' : '{"error":"paddon_locked"}', { status });
  });
  await client.adminPaddonDelete({}, ' P1 ');
  assert.deepEqual(requested, { url: '/v1/mobile/admin/production-maps/paddons/delete', method: 'POST', body: { code: 'P1' } });
  status = 409;
  await assert.rejects(client.adminPaddonDelete({}, 'P1'), error => error.code === 'paddon_locked');
});

// V2 has no recorded HTTP detail request; the request follows the baseline source.
test('paddon detail validates the code and requests a decoded snapshot', async () => {
  let url, calls = 0;
  const client = api(async (_session, requested) => {
    calls++; url = new URL(requested, 'https://example.test');
    return new Response('{"paddon":{"code":"P1"},"items":[]}', { status: 200 });
  });
  await assert.rejects(client.adminPaddonDetail({}, ' '), error => error.code === 'paddon_not_found');
  assert.equal(calls, 0);
  const result = await client.adminPaddonDetail({}, ' P1 ');
  assert.equal(url.pathname, '/v1/mobile/admin/production-maps/paddons/detail');
  assert.equal(url.searchParams.get('code'), 'P1');
  assert.equal(result.paddon.code, 'P1');
});
