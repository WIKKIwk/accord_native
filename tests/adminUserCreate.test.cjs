const assert = require('node:assert/strict');
const test = require('node:test');
const { model, role, settings, fixture, deferred, flush, l10n, exception } = require('./adminUserCreateSupport.cjs');
const a = (key, values) => l10n.adminText(key, 'uz', values);
test('role capabilities and supplier item codes use source strict String elements while nullable scalars and whole-list defaults stay intact', () => {
  for (const [decode, property] of [[model.adminUserCreateRoleFromJson, 'capability_codes'], [model.adminUserCreateSupplierFromJson, 'assigned_item_codes']]) {
    for (const value of [[null], [undefined], [1], ['valid', null]]) assert.throws(() => decode({ [property]: value }), TypeError);
    for (const value of [undefined, null, []]) assert.deepEqual(decode({ [property]: value })[property], []);
    assert.deepEqual(decode({ [property]: ['', ' original '] })[property], ['', ' original ']);
  }
  assert.equal(model.adminUserCreateRoleFromJson({ id: null, label: null }).id, '');
  assert.equal(model.adminUserCreateSupplierFromJson({ ref: null, name: null, phone: null, code: null }).phone, '');
});
test('role DTO strict types, source role ordering/brigader subset/fallbacks and current052 Metalayzer are preserved', () => {
  assert.throws(() => model.adminUserCreateRoleFromJson({ capability_codes: [1] })); assert.throws(() => model.adminUserCreateRoleFromJson({ system: 'true' }));
  const roles = [role('admin', 'admin'), role('customer', 'customer'), role('hidden-custom', null, ['missing'], false), role('allowed-custom', null, ['A'], false), role('material-custom', 'material_taminotchi', ['missing'], false), role('metalayzer', 'metalayzer')];
  const admin = model.adminUserCreateChoices(roles, 'admin', []); assert.deepEqual(admin.map(row => row.role?.id ?? row.kind), ['material-custom', 'hidden-custom', 'allowed-custom', 'metalayzer', 'boyoqchi', 'werka', 'customer', 'supplier', 'custom']);
  const brigader = model.adminUserCreateChoices(roles, 'brigader', ['A']); assert.deepEqual(brigader.map(row => row.role?.id ?? row.kind), ['material_taminotchi', 'allowed-custom', 'metalayzer', 'boyoqchi', 'werka', 'customer', 'supplier', 'custom']);
  assert.equal(model.adminUserCreateChoiceEnabled(brigader.at(-1)), false); assert.equal(model.adminUserCreateSystemRole(role('custom-metal', 'metalayzer')), 'metalayzer');
  assert.deepEqual(model.adminUserCreateGroups([' Kraska ', 'Kley', 'Kraska', 'kraska']), ['Kley', 'Kraska', 'kraska']);
});
test('source picker search filters label/subtitle before stable relevance ranking and preserves custom labels verbatim', () => {
  const choices = model.adminUserCreateChoices([role('specific', null, [], false)], 'admin', []), visible = model.adminUserCreateVisibleChoices(choices, ' Label ', a);
  assert.equal(visible.length, 1); assert.equal(visible[0].title, 'Label specific'); assert.equal(model.adminUserCreateChoiceSubtitle(visible[0].choice, a), a('user.custom_role_subtitle'));
  assert.equal(model.adminUserCreateVisibleChoices(choices, 'NO MATCH', a).length, 0); assert.equal(model.adminUserCreateVisibleChoices(choices, '', a).length, choices.length);
});
test('general load reads roles immediately without choosing a default; retired failure cannot install fallback choices', async () => {
  const f = fixture(); await f.start(); assert.deepEqual(f.calls, ['roles']); assert.equal(f.controller.getSnapshot().choice, null);
  const pending = deferred(), g = fixture({}, { roles: async () => pending.promise }); g.controller.start(); g.retire(); pending.reject(Error('offline')); await flush(); assert.equal(g.controller.getSnapshot().valid, false); assert.equal(g.controller.getSnapshot().choices, null);
  const h = fixture({}, { roles: async () => { throw Error('offline'); } }); await h.start(); assert.equal(h.controller.getSnapshot().choices[0].role.id, 'material_taminotchi');
});
test('customer-only skips role/settings/catalog reads, requires name, then returns real DTO without clearing the source form', async () => {
  const f = fixture({ customerOnly: true, returnCustomer: true, initialName: ' Initial ' }); await f.start(); assert.deepEqual(f.calls, []); assert.equal(f.controller.currentFields.name, ' Initial ');
  f.name(' '); await f.controller.save(f.controller.getSnapshot().formId); assert.equal(f.controller.getSnapshot().notice.key, 'user.name_required');
  f.name('\u0085 Ali \u0085'); f.phone(' +998 '); await f.controller.save(f.controller.getSnapshot().formId);
  assert.deepEqual(f.calls.map(value => Array.isArray(value) ? value[0] : value), ['customer', 'invalidate-users', 'clear-customers', 'returned']); assert.equal(f.calls[0][1], 'Ali'); assert.equal(f.calls.at(-1)[1].name, ' Returned name '); assert.equal(f.controller.currentFields.name, '\u0085 Ali \u0085');
});
test('ordinary customer clears fields only after optional role assignment and uses source returned-name success', async () => {
  const f = fixture(); f.roles.push(role('customer-custom', 'customer', [], false)); await f.start(); await f.select('customer-custom'); f.name(' Name '); const version = f.controller.getSnapshot().fillVersion;
  await f.controller.save(f.controller.getSnapshot().formId); assert.deepEqual(f.calls.slice(1).map(value => Array.isArray(value) ? value[0] : value), ['customer', 'assign', 'invalidate-users', 'clear-customers']);
  assert.equal(f.calls.find(value => value[0] === 'assign')[1].principal_role, 'customer'); assert.equal(f.controller.currentFields.name, ''); assert.equal(f.controller.getSnapshot().fillVersion, version + 1); assert.equal(f.controller.getSnapshot().notice.name, ' Returned name ');
});
test('supplier has no local name validation, invalidates after clearing and stays saving until actual issued-code dismissal', async () => {
  const f = fixture(); await f.start(); await f.select('supplier'); const saving = f.controller.save(f.controller.getSnapshot().formId); await flush();
  const state = f.controller.getSnapshot(); assert.equal(state.saving, true); assert.equal(state.issuedCode.value, 'SUP-CODE'); assert.deepEqual(f.calls.at(-2), ['supplier', '', '']); assert.equal(f.calls.at(-1), 'invalidate-users');
  f.controller.dismissCode(state.issuedCode.id); assert.equal(f.controller.getSnapshot().saving, true); f.controller.completeCode(state.issuedCode.id); await saving; assert.equal(f.controller.getSnapshot().saving, false);
});
test('Aparatchi uses real catalog selection then customer→assignment→code and only nonempty current IDs can select', async () => {
  const f = fixture(); await f.start(); await f.select('aparatchi'); const id = f.controller.getSnapshot().formId; await f.controller.save(id); assert.equal(f.controller.getSnapshot().notice.key, 'user.minimum_apparatus');
  f.controller.selectApparatus(id, '', true); f.controller.selectApparatus(id, 'invented', true); assert.deepEqual(f.controller.getSnapshot().selectedApparatus, []);
  f.controller.selectApparatus(id, 'apparatus:default:B', true); f.controller.selectApparatus(id, 'apparatus:default:A', true); f.name(' Name '); const saving = f.controller.save(id); await flush();
  assert.deepEqual(f.calls.slice(-4).map(value => Array.isArray(value) ? value[0] : value), ['customer', 'assign', 'customer-regenerate', 'invalidate-users']); const assignment = f.calls.find(value => value[0] === 'assign')[1];
  assert.deepEqual(assignment, { principal_role: 'aparatchi', principal_ref: 'Customer Ref', role_id: 'aparatchi', assigned_apparatus: ['apparatus:default:A', 'apparatus:default:B'], assigned_item_groups: [] }); f.finishCode(); await saving;
});
test('material normalizes case-sensitive groups, cancel preserves selection and confirm commits only after native dismissal', async () => {
  const f = fixture(); await f.start(); await f.select('material_taminotchi'); const id = f.controller.getSnapshot().formId; assert.deepEqual(f.controller.getSnapshot().groups, ['Kley', 'Kraska']);
  await f.controller.openGroups(id, () => true); let picker = f.controller.getSnapshot().picker; f.controller.toggleGroup(picker.id, 'Kraska', true); f.controller.dismissPicker(picker.id); f.controller.completePicker(picker.id); assert.deepEqual(f.controller.getSnapshot().selectedGroups, []);
  await f.controller.openGroups(id, () => true); picker = f.controller.getSnapshot().picker; f.controller.toggleGroup(picker.id, 'Kraska', true); f.controller.toggleGroup(picker.id, 'Kley', true); f.controller.confirmGroups(picker.id); assert.deepEqual(f.controller.getSnapshot().selectedGroups, []);
  f.controller.completePicker(picker.id); assert.deepEqual(f.controller.getSnapshot().selectedGroups, ['Kley', 'Kraska']); const save = f.controller.save(id); await flush(); assert.deepEqual(f.calls.find(value => value[0] === 'material').slice(1), ['', '', ['Kley', 'Kraska']]);
  assert.equal(f.calls.some(value => Array.isArray(value) && ['customer', 'assign', 'customer-regenerate'].includes(value[0])), false); f.finishCode(); await save;
});
test('system creation, regeneration and custom preparation assignment occur in source order, including052 Metalayzer', async () => {
  for (const [roleId, base, system] of [['qolipchi', 'qolipchi', true], ['boyoqchi', 'boyoqchi', true], ['prep-custom', 'tayyorlov_masteri', false], ['metal', 'metalayzer', false]]) {
    const f = fixture(); if (!f.roles.some(value => value.id === roleId)) f.roles.push(role(roleId, base, [], system)); await f.start(); await f.select(roleId); const save = f.controller.save(f.controller.getSnapshot().formId); await flush();
    const operations = f.calls.filter(Array.isArray).map(value => value[0]); assert.deepEqual(operations, ['system', 'system-regenerate', ...(roleId === 'prep-custom' ? ['assign'] : [])]); assert.equal(f.calls.find(value => value[0] === 'system')[1], base); f.finishCode(); await save;
  }
});
test('same Flutter form type retains drafts and initial-only catalog reads, while a different family retires the original form', async () => {
  const f = fixture(); await f.start(); await f.select('item_creator'); f.name('Draft'); const id = f.controller.getSnapshot().formId; await f.select('item_other'); assert.equal(f.controller.getSnapshot().formId, id); assert.equal(f.controller.currentFields.name, 'Draft');
  await f.select('aparatchi'); assert.equal(f.calls.includes('apparatus'), false, 'same CustomRole State does not rerun initState'); await f.select('customer'); assert.notEqual(f.controller.getSnapshot().formId, id); assert.equal(f.controller.currentFields.name, '');
  await f.select('aparatchi'); assert.equal(f.calls.includes('apparatus'), true); f.controller.change(id, 'name', 'stale'); assert.equal(f.controller.currentFields.name, '');
});
test('same-family role changes during customer creation use source current assignedRole after acknowledgement', async () => {
  const pending = deferred(), f = fixture({}, { customer: async () => pending.promise }); await f.start(); await f.select('item_creator'); const save = f.controller.save(f.controller.getSnapshot().formId); await f.select('item_other');
  pending.resolve({ ref: 'New', name: 'Name', phone: '' }); await save; assert.equal(f.calls.find(value => value[0] === 'assign')[1].role_id, 'item_other');
  assert.equal(f.calls.includes('clear-customers'), false, 'the custom-role customer backend path does not clear the source M3 customer cache');
});
test('form/account retirement after creation blocks subsequent assignment, credential regeneration and success', async () => {
  for (const retire of ['form', 'account']) {
    const pending = deferred(), f = fixture({}, { customer: async () => pending.promise }); await f.start(); await f.select('item_creator'); const save = f.controller.save(f.controller.getSnapshot().formId);
    if (retire === 'form') await f.select('customer'); else f.retire(); pending.resolve({ ref: 'created', name: 'created', phone: '' }); await save;
    assert.equal(f.calls.some(value => Array.isArray(value) && value[0] === 'assign'), false); assert.equal(f.calls.includes('invalidate-users'), false); assert.equal(f.controller.getSnapshot().notice, null);
  }
});
test('failed partial custom assignment keeps fields and exposes backend message without rollback or success', async () => {
  const error = new exception.MobileApiException({ code: 'forbidden', message: ' forbidden ' }), f = fixture({}, { assign: async () => { throw error; } }); await f.start(); await f.select('item_creator'); f.name('Draft'); await f.controller.save(f.controller.getSnapshot().formId);
  assert.equal(f.controller.currentFields.name, 'Draft'); assert.equal(f.controller.getSnapshot().notice.error, error); assert.equal(model.adminUserCreateError(error, a), 'forbidden'); assert.equal(f.calls.includes('invalidate-users'), false); assert.equal(f.controller.getSnapshot().issuedCode, null);
  assert.equal(model.adminUserCreateCustomerError(new exception.MobileApiException({ code: 'invalid phone', message: 'backend' }), 'Draft', a), `${a('user.customer_create_failed', { name: 'Draft' })}\n${a('user.phone_invalid')}`);
});
test('Werka hydration/save/regenerate preserve hidden snapshot fields, independent operations and last code acknowledgement', async () => {
  const saved = deferred(), regenerated = deferred(), f = fixture({}, { updateSettings: async (value, guard) => { guard(); f.calls.push(['settings-update', value]); return saved.promise; }, regenerateWerka: async () => regenerated.promise }); await f.start(); await f.select('werka');
  assert.equal(f.controller.currentFields.name, ' Original '); f.name(' Draft '); f.phone(' Phone '); const id = f.controller.getSnapshot().formId, save = f.controller.save(id), regen = f.controller.regenerate(id);
  assert.equal(f.controller.getSnapshot().saving, true); assert.equal(f.controller.getSnapshot().regenerating, true); f.name('New typing'); regenerated.resolve(settings({ werka_code: 'regen', werka_code_retry_after_sec: 3 })); await regen;
  saved.resolve(settings({ werka_code: 'late-save', werka_code_retry_after_sec: 99 })); await save; assert.equal(f.controller.getSnapshot().code, 'late-save'); assert.equal(f.controller.getSnapshot().seconds, 3); assert.equal(f.controller.currentFields.name, 'New typing');
  const payload = f.calls.find(value => value[0] === 'settings-update')[1]; assert.deepEqual(payload, settings({ werka_name: 'Draft', werka_phone: 'Phone', werka_code: '' })); f.tick(); f.tick(); f.tick(); assert.equal(f.timers.size, 0);
});
test('Werka retry state, countdown blocking, code copy and load failure contain only their source notices', async () => {
  let failed = true; const f = fixture({}, { settings: async () => { if (failed) throw Error('offline'); return settings({ werka_code_retry_after_sec: 2 }); } }); await f.start(); await f.select('werka'); assert.equal(f.controller.getSnapshot().phase, 'error');
  failed = false; await f.controller.reloadWerka(f.controller.getSnapshot().formId); await f.controller.regenerate(f.controller.getSnapshot().formId); assert.equal(f.calls.includes('werka-regenerate'), false);
  await f.controller.copyCode(); assert.deepEqual(f.calls.at(-1), ['copy', ' original code ']); assert.equal(f.controller.getSnapshot().notice.key, 'user.code_copied'); f.tick(); f.tick(); await f.controller.regenerate(f.controller.getSnapshot().formId); assert.equal(f.controller.getSnapshot().code, 'regenerated'); f.controller.dispose(); assert.equal(f.timers.size, 0);
});
test('issued code copy does not close or add notice, old native callbacks and StrictMode lifetimes cannot affect replacement forms', async () => {
  const f = fixture(); await f.start(); await f.select('supplier'); const oldId = f.controller.getSnapshot().formId, save = f.controller.save(oldId); await flush(); const dialog = f.controller.getSnapshot().issuedCode, notice = f.controller.getSnapshot().notice;
  await f.controller.copyCode(dialog.id); assert.equal(f.controller.getSnapshot().issuedCode.id, dialog.id); assert.equal(f.controller.getSnapshot().notice, notice); f.controller.dispose(); f.controller.start(); await save; await flush(); assert.equal(f.controller.getSnapshot().choice, null);
  f.controller.completeCode(dialog.id); f.controller.change(oldId, 'name', 'old'); assert.equal(f.controller.currentFields.name, ''); await f.select('supplier'); assert.ok(f.controller.getSnapshot().formId > oldId); f.controller.dispose();
});
test('accepted picker reads open immediately after blur as source mounted-only root presentation requires', async () => {
  const pending = deferred(), f = fixture({}, { roles: async () => pending.promise }); let focused = true; f.controller.start(); const open = f.controller.openRoles(() => focused); focused = false; pending.resolve([]); await open; assert.ok(f.controller.getSnapshot().picker); assert.ok(f.controller.getSnapshot().choices.length);
  const picker = f.controller.getSnapshot().picker, disabled = f.controller.getSnapshot().choices.at(-1); f.controller.chooseRole(picker.id, disabled); assert.equal(f.controller.getSnapshot().picker.closing, false); f.controller.dismissPicker(picker.id); f.controller.completePicker(picker.id); assert.equal(f.controller.getSnapshot().choice, null);
});
