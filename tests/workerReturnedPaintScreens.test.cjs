const assert = require('node:assert/strict'), test = require('node:test');
const { harness, nodes, load } = require('./support/workerOrderScreen.cjs');
const tick = () => new Promise(resolve => setImmediate(resolve));
function setup(platform, extra = {}) {
  const h = harness(platform, { ...extra, control: { allowed_actions: ['complete'], complete_requires_full_report: true, ...extra.control },
    interaction: { mode: 'in_progress', blocking_reason_code: '', ...extra.interaction },
    states: { selected: 'complete', paintEditor: true, paintColor: 'Pantone', kg: '10', meter: '10', bobina: '1', waste: '1', ...extra.states } });
  const scope = JSON.stringify([h.props.session.baseUrl, 'aparatchi', 'worker', '', h.props.orderId, h.props.apparatusId]);
  h.values.set('loadedDraftScope', scope);
  h.paintTree = () => { const tree = h.render(); return platform === 'android' ? h.sheetContents.at(-1) : tree; };
  return h;
}
const button = (tree, label) => nodes(tree, node => node.type?.name === 'NativeButton' && node.props.label === label)[0];
const dialog = tree => nodes(tree, node => node.type === 'PaintNamedDialog')[0];
test('iOS report and inline paint editor retain glass secondary actions and blue confirm/done actions', () => {
  const h = setup('ios', { states: { paintEditor: false } });
  const report = nodes(h.render(), node => node.type === 'WorkerFormDialog')[0];
  assert.equal(report.props.actionColors, 'blue');
  assert.equal(report.props.cancelLabel, 'Bekor qilish');
  assert.equal(report.props.confirmLabel, 'Tasdiqlash');
  const paint = button(h.render(), h.p('worker.daily.field.returned_ink'));
  assert.equal(paint.props.variant, 'outlined');
  paint.props.onPress();
  const editor = nodes(h.render(), node => node.type === 'WorkerFormDialog')[0];
  assert.equal(editor.props.actionColors, 'blue');
  assert.equal(editor.props.cancelLabel, 'Orqaga');
  assert.equal(editor.props.confirmLabel, 'Tayyor');
});
for (const platform of ['ios', 'android']) {
  test(`${platform}: named paint fields open a dialog and commit its initial value with the source duplicate notice`, () => {
    const h = setup(platform); button(h.paintTree(), 'Pantone+').props.onPress();
    let field = dialog(h.paintTree()); assert.equal(field.props.paint, 'Pantone');
    field.props.add('Blue', '12.5');
    let tree = h.paintTree(); assert.equal(dialog(tree), undefined);
    assert.deepEqual(h.values.get('paintDynamic')['rasxot:Pantone'], ['Blue']);
    assert.equal(nodes(tree, node => node.type === 'PaintField' && node.props.label === 'Blue')[0].props.initial, '12.5');
    button(tree, 'Pantone+').props.onPress(); dialog(h.paintTree()).props.add('blue', '2');
    assert.equal(h.values.get('error'), 'Bu nom allaqachon qo‘shilgan.');
    assert.deepEqual(h.values.get('paintDynamic')['rasxot:Pantone'], ['Blue']);
  });
  test(`${platform}: Pantone Mix uses its source heading and keeps a separate storage key`, () => {
    const h = setup(platform); button(h.paintTree(), 'Mix+').props.onPress();
    const field = dialog(h.paintTree()); assert.equal(field.props.paint, 'Mix'); field.props.add('Special', '1.5');
    const tree = h.paintTree(); assert.deepEqual(h.values.get('paintDynamic')['rasxot:Pantone Mix'], ['Special']);
    assert.equal(nodes(tree, node => node.type === 'PaintField' && node.props.label === 'Special')[0].props.initial, '1.5');
    assert.equal(h.values.get('paintDynamic')['rasxot:Pantone'], undefined);
  });
  test(`${platform}: a named field matching a base label keeps both independent source values`, () => {
    const h = setup(platform, { states: { paintColor: 'Oq', paint: { 'rasxot:Oq:1w Oq': '3' } } });
    button(h.paintTree(), 'Pantone+').props.onPress(); dialog(h.paintTree()).props.add('1w Oq', '1.5');
    const fields = nodes(h.paintTree(), node => node.type === 'PaintField' && node.props.label === '1w Oq');
    assert.deepEqual(fields.map(field => field.props.initial), ['3', '1.5']);
    fields[0].props.onChange('4');
    assert.deepEqual(nodes(h.paintTree(), node => node.type === 'PaintField' && node.props.label === '1w Oq').map(field => field.props.initial), ['4', '1.5']);
  });
  test(`${platform}: returned-paint photo uses the shared enabled preview with download suppressed`, () => {
    const image = { image_id: 'old', image_url: '/photo', image_name: 'original.png', image_mime: 'image/png', image_size_bytes: 50 };
    const h = setup(platform, { states: { paintImageId: 'old', paintImageMetadata: image } });
    const preview = nodes(h.paintTree(), node => node.type === 'PaintImage')[0];
    assert.deepEqual(preview.props.image, image); assert.equal(preview.props.disabled, undefined);
    assert.equal(preview.props.allowDownload, false); assert.equal(preview.props.isLocked(), false);
    h.setScope('retired'); assert.equal(preview.props.isLocked(), true);
  });
  test(`${platform}: Gallery upload uses shared API and a failed old-image deletion cannot roll back the new photo`, async () => {
    const h = setup(platform, { states: { paintImageId: 'old' }, deletePaint: async () => { throw Error('old cleanup failed'); } });
    button(h.paintTree(), 'Almashtirish').props.onPress();
    const choices = h.alerts[0][2]; assert.deepEqual(choices.map(item => item.text), ['Kamera', 'Gallery', 'Bekor qilish']);
    choices[1].onPress(); await tick(); await tick();
    assert.equal(h.paintUploads.length, 1); assert.equal(h.paintUploads[0][1].orderId, h.props.orderId);
    assert.equal(h.paintUploads[0][1].apparatus, h.props.apparatusId); assert.equal(h.values.get('paintImageId'), 'new-image');
    assert.equal(h.values.get('paintImageMetadata').image_url, '/new-image');
    assert.deepEqual(h.paintDeletes[0].slice(1), ['old', h.props.orderId]); assert.equal(h.values.get('error'), '');
  });
  test(`${platform}: retired photo selection cannot upload into the next account`, async () => {
    let finish;
    const h = setup(platform, { states: { paintImageId: 'old' }, pickPaintPhoto: () => new Promise(resolve => { finish = resolve; }) });
    button(h.paintTree(), 'Almashtirish').props.onPress(); h.alerts[0][2][1].onPress();
    h.setScope('retired'); finish({ uri: 'file:old', width: 10, height: 10 }); await tick();
    assert.equal(h.paintUploads.length, 0); assert.equal(h.values.get('paintImageId'), 'old');
  });
  test(`${platform}: structured photo deletion errors retain source text and keep the draft image`, async () => {
    const h = setup(platform, { states: { paintImageId: 'old' }, deletePaint: async () => { throw Object.assign(Error('Source deletion detail'), { name: 'MobileApiException' }); } });
    button(h.paintTree(), 'Olib tashlash').props.onPress(); await tick();
    assert.equal(h.values.get('error'), 'Source deletion detail'); assert.equal(h.values.get('paintImageId'), 'old'); assert.equal(h.values.get('photoBusy'), false);
  });
  test(`${platform}: worker report uses distinct source paint validation before sending`, async () => {
    for (const [paint, image, key, values] of [
      [{ 'rasxot:Oq:Mix': '-1' }, 'image', 'worker.progress.qty.returned_paint_invalid'],
      [{ 'rasxot:Oq:Mix': '1' }, 'image', 'worker.progress.qty.returned_paint_min', { rasxot: 1, astatka: 0 }],
      [{}, '', 'worker.progress.qty.returned_paint_image'],
    ]) {
      const h = setup(platform, { states: { paintEditor: false, paint, paintImageId: image } });
      const report = nodes(h.render(), node => node.type === 'WorkerFormDialog')[0]; report.props.onConfirm();
      await tick();
      assert.equal(h.values.get('error'), h.p(key, values)); assert.equal(h.actions.length, 0);
    }
  });
}

