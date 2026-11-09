// Source-derived from f11910bb _PaddonDetailHeader, PaddonWeightTotals and
// test/aparatchi_paddons_test.dart. The Node tests do not execute V2 or a device.
const assert = require('node:assert/strict'), fs = require('node:fs'), Module = require('node:module');
const path = require('node:path'), test = require('node:test'), ts = require('typescript');
function load(file, mocks = {}) {
  const filename = path.resolve(__dirname, '../src', file), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths; mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return mod.exports;
}
const bobina = load('rezka/rezkaPaddonBobina.ts'), display = load('rezka/rezkaPaddonDisplay.ts');
const model = load('rezka/rezkaPaddonDetailModel.ts', { './rezkaPaddonBobina': bobina, './rezkaPaddonDisplay': display });
const { productionText, adminText, localizedMethod } = load('shared/localization/index.ts', { './catalog.json': require('../src/shared/localization/catalog.json') });
const snapshot = (changes = {}, weights = [2, 2, 4]) => ({ paddon: { code: '00001', location: '2-qator • apparatus:default:asset-010', note: '  Today ',
  created_by_display_name: '  Operator ', contains_peremotka: true, total_gross_kg: 24.375, total_net_kg: 23.125, locked_at_unix: 1,
  item_count: 99, ...changes }, items: weights.map(bobina_kg => ({ bobina_kg })) });
const catalog = [{ id: 'apparatus:default:asset-010', name: 'Rezka 1', physical_asset_id: '', work_unit_id: '' }];
const translate = locale => ({ t: key => productionText(key, locale), unspecified: adminText('wip.unspecified', locale),
  count: n => localizedMethod('productionCount', locale, { count: n }) });

test('source detail shows server weights, resolved location, creator and actual item count', () => {
  const a = translate('uz'), data = snapshot(), before = JSON.stringify(data);
  const header = model.rezkaPaddonDetailHeader(data, catalog, a.t, a.unspecified, a.count);
  assert.equal(header.code, '00001'); assert.equal(header.location, '2-qator • Rezka 1'); assert.equal(header.creator, 'Operator');
  assert.equal(header.gross, 'Jami brutto: 24.375 kg'); assert.equal(header.net, 'Jami netto: 23.125 kg');
  assert.equal(header.wip, 'WIP: 3'); assert.equal(header.note, '  Today '); assert.equal(header.peremotka, a.t('worker.rezka.print.peremotka'));
  assert.equal(header.locked, a.t('worker.paddon.locked')); assert.equal(header.bobinaTitle, a.t('worker.paddon.bobina_summary'));
  assert.deepEqual(header.bobina.map(group => [group.label, group.countText]), [['2 kg', '2 ta'], ['4 kg', '1 ta']]);
  assert.equal(JSON.stringify(data), before);
});
test('missing creator, unavailable catalog, unlocked state and unknown totals retain V2 fallbacks', () => {
  const a = translate('uz'), data = snapshot({ created_by_display_name: ' ', note: '  ', contains_peremotka: false,
    total_gross_kg: null, total_net_kg: 0, locked_at_unix: null }, []);
  const header = model.rezkaPaddonDetailHeader(data, [], a.t, a.unspecified, a.count);
  assert.equal(header.creator, 'Belgilanmagan'); assert.equal(header.location, '2-qator • Belgilanmagan');
  assert.equal(header.gross, 'Jami brutto: —'); assert.equal(header.net, 'Jami netto: 0 kg');
  assert.equal(header.locked, ''); assert.equal(header.note, ''); assert.equal(header.peremotka, '');
  assert.equal(header.wip, 'WIP: 0'); assert.equal(header.bobinaTitle, ''); assert.deepEqual(header.bobina, []);
});
test('weight text keeps up to six decimals and treats negative or nonfinite values as unknown', () => {
  for (const [value, expected] of [[0, '0 kg'], [2, '2 kg'], [44.375, '44.375 kg'], [0.808001, '0.808001 kg'], [null, '—'],
    [-1, '—'], [NaN, '—'], [Infinity, '—']]) assert.equal(model.rezkaPaddonWeightText(value), expected);
});
test('all locale paths use existing text and localized unknown bobina count', () => {
  for (const locale of ['uz', 'en', 'ru', 'ur-PK']) {
    const a = translate(locale), header = model.rezkaPaddonDetailHeader(snapshot({ location: ' ', note: '' }, [null]), [], a.t, a.unspecified, a.count);
    assert.equal(header.location, ''); assert.equal(header.creatorLabel, a.t('worker.paddon.created_by'));
    assert.equal(header.bobina[0].label, a.t('worker.paddon.bobina_unknown')); assert.equal(header.bobina[0].countText, a.count(1));
    assert.ok(!header.gross.includes('{')); assert.ok(!header.net.includes('{'));
  }
});
