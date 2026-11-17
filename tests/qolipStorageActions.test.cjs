const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const cache = new Map();
function load(name) {
  if (cache.has(name)) return cache.get(name).exports;
  const filename = path.resolve(__dirname, '../src', name), mod = new Module(filename, module); cache.set(name, mod);
  mod.require = key => key === './qolipReworkRequestId' ? { newQolipReworkRequestId: async () => 'native-id' }
    : key.startsWith('.') ? load(`${path.relative(path.resolve(__dirname, '../src'), path.resolve(path.dirname(filename), key))}.ts`) : require(key);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ESNext } }).outputText, filename);
  return mod.exports;
}
const { QolipStorageActions, QolipPaddonActions, QolipArchiveRestore } = load('qolip/qolipStorageActions.ts');
const { MobileApiException } = load('shared/mobileApiException.ts');
const detail = (revision = 4, items = [], extra = {}) => ({ paddon: { code: 'QP-00001', warehouse: 'W', revision, item_count: items.length, archived: false, ...extra }, items, inspection: null });
const defer = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
function fixture(changes = {}) {
  const calls = [], messages = []; let current = true, id = 0;
  const deps = { current: () => current, text: key => key, notice: x => messages.push(x), error: x => messages.push(x), changed: () => calls.push('changed'),
    reload: async () => calls.push('reload'), warehouses: async () => ['W'], createDialog: async () => ({ warehouse: 'W', location: '', note: '' }),
    confirm: async (...args) => { calls.push(['confirm', ...args]); return true; }, selectMolds: async () => [{ code: 'B' }, { code: 'A' }],
    openPaddon: (...args) => calls.push(['open', ...args]), detail: async () => detail(), action: async body => { calls.push(['action', { ...body }]); return detail(); },
    archive: async body => { calls.push(['archive', { ...body }]); return []; }, delete: async body => { calls.push(['delete', { ...body }]); }, nextId: async () => `id-${++id}`, ...changes };
  return { deps, calls, messages, expire: () => { current = false; } };
}
test('storage create preserves source warehouse-only draft and opens returned pallet', async () => {
  const h = fixture(), owner = new QolipStorageActions(h.deps); await owner.create();
  assert.deepEqual(h.calls.find(x => x[0] === 'action')[1], { action: 'create', warehouse: 'W', location: '', note: '', request_id: 'id-1' });
  assert.deepEqual(h.calls.at(-1), ['open', 'QP-00001']); assert.equal(owner.saving, false);
});
test('same create intent reuses its request ID and draft after a lost response', async () => {
  let attempts = 0; const bodies = [], drafts = [], h = fixture({ action: async body => { bodies.push({ ...body }); if (++attempts === 1) throw new Error('lost'); return detail(); },
    createDialog: async (_warehouses, draft) => { drafts.push(draft); return { warehouse: 'W', location: '', note: '' }; } });
  const owner = new QolipStorageActions(h.deps); await owner.create(); await owner.create();
  assert.equal(bodies[0].request_id, bodies[1].request_id); assert.deepEqual(drafts[1], { warehouse: 'W', location: '', note: '' });
});
test('archive selection is sorted and retained across failed retry and canceled confirmation', async () => {
  let fail = true, picks = 0; const bodies = [], h = fixture({ selectMolds: async () => { picks++; return [{ code: 'B' }, { code: 'A' }]; },
    archive: async body => { bodies.push({ ...body }); if (fail) throw new Error('lost'); return []; } });
  const owner = new QolipStorageActions(h.deps); await owner.archiveMolds(); fail = false; await owner.archiveMolds();
  assert.equal(picks, 1); assert.deepEqual(bodies[0].qolip_codes, ['A', 'B']); assert.equal(bodies[0].request_id, bodies[1].request_id);
  assert.deepEqual(h.calls.filter(x => typeof x === 'string'), ['changed', 'reload']);
});

