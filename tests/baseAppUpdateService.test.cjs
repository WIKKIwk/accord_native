const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const test = require('node:test');
const ts = require('typescript');
function load(file, overrides = {}) {
  const filename = path.resolve(__dirname, '../src', file + '.ts');
  const mod = new Module(filename, module); mod.filename = filename; mod.paths = module.paths;
  mod.require = name => Object.hasOwn(overrides, name) ? overrides[name] : require(name);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return mod.exports;
}
const models = load('shared/appUpdateModels');
const { AppUpdateService, AppUpdateCancellation, appUpdateDownloadSnapshotFromMap } = load('shared/appUpdateService', { './appUpdateModels': models });
const apk = Buffer.from('signed-accord-apk'), sha = crypto.createHash('sha256').update(apk).digest('hex');
const manifest = { version_code: 5, version_name: '0.2.0', minimum_supported_version_code: 4,
  apk_url: '/accord.apk', sha256: sha, size_bytes: apk.length };
function fixture(options = {}) {
  const values = new Map(), calls = [], snapshots = [...(options.snapshots ?? [])];
  const storage = { getItem: async key => values.get(key) ?? null, setItem: async (key, value) => values.set(key, value), removeItem: async key => values.delete(key) };
  const good = { status: 'successful', receivedBytes: apk.length, totalBytes: apk.length, path: '/cache/update.apk', reason: 0, retryable: false };
  const platform = { isSupported: options.supported !== false,
    currentAppInfo: async () => new models.AppInstallationInfo('com.accord.mobilev4', 4, '0.1', ''),
    startOrAttachDownload: async () => { calls.push('start'); return snapshots.shift() ?? good; },
    queryDownload: async () => { calls.push('query'); return snapshots.shift() ?? good; },
    cancelDownload: async () => { calls.push('cancel'); },
    validateApk: async (file, pkg, version) => { calls.push(`validate:${file}:${pkg}:${version}`); },
    installApk: async () => { calls.push('install'); return 'installer_launched'; } };
  const files = { exists: async () => true, size: async () => apk.length, sha256: async () => options.digest ?? sha };
  const fetch = async (url, init) => { calls.push(`${init.method} ${new URL(url).pathname}`); return new Response(JSON.stringify(manifest), { status: 200 }); };
  const service = new AppUpdateService({ baseUrl: 'https://erp.example/', platform, files, storage, fetch,
    socketFactory: options.socketFactory, socketConnectTimeoutMs: options.socketConnectTimeoutMs,
    downloadPollIntervalMs: 0, automaticRetryDelayMs: 0 });
  return { service, calls, values, platform };
}

// @v2-test test/app_update_service_test.dart
test('checks, verifies, caches, and launches a valid APK', async () => {
  const f = fixture(), update = await f.service.check();
  assert.equal(update.updateAvailable, true); assert.equal(update.mandatory, false);
  assert.equal(await f.service.downloadAndInstall(update), 'installer_launched');
  assert.deepEqual(f.calls, ['GET /v1/mobile/app-update/android', 'start', 'validate:/cache/update.apk:com.accord.mobilev4:5', 'install']);
  assert.equal(JSON.parse(f.values.get('app_update_manifest_v1:https://erp.example')).version_code, 5);
  assert.equal((await f.service.restorePendingUpdate()).manifest.versionCode, 5);
});

test('checksum mismatch cancels the download and never launches the installer', async () => {
  const f = fixture({ digest: '0'.repeat(64) }), update = await f.service.check();
  await assert.rejects(f.service.downloadAndInstall(update), e => e.code === 'apk_checksum_mismatch');
  assert.ok(f.calls.includes('cancel')); assert.equal(f.calls.includes('install'), false);
});

test('retryable download failures restart, while cancellation can preserve an active download', async () => {
  const failed = { status: 'failed', receivedBytes: 2, totalBytes: apk.length, path: '', reason: 500, retryable: true };
  const f = fixture({ snapshots: [failed] }), update = await f.service.check();
  await f.service.prepareUpdate(update);
  assert.equal(f.calls.filter(call => call === 'start').length, 2); assert.ok(f.calls.includes('cancel'));
  const other = fixture(), otherUpdate = await other.service.check(), cancellation = new AppUpdateCancellation(true);
  cancellation.cancel(); await assert.rejects(other.service.prepareUpdate(otherUpdate, undefined, cancellation), e => e.code === 'cancelled');
  assert.equal(other.calls.includes('cancel'), false); assert.equal(other.calls.includes('start'), false);
});

