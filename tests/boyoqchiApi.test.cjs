const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
function load(relative, mocks = {}) {
  const filename = path.resolve(__dirname, `../src/${relative}.ts`), loaded = new Module(filename, module);
  loaded.filename = filename; loaded.paths = module.paths;
  loaded.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'),
    { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return loaded.exports;
}
const controls = load('workerControlsApi', { './authorizedFetch': {}, './sessionReadScope': {} });
const model = load('boyoqchi/returnedPaintModel', { '../workerControlsApi': controls });
function api(fetch) {
  return load('boyoqchi/returnedPaintApi', { '../authorizedFetch': { authorizedFetch: fetch },
    '../workerControlsApi': controls, './returnedPaintModel': model });
}
const session = { baseUrl: 'https://example.test' };
const request = { id: 'r1', order_id: 'o1', apparatus: 'apparatus:default:bosma_7', sender_role: 'aparatchi',
  created_at_unix: 100, items: [] };

// These request and parsing expectations were read from V2 source. No V2 HTTP recording exists for this role.
test('list requests the default limit and omits nonpositive offsets', async () => {
  const calls = [];
  const client = api(async (s, url, init) => { calls.push({ s, url, init }); return new Response(JSON.stringify({ items: [request], has_more: true })); });
  const page = await client.boyoqchiReturnedPaintRequests(session);
  assert.equal(calls[0].s, session);
  assert.equal(calls[0].url, '/v1/mobile/returned-paint/requests?limit=20');
  assert.equal(calls[0].init, undefined);
  assert.equal(page.items[0].id, 'r1');
  assert.equal(page.has_more, true);
  await client.boyoqchiReturnedPaintRequests(session, 100, 20);
  assert.equal(calls[1].url, '/v1/mobile/returned-paint/requests?limit=100&offset=20');
  await client.boyoqchiReturnedPaintRequests(session, 0, -1);
  assert.equal(calls[2].url, '/v1/mobile/returned-paint/requests?limit=0');
});

test('list error preserves V2 code, server message and status with non-JSON fallback', async () => {
  let body = '{"error":"  forbidden  "}', status = 403;
  const client = api(async () => new Response(body, { status }));
  await assert.rejects(client.boyoqchiReturnedPaintRequests(session), e => e.code === 'returned_paint_load_failed' &&
    e.message === 'forbidden' && e.statusCode === 403);
  body = 'server error'; status = 500;
  await assert.rejects(client.boyoqchiReturnedPaintRequests(session), e => e.code === 'returned_paint_load_failed' &&
    e.message === 'Qaytarilgan bo‘yoq ma’lumotlari yuklanmadi' && e.statusCode === 500);
  body = '{}'; status = 201;
  await assert.rejects(client.boyoqchiReturnedPaintRequests(session), e => e.statusCode === 201);
});

test('complete posts only request_id and item data then parses the response', async () => {
  let sent;
  const client = api(async (s, url, init) => { sent = { s, url, init }; return new Response(JSON.stringify({ ...request,
    status: 'completed', calculation: { final_used_paint: '1.05' } })); });
  const input = { request_id: ' r1 ', items: [{ usage: 'rasxot', category: 'colors', name: 'Oq', values: { Mix: '1.5' } }] };
  const result = await client.completeReturnedPaint(session, input);
  assert.equal(sent.url, '/v1/mobile/returned-paint/requests/complete');
  assert.equal(sent.init.method, 'POST');
  assert.equal(sent.init.headers['Content-Type'], 'application/json');
  assert.deepEqual(JSON.parse(sent.init.body), input);
  assert.equal(result.calculation.final_used_paint, '1.05');
  assert.equal(result.status, 'completed');
});

test('complete handles server error strings and malformed successful responses', async () => {
  let response = new Response(JSON.stringify({ error: 'bad_values' }), { status: 422 });
  const client = api(async () => response);
  await assert.rejects(client.completeReturnedPaint(session, { request_id: 'r1', items: [] }), e =>
    e.code === 'returned_paint_complete_failed' && e.message === 'bad_values' && e.statusCode === 422);
  response = new Response('[]');
  await assert.rejects(client.completeReturnedPaint(session, { request_id: 'r1', items: [] }), /Expected returned paint object/);
});

test('image URL resolution keeps V2 absolute, root-relative and bare paths', () => {
  const client = api(async () => { throw new Error('unexpected request'); });
  assert.equal(client.returnedPaintImageUrl('https://example.test', ' /v1/image?id=1 '), 'https://example.test/v1/image?id=1');
  assert.equal(client.returnedPaintImageUrl('https://example.test', ' https://other.test/image '), 'https://other.test/image');
  assert.equal(client.returnedPaintImageUrl('https://example.test', 'http://other.test/image'), 'http://other.test/image');
  assert.equal(client.returnedPaintImageUrl('https://example.test', 'relative-image'), 'relative-image');
  assert.equal(client.returnedPaintImageUrl('https://example.test', ' '), '');
});

test('requests use the existing same-origin authenticated transport', async () => {
  const originalFetch = global.fetch, seen = [];
  const auth = { activeSessionToken: s => s.token, refreshSession: async () => false };
  const transport = load('authorizedFetch', { './auth': auth });
  const client = api(transport.authorizedFetch);
  global.fetch = async (url, init) => {
    seen.push({ url, init });
    return new Response(JSON.stringify(init.method === 'POST' ? request : { items: [], has_more: false }), { status: 200 });
  };
  try {
    const account = { baseUrl: 'https://example.test', token: 'test-token' };
    await client.boyoqchiReturnedPaintRequests(account, 100);
    await client.completeReturnedPaint(account, { request_id: 'r1', items: [] });
    assert.deepEqual(seen.map(row => [row.url, row.init.headers.get('authorization')]), [
      ['https://example.test/v1/mobile/returned-paint/requests?limit=100', 'Bearer test-token'],
      ['https://example.test/v1/mobile/returned-paint/requests/complete', 'Bearer test-token'],
    ]);
    assert.equal(seen[1].init.headers.get('content-type'), 'application/json');
  } finally { global.fetch = originalFetch; }
});
