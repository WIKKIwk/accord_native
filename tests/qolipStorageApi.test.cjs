const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const { contractFetch, recordedSession } = require('./support/contractFetch.cjs');

function load(relative, dependencies = {}) {
  const filename = path.resolve(__dirname, '../src', relative), loaded = new Module(filename, module);
  loaded.require = name => name in dependencies ? dependencies[name] : require(name);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ESNext },
  }).outputText, filename);
  return loaded.exports;
}
const { MobileApiException } = load('shared/mobileApiException.ts');
const common = load('qolip/qolipApiCommon.ts', { '../shared/mobileApiException': { MobileApiException } });
const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } });
const mold = (overrides = {}) => ({ qolip_code: 'Q-ONE', qolip_set_id: '9501', warehouse: 'Qolip ombori',
  item_code: 'ITEM', item_name: 'Product', size: 42, quantity: 1, ...overrides });
const paddon = (overrides = {}) => ({ code: 'QP-00012', warehouse: 'Qolip ombori', locked: true,
  archived: false, revision: 4, item_count: 1, ...overrides });
const detail = (overrides = {}) => ({ ok: true, paddon: paddon(overrides), items: [mold()], history: [] });
const archive = (id, kind, code, snapshot, overrides = {}) => ({ id, kind, code, warehouse: 'Qolip ombori',
  archived_at: '2026-10-29T10:00:00Z', restored_at: '2026-10-30T10:00:00Z', snapshot, ...overrides });
function harness(response, options = {}) {
  const calls = [], applied = [], session = { token: 'token', profile: { ref: 'clerk' }, baseUrl: 'https://example.test' };
  const api = load('qolip/qolipStorageApi.ts', {
    '../auth': { activeSessionToken: value => value.token || null },
    '../sessionReadScope': { sessionReadScope: value => JSON.stringify([value.baseUrl, value.profile.ref]) },
    '../shared/mobileApiException': { MobileApiException }, './qolipApiCommon': common,
    '../shared/qolipCatalogRuntime': { qolipCatalogRuntimeFor: () => ({ applyResponse: (data, scope) => applied.push({ data, scope }) }) },
    '../authorizedFetch': { authorizedFetch: async (value, target, init = {}, guard) => {
      guard?.();
      calls.push({ session: value, target, init });
      const result = typeof response === 'function' ? response(calls.length, target, init) : response;
      options.afterResponse?.(session);
      return result;
    } },
  });
  return { api, calls, applied, session };
}

function fixtureHarness(stem, name, options = {}) {
  const replay = contractFetch(stem, name), recorded = recordedSession(stem, name), applied = [];
  const session = { ...recorded, profile: { ref: 'clerk' } };
  const api = load('qolip/qolipStorageApi.ts', {
    '../auth': { activeSessionToken: value => value.token || null },
    '../sessionReadScope': { sessionReadScope: value => JSON.stringify([value.baseUrl, value.profile.ref]) },
    '../shared/mobileApiException': { MobileApiException }, './qolipApiCommon': common,
    '../shared/qolipCatalogRuntime': { qolipCatalogRuntimeFor: () => ({ applyResponse: (data, scope) => applied.push({ data, scope }) }) },
    '../authorizedFetch': { authorizedFetch: async (value, target, init = {}, guard) => {
      guard?.();
      const headers = new Headers(init.headers);
      headers.set('Authorization', `Bearer ${value.token}`);
      const response = await replay(new URL(target, value.baseUrl), { ...init, headers });
      options.afterResponse?.(session);
      return response;
    } },
  });
  return { api, replay, session, applied };
}

test('Dart query encoding retains empty fields and RFC 3986 unreserved characters', () => {
  assert.equal(common.dartQuery({ q: "A~!*()' +", empty: '' }), 'q=A~%21%2A%28%29%27+%2B&empty');
});

test('pallet, mold and archive models retain strict V2 validations and defaults', () => {
  const { api } = harness(json({}));
  assert.deepEqual(api.qolipPaddonFromJson(paddon()), { code: 'QP-00012', warehouse: 'Qolip ombori', location: '',
    note: '', archive_entry_id: null, locked: true, archived: false, revision: 4, total_quantity: 1, item_count: 1, editable: false });
  assert.equal(api.qolipPaddonFromJson(paddon({ locked: false })).editable, true);
  for (const bad of [paddon({ code: '' }), paddon({ revision: -1 }), paddon({ item_count: -1 }), paddon({ locked: 'yes' })]) {
    assert.throws(() => api.qolipPaddonFromJson(bad));
  }
  assert.equal(api.qolipStorageMoldFromJson(mold({ products: [{ name: 'A' }, { name: 'B' }] })).product_names, 'A, B');
  assert.throws(() => api.qolipStorageMoldFromJson(mold({ qolip_code: ' ' })));
  assert.throws(() => api.qolipArchiveEntryFromJson(archive('', 'qolip', 'Q', {})));
  assert.throws(() => api.qolipArchiveEntryFromJson(archive('id', 'paddon_mold', 'Q', {})));
});

