const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
function load(name, mocks = {}) {
  const filename = path.resolve(__dirname, `../src/${name}.ts`), loaded = new Module(filename, module);
  loaded.filename = filename; loaded.paths = module.paths;
  loaded.require = id => Object.hasOwn(mocks, id) ? mocks[id] : id.startsWith('./') ? load(id.slice(2), mocks) : require(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return loaded.exports;
}
const raw = { session_id: 's', batch_id: 'b', qr_payload: 'q', source_apparatus: '', linked_at_unix: 5, worker_display_name: '', state: 'active', consume_state: 'unused', return_token: 'a'.repeat(64), blocked_reason: '' };
function api(post, fetch = async () => { throw Error('unexpected read'); }, scope = () => 'scope') { return load('scannedWipApi', { './authorizedFetch': { authorizedFetch: fetch }, './sessionReadScope': { sessionReadScope: scope }, './workerControlsApi': {
  isCanonicalApparatusId: s => s === 'apparatus:default:press', postWorkerApiRequest: post,
  WorkerControlException: class extends Error { constructor(code, message) { super(message); this.code = code; } },
} }); }
test('return sends a validated scoped WIP and requires success', async () => {
  let args; const client = api(async (...a) => { args = a; return { ok: true }; });
  const item = client.scannedWipFromJson(raw);
  await client.adminReturnScannedWip({}, ' apparatus:default:press ', ' order ', ' stage ', item);
  assert.deepEqual(args.slice(1, 6), ['/v1/mobile/admin/production-maps/scanned-wips/return', { apparatus: 'apparatus:default:press', order_id: 'order', stage_node_id: 'stage', session_id: 's', batch_id: 'b', token: raw.return_token }, 'scope', true, 'queue_action_not_allowed']);
  await assert.rejects(api(async () => ({})).adminReturnScannedWip({}, 'apparatus:default:press', 'order', 'stage', item), /Invalid WIP return response/);
});
test('invalid and already consumed WIP cannot be returned', async () => {
  const client = api(async () => { throw Error('unexpected'); });
  assert.throws(() => client.scannedWipFromJson({ ...raw, return_token: 'bad' }), /Invalid scanned WIP/);
  const consumed = client.scannedWipFromJson({ ...raw, state: 'consumed', consume_state: 'consumed' });
  await assert.rejects(client.adminReturnScannedWip({}, 'apparatus:default:press', 'order', 'stage', consumed), e => e.code === 'queue_action_not_allowed');
});

test('scanned WIP list uses the scoped query and validates every item', async () => {
  let request;
  const client = api(null, async (_session, url) => { request = url; return { status: 200, json: async () => ({ items: [raw] }) }; });
  const result = await client.adminScannedWips({}, ' apparatus:default:press ', ' order ', ' stage ');
  assert.equal(request, '/v1/mobile/admin/production-maps/scanned-wips?apparatus=apparatus%3Adefault%3Apress&order_id=order&stage_node_id=stage');
  assert.equal(result[0].batch_id, 'b');
  await assert.rejects(api(null, async () => ({ status: 200, json: async () => ({ items: [{}] }) })).adminScannedWips({}, 'apparatus:default:press', 'order', 'stage'), /Invalid scanned WIP/);
});
test('scanned WIP list rejects a changed session before using the response', async () => {
  let scope = 'first';
  const client = api(null, async () => { scope = 'second'; return { status: 200, json: async () => ({ items: [] }) }; }, () => scope);
  await assert.rejects(client.adminScannedWips({}, 'apparatus:default:press', 'order', 'stage'), e => e.code === 'session_scope_changed');
});
