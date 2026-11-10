const assert = require('node:assert/strict'), fs = require('node:fs'), Module = require('node:module');
const path = require('node:path'), test = require('node:test'), ts = require('typescript');
function setup() {
  const session = { token: 'one', baseUrl: 'https://example.test', profile: { role: 'aparatchi', ref: 'worker' }, capabilities: [], assigned_apparatus: ['cut'] };
  const h = { active: true, session, calls: [], mode: 'before', parses: 0 };
  const cache = new Map();
  const mocks = { './auth': { activeSessionToken: () => session.token, refreshSession: async () => { h.active = false; session.token = 'two'; return true; } },
    './paddonModels': { paddonFromJson: x => { h.parses++; return x; }, paddonSnapshotFromJson: x => { h.parses++; return x; }, paddonIsLocked: () => true },
    './workerPrintJob': { printJobFromJson: x => x }, 'expo/fetch': { fetch: async (url, init) => {
      h.calls.push({ url, init });
      if (h.mode === '401') return new Response('{}', { status: 401 });
      if (h.mode === 'response') h.active = false;
      return { status: 200, json: async () => { if (h.mode === 'body') h.active = false; return { paddon: { code: 'P1' }, paddons: [] }; } };
    } } };
  function load(name) {
    if (cache.has(name)) return cache.get(name);
    const file = path.resolve(__dirname, '../src', `${name}.ts`), mod = new Module(file, module); mod.filename = file; mod.paths = module.paths;
    mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : id.startsWith('.') ? load(path.posix.join(path.posix.dirname(name), id)) : require(id);
    mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, file);
    cache.set(name, mod.exports); return mod.exports;
  }
  h.load = load; h.current = () => h.active; h.guard = () => { if (!h.active) throw Error('retired'); };
  return h;
}
// @v2-test test/paddon_transfer_test.dart
const cases = {
  create: h => h.load('paddonManagementApi').adminPaddonCreate(h.session, { apparatus: 'cut', beforeSend: h.guard }),
  delete: h => h.load('paddonManagementApi').adminPaddonDelete(h.session, 'P1', h.guard),
  detail: h => h.load('paddonManagementApi').adminPaddonDetail(h.session, 'P1', { beforeSend: h.guard }),
  list: h => h.load('paddonManagementApi').adminPaddons(h.session, { apparatus: 'cut', beforeSend: h.guard }),
  report: h => h.load('paddonManagementApi').adminPaddonQrReport(h.session, 'P1', { beforeSend: h.guard }),
  add: h => h.load('paddonItemsApi').adminPaddonAddWips(h.session, { paddon_code: 'P1', progress_batch_ids: ['B'] }, h.current),
  remove: h => h.load('paddonItemsApi').adminPaddonRemoveWip(h.session, { paddon_code: 'P1', progress_batch_id: 'B' }, h.current),
  removeBatch: h => h.load('paddonItemsApi').adminPaddonRemoveWips(h.session, { paddon_code: 'P1', progress_batch_ids: ['B'] }, h.current),
  print: h => h.load('paddonPrintApi').adminPaddonPrintQr(h.session, { code: 'P1', beforeSend: h.guard }),
  confirm: h => h.load('paddonConfirmPrintApi').confirmPaddonPrint(h.session, 'P1', h.current),
  successor: h => h.load('paddonSuccessorApi').createActivePaddonSuccessor(h.session, 'P1', 'cut', h.current),
  unlock: h => h.load('paddonUnlockApi').unlockPaddon(h.session, 'P1', h.current),
  transfer: h => h.load('paddonTransferApi').transferPaddonItems(h.session, 'P1', 'P2', ['B'], h.current),
};
for (const [name, call] of Object.entries(cases)) {
  test(`${name}: a retired route cannot send or retry through a 401`, async () => {
    const h = setup(); h.active = false; await assert.rejects(call(h)); assert.equal(h.calls.length, 0);
    const retry = setup(); retry.mode = '401'; await assert.rejects(call(retry)); assert.equal(retry.calls.length, 1);
  });
  if (name !== 'delete') test(`${name}: retirement during body decoding cannot publish parsed data`, async () => {
    const h = setup(); h.mode = 'body'; await assert.rejects(call(h)); assert.equal(h.calls.length, 1); assert.equal(h.parses, 0);
  });
}
