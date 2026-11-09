const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

test('both native overview implementations connect all V2 surfaces to their role callbacks', () => {
  for (const platform of ['ios', 'android']) {
    const source = fs.readFileSync(path.resolve(__dirname, '../src/supplier', `SupplierOverviewScreens.${platform}.tsx`), 'utf8');
    for (const expected of [
      '@v2 SupplierHomeScreen', '@v2 SupplierRecentScreen', '@v2 SupplierStatusBreakdownScreen',
      '@v2 SupplierSubmittedCategoryDetailScreen', '@v2 SupplierStatusDetailScreen',
      'supplierPendingItems', 'supplierCategoryItems', 'supplierRecentItem', 'supplierStatusTitleKey',
      'props.onStatus(kind)', 'props.onReceipt?.(record.id)', 'props.onRepeat?.(', 'props.onCategory(category)',
      'props.onDetail(props.kind, item.item_code, item.item_name)', 'props.onBack', 'props.footer',
      'noSupplierShipmentsYet', 'noStatusRecords', 'noRecordsYet', 'noSupplierReceiptsYet',
    ]) assert.ok(source.includes(expected), `${platform}: ${expected}`);
  }
});

test('restricted hosts omit receipt and repeat actions rather than navigating to placeholders', () => {
  const ios = fs.readFileSync(path.resolve(__dirname, '../src/supplier/SupplierOverviewScreens.ios.tsx'), 'utf8');
  const android = fs.readFileSync(path.resolve(__dirname, '../src/supplier/SupplierOverviewScreens.android.tsx'), 'utf8');
  assert.match(ios, /return onPress \? <Button onPress=\{onPress\}>\{children\}<\/Button> : <>\{children\}<\/>/);
  for (const source of [ios, android]) {
    assert.ok(source.includes('props.onReceipt ? () => props.onReceipt?.(record.id) : undefined'));
    assert.ok(source.includes('props.onRepeat ? () => props.onRepeat?.(supplierRecentItem(record), record.sent_qty) : undefined'));
  }
});
