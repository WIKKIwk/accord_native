/* global __dirname */
const assert = require('node:assert/strict'), fs = require('node:fs'), os = require('node:os'), path = require('node:path'), { execFileSync } = require('node:child_process');
const { test, before, after } = require('node:test');
const root = path.resolve(__dirname, '../modules/accord-admin-presentation/android/src'), temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'accord-window-host-'));
before(() => { execFileSync('javac', ['-d', temporary,
  path.join(root, 'main/java/expo/modules/accordadminpresentation/PresentationWindowRegistry.java'),
  path.join(root, 'test/java/expo/modules/accordadminpresentation/PresentationWindowHostTest.java')], { encoding: 'utf8' }); });
after(() => { fs.rmSync(temporary, { recursive: true, force: true }); });
for (const name of ['armed-listener-before-ack', 'pending-native-attach', 'pending-cancel-exact', 'marker-removal-not-completion', 'detach-before-wait-retained', 'real-detach-event-before-flag-clear', 'duplicate-wait-cannot-steal', 'exact-handle-and-ticket',
  'reject-activity-root', 'reject-shared-window-token', 'reject-missing-window-token', 'reject-native-id-tag-change', 'activity-change-before-arm', 'activity-change-after-detach', 'activity-destroy-cancels', 'finishing-activity-detach-cancels',
  'activity-decor-replacement-cancels', 'parallel-windows-remain-independent', 'module-destroy-is-permanent', 'root-detach-before-ack-rejects', 'arm-reentrant-cancel', 'subscription-failure-rejects', 'reparent-never-retargets-root', 'opaque-ticket-never-reused', 'ui-thread-required']) {
  test(`production JVM window registry: ${name}`, () => {
    const output = execFileSync('java', ['-cp', temporary, 'expo.modules.accordadminpresentation.PresentationWindowHostTest', name], { encoding: 'utf8' }); assert.equal(output.trim(), `${name} passed`);
  });
}