test('physical molds are unavailable while archived, held, transferring or already on a pallet', () => {
  const { api } = harness(json({}));
  assert.equal(api.qolipStorageMoldFromJson(mold()).available, true);
  for (const blocked of [{ archived: true }, { is_in_use: true }, { is_in_rework: true }, { is_transferring: true },
    { is_custody_mismatch: true }, { paddon_code: 'QP-00012' }]) {
    assert.equal(api.qolipStorageMoldFromJson(mold(blocked)).available, false);
  }
});

test('typed pallet QR stays distinct from an ordinary mold code', () => {
  const { api } = harness(json({}));
  assert.equal(api.qolipPaddonCodeFromQr('qolip-paddon:QP-00012'), 'QP-00012');
  for (const value of ['QP-00012', 'qolip-paddon:Q-ONE', 'QOLIP-PADDON:QP-00012', 'qolip-paddon:QP-1234']) {
    assert.equal(api.qolipPaddonCodeFromQr(value), null);
  }
});

test('storage reads send unmodified search values, pagination and exact QR code', async () => {
  const { api, calls, session } = harness(index => index === 1
    ? json({ ok: true, paddons: [paddon()], has_more: true, next_offset: 100 })
    : json({ ok: true, molds: [mold()], has_more: false }));
  const page = await api.qolipPaddons(session, { archived: true, query: ' Q ', offset: 2 });
  assert.equal(page.next_offset, 100);
  let url = new URL(calls[0].target, session.baseUrl);
  assert.deepEqual(Object.fromEntries(url.searchParams), { archived: 'true', q: ' Q ', limit: '100', offset: '2' });
  assert.equal((await api.qolipStorageMolds(session, { code: 'Q-ONE' })).items[0].code, 'Q-ONE');
  assert.equal(calls[1].target, '/v1/mobile/qolip/paddons/molds?code=Q-ONE&q&limit=100&offset=0');
  url = new URL(calls[1].target, session.baseUrl);
  assert.deepEqual(Object.fromEntries(url.searchParams), { code: 'Q-ONE', q: '', limit: '100', offset: '0' });
});

test('pallet action sends V2 content type and stable body, updates catalog before model parsing', async () => {
  const { api, calls, applied, session } = harness(json(detail({ revision: 5 })));
  const body = { action: 'restore', code: 'QP-00012', expected_revision: 4, request_id: 'stable-retry' };
  assert.equal((await api.qolipPaddonAction(session, body)).paddon.revision, 5);
  assert.equal(calls[0].target, '/v1/mobile/qolip/paddons/action');
  assert.equal(new Headers(calls[0].init.headers).get('content-type'), 'text/plain; charset=utf-8');
  assert.deepEqual(JSON.parse(calls[0].init.body), body);
  assert.equal(applied.length, 1);
  const malformed = harness(json({ ok: true, paddon: { code: 'QP-00012' } }));
  await assert.rejects(malformed.api.qolipPaddonAction(malformed.session, body));
  assert.equal(malformed.applied.length, 1);
});

test('account changes reject a late read and do not apply a stale catalog update', async () => {
  const { api, session, applied } = harness(json(detail()), { afterResponse: value => { value.profile.ref = 'other'; } });
  await assert.rejects(api.qolipPaddonDetail(session, 'QP-00012'), error => error.code === 'session_scope_changed');
  assert.equal(applied.length, 0);
});

test('set selection walks pages, deduplicates by code and rejects unavailable members', async () => {
  const { api, calls, session } = harness((_, target) => {
    const first = new URL(target, session.baseUrl).searchParams.get('offset') === '0';
    return json({ ok: true, molds: first ? [mold()] : [mold(), mold({ qolip_code: 'Q-TWO' })],
      has_more: first, next_offset: 100 });
  });
  assert.deepEqual((await api.qolipStorageSet(session, '9501')).map(value => value.code), ['Q-ONE', 'Q-TWO']);
  assert.equal(calls.length, 2);
  const blocked = harness((_, target) => {
    const first = new URL(target, 'https://example.test').searchParams.get('offset') === '0';
    return json({ ok: true, molds: [first ? mold() : mold({ qolip_code: 'Q-TWO', is_in_use: true })],
      has_more: first, next_offset: 100 });
  });
  await assert.rejects(blocked.api.qolipStorageSet(blocked.session, '9501', 'Qolip ombori'), error =>
    error.code === 'qolip_set_unavailable' && error.details[0] === 'Q-TWO');
});

