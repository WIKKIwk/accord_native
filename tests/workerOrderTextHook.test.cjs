const assert = require('node:assert/strict'), fs = require('node:fs'), Module = require('node:module'), path = require('node:path'), test = require('node:test'), ts = require('typescript');
test('worker translators keep effect identity until the locale actually changes', () => {
  let locale = 'uz', cache;
  const filename = path.resolve(__dirname, '../src/components/useWorkerOrderText.ts'), mod = new Module(filename, module);
  const mocks = {
    react: { useSyncExternalStore: (_subscribe, snapshot) => snapshot(), useMemo: (create, [value]) => {
      if (!cache || cache.locale !== value) cache = { locale: value, result: create() }; return cache.result;
    } },
    '../shared/localization/runtime': { localeController: { get locale() { return locale; }, addListener: () => () => {} } },
    '../workerOrderText': { workerOrderText: (source, language) => `${language}:${source}`, workerOrderProductionText: (key, language) => `${language}:${key}` },
  };
  mod.require = id => mocks[id]; mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  const first = mod.exports.useWorkerOrderText(), rerender = mod.exports.useWorkerOrderText();
  assert.equal(first, rerender); assert.equal(first.p, rerender.p); assert.equal(first.t, rerender.t);
  locale = 'ru'; const changed = mod.exports.useWorkerOrderText();
  assert.notEqual(first.p, changed.p); assert.notEqual(first.t, changed.t);
  assert.equal(changed.p('worker.daily'), 'ru:worker.daily'); assert.equal(changed.t('label'), 'ru:label');
});
