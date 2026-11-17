const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

function loader(mocks) {
  const cache = new Map();
  return function load(name) {
    const filename = path.resolve(__dirname, '../src', name.endsWith('.ts') ? name : `${name}.ts`);
    if (cache.has(filename)) return cache.get(filename).exports;
    const loaded = new Module(filename, module); cache.set(filename, loaded);
    loaded.filename = filename; loaded.paths = module.paths;
    loaded.require = id => Object.hasOwn(mocks, id) ? mocks[id] : id.startsWith('.')
      ? load(path.relative(path.resolve(__dirname, '../src'), path.resolve(path.dirname(filename), id))) : require(id);
    loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
    return loaded.exports;
  };
}

function fixture() {
  const session = { baseUrl: 'https://example.test', token: 'old', profile: { ref: 'supplier', role: 'material_taminotchi' } };
  const calls = []; let refreshed = 0, observed = 0;
  const auth = { activeSessionToken: value => value.token,
    refreshSession: async value => { refreshed++; value.token = 'fresh'; return true; },
    joinRefreshForGuardedRead: async () => { observed++; return false; } };
  const load = loader({ './auth': auth, 'expo/fetch': { fetch: async (url, init) => {
    calls.push({ url, init });
    if (calls.length === 1) return new Response('{}', { status: 401 });
    const pathname = new URL(url).pathname;
    return new Response(JSON.stringify(pathname.endsWith('/opening-wip') ? { records: [] }
      : pathname.endsWith('/wip-batches') ? { batches: [] } : []), { status: 200 });
  } } });
  return { load, session, calls, refreshed: () => refreshed, observed: () => observed };
}

const readers = {
  assignments: (h, policy) => h.load('workerRawMaterials').adminRawMaterialAssignments(h.session, 'order', '',
    policy === 'witness' ? () => true : undefined, policy === 'legacy' ? { beforeSend() {} } : undefined),
  opening: (h, policy) => h.load('workerOpeningWipRecordsApi').adminOpeningWipRecords(h.session, { order_id: 'order' },
    policy === 'witness' ? () => true : undefined, policy === 'legacy' ? { beforeSend() {} } : undefined),
  produced: (h, policy) => h.load('workerWip').loadWorkerWipBatches(h.session, 'order', 'apparatus:default:press', new AbortController().signal,
    () => true, policy === 'legacy' ? { readPolicy: 'legacy' } : undefined),
};

for (const [name, read] of Object.entries(readers)) {
  test(`merged ${name}: Material legacy401 starts its existing refresh and retries`, async () => {
    const h = fixture(); assert.deepEqual(await read(h, 'legacy'), []);
    assert.equal(h.refreshed(), 1); assert.equal(h.observed(), 0); assert.equal(h.calls.length, 2);
    assert.equal(h.calls[1].init.headers.get('Authorization'), 'Bearer fresh');
  });
  test(`merged ${name}: Qolip witness401 cannot start credential refresh`, async () => {
    const h = fixture(); await assert.rejects(read(h, 'witness'), error => error.code === 'guarded_read_refresh_unavailable');
    assert.equal(h.refreshed(), 0); assert.equal(h.observed(), 1); assert.equal(h.calls.length, 1);
  });
  test(`merged ${name}: transport overloads remain explicit for each role`, async () => {
    for (const policy of ['legacy', 'witness']) {
      const calls = [], load = loader({ './authorizedFetch': { authorizedFetch: async (...args) => {
        calls.push(args); const pathname = new URL(args[1], 'https://example.test').pathname;
        return new Response(JSON.stringify(pathname.endsWith('/opening-wip') ? { records: [] }
          : pathname.endsWith('/wip-batches') ? { batches: [] } : []), { status: 200 });
      } } });
      await read({ load, session: { baseUrl: 'https://example.test', token: 'token', profile: { ref: 'one', role: 'material_taminotchi' } } }, policy);
      assert.equal(calls[0].length, policy === 'legacy' ? 4 : 6);
      assert.equal(typeof calls[0][3], 'function');
      if (policy === 'witness') assert.equal(calls[0][5].readWitness(), true);
      else assert.equal(calls[0][5], undefined);
    }
  });
}

test('merged mold readiness keeps Material checkAfter true and Qolip false', async () => {
  const calls = [], load = loader({ './workerControlsApi': { postWorkerApiRequest: async (...args) => {
    calls.push(args); assert.equal(args[6](), true); return { orders: [{ order_id: 'order', product: null }] };
  } }, './qolipCatalogApi': {} });
  const api = load('qolipOrderProductsApi'); let current = true;
  const beforeSend = () => { if (!current) throw Error('stale'); };
  assert.deepEqual(await api.qolipOrderProducts({}, ['order'], undefined, { beforeSend }), { order: null });
  assert.deepEqual(await api.qolipOrderProducts({}, ['order'], () => current), { order: null });
  assert.equal(calls[0][4], true); assert.equal(calls[1][4], false);
  current = false; assert.throws(calls[0][6], /stale/); assert.equal(calls[1][6](), false);
});

test('mold empty IDs preserve Material no-op and Qolip witness preflight from their parent branches', async () => {
  let sends = 0, legacyChecks = 0;
  const load = loader({ './workerControlsApi': { postWorkerApiRequest: async () => { sends++; } }, './qolipCatalogApi': {} });
  const api = load('qolipOrderProductsApi');
  assert.deepEqual(await api.qolipOrderProducts({}, [], undefined, { beforeSend() { legacyChecks++; throw Error('retired'); } }), {});
  await assert.rejects(api.qolipOrderProducts({}, [], () => false), /Hisob o‘zgardi/);
  assert.equal(sends, 0); assert.equal(legacyChecks, 0);
});

for (const policy of ['legacy', 'witness']) test(`mold ${policy} keeps its original guard behavior after an error body retires the owner`, async () => {
  let current = true;
  const load = loader({ './auth': {}, './authorizedFetch': { authorizedFetch: async (_session, _path, _init, guard) => {
    guard(); return { status: 403, headers: new Headers(), json: async () => { current = false; return { error: 'forbidden' }; } };
  } } });
  const api = load('qolipOrderProductsApi');
  const promise = policy === 'legacy' ? api.qolipOrderProducts({}, ['order'], undefined, { beforeSend() { if (!current) throw Error('original Material guard retired'); } })
    : api.qolipOrderProducts({}, ['order'], () => current);
  await assert.rejects(promise, error => policy === 'legacy' ? error.message === 'original Material guard retired' : error.code === 'forbidden');
});
