/* global __dirname */
const assert = require('node:assert/strict'), fs = require('node:fs'), os = require('node:os'), path = require('node:path'), { execFileSync } = require('node:child_process'), test = require('node:test');
const root = path.resolve(__dirname, '..'), moduleRoot = path.join(root, 'modules/accord-admin-presentation'), temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'accord-sheet-retirement-'));
test.before(() => {
  execFileSync('swiftc', ['-parse-as-library', path.join(moduleRoot, 'ios/AdminSheetTransaction.swift'), path.join(moduleRoot, 'ios/AdminSheetRetirement.swift'), path.join(__dirname, 'adminOwnedSheetRetirementSwiftHost.swift'), '-o', path.join(temporary, 'retirement-swift')], { encoding: 'utf8' });
  execFileSync('javac', ['-d', temporary, path.join(moduleRoot, 'android/src/main/java/expo/modules/accordadminpresentation/AdminSheetTransaction.java'), path.join(moduleRoot, 'android/src/main/java/expo/modules/accordadminpresentation/AdminSheetRetirement.java'), path.join(moduleRoot, 'android/src/test/java/expo/modules/accordadminpresentation/AdminSheetRetirementHostTest.java')], { encoding: 'utf8' });
});
test.after(() => fs.rmSync(temporary, { recursive: true, force: true }));
// Production pure ledger only. Simulated native facts do not prove UIKit/Android callbacks or native compilation.
for (const name of ['before-mount-tombstone-prevents-delayed-claim', 'mounted-before-call-preempted-without-native-ack', 'issued-call-never-becomes-never-presented', 'real-presentation-or-attachment-is-only-action-readiness',
  'dismiss-request-is-not-removal', 'only-genuine-platform-removal-completes', 'android-detach-without-dismiss-is-not-completion', 'early-actual-removal-retained-until-original-R', 'duplicate-pending-R-has-one-receipt-identity',
  'foreign-parent-or-R-cannot-replace-original', 'retirement-R-cannot-move-to-another-presentation', 'foreign-native-owner-callbacks-cannot-remove-original', 'private-retirement-before-late-R-keeps-proof',
  'Source-retirement-does-not-drop-pending-present-completion', 'destroy-rejects-pending-and-future-without-success', 'retiring-owner-does-not-require-account-authority', 'invalid-identity-aliases-reject-before-recording',
  'receipt-UUID-and-R-cannot-be-reused-as-P', 'known-child-hold-does-not-consume-dismiss-reservation', 'late-Source-close-after-resource-release-never-represents']) {
  for (const language of ['Swift-iOS', 'Swift-Android', 'JVM']) test(`production ${language} original sheet resource retirement: ${name}`, () => {
    const output = language === 'JVM' ? execFileSync('java', ['-cp', temporary, 'expo.modules.accordadminpresentation.AdminSheetRetirementHostTest', name], { encoding: 'utf8' })
      : execFileSync(path.join(temporary, 'retirement-swift'), [name, language === 'Swift-iOS' ? 'ios' : 'android'], { encoding: 'utf8' });
    assert.equal(output.trim(), name + ' passed');
  });
}
