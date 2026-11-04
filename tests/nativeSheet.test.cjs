const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

const filename = path.resolve(__dirname, '../src/nativeSheet.tsx');
const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
const flush = () => new Promise(resolve => queueMicrotask(resolve));

function harness(refs = []) {
  const effects = [];
  const pushes = [];
  const security = { hasPin: true };
  let index = 0;
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = module.paths;
  loaded.require = id => {
    if (id === 'expo-router') return { router: { push: value => pushes.push(value) } };
    if (id === './components/WorkerSecurity') return { SecurityContext: {} };
    if (id === 'react') return {
      useContext: () => security,
      useRef: value => refs[index++] ?? (refs[index - 1] = { current: value }),
      useMemo: factory => factory(),
      useEffect: setup => effects.push({ setup }),
      useLayoutEffect: setup => effects.push({ setup }),
    };
    return require(id);
  };
  loaded._compile(code, filename);
  const api = loaded.exports;
  const sheet = api.useNativeSheet();
  const mountOwner = () => effects.forEach(effect => { effect.cleanup = effect.setup(); });
  const unmountOwner = () => effects.forEach(effect => effect.cleanup?.());
  mountOwner();
  return { api, sheet, pushes, refs, security, mountOwner, unmountOwner };
}

test('opening pushes immediately and duplicate taps share one route', () => {
  const h = harness();
  h.sheet.open('content', { compact: true, dismissible: true });
  h.sheet.open('duplicate');
  assert.equal(h.pushes.length, 1);
  assert.deepEqual(h.pushes[0], { pathname: '/sheet/[id]', params: { id: '1' } });
  assert.equal(h.api.getNativeSheet('1').content, 'content');
  assert.equal(h.api.getNativeSheet('1').options.compact, true);
  assert.equal(h.api.getNativeSheet('1').security, h.security);
});

test('X pops once immediately and dismissal callback runs after route removal', async () => {
  const h = harness();
  let pops = 0;
  let dismissals = 0;
  h.sheet.open('content', { onDismiss: () => { dismissals++; assert.equal(h.sheet.isOpen(), false); } });
  const unmount = h.api.mountNativeSheet('1', () => { pops++; });
  h.sheet.close();
  h.sheet.close();
  assert.equal(pops, 1);
  assert.equal(dismissals, 0);
  assert.equal(h.sheet.isOpen(), true);
  unmount();
  await flush();
  assert.equal(dismissals, 1);
  assert.equal(h.api.getNativeSheet('1'), null);
});

test('native Back or swipe removes the route and can open the next action sheet', async () => {
  const h = harness();
  h.sheet.open('menu', { onDismiss: () => h.sheet.open('order') });
  const unmount = h.api.mountNativeSheet('1', () => assert.fail('native dismissal already popped'));
  h.sheet.update('updated menu');
  unmount();
  await flush();
  assert.equal(h.pushes.length, 2);
  assert.equal(h.api.getNativeSheet('1'), null);
  assert.equal(h.api.getNativeSheet('2').content, 'order');
});

test('owner logout clears visible content even while a pop is in progress', async () => {
  const h = harness();
  let pops = 0;
  let callbacks = 0;
  h.sheet.open('private content', { onDismiss: () => { callbacks++; } });
  const unmount = h.api.mountNativeSheet('1', () => { pops++; });
  h.sheet.close();
  h.unmountOwner();
  await flush();
  assert.equal(h.api.getNativeSheet('1').content, null);
  assert.equal(pops, 1);
  unmount();
  await flush();
  assert.equal(callbacks, 0);
  assert.equal(h.api.getNativeSheet('1'), null);
});

test('owner unmount before the route mounts still closes the pending route', async () => {
  const h = harness();
  let pops = 0;
  h.sheet.open('pending');
  h.unmountOwner();
  await flush();
  const unmount = h.api.mountNativeSheet('1', () => { pops++; });
  assert.equal(pops, 1);
  assert.equal(h.api.getNativeSheet('1').content, null);
  unmount();
  await flush();
  assert.equal(h.sheet.isOpen(), false);
});

test('StrictMode effect replay keeps both the owner and route alive', async () => {
  const h = harness();
  let pops = 0;
  let callbacks = 0;
  h.sheet.open('content', { onDismiss: () => { callbacks++; } });
  h.unmountOwner();
  h.mountOwner();
  const firstCleanup = h.api.mountNativeSheet('1', () => { pops++; });
  firstCleanup();
  const finalCleanup = h.api.mountNativeSheet('1', () => { pops++; });
  await flush();
  assert.equal(h.sheet.isOpen(), true);
  assert.equal(pops, 0);
  assert.equal(callbacks, 0);
  finalCleanup();
  await flush();
  assert.equal(callbacks, 1);
});

test('Fast Refresh with preserved hook refs cannot permanently block opening', () => {
  const before = harness();
  before.sheet.open('before refresh');
  const after = harness(before.refs);
  assert.equal(after.sheet.isOpen(), false);
  after.sheet.open('after refresh');
  assert.equal(after.pushes.length, 1);
  assert.equal(after.api.getNativeSheet('1').content, 'after refresh');
});
