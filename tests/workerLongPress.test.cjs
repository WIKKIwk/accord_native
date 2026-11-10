const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

function load(name, mocks = {}) {
  const filename = path.resolve(__dirname, `../src/${name}.ts`);
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = module.paths;
  loaded.require = id => Object.hasOwn(mocks, id) ? mocks[id] : id.startsWith('./') ? load(id.slice(2), mocks) : require(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return loaded.exports;
}
let responseControl, requests = [];
const authorizedFetch = async (_session, url, init = {}) => {
  requests.push({ url, body: init.body ? JSON.parse(init.body) : null });
  const result = init.method === 'POST' ? (url.endsWith('/print-preflight')
    ? { hold: { hold_id: 'hold', idempotency_key: 'key', order_id: 'o', apparatus: 'apparatus:default:p', status: 'running', revision: 2 } } : { ok: true }) : responseControl;
  return { ok: true, status: 200, json: async () => result, text: async () => JSON.stringify(result) };
};
const scope = load('sessionReadScope');
const controls = load('workerControlsApi', { './authorizedFetch': { authorizedFetch }, './sessionReadScope': scope });
const logic = load('workerOrderLogic', { './workerControlsApi': controls });
const preflight = load('workerPrintPreflight', { './workerControlsApi': controls, './workerOrderLogic': logic });
const materials = load('workerRawMaterials', { './authorizedFetch': { authorizedFetch }, './workerControlsApi': controls });
const batch = load('workerProgressBatch', { './workerControlsApi': controls, './workerProgressModel': load('workerProgressModel') });
const bootstrapApi = load('workerScanBootstrap', { './authorizedFetch': { authorizedFetch }, './workerControlsApi': controls, './workerRawMaterials': materials, './workerOrderLogic': logic, './workerProgressBatch': batch });
const queueModels = load('workerQueueModels', { './workerControlsApi': controls });
const legacyApi = load('workerLegacyScan', { './authorizedFetch': { authorizedFetch }, './workerOrderLogic': logic, './sessionReadScope': scope,
  './workerControlsApi': controls, './workerQueueModels': queueModels });
const { workerLongPressMenu, runWorkerMenuAction, readWorkerActionControl, reactivationTarget } = load('workerLongPress', { './authorizedFetch': { authorizedFetch }, './workerOrderLogic': logic, './sessionReadScope': scope, './workerControlsApi': controls, './workerPrintPreflight': preflight, './workerScanBootstrap': bootstrapApi, './workerLegacyScan': legacyApi });
const cursor = { epoch: 'e', rev: 3 };
const session = { assigned_apparatus: ['apparatus:default:p'], capabilities: ['apparatus.queue.manage'], profile: { role: 'aparatchi', ref: 'worker' } };
const token = 'a'.repeat(64);
function bootstrap(state = 'in_progress', mode = 'in_progress', actions = ['pause', 'complete']) {
  return { ok: true, control_state: { apparatus: 'apparatus:default:p', order_id: 'o', epoch: 'e', scope: 's', rev: 3, order_control: 'active', queue_state: state, stage_states: {},
    control: { state, stage_node_id: 'stage', allowed_actions: actions, previous_stage_ready: true, complete_requires_full_report: true,
      interaction: { mode, start_materials_mode: 'hidden', material_scan_required: false, assigned_materials_display_only: true,
        material_intake_allowed: true, previous_wip_mode: 'not_required', qolip_mode: 'not_required', resume_input_required: false } } } };
}
function menu(data, account = session) { return workerLongPressMenu(data, account, 'apparatus:default:p', 'o', cursor); }

test('V2 menu exposes only actions authorized for the current worker and control', () => {
  const data = bootstrap();
  data.control_state.control.temporary_pause = { session_id: 'session', token };
  assert.deepEqual(menu(data).actions, ['temporary_pause', 'astatka', 'finish']);
  data.control_state.control.re_pause = { resume_id: 'resume', worker_role: 'aparatchi', worker_ref: 'worker' };
  assert.deepEqual(menu(data).actions, ['temporary_pause', 're_pause', 'astatka', 'finish']);
  data.control_state.control.re_pause.worker_ref = 'another';
  assert.equal(menu(data).actions.includes('re_pause'), false);
  assert.equal(menu(data, { ...session, assigned_apparatus: [] }).kind, 'none');
  data.control_state.control.temporary_pause.token = 'invalid';
  data.control_state.control.stage_work = { astatka_available: true };
  assert.equal(menu(data).kind, 'none');
  delete data.control_state.control.temporary_pause;
  assert.equal(menu(data).kind, 'astatka');
  data.control_state.order_control = 'frozen';
  assert.equal(menu(data).kind, 'none');
});

test('non-print long press offers a report even when complete is not allowed and hides print-only actions', () => {
  const data = bootstrap('paused', 'paused', ['resume']);
  for (const operation of ['laminate', 'glue', 'cut']) {
    const menu = workerLongPressMenu(data, session, 'apparatus:default:p', 'o', cursor, operation);
    assert.equal(menu.kind, 'report'); assert.deepEqual(menu.actions, ['finish']);
  }
  for (const operation of ['', 'package', 'unknown']) assert.equal(workerLongPressMenu(data, session, 'apparatus:default:p', 'o', cursor, operation).kind, 'none');
});

test('laminate prior remainder keeps its report menu, while a cut prior remainder opens astatka directly', () => {
  const data = bootstrap('pending', 'fresh_start', ['start']); data.control_state.control.stage_work = { astatka_available: true };
  assert.equal(workerLongPressMenu(data, session, 'apparatus:default:p', 'o', cursor, 'laminate').kind, 'report');
  assert.equal(workerLongPressMenu(data, session, 'apparatus:default:p', 'o', cursor, 'cut').kind, 'astatka');
});

// @v2-test test/admin_production_map_test_screen_test.dart
test('native finish selection opens astatka for laminate/glue/cut and complete only for print', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../src/components/WorkerLongPressActions.tsx'), 'utf8');
  const ast = ts.createSourceFile('menu.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let declaration; const visit = node => { if (ts.isFunctionDeclaration(node) && node.name?.text === 'choose') declaration = node; ts.forEachChild(node, visit); }; visit(ast);
  const compiled = ts.transpileModule(`const choose = ${declaration.getText(ast)}; return choose;`, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  for (const operation of ['print', 'laminate', 'glue', 'cut']) {
    let choice;
    const choose = new Function('menu', 'pick', compiled)({ operation, actions: ['finish'] }, value => { choice = value; });
    choose('finish'); assert.equal(choice, operation === 'print' ? 'complete' : 'astatka');
    choose('astatka'); assert.equal(choice, 'astatka');
  }
  for (const action of ['resume', 'detach_roll']) {
    let choice;
    const choose = new Function('menu', 'pick', compiled)({ operation: 'glue', actions: [action] }, value => { choice = value; });
    choose(action); assert.equal(choice, action);
  }
});

test('temporary pause is revalidated and never sent for an outdated token', async () => {
  const data = bootstrap();
  data.control_state.control.temporary_pause = { session_id: 'session', token };
  const previous = menu(data);
  responseControl = structuredClone(data); requests = [];
  await runWorkerMenuAction(session, 'apparatus:default:p', 'o', 'temporary_pause', previous, () => cursor);
  assert.equal(requests.length, 2);
  assert.match(requests[1].url, /temporary-pause$/);
  assert.deepEqual(requests[1].body, { apparatus: 'apparatus:default:p', order_id: 'o', session_id: 'session', token });
  responseControl.control_state.control.temporary_pause.token = 'b'.repeat(64); requests = [];
  await assert.rejects(runWorkerMenuAction(session, 'apparatus:default:p', 'o', 'temporary_pause', previous, () => cursor));
  assert.equal(requests.length, 1);
  requests = [];
  await assert.rejects(readWorkerActionControl(session, 'apparatus:default:p', 'o', () => null));
  assert.equal(requests.length, 1);
});

test('re-pause and reclose require the owner and the current stage', () => {
  const data = bootstrap();
  data.control_state.control.re_pause = { resume_id: 'resume', worker_role: 'aparatchi', worker_ref: 'worker' };
  assert.equal(menu(data).actions.includes('re_pause'), true);
  const paused = bootstrap('paused', 'paused', ['resume']);
  paused.control_state.control.reclose = { session_id: 'session', stage_node_id: 'stage', worker_role: 'aparatchi', worker_ref: 'worker', token };
  assert.deepEqual(menu(paused).actions, ['reclose', 'astatka', 'finish']);
  paused.control_state.control.reclose.stage_node_id = 'other-stage';
  assert.deepEqual(menu(paused).actions, ['astatka']);
});

test('passed color trial and an available prior remainder use their V2 flows', () => {
  const trial = bootstrap('print_preflight', 'fresh_start', ['start']);
  trial.control_state.control.print_preflight = { hold_id: 'hold', idempotency_key: 'key', order_id: 'o', apparatus: 'apparatus:default:p', status: 'passed', revision: 2 };
  assert.deepEqual(menu(trial).actions, ['reopen']);
  trial.control_state.control.print_preflight.apparatus = 'other';
  assert.equal(menu(trial).kind, 'none');
  const pending = bootstrap('pending', 'fresh_start', ['start']);
  pending.control_state.control.stage_work = { astatka_available: true };
  assert.equal(menu(pending).kind, 'astatka');
});

test('re-pause, reclose and color-trial reopen send the V2 endpoint payloads', async () => {
  const active = bootstrap();
  active.control_state.control.re_pause = { resume_id: 'resume', worker_role: 'aparatchi', worker_ref: 'worker' };
  responseControl = structuredClone(active); requests = [];
  await runWorkerMenuAction(session, 'apparatus:default:p', 'o', 're_pause', menu(active), () => cursor);
  assert.match(requests[1].url, /re-pause$/);
  assert.deepEqual(requests[1].body, { apparatus: 'apparatus:default:p', order_id: 'o', resume_id: 'resume' });
  const paused = bootstrap('paused', 'paused', ['resume']);
  paused.control_state.control.reclose = { session_id: 'session', stage_node_id: 'stage', worker_role: 'aparatchi', worker_ref: 'worker', token };
  responseControl = structuredClone(paused); requests = [];
  await runWorkerMenuAction(session, 'apparatus:default:p', 'o', 'reclose', menu(paused), () => cursor);
  assert.match(requests[1].url, /reactivation\/reclose$/);
  assert.deepEqual(requests[1].body, { apparatus: 'apparatus:default:p', order_id: 'o', session_id: 'session', stage_node_id: 'stage', token });
  const trial = bootstrap('print_preflight', 'fresh_start', ['start']);
  trial.control_state.control.print_preflight = { hold_id: 'hold', idempotency_key: 'key', order_id: 'o', apparatus: 'apparatus:default:p', status: 'passed', revision: 2 };
  responseControl = structuredClone(trial); requests = [];
  await runWorkerMenuAction(session, 'apparatus:default:p', 'o', 'reopen', menu(trial), () => cursor);
  assert.deepEqual(requests[1].body, { apparatus: 'apparatus:default:p', order_id: 'o', action: 'reopen', hold_id: 'hold', expected_revision: 2, include_control: true });
});

test('completed work can reopen only an exact, current server target', () => {
  const target = { apparatus: 'apparatus:default:p', order_id: 'o', batch_id: '', session_id: 's', stage_node_id: 'stage', token: 'preview-token', readScope: scope.sessionReadScope(session) };
  const detail = { projection: 'worker_detail_v1', scope: 's', epoch: 'e', rev: 3, maps: [{ map: { id: 'o', nodes: [{ id: 'stage', kind: 'apparatus', apparatus_id: 'apparatus:default:p', title: 'Bosma' }] } }] };
  assert.deepEqual(reactivationTarget({ available: true, target }, detail, 'apparatus:default:p', 'o', cursor).target, target);
  assert.equal(reactivationTarget({ available: true, target }, detail, 'apparatus:default:p', 'o', null).target, null);
  assert.equal(reactivationTarget({ available: true, target }, detail, 'apparatus:default:p', 'o', { epoch: 'e', rev: 4 }).target, null);
  detail.maps[0].map.nodes[0].apparatus_id = 'other';
  assert.equal(reactivationTarget({ available: true, target }, detail, 'apparatus:default:p', 'o', cursor).reason, 'stale_target');
});

// @v2-test test/cancel_start_api_test.dart
test('undo start is limited to assigned laminate/glue/cut apparatus, current owner and authoritative control', () => {
  const data = bootstrap();
  data.control_state.control.cancel_start = { session_id: 'started', token, worker_ref: 'worker', previous_state: 'pending' };
  const get = (account = session, value = data, operation = 'laminate', order = 'o', current = cursor) =>
    workerLongPressMenu(value, account, 'apparatus:default:p', order, current, operation);
  for (const operation of ['laminate', 'glue', 'cut']) assert.equal(get(session, data, operation).actions.includes('cancel_start'), true);
  for (const operation of ['print', 'package', '']) assert.equal(get(session, data, operation).actions.includes('cancel_start'), false);
  for (const account of [{ ...session, assigned_apparatus: [] }, { ...session, capabilities: [] },
    { ...session, profile: { role: 'admin', ref: 'worker' } }, { ...session, profile: { role: 'aparatchi', ref: 'other' } }])
    assert.equal(get(account).actions.includes('cancel_start'), false);
  assert.equal(get(session, data, 'laminate', 'training-o').actions.includes('cancel_start'), false);
  assert.equal(get(session, data, 'laminate', 'o', { epoch: 'e', rev: 4 }).actions.includes('cancel_start'), false);
  for (const patch of [{ state: 'paused' }, { cancel_start: { session_id: 'started', token: 'invalid', worker_ref: 'worker', previous_state: 'pending' } }]) {
    const invalid = structuredClone(data); Object.assign(invalid.control_state.control, patch);
    assert.equal(get(session, invalid).actions.includes('cancel_start'), false);
  }
});

test('undo start revalidates the token and sends one exact cancel-start command', async () => {
  const data = bootstrap();
  data.control_state.control.cancel_start = { session_id: 'started', token, worker_ref: 'worker', previous_state: 'completed' };
  const previous = workerLongPressMenu(data, session, 'apparatus:default:p', 'o', cursor, 'cut');
  responseControl = structuredClone(data); requests = [];
  await runWorkerMenuAction(session, 'apparatus:default:p', 'o', 'cancel_start', previous, () => cursor);
  assert.equal(requests.filter(item => item.body).length, 1);
  assert.deepEqual(requests[1].body, { apparatus: 'apparatus:default:p', order_id: 'o', session_id: 'started', token });
  assert.match(requests[1].url, /cancel-start$/);
  for (const patch of [{ token: 'b'.repeat(64) }, { session_id: 'replacement' }, { worker_ref: 'other' }, { previous_state: 'pending' }]) {
    responseControl = structuredClone(data); Object.assign(responseControl.control_state.control.cancel_start, patch); requests = [];
    await assert.rejects(runWorkerMenuAction(session, 'apparatus:default:p', 'o', 'cancel_start', previous, () => cursor));
    assert.equal(requests.filter(item => item.body).length, 0);
  }
});

test('native menu requires confirmation before undo and reports an uncertain response without retrying', async () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../src/components/WorkerLongPressActions.tsx'), 'utf8');
  const ast = ts.createSourceFile('menu.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let declaration; const visit = node => { if (ts.isFunctionDeclaration(node) && node.name?.text === 'choose') declaration = node; ts.forEachChild(node, visit); }; visit(ast);
  const compiled = ts.transpileModule(`const choose = ${declaration.getText(ast)}; return choose;`, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  let choice, calls = 0, fails = false;
  const choose = new Function('menu', 'pick', 'p', 'runWorkerMenuAction', 'session', 'apparatusId', 'order', 'labels', compiled)(
    { actions: ['cancel_start'] }, item => { choice = item; }, key => key,
    async () => { calls++; if (fails) throw new Error('network'); }, session, 'apparatus:default:p', { id: 'o' }, {});
  choose('cancel_start'); assert.equal(calls, 0);
  assert.deepEqual(choice.confirmation, { title: 'worker.cancel_start.title', message: 'worker.cancel_start.message', confirmLabel: 'worker.cancel_start.confirm', cancelLabel: 'worker.cancel_start.back' });
  assert.equal(await choice.run(() => cursor), 'worker.cancel_start.success'); assert.equal(calls, 1);
  fails = true; assert.equal(await choice.run(() => cursor), 'worker.cancel_start.failed'); assert.equal(calls, 2);
});
