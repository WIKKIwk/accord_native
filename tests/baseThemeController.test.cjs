const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const test = require('node:test');
const ts = require('typescript');

const filename = path.resolve(__dirname, '../src/shared/themeController.ts');
const mod = new Module(filename, module); mod.filename = filename; mod.paths = module.paths;
mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
const { ThemeController } = mod.exports;
const storage = initial => {
  const values = new Map(Object.entries(initial)); let writes = 0;
  return { values, get writes() { return writes; }, getItem: async key => values.get(key) ?? null,
    setItem: async (key, value) => { writes++; values.set(key, value); }, removeItem: async key => values.delete(key) };
};

test('appearance defaults to the system and ignores previously saved palettes', async () => {
  const store = storage({ app_theme_mode: 'dark', app_theme_variant: 'moss' });
  const controller = new ThemeController(store); let notifications = 0;
  controller.addListener(() => notifications++);
  await controller.load();
  assert.equal(controller.themeMode, 'dark'); assert.equal(notifications, 1);
  assert.equal(controller.variant, undefined);
  store.values.set('app_theme_mode', 'unknown'); store.values.set('app_theme_variant', 'unknown');
  await controller.load();
  assert.equal(controller.themeMode, 'system');
});

test('theme changes notify before persistence and skip unchanged choices', async () => {
  const store = storage({}), controller = new ThemeController(store), changes = [];
  const unsubscribe = controller.addListener(() => changes.push([controller.themeMode, store.writes]));
  await controller.setThemeMode('dark'); await controller.setThemeMode('dark');
  await controller.setThemeMode('light');
  assert.deepEqual(changes, [['dark', 0], ['light', 1]]);
  assert.equal(store.values.get('app_theme_mode'), 'light'); assert.equal(store.writes, 2);
  unsubscribe(); await controller.setThemeMode('system');
  assert.equal(store.values.get('app_theme_mode'), 'system');
  assert.equal(changes.length, 2);
});

test('Auto survives a restart with an old palette preference on disk', async () => {
  const store = storage({ app_theme_mode: 'dark', app_theme_variant: 'moss' });
  const controller = new ThemeController(store);
  await controller.load();
  await controller.setThemeMode('system');
  const restored = new ThemeController(store);
  await restored.load();
  assert.equal(restored.themeMode, 'system');
  assert.equal(restored.variant, undefined);
  assert.equal(store.values.get('app_theme_mode'), 'system');
  const writes = store.writes;
  await restored.setThemeMode('system');
  assert.equal(store.writes, writes);
});
