const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const test = require('node:test');
const ts = require('typescript');

const filename = path.resolve(__dirname, '../src/shared/appUpdateRuntime.ts');
const mod = new Module(filename, module); mod.filename = filename; mod.paths = module.paths;
mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
const { AppUpdateRuntime } = mod.exports;
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

function fixture() {
  const watches = [], checks = [], foreground = [];
  const coordinator = {
    isSupported: true, endpointKey: 'https://first.example',
    setForeground(value) { foreground.push(value); },
    checkAndPrompt(presenter, manual) { checks.push({ presenter, manual }); return Promise.resolve(); },
    releaseChanges(change, end) {
      const watch = { change, end, closed: false }; watches.push(watch);
      return () => { watch.closed = true; };
    },
  };
  const presenter = {};
  return { coordinator, presenter, watches, checks, foreground,
    runtime: new AppUpdateRuntime(coordinator, presenter, { checkDelayMs: 5, reconnectDelayMs: 5, fallbackIntervalMs: 60_000 }) };
}

// @v2-test test/app_update_runtime_test.dart
test('watches release changes, debounces session changes and replaces a changed endpoint', async () => {
  const f = fixture();
  try {
    f.runtime.start();
    assert.equal(f.watches.length, 1); assert.equal(f.checks.length, 1);
    f.watches[0].change(); assert.equal(f.checks.length, 2);
    f.runtime.sessionChanged(); f.runtime.sessionChanged(); f.runtime.sessionChanged();
    await delay(25); assert.equal(f.checks.length, 3);
    f.coordinator.endpointKey = 'https://second.example';
    f.runtime.sessionChanged(); await delay(25);
    assert.equal(f.watches.length, 2); assert.equal(f.watches[0].closed, true);
    f.watches[0].end(); f.watches[0].change(); await delay(25);
    assert.equal(f.watches.length, 2); assert.equal(f.checks.length, 4);
    f.runtime.setForeground(false); f.runtime.setForeground(true); await delay(25);
    assert.equal(f.checks.length, 5);
  } finally { f.runtime.dispose(); }
  assert.equal(f.watches[1].closed, true);
  assert.deepEqual(f.foreground, [true, false, true, false]);
});

test('reconnects after an ended stream and handles an immediate failure', async () => {
  const f = fixture(); let calls = 0;
  const original = f.coordinator.releaseChanges;
  f.coordinator.releaseChanges = function (change, end) {
    if (++calls === 1) { end(new Error('connect')); return () => {}; }
    return original.call(this, change, end);
  };
  try {
    f.runtime.start(); await delay(25);
    assert.equal(f.watches.length, 1); assert.equal(calls, 2);
    f.watches[0].end(); await delay(25);
    assert.equal(f.watches.length, 2); assert.equal(calls, 3);
    f.watches[1].change(); assert.equal(f.checks.length, 2);
  } finally { f.runtime.dispose(); }
  f.watches[1].end(); await delay(15); assert.equal(calls, 3);
});
