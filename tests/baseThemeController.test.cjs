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

// V2 has no ThemeController test; these assertions follow its source behavior.
test('theme preferences load with V2 defaults for unknown values', async () => {
  const store = storage({ app_theme_mode: 'dark', app_theme_variant: 'moss' });
  const controller = new ThemeController(store); let notifications = 0;
  controller.addListener(() => notifications++);
  await controller.load();
  assert.equal(controller.themeMode, 'dark'); assert.equal(controller.isDark, true);
  assert.equal(controller.variant, 'moss'); assert.equal(notifications, 1);
  store.values.set('app_theme_mode', 'unknown'); store.values.set('app_theme_variant', 'unknown');
  await controller.load();
  assert.equal(controller.themeMode, 'light'); assert.equal(controller.variant, 'classic');
});

test('theme changes notify before persistence and skip unchanged choices', async () => {
  const store = storage({}), controller = new ThemeController(store), changes = [];
  const unsubscribe = controller.addListener(() => changes.push([controller.themeMode, controller.variant, store.writes]));
  await controller.setThemeMode('dark'); await controller.setVariant('lavender');
  await controller.setThemeMode('dark'); await controller.setVariant('lavender');
  assert.deepEqual(changes, [['dark', 'classic', 0], ['dark', 'lavender', 1]]);
  assert.equal(store.values.get('app_theme_mode'), 'dark'); assert.equal(store.values.get('app_theme_variant'), 'lavender');
  assert.equal(store.writes, 2);
  unsubscribe(); await controller.setThemeMode('system');
  assert.equal(controller.isDark, false); assert.equal(store.values.get('app_theme_mode'), 'dark');
  assert.equal(changes.length, 2);
});
