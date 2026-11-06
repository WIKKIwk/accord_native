const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const test = require('node:test');
const ts = require('typescript');
const filename = path.resolve(__dirname, '../src/shared/securityLifecycle.ts');
const mod = new Module(filename, module); mod.filename = filename; mod.paths = module.paths;
mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
const { securityLifecycleChange } = mod.exports;

test('backgrounding shows the privacy shield and resuming locks an account with a PIN', () => {
  const initial = { wasBackgrounded: false, suspendResumeLock: false };
  const away = securityLifecycleChange(initial, 'background', true, false);
  assert.equal(away.shield, true);
  assert.equal(away.incrementEpoch, true);
  const resumed = securityLifecycleChange(away.state, 'active', true, false);
  assert.equal(resumed.shield, false);
  assert.equal(resumed.lock, true);
  assert.equal(resumed.state.wasBackgrounded, false);
});

test('biometric activity is ignored and its successful resume does not lock the app', () => {
  const initial = { wasBackgrounded: false, suspendResumeLock: false };
  const duringAuth = securityLifecycleChange(initial, 'background', true, true);
  assert.deepEqual(duringAuth.state, initial);
  assert.equal(duringAuth.shield, null);
  const resumed = securityLifecycleChange({ ...duringAuth.state, suspendResumeLock: true }, 'active', true, false);
  assert.equal(resumed.lock, false);
  assert.equal(resumed.state.suspendResumeLock, false);
  const awayAgain = securityLifecycleChange(resumed.state, 'inactive', true, false);
  assert.equal(securityLifecycleChange(awayAgain.state, 'active', true, false).lock, true);
});

test('resuming without a PIN clears the background marker without locking', () => {
  const away = securityLifecycleChange({ wasBackgrounded: false, suspendResumeLock: false }, 'background', false, false);
  assert.equal(away.shield, null);
  const resumed = securityLifecycleChange(away.state, 'active', false, false);
  assert.equal(resumed.lock, false);
  assert.equal(resumed.state.wasBackgrounded, false);
});
