const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const { contractFetch, recordedSession } = require('./support/contractFetch.cjs');

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
const stem = 'f11910bb/qolip_reworks_api_test';
function harness(testName, options = {}) {
  const replay = contractFetch(stem, testName, { generated: ['request_id'] });
  const session = { ...recordedSession(stem, testName), profile: { ref: 'clerk', role: 'qolipchi' }, capabilities: ['qolip.manage'] };
  const bodies = [];
  const api = load('qolip/qolipReworkApi.ts', {
    '../auth': { activeSessionToken: value => value.token || null },
    '../sessionReadScope': { sessionReadScope: value => JSON.stringify([value.baseUrl, value.profile, value.capabilities]) },
    '../shared/mobileApiException': { MobileApiException },
    './qolipApiCommon': common,
    '../authorizedFetch': { authorizedFetch: async (value, target, init = {}, guard) => {
      guard?.();
      const headers = new Headers(init.headers);
      headers.set('Authorization', `Bearer ${value.token}`);
      if (init.body) bodies.push(init.body);
      const response = await replay(new URL(target, value.baseUrl), { ...init, headers });
      options.afterResponse?.(session);
      return response;
    } },
  });
  return { api, replay, session, bodies };
}

test('new recordings name the selected f119 V2 baseline', () => {
  const file = path.resolve(__dirname, 'contracts', `${stem}.json`);
  assert.equal(JSON.parse(fs.readFileSync(file, 'utf8')).baseline, 'f11910bb2c8c7081ce26770e69811b03fd0739ed');
});

// @v2-test test/qolip_reworks_api_test.dart
test('V2 wire sequence normalizes selections and reads returned entries', async () => {
  const { api, replay, session } = harness('wire API sends generated IDs and normalizes mold and return selections');
  const sent = await api.qolipSendToRework(session, { requestId: 'send-id', qolipCodes: [' Q-1 ', 'q-1', 'Q-2'] });
  assert.deepEqual(sent.map(row => row.qolip_code), ['Q-1', 'Q-2']);
  assert.equal((await api.qolipReworks(session)).length, 2);
  const returned = await api.qolipReturnFromRework(session, { requestId: 'return-id', reworkIds: [' r1 ', 'r1'] });
  assert.equal(returned[0].qolip_code, 'Q-1');
  assert.equal(returned[0].is_open, false);
  replay.assertDone();
});

for (const action of ['send', 'return']) {
  test(`V2 ${action} keeps the same request ID and body after transport failure`, async () => {
    const { api, replay, session, bodies } = harness(`${action} preserves its generated ID and JSON body after transport failure`);
    const submit = () => action === 'send'
      ? api.qolipSendToRework(session, { requestId: 'same-id', qolipCodes: [' Q-1 ', 'q-1'] })
      : api.qolipReturnFromRework(session, { requestId: 'same-id', reworkIds: [' r1 ', 'r1'] });
    await assert.rejects(submit(), /Recorded failure: ClientException/);
    const rows = await submit();
    assert.equal(rows[0].id, 'r1');
    assert.equal(rows[0].is_open, action === 'send');
    assert.equal(bodies[0], bodies[1]);
    replay.assertDone();
  });
}

test('V2 rejects partial success and retains server conflict metadata', async () => {
  const partial = harness('partial success response is rejected');
  await assert.rejects(partial.api.qolipSendToRework(partial.session, { requestId: 'all-or-none', qolipCodes: ['Q-1', 'Q-2'] }),
    /Incomplete mold rework response/);
  partial.replay.assertDone();
  const conflict = harness('server conflict codes and messages are retained');
  await assert.rejects(conflict.api.qolipSendToRework(conflict.session, { requestId: 'conflict', qolipCodes: ['Q-1'] }),
    error => error instanceof MobileApiException && error.code === 'qolip_in_rework' && error.statusCode === 409 &&
      error.message === 'Qoliplar peredelkaga berilmadi');
  conflict.replay.assertDone();
});

