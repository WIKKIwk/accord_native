const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const filename = path.resolve(__dirname, '../src/material/materialHistorySymbols.ts'), loaded = new Module(filename, module);
loaded.filename = filename; loaded.paths = module.paths;
loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
const { materialHistorySymbol, materialHistoryMessageSymbols } = loaded.exports;
const expected = {
  receipt_posted: 'add_business', order_reserved: 'outbox', order_unreserved: 'undo', usage_started: 'play_circle_outline',
  usage_cancelled: 'undo', consumption_posted: 'done_all', consumption_reversed: 'undo', adjustment_increase: 'add_circle_outline',
  adjustment_decrease: 'remove_circle_outline', transfer_in: 'call_received', transfer_out: 'call_made',
};

test('event icons preserve the f119 Android switch and unknown fallback', () => {
  for (const [event, icon] of Object.entries(expected)) assert.equal(materialHistorySymbol(event).android, icon, event);
  for (const event of ['', 'delivery_received', 'Receipt_Posted', '__proto__', 'constructor']) {
    assert.deepEqual(materialHistorySymbol(event), { ios: 'clock.arrow.circlepath', android: 'history' }, event);
  }
});

test('history status icons retain source error/empty semantics with native iOS symbols', () => {
  assert.deepEqual(materialHistoryMessageSymbols, {
    error: { ios: 'exclamationmark.circle', android: 'error_outline' }, empty: { ios: 'clock', android: 'history_toggle_off' },
  });
});

test('the chosen icons exist in installed native symbol catalogs', () => {
  const expoRoot = path.dirname(require.resolve('expo-symbols/package.json'));
  const android = JSON.parse(fs.readFileSync(path.join(expoRoot, 'build/android/symbols.json'), 'utf8'));
  const sfRoot = path.dirname(require.resolve('sf-symbols-typescript/package.json'));
  const sf = fs.readFileSync(path.join(sfRoot, 'dist/index.d.ts'), 'utf8');
  for (const symbol of [...Object.keys(expected), 'delivery_received'].map(materialHistorySymbol).concat(Object.values(materialHistoryMessageSymbols))) {
    assert.ok(Object.hasOwn(android, symbol.android), symbol.android);
    assert.ok(sf.includes(`'${symbol.ios}'`) || sf.includes(`"${symbol.ios}"`), symbol.ios);
  }
});
