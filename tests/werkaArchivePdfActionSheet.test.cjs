// Mocked native sheet/events only. No file, network, permission, sharing or route is used.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const catalog = require('../src/shared/localization/catalog.json');
function compile(file, mocks = {}) {
  const filename = path.resolve(__dirname, '../src', file), loaded = new Module(filename);
  loaded.filename = filename; loaded.paths = require.main.paths;
  loaded.require = name => Object.hasOwn(mocks, name) ? mocks[name] : require(name);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText, filename); return loaded.exports;
}
const jsx = { Fragment: 'Fragment', jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
const localization = compile('shared/localization/index.ts', { './catalog.json': catalog });
const sheet = compile('werka/werkaArchivePdfSheet.ts', { react: { useRef: value => ({ current: value }) }, '../shared/localization': localization });
const node = (tree, type) => {
  if (!tree || typeof tree !== 'object') return [];
  if (Array.isArray(tree)) return tree.flatMap(child => node(child, type));
  return [...(tree.type === type ? [tree] : []), ...node(tree.props?.children, type)];
};
const modifier = name => (...args) => ({ name, args });
function make(platform, locale = 'uz') {
  const ios = Object.fromEntries(['Button', 'Spacer', 'Text', 'VStack'].map(name => [name, name]));
  const android = Object.fromEntries(['Button', 'Column', 'FilledTonalButton', 'RNHostView', 'Row', 'Spacer', 'Text'].map(name => [name, name]));
  android.useMaterialColors = () => ({ onSecondaryContainer: 'tonal', onPrimary: 'filled' });
  const mocks = { 'react/jsx-runtime': jsx, '@expo/ui': { BottomSheet: 'BottomSheet' },
    '@expo/ui/swift-ui': ios, '@expo/ui/swift-ui/modifiers': Object.fromEntries(['buttonStyle', 'font', 'frame'].map(name => [name, modifier(name)])),
    '@expo/ui/jetpack-compose': android, '@expo/ui/jetpack-compose/modifiers': Object.fromEntries(['fillMaxWidth', 'height'].map(name => [name, modifier(name)])),
    'expo-symbols': { SymbolView: 'SymbolView' }, './werkaArchivePdfSheet': sheet };
  const component = compile(`werka/WerkaArchivePdfActionSheet.${platform}.tsx`, mocks).WerkaArchivePdfActionSheet;
  const calls = [], tree = component({ locale, onDismiss: () => calls.push('dismiss'), onAction: action => calls.push(action) });
  const buttons = platform === 'ios' ? node(tree, 'Button') : [...node(tree, 'FilledTonalButton'), ...node(tree, 'Button')];
  return { tree, calls, buttons, dismiss: () => node(tree, 'BottomSheet')[0].props.onDismiss(),
    press: index => buttons[index].props[platform === 'ios' ? 'onPress' : 'onClick']() };
}

test('PDF sheet labels match f119 getters and Urdu translation data', () => {
  const expected = {
    uz: ['PDF tayyor', 'Uni Files ga, Photos ga saqlashingiz yoki share qilishingiz mumkin.', 'Files ga saqlash', 'Rasmga saqlash', 'Ulashish'],
    en: ['PDF is ready', 'You can save it to Files, save it to Photos, or share it.', 'Save to Files', 'Save photo', 'Share'],
    ru: ['PDF готов', 'Вы можете сохранить его в Files, в Фото или поделиться им.', 'Сохранить в Files', 'Сохранить как фото', 'Поделиться'],
    ur: ['PDF تیار ہے', 'آپ اسے فائلز میں محفوظ، Photos میں محفوظ یا شیئر کر سکتے ہیں۔', 'فائلز میں محفوظ کریں', 'تصویر محفوظ کریں', 'شیئر کریں'],
  };
  for (const [locale, values] of Object.entries(expected)) {
    const labels = sheet.werkaArchivePdfSheetLabels(locale);
    assert.deepEqual([labels.title, labels.message, labels.files, labels.photos, labels.share], values);
  }
});

test('a failed synchronous dismissal never starts the chosen action', () => {
  let actions = 0;
  const events = sheet.useWerkaArchivePdfSheetEvents({ locale: 'uz', onDismiss: () => { throw Error('not dismissed'); },
    onAction: () => { actions++; } });
  assert.throws(() => events.choose('share'), /not dismissed/); events.choose('share'); events.dismiss();
  assert.equal(actions, 0);
});

for (const platform of ['ios', 'android']) {
  test(`${platform} presents the source title, description and three native actions in order`, () => {
    for (const locale of ['uz', 'en', 'ru', 'ur']) {
      const view = make(platform, locale), expected = sheet.werkaArchivePdfSheetLabels(locale), modal = node(view.tree, 'BottomSheet')[0];
      assert.equal(modal.props.isPresented, true); assert.equal(modal.props.showDragIndicator, true);
      assert.deepEqual(modal.props.contentPadding, { top: 8, left: 20, right: 20, bottom: 20 });
      assert.equal(view.buttons.length, 3);
      const labels = platform === 'ios' ? view.buttons.map(button => button.props.label)
        : view.buttons.map(button => node(button, 'Text')[0].props.children);
      assert.deepEqual(labels, [expected.files, expected.photos, expected.share]);
      assert.deepEqual(node(view.tree, 'Text').slice(0, 2).map(item => item.props.children), [expected.title, expected.message]);
      if (platform === 'ios') assert.deepEqual(view.buttons.map(button => button.props.systemImage), ['folder', 'photo.on.rectangle', 'square.and.arrow.up']);
      else assert.deepEqual(view.buttons.map(button => button.type), ['FilledTonalButton', 'FilledTonalButton', 'Button']);
      assert.deepEqual(view.calls, []);
    }
  });

  test(`${platform} reports each actual choice after dismissal and fences repeated events`, () => {
    for (const [index, action] of ['files', 'photos', 'share'].entries()) {
      const view = make(platform); view.press(index); view.press(index); view.dismiss();
      assert.deepEqual(view.calls, ['dismiss', action]);
    }
  });

  test(`${platform} dismissal does not invent an action`, () => {
    const view = make(platform); view.dismiss(); view.dismiss(); view.press(0);
    assert.deepEqual(view.calls, ['dismiss']);
  });
}