test('canceling retained archive selection clears its retry intent and allows a new picker', async () => {
  let picks = 0; const bodies = [], h = fixture({ selectMolds: async () => [{ code: ++picks === 1 ? 'A' : 'B' }], archive: async body => { bodies.push({ ...body }); throw new Error('lost'); } });
  const owner = new QolipStorageActions(h.deps); await owner.archiveMolds(); assert.equal(owner.pendingArchiveCount, 1);
  owner.cancelArchive(); assert.equal(owner.pendingArchiveCount, 0); await owner.archiveMolds();
  assert.deepEqual(bodies[1].qolip_codes, ['B']); assert.notEqual(bodies[0].request_id, bodies[1].request_id);
});
test('delete reviews latest revision, refuses occupied pallet, and retries the same body after loss', async () => {
  const sent = []; let reads = 0, fail = true;
  const h = fixture({ detail: async () => { reads++; return detail(9); }, delete: async body => { sent.push({ ...body }); if (fail) throw new Error('lost'); } });
  const owner = new QolipStorageActions(h.deps), paddon = detail(1).paddon;
  await owner.deletePaddon(paddon); fail = false; await owner.deletePaddon(paddon);
  assert.equal(reads, 1); assert.equal(sent[0].expected_revision, 9); assert.deepEqual(sent[0], sent[1]);
  const occupied = fixture({ detail: async () => detail(3, [{ code: 'M' }]) }); await new QolipStorageActions(occupied.deps).deletePaddon(paddon);
  assert.ok(occupied.messages.includes('paddon_not_empty')); assert.equal(occupied.calls.some(x => x[0] === 'delete'), false);
});
test('expired original role after native ID draw never dispatches', async () => {
  const id = defer(), h = fixture({ nextId: () => id.promise }), owner = new QolipStorageActions(h.deps);
  const operation = owner.create(); await new Promise(resolve => setImmediate(resolve)); h.expire(); id.resolve('id'); await operation;
  assert.equal(h.calls.some(x => x[0] === 'action'), false);
});
test('paddon action uses reviewed revision despite refresh completing during confirmation', async () => {
  const confirmation = defer(), h = fixture({ confirm: () => confirmation.promise }), owner = new QolipPaddonActions('QP-00001', h.deps);
  owner.detail = detail(4, [{ code: 'B' }, { code: 'A' }]); owner.loading = false;
  const operation = owner.act('remove', ['B', 'A']); owner.detail = detail(8); confirmation.resolve(true); await operation;
  const body = h.calls.find(x => x[0] === 'action')[1]; assert.equal(body.expected_revision, 4); assert.deepEqual(body.qolip_codes, ['A', 'B']);
});
test('paddon failed action preserves retry key while 409 retires it and reloads', async () => {
  let conflict = false; const bodies = [], h = fixture({ action: async body => { bodies.push({ ...body }); throw conflict
    ? new MobileApiException({ code: 'changed', message: 'changed', statusCode: 409 }) : new Error('lost'); } });
  const owner = new QolipPaddonActions('QP-00001', h.deps); owner.detail = detail(); owner.loading = false;
  await owner.act('lock'); await owner.act('lock'); assert.equal(bodies[0].request_id, bodies[1].request_id);
  conflict = true; await owner.act('lock'); conflict = false; await owner.act('lock'); assert.notEqual(bodies[2].request_id, bodies[3].request_id);
});
test('archived pallet restore verifies visit identity and preserves reviewed body after response loss', async () => {
  const bodies = []; let reads = 0, fail = true;
  const h = fixture({ detail: async () => { reads++; return detail(7, [], { archive_entry_id: 'visit' }); }, action: async body => { bodies.push({ ...body }); if (fail) throw new Error('lost'); return detail(); } });
  const owner = new QolipArchiveRestore({ id: 'visit', kind: 'paddon', code: 'QP-00001' }, h.deps);
  await owner.restore(); fail = false; await owner.restore(); assert.equal(reads, 1); assert.deepEqual(bodies[0], bodies[1]); assert.equal(owner.restored, true);
  const mismatch = fixture({ detail: async () => detail(9, [], { archive_entry_id: 'later' }) });
  await new QolipArchiveRestore({ id: 'visit', kind: 'paddon', code: 'QP-00001' }, mismatch.deps).restore();
  assert.equal(mismatch.calls.some(x => x[0] === 'action'), false); assert.equal(mismatch.messages[0].code, 'qolip_archive_changed');
});
