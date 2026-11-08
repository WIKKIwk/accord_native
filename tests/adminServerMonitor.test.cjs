const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
function load(file, overrides = {}) {
  const filename = path.resolve(__dirname, '../src', file + '.ts');
  const mod = new Module(filename, module); mod.filename = filename; mod.paths = module.paths;
  mod.require = name => Object.hasOwn(overrides, name) ? overrides[name] : require(name);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return mod.exports;
}
const dart = load('admin/dartJsonString');
const model = load('admin/serverMonitorModel', { './dartJsonString': dart });
const exception = load('shared/mobileApiException');
const requireToken = load('requireToken', { './auth': { activeSessionToken: session => session.token } });
function fixture() {
  const requests = []; let status = 200, body = '{}';
  const api = load('admin/serverMonitorApi', {
    '../authorizedFetch': { authorizedFetch: async (session, url, init = {}) => {
      requests.push({ session, url, init }); return new Response(body, { status });
    } }, '../requireToken': requireToken, '../shared/mobileApiException': exception,
    './dartJsonString': dart, './serverMonitorModel': model,
  });
  return { ...api, requests, setResponse(payload, code = 200) { body = JSON.stringify(payload); status = code; },
    setRawResponse(value, code = 200) { body = value; status = code; } };
}
const session = { baseUrl: 'https://example.invalid', token: 'token' };
const snapshot = { id: 'b1', status: 'ready', source: 'manual', requested_by: 'Admin', created_at_unix: 4.9,
  started_at_unix: 5, completed_at_unix: 6, size_bytes: 7, artifact_name: 'db.dump', checksum_sha256: 'abc', verified: true, error: '' };

test('server monitor parses nested defaults, lists and Dart rounding', () => {
  const report = model.monitorReportFromJson({ server: { bind_addr: 'host', uptime_seconds: 2.9 },
    database: { configured: true, reachable: true, ping_ms: 12.9 }, backups: { file_count: 2, snapshots: [snapshot],
      latest_snapshot: snapshot, active_job: { ...snapshot, status: 'queued' }, files: [{ name: 'a', size_bytes: 10 }] },
    runtime: { cpu_percent: -2.5, memory_percent: 2.5, disk_used_mb: 19.4, load_average: .7 } });
  assert.equal(report.server.bind_addr, 'host'); assert.equal(report.server.uptime_seconds, 2);
  assert.equal(report.database.ping_ms, 12); assert.equal(report.backups.healthy, true);
  assert.equal(report.backups.snapshot_count, 1); assert.equal(report.backups.snapshots[0].created_at_unix, 4);
  assert.equal(model.monitorBackupReady(report.backups.snapshots[0]), true);
  assert.equal(model.monitorBackupRunning(report.backups.active_job), true);
  assert.equal(report.runtime.cpu_percent, -3); assert.equal(report.runtime.memory_percent, 3);
  assert.equal(report.runtime.disk_used_mb, 19); assert.equal(report.runtime.load_average, .7);
  assert.equal(model.monitorBackupsFromJson({ file_count: 3, healthy: false }).healthy, false);
  assert.throws(() => model.monitorReportFromJson(null), TypeError);
  assert.throws(() => model.monitorReportFromJson({ server: [] }), TypeError);
  assert.throws(() => model.monitorBackupsFromJson({ snapshots: [null] }), TypeError);
  assert.throws(() => model.monitorRuntimeFromJson({ cpu_percent: '4' }), TypeError);
});

// @v2-test test/admin_server_monitor_api_test.dart (independently run against f11910bb)
test('monitor pong latency uses the sent timestamp and clamps to one millisecond', () => {
  assert.deepEqual(model.monitorLiveEventFromJson({ type: 'pong', id: 9, sent_at_ms: 1000 }, () => 1042), { report: null, latency_ms: 42 });
  assert.deepEqual(model.monitorLiveEventFromJson({ type: 'pong', sent_at_ms: 1000 }, () => 999), { report: null, latency_ms: 1 });
  assert.deepEqual(model.monitorLiveEventFromJson({ type: 'pong', sent_at_ms: 0 }, () => 1042), { report: null, latency_ms: null });
  const event = model.monitorLiveEventFromJson({ ok: true, server: { status: 'running' } });
  assert.equal(event.report.server.status, 'running'); assert.equal(event.latency_ms, null);
});

// No f119 MockClient recording exists for these requests; tests follow the V2 source with mocks.
test('monitor read preserves the endpoint and exception without HTTP status', async () => {
  const api = fixture(); api.setResponse({ server: { status: 'running' } });
  assert.equal((await api.adminServerMonitor(session)).server.status, 'running');
  assert.equal(api.requests[0].url, '/v1/mobile/admin/system/monitor');
  assert.deepEqual(api.requests[0].init, {});
  api.setResponse({ error: 'x' }, 403);
  await assert.rejects(api.adminServerMonitor(session), e => e.code === 'admin_server_monitor' &&
    e.message === 'Server monitor yuklanmadi' && e.statusCode === null);
});

test('backup start sends a bodyless POST and parses 202, malformed and error responses', async () => {
  const api = fixture(); api.setResponse(snapshot, 202);
  assert.equal((await api.adminStartBackup(session)).id, 'b1');
  assert.deepEqual(api.requests[0].init, { method: 'POST' });
  assert.equal(api.requests[0].url, '/v1/mobile/admin/system/backups');
  api.setResponse({ error: 'backup_already_running' }, 409);
  await assert.rejects(api.adminStartBackup(session), e => e.code === 'backup_already_running' &&
    e.message === 'Backup olish allaqachon boshlangan' && e.statusCode === 409);
  api.setRawResponse('not json', 500);
  await assert.rejects(api.adminStartBackup(session), e => e.code === 'backup_start_failed' &&
    e.message === 'Backup olish boshlanmadi' && e.statusCode === 500);
  api.setResponse({ error: '' }, 403);
  await assert.rejects(api.adminStartBackup(session), e => e.code === '' && e.message === 'Backup olish boshlanmadi');
  api.setRawResponse('', 202);
  assert.equal((await api.adminStartBackup(session)).id, '');
});

test('monitor live URI replaces the path and query, and requires a session token', () => {
  const api = fixture();
  const url = api.adminServerMonitorLiveUri({ baseUrl: 'https://example.invalid/old?q=x', token: ' abc xyz ' });
  assert.equal(url.toString(), 'wss://example.invalid/v1/mobile/admin/system/monitor/live?token=abc+xyz');
  assert.throws(() => api.adminServerMonitorLiveUri({ baseUrl: 'https://example.invalid', token: ' ' }), /No session token/);
});
