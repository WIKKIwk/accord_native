const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

test('both native notification lists use shared unread state, clear confirmation and receipt action', () => {
  for (const platform of ['ios', 'android']) {
    const source = fs.readFileSync(path.resolve(__dirname, '../src/supplier', `SupplierNotificationsScreen.${platform}.tsx`), 'utf8');
    for (const expected of ['@v2 SupplierNotificationsScreen', 'useSupplierNotifications', 'highlighted.has(record.id)',
      'supplierNotificationMetric(record)', 'supplierNotificationSecondary(record)', 'supplierNotificationStatusIcon(record)',
      'clearAllNotificationsPrompt', 'controller.clearAll()', 'controller.open(record.id)', 'WorkerAlert',
      'noNotifications', 'serverDisconnectedRetry', 'props.onOpenDrawer', 'props.footer']) {
      assert.ok(source.includes(expected), `${platform}: ${expected}`);
    }
  }
});

test('restricted host omits receipt button without a navigation callback', () => {
  for (const platform of ['ios', 'android']) {
    const source = fs.readFileSync(path.resolve(__dirname, '../src/supplier', `SupplierNotificationsScreen.${platform}.tsx`), 'utf8');
    assert.ok(source.includes('props.onReceipt ? () => { void controller.open(record.id); } : undefined'));
  }
});
