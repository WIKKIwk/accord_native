const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const test = require('node:test');
const ts = require('typescript');
const palettes = require('../src/shared/themePalettes.json');

test('base theme variants retain V2 palette and light/dark choices', () => {
  assert.equal(palettes.classic.light.colors.primary, '#324670');
  assert.equal(palettes.kalmar.dark.colors.surface, '#21150F');
  assert.equal(palettes.moss.light.seed, '#84B179');
  assert.equal(palettes.white.light.colors.surface, '#FFFFFF');
  for (const variant of ['classic', 'kalmar', 'moss', 'lavender', 'bliss', 'white']) {
    assert.ok(palettes[variant].light.colors.onSurface);
    assert.ok(palettes[variant].dark.colors.onSurface);
  }
});

test('startup shares one preference load between the root and entry', async () => {
  const filename = path.resolve(__dirname, '../src/shared/basePreferences.ts');
  const mod = new Module(filename, module); mod.filename = filename; mod.paths = module.paths;
  const calls = [];
  mod.require = id => id === './themeRuntime' ? { themeController: { load: async () => { calls.push('theme'); } } }
    : id === './localization/runtime' ? { localeController: { load: async () => { calls.push('locale'); } } } : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  await Promise.all([mod.exports.initializeBasePreferences(), mod.exports.initializeBasePreferences()]);
  assert.deepEqual(calls.sort(), ['locale', 'theme']);
});