test('archive calendar dates retain the local date and delete checks returned identity', async () => {
  const { api, calls, session } = harness(index => index === 1 ? json({ ok: true, entries: [], has_more: false })
    : json({ ok: true, deleted: true, code: 'QP-00012' }));
  await api.qolipArchive(session, { warehouse: 'Qolip ombori', from: new Date(2026, 9, 1), to: new Date(2026, 9, 28), status: 'all' });
  const query = new URL(calls[0].target, session.baseUrl).searchParams;
  assert.equal(query.get('from'), '2026-10-01');
  assert.equal(query.get('to'), '2026-10-28');
  assert.equal(query.get('warehouse'), 'Qolip ombori');
  await api.qolipDeletePaddon(session, { code: 'QP-00012' });
  const mismatch = harness(json({ ok: true, deleted: true, code: 'OTHER' }));
  await assert.rejects(mismatch.api.qolipDeletePaddon(mismatch.session, { code: 'QP-00012' }), /Invalid pallet deletion response/);
});

// @v2-test test/qolip_archive_legacy_compatibility_test.dart
test('old archive server flattens, sorts and paginates pallet snapshots', async () => {
  const rawItems = Array.from({ length: 101 }, (_, index) => ({ qolip_code: `Q-${String(index).padStart(3, '0')}`,
    item_name: index === 100 ? 'Only target' : 'Product' })).reverse();
  const { api, calls, session } = harness((_, target) => {
    const params = new URL(target, 'https://example.test').searchParams;
    if (params.has('view')) return new Response('Failed to deserialize query string: view: unknown field `view`, expected one of `q`, `status`',
      { status: 400, headers: { 'content-type': 'text/plain; charset=utf-8' } });
    const later = params.get('offset') === '100';
    return json({ ok: true, entries: later ? [archive('direct', 'qolip', 'Q-DIRECT', { qolip_code: 'Q-DIRECT' })]
      : [archive('pallet-entry', 'paddon', 'QP-00001', { items: rawItems })], has_more: !later, ...(!later ? { next_offset: 100 } : {}) });
  });
  const input = { view: 'molds', status: 'all', warehouse: 'Qolip ombori', from: new Date(2026, 9, 1), to: new Date(2026, 9, 30) };
  const first = await api.qolipArchive(session, input);
  assert.equal(first.items.length, 100);
  assert.equal(first.items[0].code, 'Q-000');
  assert.equal(first.items[99].code, 'Q-099');
  assert.equal(first.next_offset, 100);
  assert.equal(first.items[0].parent_paddon_code, 'QP-00001');
  const second = await api.qolipArchive(session, { ...input, offset: 100 });
  assert.deepEqual(second.items.map(item => item.code), ['Q-100', 'Q-DIRECT']);
  assert.equal(second.next_offset, null);
  assert.deepEqual((await api.qolipArchive(session, { ...input, query: 'only target' })).items.map(item => item.code), ['Q-100']);
  assert.ok(calls.some(call => new URL(call.target, session.baseUrl).searchParams.get('offset') === '100'));
});

test('non-legacy archive errors never trigger fallback and test mode never reaches a backend', async () => {
  const failure = harness(json({ ok: false, error: 'forbidden' }, 403));
  await assert.rejects(failure.api.qolipArchive(failure.session, { view: 'molds' }), error => error.code === 'forbidden');
  assert.equal(failure.calls.length, 1);
  const deferred = harness(json({ ok: true, entries: [], has_more: false }));
  deferred.session.token = 'test-mode-token';
  await assert.rejects(deferred.api.qolipArchive(deferred.session), /test mode is not yet ported/);
  assert.equal(deferred.calls.length, 0);
});

// @v2-test test/qolip_storage_test.dart
test('f119 storage replay preserves pagination and the revisioned action', async () => {
  const stem = 'f11910bb/qolip_storage_test', name = 'API sends revision and request id and honors pagination';
  const metadata = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'contracts', `${stem}.json`), 'utf8'));
  assert.equal(metadata.baseline, 'f11910bb2c8c7081ce26770e69811b03fd0739ed');
  const { api, replay, session } = fixtureHarness(stem, name);
  const page = await api.qolipStorageMolds(session, { query: 'Q-ONE', offset: 100 });
  assert.equal(page.items[0].code, 'Q-ONE');
  assert.equal(page.next_offset, 200);
  const restored = await api.qolipPaddonAction(session, { action: 'restore', code: 'QP-00012',
    expected_revision: 4, request_id: 'stable-retry' });
  assert.equal(restored.paddon.locked, true);
  assert.equal(restored.paddon.archived, false);
  replay.assertDone();
});

