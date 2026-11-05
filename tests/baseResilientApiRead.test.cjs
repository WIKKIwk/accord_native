const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const test = require('node:test');
const ts = require('typescript');
const filename = path.resolve(__dirname, '../src/shared/resilientApiRead.ts');
const mod = new Module(filename, module); mod.filename = filename; mod.paths = module.paths;
mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
const { resilientApiRead } = mod.exports;
const url = 'https://example.test/v1/mobile/admin/raw-materials';
const fast = { retryDelayMs: 0, attemptTimeoutMs: 20, totalTimeoutMs: 500 };

test('resilient reads retry transient server errors but preserve the final response', async () => {
  let calls = 0;
  const result = await resilientApiRead(url, async () => new Response('', { status: ++calls === 1 ? 503 : 200 }), fast);
  assert.equal(result.status, 200); assert.equal(calls, 2);
  calls = 0;
  const failed = await resilientApiRead(url, async () => { calls++; return new Response('', { status: 504 }); }, fast);
  assert.equal(failed.status, 504); assert.equal(calls, 2);
});

test('HTML API responses retry and ultimately fail if still HTML', async () => {
  let calls = 0;
  await assert.rejects(resilientApiRead(url, async () => { calls++; return new Response('<html>error</html>', { headers: { 'Content-Type': 'text/html' } }); }, fast), /HTML instead of data/);
  assert.equal(calls, 2);
});

test('TLS failures never retry and timed-out attempts are aborted', async () => {
  let calls = 0;
  await assert.rejects(resilientApiRead(url, async () => { calls++; throw new TypeError('certificate invalid'); }, fast), /certificate/);
  assert.equal(calls, 1);
  calls = 0; const signals = [];
  await assert.rejects(resilientApiRead(url, signal => { calls++; signals.push(signal); return new Promise(() => {}); },
    { ...fast, attemptTimeoutMs: 2 }), e => e.name === 'TimeoutError');
  assert.equal(calls, 2); assert.ok(signals.every(signal => signal.aborted));
});
