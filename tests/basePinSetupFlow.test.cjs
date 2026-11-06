const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const test = require('node:test');
const ts = require('typescript');

function load(relative, mocks) {
  const filename = path.resolve(__dirname, '..', relative), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths;
  mod.require = id => id in mocks ? mocks[id] : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return mod.exports;
}

function fixture() {
  const hooks = []; let cursor = 0;
  const react = {
    useState(initial) { const i = cursor++; if (!(i in hooks)) hooks[i] = initial; return [hooks[i], value => { hooks[i] = value; }]; },
    useRef(initial) { const i = cursor++; if (!(i in hooks)) hooks[i] = { current: initial }; return hooks[i]; },
    useEffect() {},
  };
  const security = { hasPin: true, saves: [], async savePin(...args) { this.saves.push(args); }, async removePin() {} };
  const { usePinSetupCore } = load('src/components/usePinSetupCore.ts', {
    react, 'react-native': { Alert: { alert() {} } }, './WorkerSecurity': { useWorkerSecurity: () => security },
  });
  const { useStagedPinSetup } = load('src/components/useStagedPinSetup.ts', { react, './usePinSetupCore': {} });
  const field = () => ({ set() {} }), fields = [field(), field(), field()];
  const render = () => { cursor = 0; return useStagedPinSetup(usePinSetupCore(...fields), key => key); };
  return { render, security };
}

test('PIN replacement checks confirmation and saves without requesting the old PIN', async () => {
  const app = fixture();
  app.render().open('set');
  app.render().change('pin', '1234');
  app.render().next();
  app.render().change('repeat', '9876');
  assert.equal(await app.render().submit(), false);
  assert.equal(app.render().phaseError, 'pinMismatch');
  assert.deepEqual(app.security.saves, []);
  app.render().change('repeat', '1234');
  assert.equal(await app.render().submit(), true);
  assert.deepEqual(app.security.saves, [['1234']]);
  assert.equal(app.render().mode, null);
});

test('back from PIN confirmation clears the first entry', () => {
  const app = fixture();
  app.render().open('set');
  app.render().change('pin', '1234');
  app.render().next();
  app.render().back();
  assert.equal(app.render().phase, 'entry');
  assert.equal(app.render().canNext, false);
});
