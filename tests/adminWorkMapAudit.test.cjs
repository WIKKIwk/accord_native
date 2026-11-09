const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const textInventory = require('./contracts/f11910bb/admin_work_map_audit_text.json');
const jsx = { Fragment: 'Fragment', jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
function load(file, mocks = {}) {
  const filename = path.resolve(__dirname, '../src', file), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths;
  mod.require = id => id === 'react/jsx-runtime' ? jsx : Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { fileName: filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText, filename);
  return mod.exports;
}
const dart = load('admin/dartJsonString.ts');
const audit = load('admin/adminWorkMapAuditModel.ts', { './dartJsonString': dart });
const { AdminWorkMapController: Controller } = load('admin/adminWorkMapController.ts', { './dartJsonString': dart, './adminWorkMapAuditModel': audit, './adminWorkMapClosedModel': load('admin/adminWorkMapClosedModel.ts', { './dartJsonString': dart }) });
const localize = { adminText: (key, _locale, values) => values ? `${key}:${values.value}` : key,
  uiText: (value, locale) => locale === 'probe' ? `ui:${value}` : value };
const present = load('admin/adminWorkMapAuditPresentation.ts', { '../shared/localization': localize, './adminWorkMapAuditModel': audit }).adminWorkMapAuditPresentation;
const tick = () => new Promise(resolve => setImmediate(resolve));
const finding = (index, overrides = {}) => ({ code: 'unknown_order', order_id: `zakaz-${index}`, subject: 'queue', detail: 'Not displayed', ...overrides });
const report = (violations, overrides = {}) => ({ ok: false, checked_order_count: 1000, checked_batch_count: 2000, checked_session_count: 3000,
  total_violations: 45, violations, ...overrides });
const page = (offset = 0, overrides = {}) => ({ projection: '', version: 'audit-1', epoch: 'server', scope: '', revision: 1,
  offset, length: offset === 40 ? 5 : 20, total: 45, next_cursor: offset === 40 ? null : `next-${offset + 20}`,
  order_ids: [], pending_ids: [], order_rows: {}, pending_rows: {}, pending_orders: [], closed_orders: [], snapshot: null,
  workflow_audit: report(Array.from({ length: offset === 40 ? 5 : 20 }, (_, i) => finding(offset + i))), ...overrides });
test('all 55 literal finding messages and fallback match the source-derived f119 inventory', () => {
  assert.equal(Object.keys(textInventory.texts).length, 55); assert.equal(textInventory.provenance.baseline, 'f11910bb2c8c7081ce26770e69811b03fd0739ed');
  for (const [code, expected] of Object.entries(textInventory.texts)) {
    assert.equal(audit.adminWorkMapAuditViolationText(code), expected);
    assert.equal(audit.adminWorkMapAuditViolationText(`\u0085 ${code.toUpperCase()} \u0085`), expected);
  }
  for (const code of ['unknown_order', 'constructor', '__proto__', 'toString', '']) assert.equal(audit.adminWorkMapAuditViolationText(code), textInventory.fallback);
});
test('paged audit keeps first-page authority, source order and duplicate findings without recomputing ok', () => {
  const first = page(0), second = page(20, { workflow_audit: report([finding(0)], { ok: true, checked_order_count: 1, total_violations: 1 }) });
  const combined = audit.adminWorkMapAuditPages([first, second]);
  assert.equal(combined.checked_order_count, 1000); assert.equal(combined.total_violations, 45); assert.equal(combined.ok, false);
  assert.equal(combined.violations.length, 21); assert.equal(combined.violations[0].order_id, combined.violations[20].order_id);
  const quirk = audit.adminWorkMapAuditPages([{ ...first, workflow_audit: { ...first.workflow_audit, ok: true } }]);
  assert.equal(quirk.ok, true); assert.equal(quirk.violations.length, 20);
});
test('missing report stays unknown, while mixed order authority is rejected rather than treated as a clean audit', () => {
  assert.equal(audit.adminWorkMapAuditPages([]), null);
  assert.equal(audit.adminWorkMapAuditPages([page(0, { workflow_audit: null }), page(20)]), null);
  for (const override of [{ order_ids: ['o'] }, { pending_ids: ['p'] }, { projection: 'orders_list_v1' }, { closed_orders: [{}] }]) {
    assert.throws(() => audit.adminWorkMapAuditPages([page(0, override)]));
  }
});
test('audit paging uses guarded window parameters, preserves complete counts and grants no order detail ticket', async () => {
  const requests = [], c = new Controller({ isCurrent: () => true, request: { view: 'audit' }, read: async request => {
    requests.push(request); return page(requests.length === 1 ? 0 : requests.length === 2 ? 20 : 40);
  } });
  c.start(); await tick(); await c.next(); await c.next();
  assert.deepEqual(requests, [{ view: 'audit', search: '' }, { view: 'audit', search: '', cursor: 'next-20' }, { view: 'audit', search: '', cursor: 'next-40' }]);
  const state = c.getSnapshot(); assert.equal(state.audit.violations.length, 45); assert.equal(state.audit.checked_order_count, 1000);
  assert.equal(state.audit.total_violations, 45); assert.equal(state.hasMore, false); assert.deepEqual(state.rows, []);
  assert.equal(c.detailTicket({ kind: 'order', id: 'zakaz-0' }), null); c.dispose();
});
test('failed append/refresh keeps the prior report and cannot replace it with a partial or clean audit', async () => {
  let calls = 0; const c = new Controller({ isCurrent: () => true, request: { view: 'audit' }, read: async () => {
    if (++calls === 1) return page(0); if (calls === 2) return page(20, { version: 'changed' }); throw new Error('server error');
  } });
  c.start(); await tick(); const before = c.getSnapshot().audit; await c.next(); assert.equal(c.getSnapshot().audit, before); assert.ok(c.getSnapshot().error);
  await c.next(); assert.equal(calls, 2);
  await c.reload(); assert.equal(c.getSnapshot().audit, before); assert.equal(c.getSnapshot().error, 'server error'); c.dispose();
});
test('switching away or account invalidation discards late audit findings and clears report authority', async () => {
  let resolve, current = true; const c = new Controller({ isCurrent: () => current, request: { view: 'audit' }, read: async () => new Promise(yes => { resolve = yes; }) });
  c.start(); c.configure(null); resolve(page()); await tick(); assert.equal(c.getSnapshot().audit, null);
  c.configure({ view: 'audit' }); current = false; c.invalidate(); resolve(page()); await tick(); assert.equal(c.getSnapshot().audit, null); c.dispose();
});
test('presentation preserves title states, four count order, fallback count, error and source subtitle without detail text', () => {
  const initial = present(null, null, true, 'en'); assert.equal(initial.title, 'production.audit_title'); assert.equal(initial.initialProgress, true); assert.equal(initial.canRefresh, false);
  const failed = present(null, 'failed', false, 'en'); assert.equal(failed.initialProgress, false); assert.equal(failed.error, 'failed'); assert.equal(failed.canRefresh, true);
  const shown = present(report([finding(0), finding(1, { order_id: '', subject: '' })], { total_violations: null }), null, false, 'ru');
  assert.equal(shown.title, 'production.audit_issues'); assert.deepEqual(shown.counts.map(row => [row.id, row.value]), [['orders', 1000], ['batches', 2000], ['sessions', 3000], ['errors', 2]]);
  assert.equal(shown.violations[0].subtitle, 'production.audit_order:zakaz-0 • production.audit_object:queue'); assert.equal(shown.violations[1].subtitle, '');
  assert.equal(shown.violations.some(row => Object.values(row).includes('Not displayed')), false);
  const clean = present(report([finding(0)], { ok: true }), 'old report with refresh error', false, 'uz');
  assert.equal(clean.title, 'production.audit_clean'); assert.equal(clean.successTitle, 'production.audit_success'); assert.equal(clean.violations.length, 1); assert.equal(clean.error, 'old report with refresh error');
});
test('count labels follow the source UrduAwareText after localized label and number composition', () => {
  const value = present(report([]), null, false, 'probe');
  assert.deepEqual(value.counts.map(row => row.text), value.counts.map(row => `ui:${row.label}: ${row.value}`));
  const real = load('shared/localization/index.ts', { './catalog.json': require('../src/shared/localization/catalog.json') }), source = load('admin/adminWorkMapAuditPresentation.ts',
    { '../shared/localization': real, './adminWorkMapAuditModel': audit }).adminWorkMapAuditPresentation;
  for (const locale of ['uz', 'en', 'ru', 'ur']) for (const number of [0, 1, 20, 1000]) {
    const rows = source(report([], { checked_order_count: number, checked_batch_count: number, checked_session_count: number, total_violations: number }), null, false, locale).counts;
    assert.deepEqual(rows.map(row => row.text), rows.map(row => real.uiText(`${real.adminText(`production.${row.id}`, locale)}: ${number}`, locale)));
  }
});
const nodes = tree => tree && typeof tree === 'object' ? [tree, ...[tree.props?.children].flat(Infinity).flatMap(nodes)] : [];
for (const platform of ['ios', 'android']) test(`${platform} native Audit content renders counters/findings and only read-only refresh`, async () => {
  let refreshed = 0;
  const native = { Button: 'Button', HStack: 'HStack', Image: 'Image', ProgressView: 'ProgressView', Spacer: 'Spacer', Text: 'NativeText', VStack: 'VStack',
    Card: 'Card', Column: 'Column', IconButton: 'IconButton', RNHostView: 'RNHostView', Row: 'Row',
    useMaterialColors: () => ({ error: '#f00', primary: '#00f', onSurfaceVariant: '#888', surfaceContainerLowest: '#fff' }) };
  const modifiers = new Proxy({}, { get: (_target, key) => value => ({ key, value }) });
  const View = load(`admin/AdminWorkMapAudit.${platform}.tsx`, { '@expo/ui': { ListItem: 'ListItem' },
    [`@expo/ui/${platform === 'ios' ? 'swift-ui' : 'jetpack-compose'}`]: native,
    [`@expo/ui/${platform === 'ios' ? 'swift-ui' : 'jetpack-compose'}/modifiers`]: modifiers,
    'react-native': { PlatformColor: value => value, ActivityIndicator: 'ActivityIndicator' }, 'expo-symbols': { SymbolView: 'SymbolView' },
    './AdminWorkMapAuditCounts': { AdminWorkMapAuditCounts: 'Counts' } }).AdminWorkMapAudit;
  const model = present(report([finding(0)]), null, false, 'uz'), onRefresh = async () => { refreshed++; };
  const rendered = nodes(View({ model, onRefresh })), buttons = rendered.filter(row => row.type === (platform === 'ios' ? 'Button' : 'IconButton')); assert.equal(buttons.length, 1);
  if (platform === 'ios') {
    assert.ok(buttons[0].props.modifiers.some(modifier => modifier.key === 'accessibilityLabel' && modifier.value === model.refreshLabel)); buttons[0].props.onPress();
  } else {
    buttons[0].props.onClick(); assert.ok(buttons[0].props.modifiers.some(modifier => modifier.key === 'testID' && modifier.value === 'admin-work-map-audit-refresh'));
    assert.ok(buttons[0].props.modifiers.some(modifier => modifier.key === 'semantics' && modifier.value.contentDescription === model.refreshLabel));
  }
  await tick(); assert.equal(refreshed, 1);
  assert.deepEqual(rendered.find(row => row.type === 'Counts').props.counts, model.counts);
  assert.equal(rendered.filter(row => row.type === 'ListItem').length, 1); assert.equal(rendered.find(row => row.type === 'ListItem').props.onPress, undefined);
  const loading = nodes(View({ model: present(null, null, true, 'uz'), onRefresh })), disabled = loading.find(row => row.type === (platform === 'ios' ? 'Button' : 'IconButton'));
  assert.equal(platform === 'ios' ? disabled.props.onPress : disabled.props.onClick, undefined);
  if (platform === 'android') assert.equal(disabled.props.enabled, false);
  else assert.ok(disabled.props.modifiers.some(modifier => modifier.key === 'disabled' && modifier.value === true));
  assert.ok(loading.some(row => row.type === 'ProgressView' || row.type === 'ActivityIndicator'));
  assert.equal(loading.some(row => row.type === 'Counts'), false);
  const emptyError = nodes(View({ model: present(null, '', false, 'uz'), onRefresh }));
  assert.ok(emptyError.some(row => row.type === 'NativeText' && row.props.children === ''));
  assert.equal(emptyError.some(row => row.type === 'ProgressView' || row.type === 'ActivityIndicator'), false);
  const clean = nodes(View({ model: present(report([], { ok: true }), null, false, 'uz'), onRefresh }));
  assert.equal(clean.find(row => row.type === 'ListItem').props.supportingText, 'production.audit_success_description');
});

for (const platform of ['ios', 'android']) test(`${platform} Audit counts use four ordered, passive, wrapping source icons`, () => {
  const colors = { surfaceContainerLow: 'surface', outlineVariant: 'outline', onSurfaceVariant: 'content' }, modifiers = new Proxy({}, { get: (_target, key) => value => ({ key, value }) });
  const native = { FlowRow: 'FlowRow', RNHostView: 'RNHostView', Row: 'Row', Shape: { RoundedCorner: props => ({ shape: props }) }, Surface: 'Surface', Text: 'NativeText', useMaterialColors: () => colors };
  const View = load(`admin/AdminWorkMapAuditCounts.${platform}.tsx`, { '@expo/ui/jetpack-compose': native, '@expo/ui/jetpack-compose/modifiers': modifiers,
    'expo-symbols': { SymbolView: 'SymbolView' }, 'react-native': { StyleSheet: { create: value => value, hairlineWidth: 1 }, Text: 'NativeText', View: 'View' },
    '../components/useBaseTheme': { useBaseTheme: () => ({ colors, direction: 'rightToLeft' }) } }).AdminWorkMapAuditCounts;
  const counts = present(report([]), null, false, 'uz').counts, tree = nodes(View({ counts }));
  const icons = tree.filter(row => row.type === 'SymbolView');
  assert.deepEqual(icons.map(row => row.props.name[platform]), platform === 'ios' ? ['doc.text', 'shippingbox', 'play.circle', 'exclamationmark.triangle']
    : ['receipt_long', 'inventory_2', 'play_circle_outline', 'report_problem']);
  assert.ok(icons.every(row => row.props.size === 17 && row.props.importantForAccessibility === 'no'));
  assert.deepEqual(tree.filter(row => row.type === 'NativeText').map(row => row.props.children), counts.map(row => row.text));
  assert.equal(tree.some(row => row.props.onClick || row.props.onPress), false);
  if (platform === 'ios') {
    assert.equal(tree[0].props.style[0].flexWrap, 'wrap'); assert.equal(tree[0].props.style[1].direction, 'rtl');
    assert.deepEqual(tree.filter(row => row.props.accessible).map(row => row.props.accessibilityLabel), counts.map(row => row.text));
  } else {
    assert.deepEqual(tree[0].props.horizontalArrangement, { spacedBy: 8 }); assert.deepEqual(tree[0].props.verticalArrangement, { spacedBy: 8 });
    assert.equal(tree.filter(row => row.type === 'Surface').length, 4);
  }
});
