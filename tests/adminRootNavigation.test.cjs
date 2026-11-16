const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
function load(file, mocks = {}) {
  const filename = path.resolve(__dirname, '../src', file), mod = new Module(filename, module);
  mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return mod.exports;
}
const { AdminRootNavigation } = load('admin/adminRootNavigation.ts', { '../shared/camera/synchronousGuard': load('shared/camera/synchronousGuard.ts') });
function context(id, calls) {
  let current = true, path = '/settings', allowed = true;
  return { value: { isCurrent: () => current, destination: route => allowed ? route : null, currentPath: () => path,
    containsPath: route => route === '/home', unfocus: () => calls.push([id, 'unfocus']),
    popTo: route => calls.push([id, 'popTo', route]), push: route => calls.push([id, 'push', route]) },
  retire: () => { current = false; }, move: next => { path = next; }, deny: () => { allowed = false; } };
}
test('coalesced dock requests retain the first context but dispatch the last target after the frame', () => {
  const calls = [], frames = [], root = new AdminRootNavigation(fn => frames.push(fn)), a = context('first', calls), b = context('second', calls);
  root.schedule('/activity', a.value); root.schedule('/home', b.value);
  assert.equal(frames.length, 1); assert.deepEqual(calls, [['first', 'unfocus'], ['second', 'unfocus']]);
  frames[0](); assert.deepEqual(calls.at(-1), ['first', 'popTo', '/home']);
});
test('an expired first context cancels the coalesced dispatch even if the last context remains mounted', () => {
  const calls = [], frames = [], root = new AdminRootNavigation(fn => frames.push(fn)), a = context('first', calls), b = context('second', calls);
  root.schedule('/activity', a.value); root.schedule('/home', b.value); a.retire(); frames[0]();
  assert.deepEqual(calls, [['first', 'unfocus'], ['second', 'unfocus']]);
  root.schedule('/activity', b.value); frames[1](); assert.deepEqual(calls.at(-1), ['second', 'push', '/activity']);
});
test('dispatch rereads current route and permission, and rechecks account after stack observation', () => {
  for (const invalidate of [f => f.move('/activity'), f => f.deny(), f => { f.value.containsPath = () => { f.retire(); return true; }; }]) {
    const calls = [], frames = [], root = new AdminRootNavigation(fn => frames.push(fn)), f = context('source', calls);
    root.schedule('/activity', f.value); invalidate(f); frames[0](); assert.deepEqual(calls, [['source', 'unfocus']]);
  }
});
test('same-route, unknown and asynchronous authority cannot schedule native navigation', async () => {
  const calls = [], frames = [], root = new AdminRootNavigation(fn => frames.push(fn)), f = context('source', calls);
  root.schedule('/settings', f.value); f.deny(); root.schedule('/unknown', f.value);
  f.value.isCurrent = () => Promise.reject(Error('not synchronous')); root.schedule('/activity', f.value);
  await new Promise(resolve => setImmediate(resolve)); assert.deepEqual(frames, []); assert.deepEqual(calls, []);
});
test('keyboard dismissal and final destination callbacks cannot retire authority and still dispatch', () => {
  const calls = [], frames = [], root = new AdminRootNavigation(fn => frames.push(fn)), f = context('source', calls);
  f.value.unfocus = () => f.retire(); root.schedule('/activity', f.value); assert.deepEqual(frames, []);
  const valid = context('current', calls); root.schedule('/activity', valid.value);
  let checks = 0; valid.value.destination = route => { if (++checks === 2) valid.retire(); return route; };
  frames[0](); assert.deepEqual(calls, [['current', 'unfocus']]);
});