test('V2 mileage keeps an unknown baseline and old cycles', async () => {
  const { api, replay, session } = harness('mileage wire data keeps unknown baseline and old cycles');
  const before = await api.qolipMileage(session, 'Q-1');
  assert.equal(before.tracking_enabled, false);
  assert.equal(before.current_meter, null);
  const after = await api.qolipMileage(session, 'Q-2');
  assert.equal(after.current_meter, 800);
  assert.deepEqual(after.cycles.map(cycle => cycle.meter), [1200, 800]);
  assert.notEqual(after.cycles[0].ended_at, null);
  replay.assertDone();
});

for (const action of ['list', 'mileage', 'send', 'return']) {
  test(`V2 ${action} rejects a response after its account or server changes`, async () => {
    const { api, replay, session } = harness(`${action} discards a pending result after account or server changes`, {
      afterResponse: value => { value.profile.ref = 'other'; },
    });
    const pending = action === 'list' ? api.qolipReworks(session) : action === 'mileage' ? api.qolipMileage(session, 'Q-1') :
      action === 'send' ? api.qolipSendToRework(session, { requestId: 'pending-send', qolipCodes: ['Q-1'] }) :
        api.qolipReturnFromRework(session, { requestId: 'pending-return', reworkIds: ['r1'] });
    await assert.rejects(pending, error => error instanceof MobileApiException && error.code === 'session_scope_changed');
    replay.assertDone();
  });
}

test('same-account token refresh preserves the pending read', async () => {
  const { api, replay, session } = harness('same-account token refresh does not invalidate pending rework reads', {
    afterResponse: value => { value.token = 'refreshed-token'; },
  });
  assert.deepEqual(await api.qolipReworks(session), []);
  replay.assertDone();
});

test('source validation rejects invalid statuses, empty input and oversized selections before sending', async () => {
  const { api, session, replay } = harness('same-account token refresh does not invalidate pending rework reads');
  await assert.rejects(api.qolipReworks(session, 'closed'), /Invalid mold rework status/);
  await assert.rejects(api.qolipSendToRework(session, { requestId: ' ', qolipCodes: ['Q-1'] }), /Select mold codes/);
  await assert.rejects(api.qolipSendToRework(session, { requestId: 'id', qolipCodes: ['Q-1', ' '] }), /Select mold codes/);
  await assert.rejects(api.qolipReturnFromRework(session, { requestId: 'id', reworkIds: [] }), /Select rework records/);
  await assert.rejects(api.qolipReturnFromRework(session, {
    requestId: 'id', reworkIds: Array.from({ length: 1001 }, (_, index) => String(index)),
  }), /Select rework records/);
  // This recorded read remains pending, demonstrating validation made no request.
  assert.throws(() => replay.assertDone());
});

test('source decoders validate required types, dates, open state and nullable mileage', () => {
  const { api } = harness('same-account token refresh does not invalidate pending rework reads');
  const base = { id: 'r1', qolip_code: 'Q-1', sent_at: '2026-10-24T10:00:00Z' };
  assert.equal(api.qolipReworkEntryFromJson(base).is_open, true);
  assert.equal(api.qolipReworkEntryFromJson({ ...base, sent_at: '2020-01-42' }).sent_at, '2020-01-42');
  assert.equal(api.qolipReworkEntryFromJson({ ...base, size: 42.9 }).size, 42);
  for (const bad of [{ ...base, id: ' ' }, { ...base, qolip_code: 123 }, { ...base, sent_at: 'not a date' },
    { ...base, returned_at: ' ' }, { ...base, size: '42' }]) {
    assert.throws(() => api.qolipReworkEntryFromJson(bad));
  }
  assert.deepEqual(api.qolipMileageFromJson({ qolip_code: 'Q-1', tracking_enabled: false, current_meter: null, cycles: [] }), {
    qolip_code: 'Q-1', tracking_enabled: false, current_meter: null, cycles: [],
  });
  assert.throws(() => api.qolipMileageFromJson({ qolip_code: 'Q-1', cycles: [{ id: 'bad' }] }));
});