test('unsupported devices reject installation and invalid download state is rejected', async () => {
  const f = fixture({ supported: false }), update = await f.service.check();
  await assert.rejects(f.service.prepareUpdate(update), e => e.code === 'unsupported_platform');
  assert.equal(f.calls.includes('start'), false);
  assert.throws(() => appUpdateDownloadSnapshotFromMap({ status: 'running', receivedBytes: -1 }), e => e.code === 'invalid_download_state');
  assert.equal(appUpdateDownloadSnapshotFromMap({ status: 'paused', receivedBytes: 3.9 }).receivedBytes, 3);
});

test('manifest reads enforce the V2 size limit', async () => {
  const f = fixture();
  const service = new AppUpdateService({ baseUrl: 'https://erp.example/', platform: f.platform,
    storage: { getItem: async () => null, setItem: async () => {}, removeItem: async () => {} },
    files: { exists: async () => false, size: async () => 0, sha256: async () => '' },
    fetch: async () => new Response('x'.repeat(128 * 1024 + 1)) });
  await assert.rejects(service.check(), e => e.code === 'manifest_too_large');
});

// @v2-test test/warehouse_live_client_io_test.dart
test('release changes filter live events and stop on invalid data or cancellation', () => {
  const sockets = [], urls = [], ends = []; let changes = 0;
  const f = fixture({ socketFactory: url => {
    urls.push(url); const socket = { close() { this.closed = (this.closed ?? 0) + 1; } };
    sockets.push(socket); return socket;
  } });
  const cancel = f.service.releaseChanges(() => changes++, error => ends.push(error));
  assert.deepEqual(urls, ['wss://erp.example/v1/mobile/app-update/android/live']);
  sockets[0].onopen();
  sockets[0].onmessage({ data: JSON.stringify({ type: 'other' }) });
  sockets[0].onmessage({ data: JSON.stringify({ type: 'android_release_changed' }) });
  sockets[0].onmessage({ data: new Uint8Array([1]) });
  assert.equal(changes, 1);
  sockets[0].onmessage({ data: 'invalid' });
  sockets[0].onclose(); cancel();
  assert.equal(ends.length, 1); assert.ok(ends[0] instanceof Error); assert.equal(sockets[0].closed, 1);
  const cancelSecond = f.service.releaseChanges(() => changes++, error => ends.push(error));
  cancelSecond(); sockets[1].onclose();
  assert.equal(ends.length, 1); assert.equal(sockets[1].closed, 1);
});

test('release connection times out and closes when no handshake completes', async () => {
  let socket;
  const f = fixture({ socketConnectTimeoutMs: 5, socketFactory: () => (socket = { close() { this.closed = true; } }) });
  const error = await new Promise(resolve => f.service.releaseChanges(() => {}, resolve));
  assert.match(error.message, /timed out/); assert.equal(socket.closed, true);
});

test('server changes affect new update requests without changing an in-flight manifest base', async () => {
  const f = fixture(), urls = []; let endpoint = 'https://first.example', complete;
  const storage = { getItem: async () => null, setItem: async () => {}, removeItem: async () => {} };
  const files = { exists: async () => false, size: async () => 0, sha256: async () => '' };
  const service = new AppUpdateService({ baseUrl: () => endpoint, platform: f.platform, files, storage,
    fetch: url => { urls.push(url); return new Promise(resolve => { complete = resolve; }); } });
  const pending = service.check(); await new Promise(resolve => setImmediate(resolve));
  endpoint = 'https://second.example';
  complete(new Response(JSON.stringify(manifest), { status: 200 }));
  const result = await pending;
  assert.equal(urls[0], 'https://first.example/v1/mobile/app-update/android');
  assert.equal(result.manifest.apkUri, 'https://first.example/accord.apk');
  assert.equal(service.endpointKey, 'https://second.example');
});

test('a corrupt cached manifest is removed from the endpoint where the read started', async () => {
  const f = fixture(), removed = []; let endpoint = 'https://first.example', complete;
  const storage = { getItem: () => new Promise(resolve => { complete = resolve; }), setItem: async () => {},
    removeItem: async key => { removed.push(key); } };
  const service = new AppUpdateService({ baseUrl: () => endpoint, platform: f.platform, storage,
    files: { exists: async () => false, size: async () => 0, sha256: async () => '' } });
  const pending = service.restorePendingUpdate(); endpoint = 'https://second.example'; complete('invalid');
  assert.equal(await pending, null);
  assert.deepEqual(removed, ['app_update_manifest_v1:https://first.example']);
});
