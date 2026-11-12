const assert = require('node:assert/strict'), test = require('node:test');
const { setup, tick, defer, batch } = require('./support/workerPaddonHarness.cjs');
// @v2-test test/aparatchi_paddons_test.dart
test('Android list stays quiet behind a detail and revalidates a changed Paddon on return', async () => {
  const h = await setup('list', 'android');
  try {
    const controller = h.model.controller, before = h.events.filter(event => event[0] === 'list').length;
    h.props.visible = false; h.render(); await tick();
    assert.equal(h.model.enabled, false); assert.equal(h.events.filter(event => event[0] === 'list').length, before);
    h.paddons.delete('P1');
    h.load('workerPaddonRevision').workerPaddonRevision.notify(h.load('sessionReadScope').sessionReadScope(h.session));
    h.props.visible = true; h.render();
    assert.equal(h.model.controller, controller); assert.equal(h.model.state.phase, 'ready');
    assert(h.model.state.rows.some(row => row.code === 'P1'));
    await tick(); h.render(); assert.equal(h.model.controller, controller);
    assert.equal(h.events.filter(event => event[0] === 'list').length, before + 1);
    assert(!h.model.state.rows.some(row => row.code === 'P1'));
  } finally { h.dispose(); }
});
for (const platform of ['ios', 'android']) {
  test(`${platform}: reopening a fresh Paddon immediately reuses its data and catalog without another read`, async () => {
    const h = await setup('detail', platform), events = h.events.length;
    const owner = h.load('workerPaddonRuntime').workerPaddonOwner(h.session, 'cut'); owner.mount(true);
    try {
      const reopened = owner.detail('P1');
      assert.equal(reopened.getSnapshot().phase, 'ready'); assert.equal(reopened.getSnapshot().snapshot.paddon.code, 'P1');
      assert.deepEqual(owner.cachedCatalog(), h.catalog);
      await reopened.load(false); await owner.catalog(() => true, false);
      assert.equal(h.events.length, events);
      h.paddons.get('P1').items = [batch('new')];
      await reopened.load();
      assert.equal(h.events.filter(event => event[0] === 'read').length, 2);
      assert.deepEqual(reopened.getSnapshot().snapshot.items.map(row => row.batch_id), ['new']);
    } finally { owner.mount(false); h.dispose(); }
  });
  test(`${platform}: a fresh return to the Paddon list does not refetch unchanged rows`, async () => {
    const h = await setup('list', platform);
    try {
      const before = h.events.length; h.props.visible = false; h.render();
      h.props.visible = true; h.render(); await tick(); h.render();
      assert.equal(h.events.length, before); assert.equal(h.model.state.phase, 'ready');
    } finally { h.dispose(); }
  });
  test(`${platform}: creating a Paddon navigates to its returned code and keeps the assigned apparatus`, async () => {
    const h = await setup('list', platform);
    try { assert(h.model.canCreate); await h.model.create(); assert(h.events.some(e => e[0] === 'create' && e[1] === 'cut'));
      assert.deepEqual(h.events.find(e => e[0] === 'detail'), ['detail', 'P3', 'cut', 'cut']); }
    finally { h.dispose(); }
  });
  test(`${platform}: deletion keeps the action sheet and confirmation as two separate native steps`, async () => {
    const h = await setup('list', platform);
    try {
      const operation = h.model.remove(h.model.state.rows[0]); h.render(); const sheet = h.sheets.at(-1);
      assert.equal(h.model.presentation.data, null); sheet.content.props.choose('delete'); await tick(); h.render();
      assert.equal(h.model.presentation.data, null); sheet.options.onDismiss(); await tick(); h.render();
      assert.equal(h.model.presentation.data.title, 'worker.paddon.delete.title'); assert.equal(h.events.some(e => e[0] === 'delete'), false);
      await h.close(); await operation; assert.equal(h.events.filter(e => e[0] === 'delete').length, 1);
    } finally { h.dispose(); }
  });
  test(`${platform}: Add confirms exact selected IDs, membership acknowledgement exits selection`, async () => {
    const h = await setup('detail', platform);
    try { await h.model.edit('add'); h.render(); h.model.controller.toggle('A'); h.render(); const operation = h.model.edit('add'); h.render();
      assert.equal(h.events.some(e => e[0] === 'add'), false); assert.match(h.model.presentation.data.message, /"count":1/);
      await h.close(); await operation; h.render(); assert.deepEqual(h.events.find(e => e[0] === 'add'), ['add', ['A']]); assert.equal(h.model.state.mode, null);
      const remove = h.model.remove(h.model.state.snapshot.items[0]); h.render(); await h.close(); await remove;
      assert.deepEqual(h.events.find(e => e[0] === 'remove'), ['remove', ['A'], true]);
    } finally { h.dispose(); }
  });
  test(`${platform}: QR discard blocks additional detections while pending lookups finish and rejection retains them`, async () => {
    const h = await setup('detail', platform);
    try { const lookup = defer(); h.lookup = () => lookup.promise; h.model.controller.startScan(); h.render();
      const staged = h.model.controller.stage('A'); await tick(); h.render(); const cancel = h.model.cancelScan(); h.render();
      assert.equal(h.model.state.review, true); await h.model.controller.stage('B'); assert.equal(h.events.filter(e => e[0] === 'lookup').length, 1);
      lookup.resolve(batch('A')); await staged; h.render(); await h.close(null); assert.equal(await cancel, false); h.render(); assert.equal(h.model.state.scanning, true);
      const back = h.model.requestBack(h.props.onBack); h.render(); await h.close(); await back; h.render(); assert.equal(h.model.state.scanning, false); assert(h.events.some(e => e[0] === 'back'));
    } finally { h.dispose(); }
  });
  test(`${platform}: transfer locks actions throughout confirmation and executes only one explicit transfer`, async () => {
    const h = await setup('transfer', platform);
    try { h.model.controller.toggle('P1', 'A'); // source begins empty; replace it with a real waiting WIP then refresh.
      h.paddons.get('P1').items = [batch('A')]; await h.model.controller.load(); h.render(); h.model.controller.toggle('P1', 'A'); h.render();
      const operation = h.model.move(); h.render(); assert(h.model.blocked); assert.equal(h.events.some(e => e[0] === 'move'), false);
      await h.model.move(); await h.close(); await operation; h.render();
      assert.deepEqual(h.events.find(e => e[0] === 'move'), ['move', 'P1', 'P2', ['A']]); assert.equal(h.events.filter(e => e[0] === 'move').length, 1);
      assert.deepEqual(h.model.state.selected, []);
    } finally { h.dispose(); }
  });
}
test('a new account witness cannot reuse cached Paddon permissions or apparatus names', async () => {
  const h = await setup('detail', 'android'); h.expire();
  const owner = h.load('workerPaddonRuntime').workerPaddonOwner(h.session, 'cut'); owner.mount(true);
  try {
    const reopened = owner.detail('P1'); assert.equal(reopened.getSnapshot().snapshot, null); assert.equal(owner.cachedCatalog(), null);
    await reopened.load(false); assert.equal(h.events.filter(event => event[0] === 'read').length, 2);
  } finally { owner.mount(false); h.dispose(); }
});
test('membership changes invalidate rapid Paddon reopen and list return even within the freshness window', async () => {
  const h = await setup('detail', 'android'), owner = h.load('workerPaddonRuntime').workerPaddonOwner(h.session, 'cut'); owner.mount(true);
  try {
    await owner.list.load(false); assert(owner.detail('P1').getSnapshot().snapshot);
    assert(await h.model.controller.add(['A']));
    const reopened = owner.detail('P1'); assert.equal(reopened.getSnapshot().snapshot, null);
    await reopened.load(false); await owner.list.load(false);
    assert.deepEqual(reopened.getSnapshot().snapshot.items.map(row => row.batch_id), ['A']);
    assert.equal(h.events.filter(event => event[0] === 'read').length, 2);
    assert.equal(h.events.filter(event => event[0] === 'list').length, 2);
  } finally { owner.mount(false); h.dispose(); }
});
test('iOS decisions do not resolve on button press before Modal.onDismiss', async () => {
  const h = await setup();
  try { await h.model.edit('add'); h.model.controller.toggle('A'); h.render(); const operation = h.model.edit('add'); h.render();
    h.model.presentation.close('confirm'); h.render(); await tick(); assert.equal(h.events.some(e => e[0] === 'add'), false);
    h.model.presentation.dismissed(); await operation; assert.equal(h.events.filter(e => e[0] === 'add').length, 1);
  } finally { h.dispose(); }
});
test('an account retired during the confirmation cannot send the old Add', async () => {
  const h = await setup();
  try { await h.model.edit('add'); h.model.controller.toggle('A'); h.render(); const operation = h.model.edit('add'); h.render();
    h.expire(); await h.close(); await operation; assert.equal(h.events.some(e => e[0] === 'add'), false);
  } finally { h.dispose(); }
});
test('Paddon print physically succeeds before lock, reloads authority, then asks before creating the successor', async () => {
  const h = await setup();
  try { const operation = h.model.print(); await tick(); h.render();
    const events = h.events.map(e => e[0]); assert(events.indexOf('physicalPrint') < events.indexOf('confirmPrint'));
    assert(events.lastIndexOf('read') > events.indexOf('confirmPrint')); assert.equal(h.model.state.snapshot.paddon.locked_at_unix, 2);
    assert.equal(h.model.presentation.data.title, 'worker.paddon.next.title'); assert.equal(h.model.presentation.data.kind, 'successor');
    assert.equal(h.events.some(e => e[0] === 'successor'), false);
    await h.close(); await operation; assert.deepEqual(h.events.find(e => e[0] === 'successor'), ['successor', 'P1', 'cut']);
  } finally { h.dispose(); }
});
for (const failure of ['cancelPrinter', 'printFailure', 'confirmFailure']) test(`Paddon ${failure} cannot create a successor or confirm an unprinted label`, async () => {
  const h = await setup();
  try { h[failure] = true; await h.model.print(); h.render();
    assert.equal(h.events.some(e => e[0] === 'successor'), false); if (failure !== 'confirmFailure') assert.equal(h.events.some(e => e[0] === 'confirmPrint'), false);
    assert.equal(h.model.state.printing, false); assert.equal(h.model.presentation.data, null);
  } finally { h.dispose(); }
});
test('a second Print tap cannot release the first printer selection interlock', async () => {
  const h = await setup(), selected = defer();
  try { h.printerSelection = () => selected.promise; const printing = h.model.print(); await tick();
    await h.model.print(); h.render(); assert.equal(h.model.state.printing, true);
    assert.equal(h.events.filter(e => e[0] === 'pickPrinter').length, 1); h.model.controller.startScan(); h.render(); assert.equal(h.model.state.scanning, false);
    selected.resolve(null); await printing; h.render(); assert.equal(h.model.state.printing, false);
  } finally { h.dispose(); }
});
