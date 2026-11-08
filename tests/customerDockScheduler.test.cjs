const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const filename = path.resolve(__dirname, '../src/customer/customerDockScheduler.ts'), mod = new Module(filename, module);
mod.filename = filename; mod.paths = module.paths;
mod.require = id => id === 'react-native' ? { Keyboard: { dismiss() {} } } : require(id);
mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
const { createCustomerDockScheduler } = mod.exports;
function fixture() {
  const frames = [], actions = []; let dismisses = 0, mounted = true, active = 'home';
  const queue = createCustomerDockScheduler(callback => frames.push(callback), () => { dismisses++; });
  const request = destination => queue({ destination, active: () => active, isMounted: () => mounted, dispatch: action => actions.push(action) });
  return { request, frames, actions, flush: () => { while (frames.length) frames.shift()(); },
    dismisses: () => dismisses, setMounted: value => { mounted = value; }, setActive: value => { active = value; } };
}

test('same-frame requests keep only the last destination and dismiss the keyboard', () => {
  const f = fixture(); f.request('notifications'); f.request('chat');
  assert.equal(f.frames.length, 1); assert.equal(f.dismisses(), 2); assert.deepEqual(f.actions, []);
  f.flush(); assert.deepEqual(f.actions, [{ type: 'NAVIGATE', payload: { name: 'chat', pop: true } }]);
});

test('active destination is ignored and a changed active destination is rechecked at the frame', () => {
  const f = fixture(); f.request('home'); assert.equal(f.frames.length, 0); assert.equal(f.dismisses(), 0);
  f.request('notifications'); f.setActive('notifications'); f.flush(); assert.deepEqual(f.actions, []);
  f.request('home'); f.flush(); assert.deepEqual(f.actions, [{ type: 'NAVIGATE', payload: { name: 'index', pop: true } }]);
});

test('an unmounted first context drops its queued navigation, as V2 does', () => {
  const f = fixture(); f.request('notifications'); f.setMounted(false); f.flush();
  assert.deepEqual(f.actions, []);
});

test('coalescing keeps the first requesting context for the scheduled callback', () => {
  const frames = [], actions = [];
  let firstMounted = true;
  const queue = createCustomerDockScheduler(fn => frames.push(fn), () => {});
  queue({ destination: 'notifications', active: () => 'home', isMounted: () => firstMounted, dispatch: action => actions.push(['first', action]) });
  queue({ destination: 'chat', active: () => 'home', isMounted: () => true, dispatch: action => actions.push(['second', action]) });
  firstMounted = false; frames.shift()();
  assert.deepEqual(actions, []);
});
