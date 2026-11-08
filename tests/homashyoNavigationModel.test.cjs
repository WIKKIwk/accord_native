// Source-derived shell data only. No Expo route, Chat runtime, camera, printer or network is started.
const assert = require('node:assert/strict'); const fs = require('node:fs'); const Module = require('node:module');
const path = require('node:path'); const test = require('node:test'); const ts = require('typescript');
const file = path.resolve(__dirname, '../src/homashyo/rawSplitNavigationModel.ts'), m = new Module(file, module);
m.filename = file; m.paths = module.paths;
m._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, file);
const { rawSplitDrawerItems, rawSplitNonChatDockItems, rawSplitDrawerActive, rawSplitDockActive, rawSplitHeader,
  rawSplitHistoryBackAction } = m.exports;
const t = value => `translated:${value}`;

test('drawer has V2 home, history, profile order and native icons, without adding a Chat row', () => {
  assert.deepEqual(rawSplitDrawerItems(t), [
    { id: 'home', label: 'translated:Rezka', symbol: { ios: 'scissors', android: 'content_cut' } },
    { id: 'history', label: 'translated:Rezka tarixi', symbol: { ios: 'clock.arrow.circlepath', android: 'history' } },
    { id: 'profile', label: 'translated:Profil', symbol: { ios: 'person', android: 'person_outline' } },
  ]);
  for (const page of ['home', 'history', 'profile']) assert.equal(rawSplitDrawerActive(page), page);
});

test('the non-Chat dock prefix has no unread placeholder or Chat route', () => {
  const items = rawSplitNonChatDockItems(t);
  assert.deepEqual(items.map(item => [item.id, item.label]), [['home', 'translated:Rezka'], ['profile', 'translated:Profil']]);
  assert.deepEqual(items.map(item => item.android), ['content_cut', 'person']);
  assert.deepEqual(items.map(item => item.ios), [{ default: 'scissors', selected: 'scissors' }, { default: 'person', selected: 'person.fill' }]);
  assert.ok(items.every(item => !('unread' in item) && !('route' in item) && !('badge' in item)));
  assert.equal(rawSplitDockActive('home'), 'home'); assert.equal(rawSplitDockActive('history'), 'home');
  assert.equal(rawSplitDockActive('profile'), 'profile');
});

test('V2 headers disable their actions while busy and history has a back control', () => {
  assert.deepEqual(rawSplitHeader('home', false, t), { title: 'translated:Rezka', navigation: 'drawer', showHistory: true,
    historyEnabled: true, printerEnabled: true, loading: false });
  assert.deepEqual(rawSplitHeader('home', true, t), { title: 'translated:Rezka', navigation: 'drawer', showHistory: true,
    historyEnabled: false, printerEnabled: false, loading: true });
  assert.deepEqual(rawSplitHeader('history', false, t), { title: 'translated:Rezka tarixi', navigation: 'back', showHistory: false,
    historyEnabled: false, printerEnabled: true, loading: false });
  assert.equal(rawSplitHeader('history', true, t).printerEnabled, false);
  assert.equal(rawSplitHistoryBackAction(true), 'pop'); assert.equal(rawSplitHistoryBackAction(false), 'home-replacement');
});

test('the existing shared drawer closes on the selected item and delegates other selections once', () => {
  const filename = path.resolve(__dirname, '../src/shared/navigation/roleDrawerModel.ts'), drawer = new Module(filename, module);
  drawer.filename = filename; drawer.paths = module.paths;
  drawer._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  const events = [], props = { active: 'history', onClose: () => events.push('close'), onSelect: id => events.push(id) };
  const items = rawSplitDrawerItems(value => value);
  drawer.exports.selectRoleDrawerItem(items[1], props); assert.deepEqual(events, ['close']);
  drawer.exports.selectRoleDrawerItem(items[0], props); assert.deepEqual(events, ['close', 'close', 'home']);
});
