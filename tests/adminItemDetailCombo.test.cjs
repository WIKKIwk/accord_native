const assert = require('node:assert/strict');
const test = require('node:test');
const s = require('./adminItemDetailComboSupport.cjs');
test('catalog uses exact raw item_code GET, original witness, canonical combo/template/product DTOs and source identity validation', async () => {
  const calls = [], guard = () => {}, witness = () => true, session = { capabilities: [] };
  const value = { combo: { item_code: ' Raw ~* ', revision: 2.8 }, template: { products: [null, { item_code: 'Child', frame_count: 2.9 }], image_id: ' image ', combo: { item_code: 'wrong' } } };
  const api = s.api({ authorizedFetch: async (...args) => { calls.push(args); return { status: 200, json: async () => value }; } });
  const result = await api.adminItemDetailCombo(session, ' Raw ~* ', guard, witness); assert.equal(calls[0][1], '/v1/mobile/admin/combos?item_code=+Raw+~%2A+'); assert.equal(calls[0][5].readWitness, witness);
  assert.equal(result.combo.item_code, ' Raw ~* '); assert.equal(result.combo.revision, 2); assert.equal(result.template.combo, result.combo); assert.equal(result.template.image_id, 'image');
  assert.equal(result.template.products.length, 1); assert.equal(result.template.products[0].frame_count, 2);
  for (const payload of [null, [], {}, { combo: { item_code: 'Other' }, template: {} }, { combo: { item_code: 'Code' }, template: [] }]) {
    const invalid = s.api({ authorizedFetch: async () => ({ status: 200, json: async () => payload }) }); await assert.rejects(invalid.adminItemDetailCombo(session, 'Code', guard, witness), TypeError);
  }
});
test('catalog capability matches all three source grants without aliasing other role flags', () => {
  const api = s.api({}); for (const capability of ['admin.access', 'production.map.manage', 'qolip.manage']) assert.equal(api.canReadAdminItemDetailCombo({ capabilities: [capability] }), true);
  assert.equal(api.canReadAdminItemDetailCombo({ capabilities: ['worker.access', 'admin.Access'] }), false);
});
test('catalog error and response/model retirement retain original owner over source API errors', async () => {
  const session = {}, witness = () => true; let current = true, handler = async () => ({ status: 403, json: async () => ({ error: 'forbidden' }) }); const guard = () => { if (!current) throw Error('retired'); };
  const api = s.api({ authorizedFetch: (...args) => handler(...args) }); await assert.rejects(api.adminItemDetailCombo(session, 'C', guard, witness), error => error instanceof s.exception.MobileApiException && error.code === 'forbidden' && error.statusCode === 403);
  for (const when of ['response', 'body', 'model', 'error-body']) {
    current = true; handler = async () => { if (when === 'response') current = false; return { status: when === 'error-body' ? 500 : 200, json: async () => {
      if (when === 'body' || when === 'error-body') current = false;
      return { combo: when === 'model' ? { get item_code() { current = false; return 'C'; } } : { item_code: 'C' }, template: {} };
    } }; }; await assert.rejects(api.adminItemDetailCombo(session, 'C', guard, witness), /retired/);
  }
  const diagnostic = s.api({ authorizedFetch: async () => ({ status: 409, headers: new Headers({ 'x-request-id': 'request' }), json: async () => ({ error: 'order_delete_blocked', apparatus_options: [' A '], blockers: [{ message: ' blocker ' }], active_kadr_count: 4, scanned_kadr_count: 3, order_title: ' Order ' }) }) });
  await assert.rejects(diagnostic.adminItemDetailCombo({}, 'Code', () => {}, () => true), error => error instanceof s.exception.MobileApiException && error.requestId === 'request' &&
    error.activeKadrCount === 4 && error.scannedKadrCount === 3 && error.orderTitle === 'Order' && error.apparatusOptions[0] === 'A' && error.details[0] === 'blocker');
});
test('product lookup trims its code, excludes include_image, resolves only actual non-SKU names and suppresses ordinary failures', async () => {
  const calls = [], guard = () => {}, witness = () => true; let name = ' Name ', status = 200;
  const api = s.api({ authorizedFetch: async (...args) => { calls.push(args); return { status, json: async () => ({ name }) }; } });
  assert.equal(await api.adminItemDetailComboProductName({}, ' SKU\u0085 ', guard, witness), 'Name'); assert.equal(calls[0][1], '/v1/mobile/admin/items/detail?code=SKU'); assert.equal(calls[0][5].readWitness, witness);
  name = ' sKu '; assert.equal(await api.adminItemDetailComboProductName({}, 'SKU', guard, witness), null); name = ' '; assert.equal(await api.adminItemDetailComboProductName({}, 'SKU', guard, witness), null);
  status = 500; assert.equal(await api.adminItemDetailComboProductName({}, 'SKU', guard, witness), null); const count = calls.length; assert.equal(await api.adminItemDetailComboProductName({}, ' ', guard, witness), null); assert.equal(calls.length, count);
  let current = true; const scoped = s.api({ authorizedFetch: async () => ({ status: 200, json: async () => { current = false; return { name: 'Private' }; } }) });
  await assert.rejects(scoped.adminItemDetailComboProductName({}, 'SKU', () => { if (!current) throw Error('expired'); }, () => current), /expired/);
});
test('source image/name/size presentation preserves ID priority, disabled known-name fallback and raw dimension text', () => {
  const entry = s.entry(); entry.template.image_id = ' image ~*\u0085 '; entry.template.image_url = 'https://ignored.example'; assert.equal(s.presentation.adminItemDetailComboImageUrl(entry), '/v1/mobile/calculate/orders/image/view?id=image+~%2A');
  entry.template.image_id = ''; entry.template.image_url = ' https://real.example/photo '; assert.equal(s.presentation.adminItemDetailComboImageUrl(entry), 'https://real.example/photo');
  assert.equal(s.presentation.adminItemDetailComboImageUrl(null), ''); assert.equal(s.presentation.adminItemDetailComboKnownName(s.product('SKU', ' sku ')), null); assert.equal(s.presentation.adminItemDetailComboKnownName(s.product('SKU', ' Name ')), 'Name');
  assert.equal(s.presentation.adminItemDetailComboSize(s.product()), '12.25 mm × 3'); assert.equal(s.presentation.adminItemDetailComboSize(s.product('S', '', { frame_product_size_mm: -0 })), '-0 mm × 3');
});
test('catalog unavailable remains a disabled source retry state; retry supersedes old pending response and StrictMode retains subscribers', async () => {
  let allowed = false, calls = 0, pending = s.deferred(); const owner = new s.controllers.AdminItemDetailComboController(' Raw ', { isCurrent: () => true, canRead: () => allowed, read: async (code, guard, witness) => { assert.equal(code, ' Raw '); guard(); assert.equal(witness(), true); return ++calls === 1 ? pending.promise : s.entry(' Raw '); } });
  let notifications = 0; owner.subscribe(() => { notifications++; }); owner.start(); assert.equal(owner.getSnapshot().phase, 'unavailable'); assert.equal(calls, 0);
  allowed = true; const old = owner.reload(); await owner.reload(); pending.resolve(s.entry('Old')); await old; assert.equal(owner.getSnapshot().entry.combo.item_code, ' Raw ');
  owner.dispose(); owner.start(); await s.flush(); assert.equal(calls, 3); assert.equal(owner.getSnapshot().phase, 'content'); assert.ok(notifications >= 6);
});
test('catalog new denial supersedes its earlier read and reentrant retirement prevents dispatch', async () => {
  const pending = s.deferred(); let allowed = true; const owner = new s.controllers.AdminItemDetailComboController('Code', { isCurrent: () => true, canRead: () => allowed, read: () => pending.promise });
  owner.start(); allowed = false; await owner.reload(); pending.resolve(s.entry()); await s.flush(); assert.equal(owner.getSnapshot().phase, 'unavailable'); assert.equal(owner.getSnapshot().entry, null);
  let calls = 0; const retired = new s.controllers.AdminItemDetailComboController('Code', { isCurrent: () => true, canRead: () => true, read: async () => { calls++; return s.entry(); } });
  retired.subscribe(() => { if (retired.getSnapshot().phase === 'loading') retired.invalidate(); }); retired.start(); await s.flush(); assert.equal(calls, 0); assert.equal(retired.getSnapshot().phase, 'invalidated');
});
test('actual product rows load separately only for missing/equal-SKU labels and fence original row cleanup', async () => {
  let calls = 0; const pending = s.deferred(), read = async (code, guard, witness) => { calls++; assert.equal(code, 'SKU'); guard(); assert.equal(witness(), true); return pending.promise; };
  for (const product of [s.product('SKU', 'Known'), s.product('', '')]) { const owner = new s.controllers.AdminItemDetailComboProductNameController(product, { isCurrent: () => true, read }); owner.start(); }
  assert.equal(calls, 0); const a = new s.controllers.AdminItemDetailComboProductNameController(s.product(' SKU ', ' sku '), { isCurrent: () => true, read }), b = new s.controllers.AdminItemDetailComboProductNameController(s.product(), { isCurrent: () => true, read });
  a.start(); b.start(); assert.equal(calls, 2); a.dispose(); pending.resolve('Resolved'); await s.flush(); assert.equal(a.getSnapshot().name, null); assert.equal(b.getSnapshot().name, 'Resolved');
  a.start(); await s.flush(); assert.equal(a.getSnapshot().name, 'Resolved');
});
