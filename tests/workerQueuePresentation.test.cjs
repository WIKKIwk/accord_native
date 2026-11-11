const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const cache = new Map();
function load(file) {
  let filename = path.resolve(__dirname, '../src', file);
  if (filename.endsWith('.json')) return require(filename);
  if (!path.extname(filename)) filename = fs.existsSync(`${filename}.ts`) ? `${filename}.ts` : path.join(filename, 'index.ts');
  if (cache.has(filename)) return cache.get(filename).exports;
  const mod = new Module(filename, module); mod.paths = module.paths; cache.set(filename, mod);
  mod.require = id => id === './authorizedFetch' ? {} : id.startsWith('.') ? load(path.relative(path.resolve(__dirname, '../src'), path.resolve(path.dirname(filename), id))) : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText, filename);
  return mod.exports;
}
const { workerDailyWorkVisible } = load('workerNavigation');
const { workerDrawerItems } = load('components/workerDrawerModel');
const { workerQueueLimitLabels } = load('workerQueuePresentation');
const { workerOrderText } = load('workerOrderText');
const { getWorkerTabs } = load('components/workerTabModel');

// Source: features/aparatchi/presentation/widgets/aparatchi_navigation_drawer.dart:99.
test('daily drawer entry requires an operator and a canonical assigned apparatus', () => {
  const session = (role, assigned_apparatus) => ({ profile: { role }, assigned_apparatus });
  for (const role of ['aparatchi', 'rezka_master']) {
    assert.equal(workerDailyWorkVisible(session(role, ['apparatus:default:print'])), true);
    for (const ids of [[], ['old-print'], ['Apparatus:default:print'], ['apparatus:']]) assert.equal(workerDailyWorkVisible(session(role, ids)), false);
  }
  assert.equal(workerDailyWorkVisible(session('admin', ['apparatus:default:print'])), false);
  const withoutDaily = workerDrawerItems('Worker', true, [], value => value, false);
  assert.deepEqual(withoutDaily.map(item => item.id), ['queue', 'instructions', 'transfer', 'profile']);
});

// Source: features/admin/presentation/widgets/worker_queue_limit_filter.dart:27.
test('queue limit labels retain V2 language switches, count translations and Urdu fallback', () => {
  const expected = { uz: ['Ko‘rsatish', 'Barchasi'], en: ['Show', 'All'], ru: ['Показывать', 'Все'], ur: ['Ko‘rsatish', 'Barchasi'] };
  const catalog = require('../src/shared/localization/catalog.json');
  for (const locale of ['uz', 'en', 'ru', 'ur']) {
    const labels = workerQueueLimitLabels(locale, [5, 10, 20, 50, 0]);
    assert.equal(labels.title, expected[locale][0]); assert.equal(labels.all, expected[locale][1]);
    assert.equal(labels.counts[5], catalog.production['qolip.tasks.count'][locale].replace('{count}', '5'));
    assert.equal(labels.counts[0], undefined);
    const text = source => workerOrderText(source, locale), drawer = workerDrawerItems('Worker', true, [], text);
    assert.equal(drawer.find(item => item.id === 'daily').label, catalog.production['worker.daily'][locale]);
    assert.equal(drawer.find(item => item.id === 'profile').label, catalog.getters.profileTitle[locale]);
    const tabs = getWorkerTabs([{ id: 'one', name: '1' }, { id: 'two', name: '2' }], catalog.production['worker.queue.tab.completed'][locale]);
    assert.deepEqual(tabs.map(item => item.id), ['one', 'completed', 'two']);
    assert.equal(tabs[1].name, catalog.production['worker.queue.tab.completed'][locale]);
  }
});
