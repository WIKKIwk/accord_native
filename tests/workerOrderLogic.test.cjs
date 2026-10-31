const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

const filename = path.resolve(__dirname, '../src/workerOrderLogic.ts');
const loaded = new Module(filename, module);
loaded.filename = filename;
loaded.paths = module.paths;
loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
const { validOrderControl, automaticQolipConfirmation, preflightFreezeRequest, runningFreezeRequest } = loaded.exports;

function bootstrap() {
  return { ok: true, control_state: { apparatus: 'press', order_id: 'order', epoch: 'epoch', scope: 'scope', rev: 12,
    order_control: 'active', queue_state: 'pending', control: { state: 'pending', allowed_actions: ['start'], interaction: { mode: 'fresh_start' } } } };
}

test('control is scoped, current and cannot authorize frozen or inconsistent work', () => {
  const current = bootstrap();
  assert.equal(validOrderControl(current, 'press', 'order', { epoch: 'epoch', rev: 12 }), true);
  assert.equal(validOrderControl(current, 'press', 'other', { epoch: 'epoch', rev: 12 }), false);
  assert.equal(validOrderControl(current, 'press', 'order', { epoch: 'epoch', rev: 13 }), false);
  assert.equal(validOrderControl(current, 'press', 'order', { epoch: 'old-epoch', rev: 1 }), false);
  const inconsistent = bootstrap(); inconsistent.control_state.queue_state = 'paused';
  assert.equal(validOrderControl(inconsistent, 'press', 'order', null), false);
  const frozen = bootstrap(); frozen.control_state.order_control = 'frozen';
  assert.equal(validOrderControl(frozen, 'press', 'order', null), false);
  frozen.control_state.queue_state = 'frozen'; frozen.control_state.control.state = 'frozen'; frozen.control_state.control.interaction.mode = 'frozen'; frozen.control_state.control.allowed_actions = [];
  assert.equal(validOrderControl(frozen, 'press', 'order', null), true);
});

function molds() {
  return { qolip_code: '', automatic_confirmation_enabled: true, policy_revision: 3, blocking_reason_code: '',
    required_qolip_count: 2, required_qolip_codes: ['A', 'B'], required_qolips: [
      { qolip_code: 'A', qolip_set_id: 'set-1', color: 'red', is_extension: false, ready: true, blocking_reason_code: '' },
      { qolip_code: 'B', qolip_set_id: 'set-1', color: 'black', is_extension: true, ready: true, blocking_reason_code: '' },
    ], sets: [{ set_id: 'set-1', fingerprint: 'a'.repeat(64), ready: true, blocking_reason_code: '' }] };
}

test('automatic molds require the exact policy, set fingerprint and ready members', () => {
  const data = molds();
  const interaction = { qolip_policy_revision: 3 };
  assert.deepEqual(automaticQolipConfirmation(data, interaction, ''), { method: 'automatic', set_id: 'set-1', fingerprint: 'a'.repeat(64), policy_revision: 3 });
  assert.equal(automaticQolipConfirmation(data, { qolip_policy_revision: 4 }, ''), null);
  data.required_qolips[1].ready = false;
  assert.equal(automaticQolipConfirmation(data, interaction, ''), null);
  data.required_qolips[1].ready = true; data.sets[0].fingerprint = 'bad';
  assert.equal(automaticQolipConfirmation(data, interaction, ''), null);
  data.sets[0].fingerprint = 'a'.repeat(64); data.required_qolip_codes[0] = 'another';
  assert.equal(automaticQolipConfirmation(data, interaction, ''), null);
});

test('preflight freeze requires the pending request and exact apparatus', () => {
  assert.equal(preflightFreezeRequest(bootstrap().control_state, 'press', 'order'), null);
  const state = bootstrap().control_state;
  state.order_control = 'freeze_requested'; state.queue_state = 'print_preflight';
  state.control = { state: 'print_preflight', allowed_actions: ['freeze'], interaction: { mode: 'freeze_requested' },
    print_preflight: { order_id: 'order', apparatus: 'press', status: 'running' },
    freeze_request: { request_id: 'request', status: 'pending', scope: 'order', target_apparatus: 'press', target_session_id: '' } };
  assert.equal(validOrderControl({ ok: true, control_state: state }, 'press', 'order', null), true);
  assert.equal(preflightFreezeRequest(state, 'press', 'order'), 'request');
  assert.equal(preflightFreezeRequest(state, 'another', 'order'), null);
  state.control.freeze_request.target_session_id = 'old-session';
  assert.equal(preflightFreezeRequest(state, 'press', 'order'), null);
});

test('running freeze requires the matching active session', () => {
  assert.equal(runningFreezeRequest(bootstrap().control_state, 'press'), null);
  const state = bootstrap().control_state;
  state.order_control = 'freeze_requested'; state.queue_state = 'in_progress';
  state.control = { state: 'in_progress', allowed_actions: ['pause'], interaction: { mode: 'freeze_requested' },
    freeze_request: { request_id: 'request', status: 'pending', scope: 'order', target_apparatus: 'press', target_session_id: 'session' } };
  assert.equal(validOrderControl({ ok: true, control_state: state }, 'press', 'order', null), true);
  assert.equal(runningFreezeRequest(state, 'press'), 'request');
  state.control.freeze_request.target_session_id = '';
  assert.equal(runningFreezeRequest(state, 'press'), null);
});
