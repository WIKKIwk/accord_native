const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

function load(name, mocks = {}) {
  const filename = path.resolve(__dirname, `../src/${name}.ts`), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths;
  mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText, filename);
  return mod.exports;
}

function searchHarness() {
  const originalSet = global.setTimeout, originalClear = global.clearTimeout;
  const timers = new Map(), hooks = [], effects = [], commits = [];
  let now = 0, nextTimer = 0, cursor = 0;
  global.setTimeout = (fn, ms) => { const id = ++nextTimer; timers.set(id, { fn, at: now + ms }); return id; };
  global.clearTimeout = id => timers.delete(id);
  const react = {
    useState(initial) {
      const id = cursor++;
      if (!hooks[id]) hooks[id] = { value: typeof initial === 'function' ? initial() : initial };
      return [hooks[id].value, value => {
        if (hooks[id].value !== value) { hooks[id].value = value; commits.push(value); }
      }];
    },
    useEffect(fn, dependencies) {
      const id = cursor++, previous = hooks[id];
      if (!previous || dependencies.some((value, index) => !Object.is(value, previous.dependencies[index]))) {
        hooks[id] = { dependencies, cleanup: previous?.cleanup };
        effects.push(() => { previous?.cleanup?.(); hooks[id].cleanup = fn(); });
      }
    },
  };
  const { useWorkerQueueSearch } = load('components/useWorkerQueueSearch', {
    react, '../workerQueueWindow': load('workerQueueWindow'),
  });
  const unmount = () => { hooks.forEach(hook => hook.cleanup?.()); };
  return {
    commits,
    render(value) { cursor = 0; const query = useWorkerQueueSearch(value); while (effects.length) effects.shift()(); return query; },
    advance(ms) {
      const end = now + ms;
      while (true) {
        const next = [...timers].filter(([, timer]) => timer.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
        if (!next) break;
        timers.delete(next[0]); now = next[1].at; next[1].fn();
      }
      now = end;
    },
    unmount,
    restore() { unmount(); global.setTimeout = originalSet; global.clearTimeout = originalClear; },
  };
}

// @v2 admin_production_map_orders_worker_window.dart::_onOrdersSearchChanged
test('worker typing retains the live query until the latest name or order number settles for 350ms', () => {
  const x = searchHarness();
  try {
    assert.equal(x.render(''), '');
    assert.equal(x.render('ke'), ''); x.advance(200);
    assert.equal(x.render('keks'), ''); x.advance(349);
    assert.equal(x.render('keks'), ''); assert.deepEqual(x.commits, []);
    x.advance(1); assert.equal(x.render('keks'), 'keks');
    assert.equal(x.render(' 0304 '), 'keks'); x.advance(350);
    assert.equal(x.render(' 0304 '), '0304');
    assert.deepEqual(x.commits, ['keks', '0304']);
  } finally { x.restore(); }
});

test('clearing worker search waits for the same debounce and whitespace does not create another queue window', () => {
  const x = searchHarness();
  try {
    assert.equal(x.render('keks'), 'keks');
    assert.equal(x.render(' keks '), 'keks'); x.advance(350);
    assert.deepEqual(x.commits, []);
    assert.equal(x.render(''), 'keks'); x.advance(349);
    assert.equal(x.render(''), 'keks'); x.advance(1);
    assert.equal(x.render(''), ''); assert.deepEqual(x.commits, ['']);
  } finally { x.restore(); }
});

test('worker server query preserves V2 Unicode normalization and cancels the pending query on unmount', () => {
  const x = searchHarness(), input = `  ${'a'.repeat(119)}😀extra  `;
  try {
    x.render(''); x.render(input); x.advance(350);
    assert.equal(x.render(input), `${'a'.repeat(119)}😀`);
    x.render('discard'); x.unmount(); x.advance(350);
    assert.deepEqual(x.commits, [`${'a'.repeat(119)}😀`]);
  } finally { x.restore(); }
});
