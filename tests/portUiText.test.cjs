const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');

const load = () => import(path.join(__dirname, '../.agents/skills/accord-port/scripts/ui_text.mjs'));
const texts = list => list.map(item => item.text);

test('Dart strings include nested literals and skip comments', async () => {
  const { dartStrings } = await load();
  const found = dartStrings(`// 'not this'
/* 'nor this' */
final a = 'Jami: \${ok ? 'Bor' : 'Yo\\'q'} kg';
final b = r'raw $x';`);
  assert.deepEqual(texts(found).sort(), ["Bor", "Jami: \${ok ? 'Bor' : 'Yo\\'q'} kg", "Yo\\'q", 'raw $x'].sort());
  const outer = found.find(item => item.text.startsWith('Jami'));
  assert.deepEqual(outer.parts, ['Jami: ', ' kg']);
  assert.equal(found.find(item => item.text.startsWith('Yo')).parts[0], "Yo'q");
  assert.deepEqual(found.find(item => item.text.startsWith('raw')).parts, ['raw $x']);
});

test('Dart simple interpolation and triple quotes split into parts', async () => {
  const { dartStrings } = await load();
  assert.deepEqual(dartStrings("x('Ombor ochildi: $name!');")[0].parts, ['Ombor ochildi: ', '!']);
  assert.deepEqual(dartStrings("x('''Bir\nIkki''');")[0].parts, ['Bir\nIkki']);
});

test('only text for a person counts as UI text', async () => {
  const { isUiText } = await load();
  for (const value of ['Formula saqlandi', 'Homashyo', 'Saqlash kaliti', 'o‘chirilsinmi?', ' ta ichki formula']) {
    assert.equal(isUiText([value]), true, value);
  }
  for (const value of ['order_code', 'preparation-formula', 'camelCase', 'GET', 'Content-Type', 'Authorization', '/v1/mobile/x',
    'yyyy-MM-dd HH:mm', 'logo.png', 'ab', '', 'https://x.test/a b', 'application/json; charset=utf-8']) {
    assert.equal(isUiText([value]), false, value);
  }
});

test('calls that never reach a screen are skipped in Dart, but thrown messages stay', async () => {
  const { dartStrings, shownInDart } = await load();
  const shown = source => shownInDart(dartStrings(source)[0]);
  assert.equal(shown("debugPrint('Yuklanmadi matni');"), false);
  assert.equal(shown("ValueKey('Asosiy kalit');"), false);
  assert.equal(shown("message.replaceFirst('Bad state: ', '');"), false);
  assert.equal(shown("doc['Eski kalit'];"), false);
  assert.equal(shown("throw StateError('Homashyo tanlanmadi');"), true);
  assert.equal(shown("Text('Saqlash');"), true);
});

test('TypeScript strings and JSX text are found, comments and imports are not shown', async () => {
  const { shownInTs, tsStrings } = await load();
  const found = tsStrings(`import x from 'expo-router';
// 'not this'
const a = \`Jami: \${ok ? 'Bor' : 'Yo‘q'} kg\`;
const b = /it's/.test(c);
const v = <Text>Saqlash</Text>;
throw new TypeError('Invalid thing');
throw new Error('Invalid other');`);
  const shown = texts(found.filter(shownInTs));
  assert.equal(shown.includes('expo-router'), false);
  assert.equal(shown.includes('not this'), false);
  assert.equal(shown.includes('Invalid thing'), false);
  assert.equal(shown.includes('Invalid other'), false);
  for (const value of ['Bor', 'Yo‘q', 'Saqlash']) assert.equal(shown.includes(value), true, value);
  assert.deepEqual(found.find(item => item.text.startsWith('Jami')).parts, ['Jami: ', ' kg']);
});

test('fragments ignore label separators so a translated word still matches', async () => {
  const { fragmentsOf } = await load();
  assert.deepEqual(fragmentsOf(['Mavjud: ', ' kg']), ['Mavjud']);
  assert.deepEqual(fragmentsOf(['Birinchi qator\nIkkinchi qator.']), ['Birinchi qator', 'Ikkinchi qator.']);
});

test('nearest suggests the reworded string and nothing when nothing is close', async () => {
  const { nearest } = await load();
  assert.equal(nearest('Homashyo nomi o‘zgartirildi', ['Formula', 'Homashyo nomini o‘zgartirish']), 'Homashyo nomini o‘zgartirish');
  assert.equal(nearest('Formula saqlandi', ['Printer topilmadi', 'Kamera']), null);
});

test('surfaces lists sheets, dialogs and back guards', async () => {
  const { surfacesIn } = await load();
  const kinds = surfacesIn(`showModalBottomSheet(c); showM3ConfirmDialog(c); SnackBar(); PopScope(); AlertDialog(); HapticFeedback.lightImpact(); showFoo();`).map(item => item.kind);
  assert.deepEqual(kinds, ['showModalBottomSheet', 'showM3ConfirmDialog', 'SnackBar', 'PopScope', 'AlertDialog', 'HapticFeedback.lightImpact']);
});
