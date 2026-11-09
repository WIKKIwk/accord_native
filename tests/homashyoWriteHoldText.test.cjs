// Role-local safety notice is the deliberate deviation from the V2 text catalog.
const assert = require('node:assert/strict'); const fs = require('node:fs'); const Module = require('node:module');
const path = require('node:path'); const test = require('node:test'); const ts = require('typescript');
test('write and print hold notice covers Uzbek, English, Russian and Urdu', () => {
  let locale = 'uz'; const file = path.resolve(__dirname, '../src/homashyo/useRawSplitWriteHoldText.ts'), mod = new Module(file, module);
  mod.filename = file; mod.paths = module.paths;
  const mocks = { react: { useSyncExternalStore: (_sub, get) => get() }, '../shared/localization/runtime': { localeController: { get locale() { return locale; }, addListener: () => () => {} } } };
  mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, file);
  const messages = []; for (locale of ['uz', 'en', 'ru', 'ur']) messages.push(mod.exports.useRawSplitWriteHoldText());
  assert.match(messages[0], /saqlash.*chop etish/); assert.match(messages[1], /Saving.*printing/);
  assert.match(messages[2], /Сохранение.*печать/); assert.match(messages[3], /پرنٹ/); assert.equal(new Set(messages).size, 4);
});
