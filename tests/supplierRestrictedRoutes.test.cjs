const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('restricted platform routes expose only non-held Supplier pages', () => {
  const android = fs.readdirSync(path.join(root, 'src/app/android-supplier')).sort();
  assert.deepEqual(android, ['_layout.tsx', 'category.tsx', 'index.tsx', 'profile.tsx', 'recent.tsx', 'status-detail.tsx', 'status.tsx']);
  const iosRoot = fs.readdirSync(path.join(root, 'src/app/ios-supplier')).sort();
  assert.deepEqual(iosRoot, ['(home)', '_layout.tsx', 'recent']);
  const iosHome = fs.readdirSync(path.join(root, 'src/app/ios-supplier/(home)')).sort();
  assert.deepEqual(iosHome, ['_layout.tsx', 'category.tsx', 'index.tsx', 'profile.tsx', 'status-detail.tsx', 'status.tsx']);
  for (const platform of ['ios', 'android']) {
    const pages = read(`src/supplier/SupplierPages.${platform}.tsx`);
    assert.ok(!pages.includes('onReceipt=')); assert.ok(!pages.includes('onRepeat='));
    assert.ok(!pages.includes('SupplierNotificationsScreen')); assert.ok(!pages.includes('createDispatch'));
    assert.ok(!pages.includes('useChatUnreadCount')); assert.ok(!pages.includes('ChatRouteProvider'));
    assert.ok(pages.includes('SupplierStatusBreakdownScreen')); assert.ok(pages.includes('SupplierStatusDetailScreen'));
    assert.ok(pages.includes('ProfileScreen')); assert.ok(pages.includes('SupplierDrawer'));
  }
  const targets = read('src/shared/appRoutes.ts').split('const homeTargets:')[1].split('export function homeTarget')[0];
  assert.ok(!targets.includes('[appRoutes.supplierHome]'), 'held role is not wired as a login home target');
});

test('restricted shells reuse native navigation and do not start unread transports or stores', () => {
  const shell = read('src/supplier/SupplierShell.tsx'), android = read('src/supplier/SupplierDock.android.tsx');
  const ios = read('src/supplier/SupplierTabs.ios.tsx'), pages = read('src/supplier/SupplierPages.android.tsx');
  assert.ok(shell.includes('registerSessionResetHook')); assert.ok(shell.includes('canOpenRoute(session, appRoutes.supplierHome)'));
  assert.ok(shell.includes('RoleDrawer')); assert.ok(shell.includes("item.id !== 'notifications'"));
  assert.ok(android.includes('RoleBottomBar')); assert.ok(android.includes("item.id !== 'chat' && item.id !== 'notifications'"));
  assert.ok(ios.includes('<NativeTabs>')); assert.ok(!ios.includes('name="notifications"')); assert.ok(!ios.includes('name="chat"'));
  for (const source of [shell, android, ios]) {
    assert.ok(!source.includes('useChatUnreadCount')); assert.ok(!source.includes('notificationUnreadStore'));
  }
  assert.ok(pages.includes('supplierRootStackAction(name)')); assert.ok(pages.includes('supplierDrawerStackAction(current, name)'));
  assert.ok(!pages.includes('dismissTo('));
});
