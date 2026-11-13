const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const test = require('node:test');
const ts = require('typescript');
const filename = path.resolve(__dirname, '../src/shared/appRoutes.ts');
const loaded = new Module(filename, module);
loaded.filename = filename; loaded.paths = module.paths;
loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
const { appRoutes, canOpenRoute, homeRoute, homeTarget } = loaded.exports;
const session = (role, capabilities = []) => ({ token: 'token', profile: { role, ref: 'user' }, capabilities });

test('Metalayzer home and access require the role and its capability', () => {
  const operator = session('metalayzer', ['metalayzer.access', 'admin.access']);
  assert.equal(homeRoute(operator), appRoutes.metalayzer);
  assert.equal(homeTarget(operator, 'ios'), '/ios-metalayzer');
  assert.equal(homeTarget(operator, 'android'), '/android-metalayzer');
  assert.equal(canOpenRoute(operator, appRoutes.metalayzer), true);
  assert.equal(canOpenRoute(operator, appRoutes.adminHome), false);
  assert.equal(canOpenRoute(session('metalayzer'), appRoutes.metalayzer), false);
  assert.equal(canOpenRoute(session('admin', ['metalayzer.access']), appRoutes.metalayzer), false);
  assert.equal(canOpenRoute(null, appRoutes.metalayzer), false);
});
