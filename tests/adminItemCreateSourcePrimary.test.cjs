const assert = require('node:assert/strict'), test = require('node:test');
const s = require('./adminSourceSceneScaffoldSupport.cjs'), items = require('./adminItemCreateSessionSupport.cjs');
const { nodes } = require('./adminItemDetailViewsSupport.cjs'), { expand } = require('./adminSupplierDetailViewSupport.cjs');
async function start(f) { f.render(); await s.flush(); f.renderDirty(); f.root.rootReady(); f.renderDirty(); return f.hub().primary().ticket; }
async function measure(f) { f.sourceOwner().bindViewport({ tag: 31, nativeID: f.sourceOwner().viewportID }); await s.flush(); f.renderDirty(); const target = f.sourceOwner().getSnapshot().target; f.sourceOwner().bindDock({ tag: 32, nativeID: target.nativeID }, target); await s.flush(); f.renderDirty(); }
const nativeID = node => node.props.modifiers?.find(value => value.name === 'testID' || value.name === 'accessibilityIdentifier')?.args[0];
for (const platform of ['android', 'ios']) {
  test(`${platform} actual page Primary owns ONE real global registration transported into its original outer SourceDock without callback/default registration`, async t => {
    const f = s.nativeFixture(platform, { controlledPrimaryPlacement: true }); t.after(f.cleanup); assert.equal(f.props.renderPrimaryAction, undefined); const ticket = await start(f);
    assert.equal(f.counts.register, 1); assert.equal(f.sourceOwner().getSnapshot().target, null); assert.equal(f.model().current(), true); await measure(f);
    assert.equal(f.sourceOwner().getSnapshot().target.primary.ticket, ticket); assert.equal(f.sourceOwner().hubRequest().ticket, ticket); assert.equal(f.counts.register, 1);
    assert.equal(f.hub().open(ticket), false); f.acknowledgePrimaryPlacement(); f.render();
    assert.equal(f.hub().open(ticket), true); const overlay = f.hub().getSnapshot().overlay; assert.equal(overlay.mode, 'custom'); assert.equal(overlay.actions.length, 1); assert.equal(overlay.actions[0].label, f.model().a('item.add_title')); assert.equal(overlay.actions[0].icon.android, 'inventory_2');
  });
  test(`${platform} same original Primary ticket carries real Add→Move counts/prompt/spinner→clear without render loops or fabricated native geometry`, async t => {
    const rows = [items.item('A'), items.item('B')], pending = s.deferred();
    const f = s.nativeFixture(platform, { controlledPrimaryPlacement: true, catalog: { adminCatalogItemsPage: async () => rows, moveAdminCatalogItems: async () => pending.promise } }); t.after(f.cleanup); const ticket = await start(f); await measure(f); f.acknowledgePrimaryPlacement(); f.render();
    const originalTarget = f.sourceOwner().getSnapshot().target, owner = f.model().owner; f.model().toggleItem(rows[0]); f.renderDirty();
    let target = f.sourceOwner().getSnapshot().target, replacement = target.primary.replacementValue; assert.equal(target.primary.ticket, ticket); assert.equal(target.identity, originalTarget.identity); assert.equal(target.primary.replacement, true);
    const first = expand(replacement), button = nodes(first, value => nativeID(value) === 'admin-items-move-fab')[0]; assert.ok(button); assert.ok(nodes(first, value => value.type === 'Text').some(value => value.props.children === `${f.model().a('bulk_move.action')} (1)`));
    const hubState = f.hub().getSnapshot(); f.render(); f.render(); assert.equal(f.hub().getSnapshot(), hubState); assert.equal(f.sourceOwner().getSnapshot().target.primary.replacementValue, replacement);
    f.model().toggleItem(rows[1]); f.renderDirty(); target = f.sourceOwner().getSnapshot().target; assert.equal(target.primary.ticket, ticket); assert.equal(target.identity, originalTarget.identity); assert.notEqual(target.primary.replacementValue, replacement);
    f.model().owner.controller.list.changeGroup('Target'); await s.flush(); f.renderDirty(); replacement = f.sourceOwner().getSnapshot().target.primary.replacementValue;
    const beforeMove = nodes(expand(replacement), value => nativeID(value) === 'admin-items-move-fab')[0]; (beforeMove.props.onClick ?? beforeMove.props.onPress)(); f.renderDirty(); assert.equal(f.model().state.list.moving, true); assert.equal(f.model().state.list.submittingMove, false);
    const commit = f.model().chooseMove(true); assert.equal(typeof commit, 'function');
    // Controlled original prompt completion edge: the production native overlay must invoke this only after its real removal receipt.
    const committing = commit(); f.renderDirty(); assert.equal(f.model().state.list.submittingMove, true); target = f.sourceOwner().getSnapshot().target; assert.equal(target.primary.ticket, ticket);
    const spinner = expand(target.primary.replacementValue); assert.equal(nodes(spinner, value => value.type === (platform === 'android' ? 'CircularProgressIndicator' : 'ProgressView')).length, 1);
    pending.resolve({ updated_count: 2, failed_count: 0, updated_item_codes: ['A', 'B'] }); await committing; await s.flush(); f.renderDirty(); assert.equal(f.model().state.list.selectedCodes.length, 0); assert.equal(f.hub().primaryFor(ticket).replacement, false); assert.equal(f.model().owner, owner); assert.equal(f.counts.register, 1);
  });
  test(`${platform} accepted genuine custom Add opens original dialog after actual page blur while new commands reject`, async t => {
    const f = s.nativeFixture(platform, { controlledPrimaryPlacement: true }); t.after(f.cleanup); const ticket = await start(f); await measure(f); f.acknowledgePrimaryPlacement(); f.render(); assert.equal(f.hub().open(ticket), true); const overlay = f.hub().getSnapshot().overlay;
    f.root.open(); f.commitFrame(); f.renderDirty(); assert.equal(f.hub().primary(), null); assert.equal(f.hub().primaryFor(ticket).ticket, ticket); assert.equal(f.hub().open(ticket), false);
    assert.equal(f.hub().select(overlay.id, overlay.generation, overlay.actions[0].id), true); f.runFrames(); f.renderDirty(); assert.ok(f.model().state.form.dialog); assert.equal(f.model().nativeCurrent(), false); assert.equal(f.counts.register, 1);
  });
  test(`${platform} actual parent-first full replay revokes original transport and acquires one fresh committed page ticket`, async t => {
    const f = s.nativeFixture(platform); t.after(f.cleanup); const old = await start(f); await measure(f); const oldModel = f.model();
    f.replay(); f.renderDirty(); await s.flush(); f.renderDirty(); const fresh = f.hub().primary().ticket; assert.notEqual(fresh, old); assert.equal(f.hub().primaryFor(old), null); assert.equal(f.hub().open(old), false); assert.equal(oldModel.current(), false); assert.equal(f.model().current(), true);
    await measure(f); assert.equal(f.sourceOwner().getSnapshot().target.primary.ticket, fresh); assert.equal(f.counts.create, 1);
  });
  test(`${platform} real locale/geometry updates keep SAME ticket while missing host and queued stale Move events reject new intent`, async t => {
    const rows = [items.item('A')], f = s.nativeFixture(platform, { controlledPrimaryPlacement: true, catalog: { adminCatalogItemsPage: async () => rows } }); t.after(f.cleanup);
    const ticket = await start(f); await measure(f); f.model().toggleItem(rows[0]); f.renderDirty(); let target = f.sourceOwner().getSnapshot().target; const identity = target.identity;
    const held = expand(target.primary.replacementValue), heldButton = nodes(held, value => nativeID(value) === 'admin-items-move-fab')[0]; (heldButton.props.onClick ?? heldButton.props.onPress)(); assert.equal(f.model().owner.controller.list.getSnapshot().prompt, null); assert.equal(f.hub().open(ticket), false);
    f.acknowledgePrimaryPlacement(); f.render(); const button = nodes(f.tree(), value => nativeID(value) === 'admin-items-move-fab')[0]; assert.ok(button); assert.equal(nodes(f.tree(), value => nativeID(value) === 'admin-items-move-fab').length, 1);
    const scene = nodes(f.tree(), value => value.props.testID === 'admin-source-scaffold-scene')[0]; assert.equal(nodes(scene, value => nativeID(value) === 'admin-items-move-fab').length, 0);
    f.locale('ru'); f.renderDirty(); target = f.sourceOwner().getSnapshot().target; assert.equal(target.primary.ticket, ticket); assert.equal(target.identity, identity); assert.ok(nodes(f.tree(), value => value.type === 'Text').some(value => value.props.children === `${f.model().a('bulk_move.action')} (1)`));
    const model = f.model(), viewport = f.native.calls.find(value => value.kind === 'viewport').result.initial; f.native.emit({ ...viewport, revision: 4, frame: 8, viewport: null }); f.renderDirty();
    assert.equal(f.hub().primaryFor(ticket).ticket, ticket); assert.equal(f.model().owner, model.owner); assert.equal(f.model().current(), true); assert.equal(f.counts.register, 1); (button.props.onClick ?? button.props.onPress)(); assert.equal(f.model().owner.controller.list.getSnapshot().prompt, null);
    f.props.isCurrent = () => true; f.render(); assert.equal(model.current(), false); assert.equal(f.hub().primaryFor(ticket), null); (button.props.onClick ?? button.props.onPress)(); assert.equal(model.owner.controller.list.getSnapshot().prompt, null);
  });
  test(`${platform} replacing genuine domain arguments mounts a fresh real Primary instead of retargeting original handlers`, async t => {
    const f = s.nativeFixture(platform); t.after(f.cleanup); const ticket = await start(f), old = f.model(); f.props.onOpenItem = async () => {}; f.render(); await s.flush(); f.renderDirty();
    assert.notEqual(f.model().owner, old.owner); assert.equal(old.current(), false); assert.equal(f.hub().primaryFor(ticket), null); assert.notEqual(f.hub().primary().ticket, ticket); assert.equal(f.counts.register, 2);
  });
}
