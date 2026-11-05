const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const test = require('node:test');
const ts = require('typescript');
const filename = path.resolve(__dirname, '../src/shared/appUpdateModels.ts');
const mod = new Module(filename, module); mod.filename = filename; mod.paths = module.paths;
mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
const { AppInstallationInfo, AppUpdateManifest, AppUpdateCheckResult } = mod.exports;
const checksum = 'a'.repeat(64);
const raw = { version_code: 6, version_name: '0.3.0', minimum_supported_version_code: 5, mandatory: false,
  apk_url: '/v1/mobile/app-update/android/apk/app.apk', sha256: checksum, size_bytes: 1234 };

// @v2-test test/app_update_models_test.dart
test('manifest resolves the APK and determines mandatory policy', () => {
  const manifest = AppUpdateManifest.fromJson({ ...raw, release_notes: 'Updater qo‘shildi' }, 'https://erp.example/api/');
  assert.equal(manifest.apkUri, 'https://erp.example/v1/mobile/app-update/android/apk/app.apk');
  assert.equal(manifest.releaseNotes, 'Updater qo‘shildi');
  assert.equal(manifest.isMandatoryFor(new AppInstallationInfo('', 4, '', '')), true);
  assert.equal(manifest.isMandatoryFor(new AppInstallationInfo('', 5, '', '')), false);
  assert.equal(new AppUpdateCheckResult(new AppInstallationInfo('', 6, '', ''), manifest).mandatory, false);
  assert.equal(manifest.toJson().size_bytes, 1234);
});

test('manifest rejects bad checksums, version constraints and unsupported URLs', () => {
  for (const change of [{ sha256: 'bad' }, { version_code: 0 }, { minimum_supported_version_code: 7 },
    { apk_url: 'file:///tmp/app.apk' }, { apk_url: '' }, { size_bytes: 0 }]) {
    assert.throws(() => AppUpdateManifest.fromJson({ ...raw, ...change }, 'https://erp.example/'), e => e.code === 'invalid_manifest');
  }
});
