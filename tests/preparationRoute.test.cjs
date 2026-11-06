const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const test = require('node:test');
const ts = require('typescript');
const filename = path.resolve(__dirname, '../src/shared/appRoutes.ts'), loaded = new Module(filename, module);
loaded.filename = filename; loaded.paths = module.paths;
loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
const { appRoutes: routes, canOpenRoute, homeTarget } = loaded.exports;
const session = (role, capabilities = []) => ({ token: 'token', profile: { role, ref: 'prep' }, capabilities });
// @v2-test test/preparation_production_journal_test.dart
test('production route requires preparation role and workspace permission', () => {
  assert.equal(canOpenRoute(session('tayyorlov_masteri', ['preparation.access']), routes.preparationProduction), true);
  assert.equal(canOpenRoute(session('admin', ['preparation.access']), routes.preparationProduction), false);
  assert.equal(canOpenRoute(session('tayyorlov_masteri'), routes.preparationProduction), false);
});
test('preparation role selects the platform home target', () => {
  const prep = session('tayyorlov_masteri', ['preparation.access']);
  assert.equal(homeTarget(prep, 'ios'), '/ios-preparation');
  assert.equal(homeTarget(prep, 'android'), '/android-preparation');
});
