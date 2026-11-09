const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

function load(relative, dependencies = {}) {
  const filename = path.resolve(__dirname, '../src', relative), loaded = new Module(filename, module);
  loaded.require = name => name in dependencies ? dependencies[name] : require(name);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ESNext },
  }).outputText, filename);
  return loaded.exports;
}
const { MobileApiException } = load('shared/mobileApiException.ts');
const common = load('qolip/qolipApiCommon.ts', { '../shared/mobileApiException': { MobileApiException } });
const json = (value, status = 200) => new Response(JSON.stringify(value), { status });
function harness(response) {
  const calls = [], session = { token: 'token' };
  const api = load('qolip/qolipBlocksApi.ts', {
    '../auth': { activeSessionToken: value => value.token || null },
    '../shared/mobileApiException': { MobileApiException },
    './qolipApiCommon': common,
    '../authorizedFetch': { authorizedFetch: async (value, target, init = {}) => {
      calls.push({ session: value, target, init });
      return typeof response === 'function' ? response(calls.length, init) : response;
    } },
  });
  return { api, calls, session };
}

test('source block reader preserves warehouses, block defaults and cross-block capability', async () => {
  const { api, calls, session } = harness(() => json({
    warehouses: [' A ', null, 17], blocks: [{ name: 'A', warehouse: 'W' }, { name: 42, warehouse: true }, {}],
    supports_cross_block_move: true,
  }));
  assert.deepEqual(await api.qolipBlocksData(session), {
    warehouses: [' A ', 'null', '17'],
    blocks: [{ name: 'A', warehouse: 'W' }, { name: '42', warehouse: 'true' }, { name: '', warehouse: '' }],
    supports_cross_block_move: true,
  });
  assert.deepEqual(await api.qolipBlocks(session), [{ name: 'A', warehouse: 'W' }, { name: '42', warehouse: 'true' }, { name: '', warehouse: '' }]);
  assert.equal(calls[0].target, '/v1/mobile/qolip/blocks');
  assert.equal(calls[0].init.method, undefined);
});

test('missing block lists default empty but non-map rows and non-200 reads fail', async () => {
  const { api, session } = harness(json({}));
  assert.deepEqual(await api.qolipBlocksData(session), { warehouses: [], blocks: [], supports_cross_block_move: false });
  assert.deepEqual(api.qolipBlocksResultFromJson({ warehouses: 'bad', blocks: null, supports_cross_block_move: 1 }), {
    warehouses: [], blocks: [], supports_cross_block_move: false,
  });
  assert.throws(() => api.qolipBlocksResultFromJson({ blocks: [17] }));
  await assert.rejects(harness(new Response('failed', { status: 503 })).api.qolipBlocksData(session), /Qolip blocks failed/);
});

test('block creation sends trimmed warehouse and name without invented validation', async () => {
  const { api, calls, session } = harness(json({ block: { name: 'A', warehouse: 'W' } }));
  assert.deepEqual(await api.qolipCreateBlock(session, { warehouse: '\u0085 W ', block: ' A\u0085' }), { name: 'A', warehouse: 'W' });
  assert.equal(calls[0].target, '/v1/mobile/qolip/blocks');
  assert.equal(calls[0].init.method, 'POST');
  assert.equal(new Headers(calls[0].init.headers).get('content-type'), 'application/json');
  assert.deepEqual(JSON.parse(calls[0].init.body), { warehouse: 'W', block: 'A' });
  await assert.rejects(harness(new Response('bad', { status: 400 })).api.qolipCreateBlock(session, { warehouse: '', block: '' }),
    /Qolip block create failed/);
});

test('rename validates blank names and keeps method, body and server error details', async () => {
  const block = { name: ' A ', warehouse: ' W ' };
  const { api, calls, session } = harness(json({ block: { name: 'B', warehouse: 'W' } }));
  await assert.rejects(api.qolipUpdateBlock(session, block, ' \u0085 '), error =>
    error instanceof MobileApiException && error.code === 'block_required' && error.message === 'block_required');
  assert.equal(calls.length, 0);
  assert.deepEqual(await api.qolipUpdateBlock(session, block, ' B '), { name: 'B', warehouse: 'W' });
  assert.equal(calls[0].init.method, 'PUT');
  assert.deepEqual(JSON.parse(calls[0].init.body), { warehouse: 'W', block: 'A', new_block: 'B' });
  const failure = harness(json({ error: 'block_exists', message: '  Band  ' }, 409));
  await assert.rejects(failure.api.qolipUpdateBlock(failure.session, block, 'B'), error =>
    error instanceof MobileApiException && error.code === 'block_exists' && error.statusCode === 409 && error.message === 'Band');
});

test('delete sends the V2 JSON body and preserves fallback error when body is malformed', async () => {
  const block = { name: ' A ', warehouse: ' W ' };
  const { api, calls, session } = harness(new Response(null, { status: 200 }));
  assert.equal(await api.qolipDeleteBlock(session, block), undefined);
  assert.equal(calls[0].init.method, 'DELETE');
  assert.deepEqual(JSON.parse(calls[0].init.body), { warehouse: 'W', block: 'A' });
  const failure = harness(new Response('not json', { status: 500 }));
  await assert.rejects(failure.api.qolipDeleteBlock(failure.session, block), error =>
    error instanceof MobileApiException && error.code === 'qolip_block_delete_failed' && error.statusCode === 500 &&
      error.message === 'Blok o‘chirilmadi.');
});

test('deferred test mode cannot send a block request to a backend', async () => {
  const { api, calls, session } = harness(json({ blocks: [] }));
  session.token = 'test-mode-token';
  await assert.rejects(api.qolipBlocksData(session), /test mode is not yet ported/);
  assert.equal(calls.length, 0);
});
