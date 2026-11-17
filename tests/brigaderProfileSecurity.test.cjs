/* global __dirname */
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
function load(file, mocks = {}) {
  const filename = path.resolve(__dirname, '../src', file), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths;
  mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText, filename);
  return mod.exports;
}
const account = { token: 'real', baseUrl: 'https://example.invalid', profile: { role: 'brigader', ref: 'one' } };
const tick = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };

test('switch PIN save checks the original account after both delayed identity and PIN hashing', async () => {
  const { SwitchPinStore } = load('shared/switchPin.ts', { '../savedAccountStore': { savedAccountId: () => 'identity' } });
  for (const pause of ['identity', '1234']) {
    const pending = deferred(), entered = deferred(), writes = []; let current = true;
    const store = new SwitchPinStore({ setItem: async (...args) => writes.push(args) }, async value => {
      if (value === pause) { entered.resolve(); await pending.promise; }
      return `hash:${value}`;
    });
    const saving = store.save(account, '1234', () => current); await entered.promise;
    current = false; pending.resolve(); await assert.rejects(saving, /Akkaunt/); assert.deepEqual(writes, []);
  }
});

test('an old switch-PIN remove cannot delete a same-account replacement after delayed key hashing', async () => {
  const { SwitchPinStore } = load('shared/switchPin.ts', { '../savedAccountStore': { savedAccountId: () => 'identity' } });
  const pending = deferred(), entered = deferred(), removed = []; let current = true;
  const store = new SwitchPinStore({ removeItem: async key => removed.push(key) }, async value => {
    entered.resolve(); await pending.promise; return `hash:${value}`;
  });
  const clearing = store.clear(account, () => current); await entered.promise; current = false; pending.resolve();
  await assert.rejects(clearing, /Akkaunt/); assert.deepEqual(removed, []);
});

function lockFixture() {
  const values = new Map(), writes = [], hashGate = { current: null }, readGate = { current: null };
  const store = {
    getItemAsync: async (key, options) => {
      if (options?.requireAuthentication && readGate.current) { const gate = readGate.current; readGate.current = null; gate.entered.resolve(); await gate.release.promise; }
      return values.get(key) ?? null;
    },
    setItemAsync: async (key, value) => { writes.push([key, value]); values.set(key, value); },
    deleteItemAsync: async key => { values.delete(key); }, canUseBiometricAuthentication: () => true,
  };
  const api = load('appLock.ts', {
    'expo-constants': { __esModule: true, default: { appOwnership: null }, AppOwnership: { Expo: 'expo' } },
    'expo-secure-store': store, 'react-native': { Platform: { OS: 'ios' } }, './auth': { activeSessionToken: () => 'real' },
    'expo-crypto': { CryptoDigestAlgorithm: { SHA256: 'sha256' }, getRandomBytesAsync: async n => crypto.randomBytes(n), randomUUID: () => 'challenge',
      digestStringAsync: async (_algorithm, value) => {
        if (hashGate.current && value.includes(':1234')) { const gate = hashGate.current; hashGate.current = null; gate.entered.resolve(); await gate.release.promise; }
        return crypto.createHash('sha256').update(value).digest('hex');
      } },
  });
  return { api, values, writes, hashGate, readGate };
}

test('app PIN save and remove retain the original settings authority through async storage preparation', async () => {
  const f = lockFixture(), gate = { entered: deferred(), release: deferred() }; let current = true;
  f.hashGate.current = gate;
  const saving = f.api.saveAppPin(account, '1234', () => current); await gate.entered.promise;
  current = false; gate.release.resolve(); await assert.rejects(saving, /Akkaunt/); assert.deepEqual(f.writes, []);
  await f.api.saveAppPin(account, '5678'); const count = f.writes.length;
  let checks = 0;
  await assert.rejects(f.api.clearAppLock(account, () => ++checks === 1), /Akkaunt/);
  assert.equal(f.writes.length, count); assert.equal(await f.api.verifyAppPin(account, '5678'), true);
});

test('biometric authentication completing after settings retirement cannot enable the old account', async () => {
  const f = lockFixture(); await f.api.saveAppPin(account, '5678');
  const gate = { entered: deferred(), release: deferred() }; f.readGate.current = gate; let current = true;
  const saving = f.api.setAppBiometric(account, true, () => current); await gate.entered.promise;
  current = false; gate.release.resolve(); await assert.rejects(saving, /Akkaunt/);
  assert.equal((await f.api.loadAppLock(account)).biometric, false);
});

test('stale switch-PIN setup callbacks cannot read, mutate, alert or publish a pending read', async () => {
  const hooks = [], effects = [], writes = [], calls = [], pending = deferred(); let cursor = 0, current = true;
  const react = {
    useState: initial => { const index = cursor++; if (!(index in hooks)) hooks[index] = { value: initial };
      return [hooks[index].value, value => { writes.push(value); hooks[index].value = value; }]; },
    useRef: initial => { const index = cursor++; if (!(index in hooks)) hooks[index] = { current: initial }; return hooks[index]; },
    useEffect: fn => effects.push(fn),
  };
  const { useSwitchPinSetupCore } = load('components/useSwitchPinSetupCore.ts', {
    react, 'react-native': { Alert: { alert: (...args) => calls.push(args) } }, '../shared/switchPinRuntime': { switchPinStore: {
      has: async (_session, guard) => { assert.equal(guard(), true); return pending.promise; },
      save: async () => calls.push('save'), clear: async () => calls.push('clear'),
    } },
  });
  const render = () => { cursor = 0; return useSwitchPinSetupCore(account, { set: value => writes.push(value) }, key => key, true, () => current); };
  const pin = render(), cleanup = effects[0](); current = false; pending.resolve(true); await tick();
  const count = writes.length; pin.open(); pin.change('1234'); pin.back(); pin.close(); await pin.remove(); await pin.submit();
  assert.equal(writes.length, count); assert.deepEqual(calls, []); cleanup();
});

test('Brigader logout uses source ordering while allowing only its original active session cleanup', async () => {
  for (const replace of [false, true]) {
    const calls = []; let active = account, epoch = 3, validWitness = true;
    const witness = { session: account };
    const api = load('brigader/brigaderLogout.ts', {
      '../auth': { activeSessionEpoch: value => value === active ? epoch : null, currentSession: () => active,
        isSessionWitnessCurrent: value => value === witness && validWitness,
        logout: async (_session, options) => { calls.push('server'); validWitness = false; if (replace) epoch++;
          try { await options.beforeClearSession(); } catch {} calls.push('clear-session'); }, },
      '../appLock': { clearAppLock: async (_session, guard) => { if (!guard()) throw Error('stale'); calls.push('app-pin-biometric'); } },
      '../shared/switchPinRuntime': { switchPinStore: { clear: async (_session, guard) => { if (!guard()) throw Error('stale'); calls.push('switch-pin'); } } },
      './brigaderAccess': { brigaderMayEnter: () => true },
    });
    await api.logoutBrigader(account, witness);
    assert.deepEqual(calls, replace ? ['server', 'clear-session'] : ['server', 'app-pin-biometric', 'switch-pin', 'clear-session']);
    await api.logoutBrigader(account, witness); assert.equal(calls.filter(value => value === 'server').length, 1);
  }
});
