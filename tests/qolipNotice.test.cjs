const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

test('queued notices keep the first timeout and show duplicate messages separately', () => {
  const oldSet = global.setTimeout, oldClear = global.clearTimeout, timers = new Map(); let nextTimer = 0, state = { nextId: 1, messages: [] }, previousId, cleanup;
  const react = { useState: () => [state, update => { state = typeof update === 'function' ? update(state) : update; }],
    useCallback: callback => callback, useEffect: (effect, [id]) => {
      if (id === previousId) return; cleanup?.(); previousId = id; cleanup = effect();
    } };
  const filename = path.resolve(__dirname, '../src/qolip/useQolipNotice.ts'), m = new Module(filename, module);
  m.require = key => key === 'react' ? react : require(key);
  m._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  try {
    global.setTimeout = callback => { const id = ++nextTimer; timers.set(id, callback); return id; };
    global.clearTimeout = id => timers.delete(id);
    let hook = m.exports.useQolipNotice(); hook.show('same'); hook = m.exports.useQolipNotice();
    assert.equal(hook.message, 'same'); assert.deepEqual([...timers.keys()], [1]);
    hook.show('same'); hook = m.exports.useQolipNotice(); assert.deepEqual([...timers.keys()], [1]);
    timers.get(1)(); hook = m.exports.useQolipNotice(); assert.equal(hook.message, 'same'); assert.deepEqual([...timers.keys()], [2]);
    timers.get(2)(); hook = m.exports.useQolipNotice(); assert.equal(hook.message, ''); assert.equal(timers.size, 0);
    hook.show('first'); hook = m.exports.useQolipNotice(); assert.deepEqual([...timers.keys()], [3]);
    timers.get(3)(); hook.show('new before render'); hook = m.exports.useQolipNotice();
    assert.equal(hook.message, 'new before render'); assert.deepEqual([...timers.keys()], [4]);
  } finally { cleanup?.(); global.setTimeout = oldSet; global.clearTimeout = oldClear; }
});
