const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
function loader(mocks = {}) {
  mocks = { './workerQueueLimit': { DEFAULT_QUEUE_LIMIT: 10 }, './authorizedFetch': {}, ...mocks };
  const cache = new Map();
  return function load(name) {
    const filename = path.resolve(__dirname, '../../src', name.endsWith('.ts') ? name : `${name}.ts`);
    if (cache.has(filename)) return cache.get(filename).exports;
    const loaded = new Module(filename, module); loaded.filename = filename; loaded.paths = module.paths; cache.set(filename, loaded);
    loaded.require = id => {
      if (Object.hasOwn(mocks, id)) return mocks[id];
      if (id.startsWith('.')) {
        const name = path.relative(path.resolve(__dirname, '../../src'), path.resolve(path.dirname(filename), id));
        if (Object.hasOwn(mocks, `./${name}`)) return mocks[`./${name}`];
        return load(name);
      }
      return require(id);
    };
    loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      fileName: filename,
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React },
    }).outputText, filename);
    return loaded.exports;
  };
}
function clock() {
  const oldSet = global.setTimeout, oldClear = global.clearTimeout;
  let time = 0, sequence = 0; const timers = new Map();
  global.setTimeout = (run, delay = 0) => { const id = ++sequence; timers.set(id, { run, at: time + delay }); return id; };
  global.clearTimeout = id => timers.delete(id);
  return {
    advance(duration) { const end = time + duration; let next;
      while ((next = [...timers.entries()].filter(([, entry]) => entry.at <= end).sort((a, b) => a[1].at - b[1].at)[0])) {
        timers.delete(next[0]); time = next[1].at; next[1].run();
      }
      time = end;
    },
    get pending() { return timers.size; },
    restore() { global.setTimeout = oldSet; global.clearTimeout = oldClear; },
  };
}
module.exports = { loader, clock };