test('shared named-field dialog keeps invalid name/value open and normalizes a valid initial value', () => {
  const stored = [], calls = []; let index = 0;
  const native = new Proxy({}, { get: (_target, key) => String(key) });
  const model = load('boyoqchi/returnedPaintModel.ts', { '../workerControlsApi': {} });
  const form = load('boyoqchi/BoyoqchiFormContent.tsx', {
    react: { useState: initial => { const key = index++; if (!(key in stored)) stored[key] = initial; return [stored[key], value => { stored[key] = value; }]; } },
    'react-native': { ...native, Modal: 'Modal', Pressable: 'Pressable', Text: 'Text', View: 'View', StyleSheet: { create: value => value, absoluteFill: {} } },
    '@expo/ui': native, '../components/useWorkerColors': { useWorkerColors: () => ({}) }, '../components/useBaseTheme': {},
    './useBoyoqchiText': { useBoyoqchiText: () => text => text }, './returnedPaintModel': model,
    '../workerOrderLogic': {}, '../components/WorkerIconButton': {}, '../components/WorkerSheetButton': { WorkerSheetButton: 'Button' },
    './BoyoqchiImage': {}, './BoyoqchiPaintPalette': {}, './BoyoqchiUsageSwipe': {}, './boyoqchiLogic': {},
  });
  const render = () => { index = 0; return form.ReturnedPaintNamedFieldDialog({ paint: 'Pantone', close() {}, add: (...args) => calls.push(args) }); };
  for (const [name, value] of [['', '1'], ['Blue', ''], ['Blue', '-1'], ['Blue', 'Infinity'], ['Blue', '1e400']]) {
    let tree = render(), fields = nodes(tree, node => node.type === form.ReturnedPaintField);
    fields[0].props.onChange(name); fields[1].props.onChange(value); tree = render();
    nodes(tree, node => node.type === 'Button' && node.props.label === 'Qo‘shish')[0].props.onPress();
    assert.equal(calls.length, 0);
  }
  let tree = render(), fields = nodes(tree, node => node.type === form.ReturnedPaintField);
  assert.deepEqual(fields.map(field => [field.props.label, field.props.placeholder]), [['Majburiy nom', 'Masalan: Pantone Blue'], ['Qiymat', 'Masalan: 12.5']]);
  fields[0].props.onChange(' Blue '); fields[1].props.onChange(' 1,50 '); tree = render();
  nodes(tree, node => node.type === 'Button' && node.props.label === 'Qo‘shish')[0].props.onPress();
  assert.deepEqual(calls, [['Blue', '1.50']]);
});
