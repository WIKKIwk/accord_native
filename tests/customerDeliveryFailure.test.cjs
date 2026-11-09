const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

function fixture(reason) {
  const effects = [], updates = []; let stateIndex = 0;
  const react = {
    useCallback: fn => fn,
    useEffect: fn => effects.push(fn),
    useRef: value => ({ current: value }),
    useState: value => { const index = stateIndex++; return [value, next => updates.push([index, next])]; },
    useSyncExternalStore() {},
  };
  const mocks = { react,
    './customerApi': { customerDeliveryDetail: async () => { throw reason; } },
    './CustomerContext': { useCustomerContext: () => ({ session: {}, store: {} }), useCustomerText: () => ({ method() {} }) },
    '../shared/notificationStoresRuntime': { refreshHub: {} },
  };
  const filename = path.resolve(__dirname, '../src/customer/useCustomerScreens.ts'), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths;
  mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  mod.exports.useCustomerDelivery('dn', () => {}); effects[0]();
  return updates;
}

test('delivery retains a nullish rejection as a failure, preserving its original cause', async () => {
  for (const reason of [null, undefined]) {
    const updates = fixture(reason); await new Promise(resolve => setImmediate(resolve));
    const errors = updates.filter(([index]) => index === 2).map(([, value]) => value);
    assert.equal(errors[0], null);
    assert.notEqual(errors.at(-1), null); assert.notEqual(errors.at(-1), undefined);
    assert.equal(errors.at(-1).cause, reason);
    assert.deepEqual(updates.filter(([index]) => index === 1).map(([, value]) => value), [true, false]);
  }
});

test('delivery preserves non-null rejection values unchanged', async () => {
  const issue = new Error('offline');
  for (const reason of [false, 0, '', issue]) {
    const updates = fixture(reason); await new Promise(resolve => setImmediate(resolve));
    assert.equal(updates.filter(([index]) => index === 2).at(-1)[1], reason);
  }
});
