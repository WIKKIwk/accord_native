const assert = require('node:assert/strict');
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
const serviceModule = load('shared/appUpdateService', { './appUpdateModels': models });
const { AppUpdateCoordinator } = load('shared/appUpdateCoordinator', { './appUpdateModels': models, './appUpdateService': serviceModule });
const info = new models.AppInstallationInfo('app', 4, '4', '');
const update = (version, mandatory = false) => new models.AppUpdateCheckResult(info,
  new models.AppUpdateManifest(version, String(version), 0, mandatory, `https://example.test/${version}.apk`, 'a'.repeat(64), 10, '', ''));
const deferred = () => { let resolve, reject; const promise = new Promise((ok, fail) => { resolve = ok; reject = fail; }); return { promise, resolve, reject }; };
const flush = () => new Promise(resolve => setImmediate(resolve));
function fixture() {
  let result = update(5), endpoint = 'https://example.test'; const preparations = [], dialogs = [];
  const service = { get endpointKey() { return endpoint; }, isSupported: true, currentAppInfo: async () => info,
    check: async () => result, restorePendingUpdate: async () => null, rememberUpdate: async () => {},
    prepareUpdate: async (value, progress, cancellation) => { const wait = deferred(); preparations.push({ value, progress, cancellation, ...wait }); return wait.promise; },
    installPreparedUpdate: async () => 'installer_launched' };
  const presenter = { showManual: async () => {}, showReady: () => { const wait = deferred(); dialogs.push(wait); return wait.promise; } };
  return { service, presenter, preparations, dialogs, coordinator: new AppUpdateCoordinator(service), setResult: value => { result = value; },
    setEndpoint: value => { endpoint = value; } };
}

test('optional updates prepare in the background and are prompted only once', async () => {
  const f = fixture();
  try {
    await f.coordinator.checkAndPrompt(f.presenter, false);
    assert.equal(f.coordinator.preparing, true); assert.equal(f.preparations.length, 1);
    f.preparations[0].progress(7, 10); assert.equal(f.coordinator.receivedBytes, 7);
    f.preparations[0].resolve({ update: update(5), path: '/apk' }); await flush();
    assert.equal(f.coordinator.ready.path, '/apk'); assert.equal(f.dialogs.length, 1);
    f.dialogs[0].resolve(); await flush();
    await f.coordinator.checkAndPrompt(f.presenter, false); await flush();
    assert.equal(f.dialogs.length, 1); assert.equal(f.preparations.length, 1);
  } finally { f.coordinator.dispose(); }
});

test('a newer publication cancels the old preparation and rejects its late result', async () => {
  const f = fixture();
  try {
    await f.coordinator.checkAndPrompt(f.presenter, false);
    f.setResult(update(6)); await f.coordinator.refresh();
    assert.equal(f.preparations.length, 2); assert.equal(f.preparations[0].cancellation.isCancelled, true);
    assert.equal(f.preparations[0].cancellation.preserveDownload, true);
    f.preparations[0].resolve({ update: update(5), path: '/old' }); await flush();
    assert.equal(f.coordinator.ready, null);
    f.preparations[1].resolve({ update: update(6), path: '/new' }); await flush();
    assert.equal(f.coordinator.ready.path, '/new');
  } finally { f.coordinator.dispose(); }
});

test('an endpoint change invalidates late results from the old server', async () => {
  const f = fixture(), waiting = deferred(); let reads = 0;
  f.service.check = async () => ++reads === 1 ? waiting.promise : update(6);
  try {
    const first = f.coordinator.checkAndPrompt(f.presenter, false); await flush();
    f.setEndpoint('https://new.example.test'); await f.coordinator.refresh();
    waiting.resolve(update(5)); await first; await flush();
    assert.equal(f.coordinator.latest.manifest.versionCode, 6);
    assert.equal(f.preparations.length, 1);
  } finally { f.coordinator.dispose(); }
});

test('a missing prepared APK restarts preparation on install', async () => {
  const f = fixture();
  f.service.installPreparedUpdate = async () => { throw new models.AppUpdateException('prepared_apk_missing', 'missing'); };
  try {
    await f.coordinator.checkAndPrompt(f.presenter, false);
    f.preparations[0].resolve({ update: update(5), path: '/apk' }); await flush();
    await assert.rejects(f.coordinator.installReady(), error => error.code === 'prepared_apk_missing');
    assert.equal(f.coordinator.ready, null); assert.equal(f.preparations.length, 2);
  } finally { f.coordinator.dispose(); }
});