test('f119 storage replays stale account, malformed mutation and local date cases', async () => {
  const stem = 'f11910bb/qolip_storage_test';
  const stale = fixtureHarness(stem, 'an account switch discards a late successful read', {
    afterResponse: value => { value.profile.ref = 'other'; },
  });
  await assert.rejects(stale.api.qolipPaddonDetail(stale.session, 'QP-00012'), error => error.code === 'session_scope_changed');
  stale.replay.assertDone();
  const invalid = fixtureHarness(stem, 'malformed successful mutation never reports a valid pallet');
  await assert.rejects(invalid.api.qolipPaddonAction(invalid.session, { action: 'lock', request_id: 'x' }));
  invalid.replay.assertDone();
  const dates = fixtureHarness(stem, 'archive filter sends calendar dates without UTC conversion');
  await dates.api.qolipArchive(dates.session, { warehouse: 'Qolip ombori', from: new Date(2026, 9, 1),
    to: new Date(2026, 9, 28), status: 'all' });
  dates.replay.assertDone();
});

test('f119 storage replays complete set selection and exact QR lookup', async () => {
  const stem = 'f11910bb/qolip_storage_test';
  const blocked = fixtureHarness(stem, 'complete set lookup includes later pages and rejects any unavailable member');
  await assert.rejects(blocked.api.qolipStorageSet(blocked.session, '9501', 'Qolip ombori'), error =>
    error.code === 'qolip_set_unavailable' && error.details[0] === 'Q-TWO');
  blocked.replay.assertDone();
  const complete = fixtureHarness(stem, 'complete set includes every distinct code across pages');
  assert.deepEqual((await complete.api.qolipStorageSet(complete.session, '9501')).map(value => value.code), ['Q-ONE', 'Q-TWO']);
  complete.replay.assertDone();
  const exact = fixtureHarness(stem, 'QR mold lookup requests exact code rather than fuzzy first page');
  assert.equal((await exact.api.qolipStorageMolds(exact.session, { code: 'Q-ONE' })).items[0].code, 'Q-ONE');
  exact.replay.assertDone();
});

test('f119 archive mutation applies its catalog reset', async () => {
  const { api, replay, session, applied } = fixtureHarness('f11910bb/qolip_storage_test', 'archive mutation resets names as well as cached mold details');
  await api.qolipPaddonAction(session, { action: 'archive', request_id: 'archive-reset' });
  assert.deepEqual(applied[0].data.catalog_delta, { reset: true });
  replay.assertDone();
});

// @v2-test test/qolip_archive_legacy_compatibility_test.dart
test('f119 legacy archive replay flattens pages and filters snapshots', async () => {
  const stem = 'f11910bb/qolip_archive_legacy_compatibility_test', name = 'old server flattens pallet snapshots across paginated archive entries';
  const metadata = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'contracts', `${stem}.json`), 'utf8'));
  assert.equal(metadata.baseline, 'f11910bb2c8c7081ce26770e69811b03fd0739ed');
  const { api, replay, session } = fixtureHarness(stem, name);
  const input = { view: 'molds', status: 'all', warehouse: 'Qolip ombori', from: new Date(2026, 9, 1), to: new Date(2026, 9, 30) };
  const first = await api.qolipArchive(session, input);
  assert.equal(first.items.length, 100);
  assert.equal(first.items[0].code, 'Q-000');
  assert.equal(first.next_offset, 100);
  assert.deepEqual((await api.qolipArchive(session, { ...input, offset: 100 })).items.map(value => value.code), ['Q-100', 'Q-DIRECT']);
  assert.deepEqual((await api.qolipArchive(session, { ...input, query: 'only target' })).items.map(value => value.code), ['Q-100']);
  replay.assertDone();
});

test('f119 archive replay never falls back for unrelated server errors', async () => {
  const { api, replay, session } = fixtureHarness('f11910bb/qolip_archive_legacy_compatibility_test', 'other errors never use the compatibility fallback');
  for (let i = 0; i < 3; i++) await assert.rejects(api.qolipArchive(session, { view: 'molds' }));
  replay.assertDone();
});
