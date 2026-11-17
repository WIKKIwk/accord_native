const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const filename = path.resolve(__dirname, '../src/material/materialAssignmentPresentation.ts');
const commonFilename = path.resolve(__dirname, '../src/qolip/qolipApiCommon.ts');
const common = new Module(commonFilename, module);
common.require = id => id === '../shared/mobileApiException' ? {} : require(id);
common._compile(ts.transpileModule(fs.readFileSync(commonFilename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText, commonFilename);
const loaded = new Module(filename, module);
loaded.filename = filename;
loaded.paths = module.paths;
loaded.require = id => id === '../qolip/qolipApiCommon' ? common.exports : require(id);
loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText, filename);
const p = loaded.exports;
const translate = (key, values = {}) => ({ key, values });
const assignment = (changes = {}) => ({ order_id: ' order-fallback ', stock_status: '', consumed_qty: 0, ...changes });
const detail = (changes = {}) => ({ status: '', order: null, ...changes });
const order = (changes = {}) => ({ id: 'id', code: ' CODE ', order_number: ' NUM ', title: ' Film ', ...changes });

// Source-derived f119 admin_raw_material_assignment_screen_widgets_part_03.dart.
test('scanned consumed state wins over available; otherwise stock status wins before lookup status', () => {
  assert.equal(p.materialScannedStatus(detail({ status: 'reserved' }), assignment({ consumed_qty: 0.1, stock_status: 'available' })), 'consumed');
  assert.equal(p.materialScannedStatus(detail({ status: 'reserved' }), assignment({ stock_status: ' IN_USE ' })), 'in_use');
  assert.equal(p.materialScannedStatus(detail({ status: ' Available ' }), assignment()), 'available');
  assert.equal(p.materialScannedStatus(detail(), assignment()), '');
});

test('displayed order label retains code and title while confirmation title has its own priority', () => {
  const value = detail({ order: order() });
  assert.equal(p.materialScannedOrderLabel(value, assignment()), 'CODE · Film');
  assert.equal(p.materialScannedOrderTitle(value, assignment()), 'Film');
  assert.equal(p.materialScannedOrderLabel(detail({ order: order({ code: 'Film' }) }), assignment()), 'Film');
  assert.equal(p.materialScannedOrderLabel(detail({ order: order({ title: '', code: '' }) }), assignment()), 'NUM');
  assert.equal(p.materialScannedOrderTitle(detail({ order: order({ title: '', code: '', order_number: '', id: '' }) }), assignment()), 'order-fallback');
  assert.equal(p.materialScannedOrderLabel(detail(), assignment()), 'order-fallback');
});

test('source lock message distinguishes active use, consumption and other locked states', () => {
  const value = detail({ order: order() });
  assert.deepEqual(p.materialScannedLockMessage(value, assignment({ stock_status: 'in_use' }), translate),
    { key: 'raw_material.unlink_blocked_in_use', values: { order: 'Film' } });
  assert.deepEqual(p.materialScannedLockMessage(value, assignment({ consumed_qty: 1, stock_status: 'in_use' }), translate),
    { key: 'raw_material.unlink_blocked_consumed', values: { order: 'Film' } });
  assert.deepEqual(p.materialScannedLockMessage(value, assignment({ stock_status: 'reserved' }), translate),
    { key: 'raw_material.unlink_blocked_generic', values: { order: 'Film' } });
  assert.equal(p.materialScannedLockMessage(value, assignment({ stock_status: 'available' }), translate), '');
  assert.equal(p.materialScannedLockMessage(detail(), assignment(), translate), '');
});

test('known statuses localize and unknown server statuses retain their trimmed spelling', () => {
  for (const [raw, key] of [['available', 'raw_material.status_available'], ['IN_USE', 'raw_material.status_in_use'],
    ['reserved', 'label.reserved'], ['consumed', 'raw_material.status_consumed']]) {
    assert.deepEqual(p.materialStockStatusLabel(` ${raw} `, translate), { key, values: {} });
  }
  assert.equal(p.materialStockStatusLabel(' FutureState ', translate), 'FutureState');
  assert.equal(p.materialStockStatusLabel(' ', translate), '');
});

test('width diagnostics preserve source min fallback and named already-assigned branch', () => {
  const diagnostic = { reason: 'raw_material_roll_size_mismatch', roll_width_mm: 9.5, minimum_width_mm: null,
    order_width_mm: 10, maximum_width_mm: 20, order_title: '' };
  assert.deepEqual(p.materialDiagnosticMessage(diagnostic, translate), {
    key: 'production.assignment.diagnostic_roll_too_narrow', values: { actual: '9.5 mm', min: '10 mm' },
  });
  assert.deepEqual(p.materialDiagnosticMessage({ ...diagnostic, roll_width_mm: 25 }, translate), {
    key: 'production.assignment.diagnostic_roll_too_wide', values: { actual: '25 mm', min: '10 mm', max: '20 mm' },
  });
  assert.deepEqual(p.materialDiagnosticMessage({ ...diagnostic, reason: 'raw_material_already_assigned', order_title: ' Film ' }, translate), {
    key: 'production.assignment.diagnostic_already_assigned_named', values: { order: 'Film' },
  });
});

test('assignment dates reuse the existing Dart parser for local dates, overflow and compact timestamps', () => {
  const previous = process.env.TZ; process.env.TZ = 'Asia/Tashkent';
  try {
    for (const [raw, expected] of [
      [' ', ''], [' invalid ', 'invalid'], ['2026-01-15', '15.01.2026 00:00'],
      ['20260115 100230', '15.01.2026 10:02'], ['2020-02-31 12:34', '02.03.2020 12:34'],
      ['2026-01-15T10:02:30Z', '15.01.2026 15:02'],
    ]) assert.equal(p.materialAssignmentTimestamp(raw), expected, raw);
  } finally { if (previous === undefined) delete process.env.TZ; else process.env.TZ = previous; }
});
