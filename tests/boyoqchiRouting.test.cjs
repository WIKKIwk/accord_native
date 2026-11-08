const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const filename = path.resolve(__dirname, '../src/shared/appRoutes.ts'), loaded = new Module(filename, module);
loaded.filename = filename; loaded.paths = module.paths;
loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
const routes = loaded.exports;
const session = { token: 'token', baseUrl: 'https://example.test', profile: { ref: 'paint-1', role: 'boyoqchi' },
  capabilities: ['boyoqchi.access'], assigned_apparatus: [], assigned_apparatus_labels: [], imageCacheScope: 'scope' };

test('Boyoqchi session routes to the correct native role tree on each platform', () => {
  assert.equal(routes.homeRoute(session), routes.appRoutes.boyoqchiHome);
  assert.equal(routes.homeTarget(session, 'ios'), '/ios-boyoqchi');
  assert.equal(routes.homeTarget(session, 'android'), '/android-boyoqchi');
  assert.equal(routes.canOpenRoute(session, routes.appRoutes.boyoqchiHome), true);
  assert.equal(routes.canOpenRoute(session, routes.appRoutes.boyoqchiAstatka), true);
  assert.equal(routes.canOpenRoute({ ...session, capabilities: [] }, routes.appRoutes.boyoqchiAstatka), false);
});

test('role route trees reuse shared profile and chat pages on both platforms', () => {
  for (const platform of ['ios', 'android']) {
    const root = path.resolve(__dirname, `../src/app/${platform}-boyoqchi`);
    for (const relative of ['_layout.tsx', 'chat/_layout.tsx', 'chat/index.tsx', 'chat/new.tsx', 'chat/[conversationId].tsx']) {
      assert.equal(fs.existsSync(path.join(root, relative)), true, `${platform} ${relative}`);
    }
    assert.match(fs.readFileSync(path.join(root, 'chat/_layout.tsx'), 'utf8'), /ChatRouteProvider/);
  }
});
