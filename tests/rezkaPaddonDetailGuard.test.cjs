const assert = require('node:assert/strict'), fs = require('node:fs'), Module = require('node:module');
const path = require('node:path'), test = require('node:test'), ts = require('typescript');
function setup() {
  const calls = [];
  const filename = path.resolve(__dirname, '../src/paddonManagementApi.ts'), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths;
  const mocks = { './authorizedFetch': { authorizedFetch: async (...args) => { calls.push(args); args[3]?.();
    return new Response('{"paddon":{"code":"P1"},"items":[]}', { status: 200 }); } },
  './workerControlsApi': { productionMapResponseError: () => Error(), WorkerControlException: class extends Error {} },
  './paddonModels': { paddonFromJson: value => value, paddonSnapshotFromJson: value => value } };
  mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return { api: mod.exports, calls };
}
test('detail reader preserves legacy two-argument fetch and adds an optional checked send guard', async () => {
  const h = setup(), session = {}; let checks = 0;
  await h.api.adminPaddonDetail(session, ' P1 '); assert.equal(h.calls[0].length, 2);
  assert.equal(h.calls[0][1], '/v1/mobile/admin/production-maps/paddons/detail?code=P1');
  await h.api.adminPaddonDetail(session, 'P1', { beforeSend: () => { checks++; } });
  assert.equal(h.calls[1].length, 4); assert.equal(checks, 1);
});
test('the legacy detail call does not consult an inherited options guard', async () => {
  const h = setup(); let reads = 0;
  const previous = Object.getOwnPropertyDescriptor(Object.prototype, 'beforeSend');
  Object.defineProperty(Object.prototype, 'beforeSend', { configurable: true, get() { reads++; return () => {}; } });
  try {
    await h.api.adminPaddonDetail({}, 'P1');
    assert.equal(reads, 0); assert.equal(h.calls[0].length, 2); assert.equal(h.api.adminPaddonDetail.length, 2);
  } finally {
    if (previous) Object.defineProperty(Object.prototype, 'beforeSend', previous);
    else delete Object.prototype.beforeSend;
  }
});
test('throwing or asynchronous detail guards fail closed without retry or unhandled rejection', async () => {
  const h = setup(), expected = new TypeError('stop'); let checks = 0;
  await assert.rejects(h.api.adminPaddonDetail({}, 'P1', { beforeSend: () => { checks++; throw expected; } }), e => e === expected);
  assert.equal(checks, 1); assert.equal(h.calls.length, 1);
  for (const beforeSend of [async () => {}, async () => { throw Error('late'); }, () => false])
    await assert.rejects(h.api.adminPaddonDetail({}, 'P1', { beforeSend }), /guard must be synchronous/);
  await new Promise(resolve => setImmediate(resolve));
});
