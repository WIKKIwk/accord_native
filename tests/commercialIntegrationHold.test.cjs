const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

const filename = path.resolve(__dirname, '../src/shared/appRoutes.ts');
const loaded = new Module(filename, module); loaded.filename = filename; loaded.paths = module.paths;
loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
const { homeTarget } = loaded.exports;
const session = (role, capabilities) => ({ token: 'token', profile: { role, ref: 'user' }, capabilities });

test('held Admin and Customer homes cannot change protected role targets, including overlapping capabilities', () => {
  for (const platform of ['ios', 'android']) {
    for (const caps of [['apparatus.queue.read', 'admin.access'], ['apparatus.queue.read', 'customer.access']])
      assert.equal(homeTarget(session('aparatchi', caps), platform), null);
    for (const caps of [['admin.access'], ['customer.access']])
      assert.equal(homeTarget(session('tayyorlov_masteri', caps), platform), null);
    assert.equal(homeTarget(session('aparatchi', ['apparatus.queue.read']), platform), platform === 'ios' ? '/ios-worker' : 'worker');
    assert.equal(homeTarget(session('tayyorlov_masteri', ['preparation.access']), platform), `/${platform}-preparation`);
    assert.equal(homeTarget(session('admin', ['admin.access']), platform), null);
    assert.equal(homeTarget(session('customer', ['customer.access']), platform), null);
  }
});

test('both role root layouts redirect to the stable unavailable entry without mounting role code', () => {
  for (const role of ['admin', 'customer']) for (const platform of ['ios', 'android']) {
    const source = fs.readFileSync(path.resolve(__dirname, `../src/app/${platform}-${role}/_layout.tsx`), 'utf8');
    assert.match(source, /<Redirect href="\/"\s*\/>/);
    assert.doesNotMatch(source, /(?:AdminLayout|CustomerShell|CustomerGate)/);
  }
});
