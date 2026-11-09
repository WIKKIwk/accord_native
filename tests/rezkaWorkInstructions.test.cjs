// Rules read from f11910bb aparatchi_work_instructions_screen.dart. No Dart, backend or device is used.
const assert = require('node:assert/strict'), fs = require('node:fs'), Module = require('node:module');
const path = require('node:path'), test = require('node:test'), ts = require('typescript');
function load(file, mocks = {}) {
  const filename = path.resolve(__dirname, '../src', file), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths; mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return mod.exports;
}
const shared = load('apparatusApi.ts', { './authorizedFetch': {}, './workerControlsApi': { WorkerControlException: class {} } });
const model = load('rezka/rezkaWorkInstructionsModel.ts', { '../apparatusApi': shared });
const { productionText } = load('shared/localization/index.ts', { './catalog.json': require('../src/shared/localization/catalog.json') });
const { RezkaWorkInstructionsController } = load('rezka/rezkaWorkInstructionsController.ts', { './rezkaWorkInstructionsModel': model });
const row = (id, operation, technology = 'slitting', colors = null) => ({ id, name: id, operation, technology, color_stations: colors });
const text = (key, values) => productionText(key, 'uz', values);
test('assigned ids trim and deduplicate by case, then retain V2 exact membership and server order', () => {
  const rows = [row('two', 'cut'), row('one', 'cut'), row('ONE', 'cut'), row('other', 'cut')];
  assert.deepEqual(model.assignedInstructionApparatus(rows, [' one ', '', 'ONE', 'two', 'two']).map(value => value.id), ['two', 'one']);
  assert.deepEqual(model.assignedInstructionApparatus(rows, ['ONE', 'one']).map(value => value.id), ['ONE']);
});
test('print, flexo, glue, laminate, cutting and generic guides use the exact branch counts and labels', () => {
  const cases = [
    [row('Print', ' PRINT ', 'rotogravure', 7), [4, 3, 3, 3], text('worker.guide.kind.print.color', { count: 7 })],
    [row('Flexo', 'print', ' FLEXOGRAPHIC ', null), [4, 3, 3, 3], text('worker.guide.kind.print.flexo')],
    [row('Unknown colors', 'print'), [4, 3, 3, 3], text('worker.guide.kind.machine')],
    [row('Zero colors', 'print', 'rotogravure', 0), [4, 3, 3, 3], text('worker.guide.kind.print.color', { count: 0 })],
    [row('Glue', ' GLUE '), [3, 3, 3, 3], 'Glue'],
    [row('Laminate', 'laminate'), [3, 3, 3, 3], text('worker.guide.kind.lamination')],
    [row('Cut', ' CUT '), [3, 3, 3, 3], text('worker.guide.kind.cutting')],
    [row('Package', 'package'), [3, 2, 3, 3], text('worker.guide.kind.machine')],
  ];
  for (const [apparatus, counts, kind] of cases) {
    const guide = model.rezkaApparatusGuide(apparatus, text); assert.equal(guide.name, apparatus.name); assert.equal(guide.kind, kind);
    assert.deepEqual(guide.sections.map(section => section.items.length), counts);
    assert.deepEqual(guide.sections.map(section => section.title), ['worker.guide.before_start', 'worker.guide.pause', 'worker.guide.complete', 'worker.guide.partial'].map(key => text(key)));
    assert.ok(guide.sections.every(section => section.items.every((item, index) => item.startsWith(`${index + 1}. `))));
  }
});
test('selected-source widget assertions are retained for current assigned apparatus without invoking its legacy demo setup', () => {
  const selected = model.assignedInstructionApparatus([row('7 ta rangli bosma aparat', 'print', 'rotogravure', 7),
    row('Laminatsiya 1', 'laminate'), row('Rezka 1', 'cut'), row('Godex aparat - DEMO', 'package')],
  ['7 ta rangli bosma aparat', 'Laminatsiya 1', 'Rezka 1']);
  const content = model.rezkaWorkInstructionsContent(selected, text), rendered = JSON.stringify(content);
  for (const phrase of ['Kuzatishdan zakazni ochish', 'drawerdagi Kuzatish', 'Zakaz yo‘q', 'Ekrandagi holatlar va tugmalar',
    'Qoliplar qatorini oching', 'Pauza miqdori oynasi', 'Rasxot va Astatka', 'Pauzada Jami chiqindi va kraska astatkasi kiritilmaydi',
    'Plyonkadan ortgan rulon', 'Pauzada Plyonkadan ortgan rulon ham, Jami chiqindi (atxot) ham kiritilmaydi',
    'order bo‘yicha jami atxot miqdorini', 'Tayyor mahsulot chetidan chiqqan chiqindi']) assert.ok(rendered.includes(phrase), phrase);
  assert.ok(!rendered.includes('Godex aparat - DEMO')); assert.deepEqual(content.common.map(section => section.items.length), [5, 4]);
});
test('every selected guide key resolves through the reused localization catalog in all four V2 languages', () => {
  const rows = ['print', 'laminate', 'glue', 'cut', 'package'].map(operation => row(operation, operation, 'flexographic', 3));
  for (const locale of ['uz', 'en', 'ru', 'ur-PK']) {
    const content = model.rezkaWorkInstructionsContent(rows, (key, values) => {
      const value = productionText(key, locale, values); assert.notEqual(value, key, key); return value;
    });
    assert.equal(content.guides.length, 5); assert.ok(!JSON.stringify(content).includes('{count}'));
  }
});
test('one init read is shared across StrictMode suspend/resume and is never repeated on ready state', async () => {
  let finish, calls = 0;
  const c = new RezkaWorkInstructionsController({ assigned: ['cut'], isCurrent: () => true,
    load: () => { calls++; return new Promise(resolve => { finish = resolve; }); } });
  await c.start(); assert.equal(calls, 0); c.resume(); const pending = c.start();
  c.suspend(); c.resume(); assert.equal(c.start(), pending); finish([row('cut', 'cut'), row('other', 'print')]); await pending;
  assert.equal(calls, 1); assert.deepEqual(c.getSnapshot().apparatus.map(value => value.id), ['cut']);
  await c.start(); assert.equal(calls, 1);
});
test('failed catalog read and no assigned match both use V2 ready empty, with no new error/retry state', async () => {
  for (const load of [async () => { throw new Error('offline'); }, async () => [row('other', 'cut')]]) {
    const c = new RezkaWorkInstructionsController({ assigned: ['mine'], isCurrent: () => true, load });
    c.resume(); await c.start(); assert.deepEqual(c.getSnapshot(), { phase: 'ready', apparatus: [] });
  }
});
test('a synchronous read rejection cannot reenter start through a listener and create a second read', async () => {
  let calls = 0; const c = new RezkaWorkInstructionsController({ assigned: [], isCurrent: () => true,
    load: () => { calls++; throw new Error('guard rejected'); } });
  const unsubscribe = c.subscribe(() => { void c.start(); }); c.resume(); await c.start();
  assert.equal(calls, 1); assert.equal(c.getSnapshot().phase, 'ready'); unsubscribe(); c.dispose();
});
test('scope change or reset retires the read and redacts late results without starting a replacement request', async () => {
  for (const condition of ['scope', 'reset', 'dispose']) {
    let current = true, finish, calls = 0;
    const c = new RezkaWorkInstructionsController({ assigned: ['mine'], isCurrent: () => current,
      load: () => { calls++; return new Promise(resolve => { finish = resolve; }); } });
    c.resume(); const pending = c.start();
    if (condition === 'scope') current = false;
    else if (condition === 'reset') c.invalidate(); else c.dispose();
    finish([row('mine', 'cut')]); await pending; current = true; c.resume(); await c.start();
    assert.deepEqual(c.getSnapshot(), { phase: 'invalid', apparatus: [] }, condition); assert.equal(calls, 1);
  }
});
test('a result finishing while suspended stays out of the view until that same valid owner resumes', async () => {
  let finish; const c = new RezkaWorkInstructionsController({ assigned: ['mine'], isCurrent: () => true,
    load: () => new Promise(resolve => { finish = resolve; }) });
  c.resume(); const pending = c.start(); c.suspend(); finish([row('mine', 'cut')]); await pending;
  assert.equal(c.getSnapshot().phase, 'loading'); c.resume(); assert.equal(c.getSnapshot().phase, 'ready'); c.dispose();
});
