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
function api(fetch, imageFetch = fetch) {
  return load('boyoqchi/returnedPaintApi', { '../authorizedFetch': { authorizedFetch: fetch, authorizedImageFetch: imageFetch },
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

test('ordinary image upload validates apparatus and sends bytes, canonical parameters and sanitized filename', async () => {
  let sent;
  const client = api(async (_s, url, init) => { sent = { url, init }; return new Response(JSON.stringify({ image: {
    image_id: 'image-1', image_name: 'x.jpg', image_mime: 'image/jpeg', image_size_bytes: 3, image_url: '/image/1' } })); });
  await assert.rejects(client.uploadReturnedPaintImage(session, { orderId: 'o1', apparatus: 'Display name',
    filename: 'x.jpg', mime: 'image/jpeg', bytes: Uint8Array.of(1, 2, 3) }), e => e.code === 'apparatus_id_invalid');
  const result = await client.uploadReturnedPaintImage(session, { orderId: ' order 1 ', apparatus: ' apparatus:default:bosma_7 ',
    filename: ' gul🌸.jpg ', mime: 'image/jpeg', bytes: Uint8Array.of(1, 2, 3) });
  assert.equal(sent.url, '/v1/mobile/returned-paint/images?order_id=order+1&apparatus=apparatus%3Adefault%3Abosma_7');
  assert.equal(sent.init.method, 'POST');
  assert.deepEqual(sent.init.headers, { 'Content-Type': 'image/jpeg', 'x-file-name': 'gul.jpg' });
  assert.deepEqual([...sent.init.body], [1, 2, 3]);
  assert.equal(result.image_url, '/image/1');
  await client.uploadReturnedPaintImage(session, { orderId: 'o1', apparatus: 'apparatus:default:bosma_7',
    filename: '🌸', mime: 'image/png', bytes: new Uint8Array() });
  assert.equal(sent.init.headers['x-file-name'], 'qaytarilgan-boyoq.jpg');
});

test('training image upload and delete use their own path and preserve the original filename', async () => {
  const calls = [];
  const client = api(async (_s, url, init) => { calls.push({ url, init });
    return new Response(JSON.stringify({ image: { image_id: 'img', image_name: 'rang.png', image_size_bytes: 2 } })); });
  await client.uploadReturnedPaintImage(session, { orderId: ' training-1 ', apparatus: 'apparatus:default:bosma_7',
    filename: 'rang🌸.png', mime: 'image/png', bytes: Uint8Array.of(5, 6) });
  assert.equal(calls[0].url, '/v1/mobile/admin/training/images');
  assert.equal(calls[0].init.headers['x-file-name'], 'rang🌸.png');
  await client.deleteReturnedPaintImage(session, ' image id ', 'training-1');
  assert.equal(calls[1].url, '/v1/mobile/admin/training/images?id=image+id');
  assert.equal(calls[1].init.method, 'DELETE');
  await client.deleteReturnedPaintImage(session, '   ', 'training-1');
  assert.equal(calls.length, 2);
});

test('ordinary image deletion and failed upload preserve source status and errors', async () => {
  let fail = false, call;
  const client = api(async (_s, url, init) => { call = { url, init }; return fail
    ? new Response(JSON.stringify({ error: '  denied  ' }), { status: 403 }) : new Response('{}'); });
  await client.deleteReturnedPaintImage(session, ' id /1 ');
  assert.equal(call.url, '/v1/mobile/returned-paint/images?id=id+%2F1');
  assert.equal(call.init.method, 'DELETE');
  fail = true;
  await assert.rejects(client.uploadReturnedPaintImage(session, { orderId: 'o', apparatus: 'apparatus:default:bosma_7',
    filename: 'x.jpg', mime: 'image/jpeg', bytes: Uint8Array.of(2) }), e =>
    e.code === 'returned_paint_image_upload_failed' && e.message === 'denied' && e.statusCode === 403);
  await assert.rejects(client.deleteReturnedPaintImage(session, 'id'), e => e.code === 'returned_paint_image_delete_failed' && e.message === 'denied');
});

test('download uses the authenticated image transport and rejects missing, empty or unsuccessful images', async () => {
  let url, response = new Response(Uint8Array.of(1, 2));
  const client = api(async () => { throw Error('wrong transport'); }, async (_s, path) => { url = path; return response; });
  const image = { image_id: 'i', image_name: '', image_mime: '', image_size_bytes: 2, image_url: '/image/1' };
  assert.deepEqual([...await client.downloadReturnedPaintImage(session, image)], [1, 2]);
  assert.equal(url, 'https://example.test/image/1');
  await assert.rejects(client.downloadReturnedPaintImage(session, { ...image, image_url: '' }), e => e.code === 'returned_paint_image_url_missing');
  response = new Response(new Uint8Array());
  await assert.rejects(client.downloadReturnedPaintImage(session, image), e => e.code === 'returned_paint_image_download_failed');
  response = new Response('{"error":"bad_image"}', { status: 404 });
  await assert.rejects(client.downloadReturnedPaintImage(session, image), e => e.message === 'bad_image' && e.statusCode === 404);
});
