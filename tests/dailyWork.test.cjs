const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

function load(fetch = async () => { throw new Error('unexpected request'); }) {
  const scopeFile = path.resolve(__dirname, '../src/sessionReadScope.ts');
  const scope = new Module(scopeFile, module);
  scope.filename = scopeFile;
  scope.paths = module.paths;
  scope._compile(ts.transpileModule(fs.readFileSync(scopeFile, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText, scopeFile);
  const progressFile = path.resolve(__dirname, '../src/workerProgressModel.ts');
  const progress = new Module(progressFile, module);
  progress.filename = progressFile; progress.paths = module.paths;
  progress._compile(ts.transpileModule(fs.readFileSync(progressFile, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, progressFile);
  const controlsFile = path.resolve(__dirname, '../src/workerControlsApi.ts');
  const controls = new Module(controlsFile, module);
  controls.filename = controlsFile; controls.paths = module.paths;
  controls.require = id => id === './authorizedFetch' ? { authorizedFetch: fetch } : id === './sessionReadScope' ? scope.exports : require(id);
  controls._compile(ts.transpileModule(fs.readFileSync(controlsFile, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, controlsFile);
  const batchFile = path.resolve(__dirname, '../src/workerProgressBatch.ts');
  const batch = new Module(batchFile, module);
  batch.filename = batchFile; batch.paths = module.paths;
  batch.require = id => id === './workerControlsApi' ? controls.exports : id === './workerProgressModel' ? progress.exports : require(id);
  batch._compile(ts.transpileModule(fs.readFileSync(batchFile, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, batchFile);
  const apiFile = path.resolve(__dirname, '../src/workerProgressApi.ts');
  const progressApi = new Module(apiFile, module);
  progressApi.filename = apiFile; progressApi.paths = module.paths;
  progressApi.require = id => id === './authorizedFetch' ? { authorizedFetch: fetch } : id === './sessionReadScope' ? scope.exports :
    id === './workerControlsApi' ? controls.exports : id === './workerProgressBatch' ? batch.exports : require(id);
  progressApi._compile(ts.transpileModule(fs.readFileSync(apiFile, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, apiFile);
  const apparatusFile = path.resolve(__dirname, '../src/apparatusApi.ts');
  const apparatus = new Module(apparatusFile, module);
  apparatus.filename = apparatusFile; apparatus.paths = module.paths;
  apparatus.require = id => id === './authorizedFetch' ? { authorizedFetch: fetch } : id === './workerControlsApi' ? controls.exports : require(id);
  apparatus._compile(ts.transpileModule(fs.readFileSync(apparatusFile, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, apparatusFile);
  const filename = path.resolve(__dirname, '../src/dailyWork.ts');
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = module.paths;
  loaded.require = id => id === './apparatusApi' ? apparatus.exports : id === './workerProgressModel' ? progress.exports :
    id === './workerProgressApi' ? progressApi.exports : id === './workerControlsApi' ? controls.exports : require(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText, filename);
  return loaded.exports;
}

const model = load();
const unix = value => Math.floor(value.getTime() / 1000);

test('history uses the signed-in worker scope and the V2 limit', async () => {
  let received;
  const api = load(async (session, url, options) => {
    received = { session, url, signal: options.signal };
    return { ok: true, status: 200, json: async () => ({ batches: [{ batch_id: 'b1', order_id: 'o1', apparatus: 'apparatus:default:press' }] }) };
  });
  const session = { profile: { ref: 'worker & 1' } };
  const signal = new AbortController().signal;
  const rows = await api.loadDailyWork(session, signal);
  const url = new URL(received.url, 'https://example.com');
  assert.equal(url.pathname, '/v1/mobile/admin/production-maps/progress-qr/history');
  assert.equal(url.searchParams.has('worker_ref'), false);
  assert.equal(url.searchParams.get('limit'), '200');
  assert.equal(received.session, session);
  assert.equal(received.signal.aborted, false);
  assert.equal(rows[0].id, 'b1');
  assert.equal((await api.loadDailyWork({ profile: {} }, signal))[0].id, 'b1');
});

test('local-day filtering includes overlapping work and excludes the following midnight', () => {
  const at = (day, hour = 0) => unix(new Date(2026, 10, day, hour));
  const rows = model.parseDailyWorkHistory({ batches: [
    { batch_id: 'across', started_at_unix: at(1, 23), completed_at_unix: at(2, 2) },
    { batch_id: 'at-start', started_at_unix: at(1, 23), completed_at_unix: at(2) },
    { batch_id: 'at-end', started_at_unix: at(3), completed_at_unix: at(3, 1) },
    { batch_id: 'only-start', started_at_unix: at(2, 12) },
    { batch_id: 'no-date' },
  ] });
  assert.deepEqual(model.batchesForDay(rows, new Date(2026, 10, 2, 18)).map(row => row.id), ['only-start', 'across', 'at-start']);
});

test('groups orders, counts unique orders and follows V2 WIP status and title rules', () => {
  const rows = model.parseDailyWorkHistory({ batches: [
    { batch_id: '1', order_id: 'A', label_item_name: 'Mahsulot yarim tayyor mahsulot, apparat: apparatus:1', wip_status: 'waiting', produced_qty: 150, uom: 'm' },
    { batch_id: '2', order_id: 'A', status_detail: { flow_status: 'accepted_to_stock' }, finished_goods_meter: 123.4567 },
    { batch_id: '3', order_id: 'B', wip_status: 'in_use' },
    { batch_id: '4', wip_status: 'used' },
  ] });
  const groups = model.groupDailyWork(rows);
  assert.equal(groups.length, 3);
  assert.equal(groups[0].title, 'Mahsulot');
  assert.equal(groups[0].batches.length, 2);
  assert.deepEqual(model.dailyWorkTotals(rows), { orders: 2, wips: 4, used: 2 });
  assert.equal(model.dailyWorkStatus(rows[2]), 'Jarayonda');
  assert.equal(model.dailyWorkQuantity(rows[1]), '123.457 m');
  assert.equal(model.dailyWorkQuantity(rows[0]), '150 m');
});

test('legacy history derives paused work state when status detail is absent', () => {
  const [row] = model.parseDailyWorkHistory({ batches: [{ batch_id: 'legacy', status: 'paused', action: 'pause', wip_status: 'waiting' }] });
  assert.equal(row.flowStatus, 'free_wip');
  assert.equal(model.dailyWorkStatus(row), 'Jarayonda');
});

test('invalid history and forbidden requests are reported instead of appearing empty', async () => {
  assert.throws(() => model.parseDailyWorkHistory({ batches: null }), /Server javobi/);
  const api = load(async () => ({ ok: false, status: 403 }));
  await assert.rejects(api.loadDailyWork({ profile: { ref: 'w1' } }, new AbortController().signal), /ruxsat/);
});

test('apparatus names resolve from the catalog without exposing internal IDs', async () => {
  const api = load(async () => new Response(JSON.stringify([{ runtime_projection: {
    apparatus_id: 'apparatus:default:press', display: { display_name: 'Bosma 1' }, source_revision: 1,
    source_aasx_sha256: 'a'.repeat(64), execution_profile: { operation: 'print', technology: 'flexographic' },
  } }]), { status: 200 }));
  const names = await api.loadDailyWorkApparatus({}, new AbortController().signal);
  assert.equal(api.dailyWorkLocation('apparatus:default:press', names), 'Bosma 1');
  assert.equal(api.dailyWorkLocation('apparatus:other', names), '');
  assert.equal(api.dailyWorkLocation('Ombor', names), 'Ombor');
});
