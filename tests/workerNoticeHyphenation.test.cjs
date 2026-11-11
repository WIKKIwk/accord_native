const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

const filename = path.resolve(path.dirname(module.filename), '../src/workerNoticeHyphenation.ts');
const mod = new Module(filename, module);
mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, filename);
const { hyphenateWorkerNotice: hyphenate, SOFT_HYPHEN } = mod.exports;

test('Uzbek notice vocabulary receives syllable boundaries, not permanent hyphens', () => {
  for (const [word, syllables] of [
    ['maktabimda', 'mak-ta-bim-da'], ['buyurtmasi', 'bu-yurt-ma-si'],
    ['buyurtmani', 'bu-yurt-ma-ni'], ['boshlash', 'bosh-lash'],
    ['ettirish', 'et-ti-rish'], ['bo‘shashini', 'bo‘-sha-shi-ni'],
    ['uskuna', 'us-ku-na'], ['Ushbu', 'Ush-bu'], ['kuting', 'ku-ting'],
    ['apparat', 'ap-pa-rat'], ['rangli', 'rang-li'], ['shashoqcha', 'sha-shoq-cha'],
  ]) assert.equal(hyphenate(word, 'uz'), syllables.replaceAll('-', SOFT_HYPHEN), word);
});

test('digraphs and apostrophe letters stay together; single letters are never stranded', () => {
  for (const [word, syllables] of [
    ['chegara', 'che-ga-ra'], ['ko‘ngil', 'ko‘-ngil'], ['g‘alaba', 'g‘a-la-ba'],
    ['aka', 'aka'], ['ona', 'ona'], ['aloqa', 'alo-qa'], ['radio', 'ra-dio'],
  ]) assert.equal(hyphenate(word, 'uz-Latn'), syllables.replaceAll('-', SOFT_HYPHEN), word);
  for (const apostrophe of ["'", '‘', '’', 'ʻ', 'ʼ', '`', '＇']) {
    assert.equal(hyphenate(`bo${apostrophe}shashini`, 'uz'), `bo${apostrophe}${SOFT_HYPHEN}sha${SOFT_HYPHEN}shi${SOFT_HYPHEN}ni`);
  }
});

test('quoted order names, technical identifiers and foreign spelling remain intact', () => {
  for (const value of [
    '“Pop cake xolodnaya payka”', '«Ak pirandik 450 gr»', '"silver choy"',
    'https://accord.example/buyurtmani', 'www.accord.example/uskuna', 'buyurtma@accord.example',
    'order_buyurtmani buyurtmani-0337 /buyurtmani buyurtmani: 0337buyurtmani',
    'SKU USB QR API', 'ma’rifat', 'réorientation', 'Бbuyurtmani',
  ]) assert.equal(hyphenate(value, 'uz'), value);
});

test('hyphenation preserves the original content and is idempotent and locale scoped', () => {
  const message = 'Uskuna 8 ta rangli bosma apparat — “keks” buyurtmasi bilan band. Ushbu buyurtmani boshlash yoki davom ettirish uchun uskuna bo‘shashini kuting.';
  const display = hyphenate(message, 'uz');
  assert.notEqual(display, message);
  assert.equal(display.replaceAll(SOFT_HYPHEN, ''), message);
  assert.equal(hyphenate(display, 'uz'), display);
  assert.equal(hyphenate(message, 'uz_Latn'), display);
  for (const locale of ['en', 'ru', 'ur', '']) assert.equal(hyphenate(message, locale), message);
  for (const value of ['', '1234 0/1', 'Ускуна бўшашини кутинг.']) assert.equal(hyphenate(value, 'uz'), value);
});
