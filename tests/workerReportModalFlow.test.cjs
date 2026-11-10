const assert = require('node:assert/strict'), fs = require('node:fs'), Module = require('node:module'), path = require('node:path'), test = require('node:test'), ts = require('typescript');
const filename = path.resolve(__dirname, '../src/workerReportModalFlow.ts'), mod = new Module(filename, module); mod.paths = module.paths;
mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
const { WorkerReportModalFlow } = mod.exports, tick = () => new Promise(setImmediate);
test('iOS modal hide waits for presentation and actual dismissal, sharing concurrent requests', async () => {
  const events = [], flow = new WorkerReportModalFlow(true, hidden => events.push(hidden)); let completed = false;
  const first = flow.hide(); first.then(() => { completed = true; }); assert.equal(flow.hide(), first);
  await tick(); assert.deepEqual(events, []); flow.didShow(); await tick(); assert.deepEqual(events, [true]); assert.equal(completed, false);
  flow.didDismiss(); await first; assert.equal(completed, true); await flow.hide(); assert.deepEqual(events, [true]);
});
test('rapid child/main/next modal transitions cannot hide a modal before its native onShow', async () => {
  const events = [], flow = new WorkerReportModalFlow(true, value => events.push(value));
  flow.didShow(); const hide = flow.hide(); await tick(); flow.didDismiss(); await hide;
  flow.show(); let done = false; const second = flow.hide().then(() => { done = true; }); await tick();
  assert.deepEqual(events, [true, false]); assert.equal(done, false);
  flow.didShow(); await tick(); assert.deepEqual(events, [true, false, true]); flow.didDismiss(); await second;
});
test('Android modal handoff completes without waiting for unsupported iOS native events', async () => {
  const events = [], flow = new WorkerReportModalFlow(false, value => events.push(value));
  await flow.hide(); flow.show(); await flow.hide(); assert.deepEqual(events, [true, false, true]);
});
test('disposing a screen releases presentation and dismissal waiters without showing another modal', async () => {
  for (const presented of [false, true]) {
    const events = [], flow = new WorkerReportModalFlow(true, value => events.push(value)); if (presented) flow.didShow();
    const hide = flow.hide(); await tick(); flow.dispose(); await hide; flow.show();
    assert.deepEqual(events, presented ? [true] : []);
  }
});
