/* global __dirname */
const assert = require('node:assert/strict'), fs = require('node:fs'), os = require('node:os'), path = require('node:path'), { execFileSync } = require('node:child_process'), test = require('node:test');
const root = path.resolve(__dirname, '..'), temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'accord-owned-sheet-'));
test.before(() => {
  execFileSync('swiftc', ['-parse-as-library', path.join(root, 'modules/accord-admin-presentation/ios/AdminSheetTransaction.swift'), path.join(__dirname, 'adminOwnedSheetSwiftHost.swift'), '-o', path.join(temporary, 'owned-sheet')], { encoding: 'utf8' });
  execFileSync('javac', ['-d', temporary, path.join(root, 'modules/accord-admin-presentation/android/src/main/java/expo/modules/accordadminpresentation/AdminSheetTransaction.java'),
    path.join(root, 'modules/accord-admin-presentation/android/src/test/java/expo/modules/accordadminpresentation/AdminSheetTransactionHostTest.java')], { encoding: 'utf8' });
});
test.after(() => fs.rmSync(temporary, { recursive: true, force: true }));
// Production Foundation/JVM cores only. These do not compile UIKit/Kotlin/Expo/Fabric or prove working native sheets.
for (const name of ['membership-and-attempt-never-ready', 'blocked-pull-down-is-only-attempt', 'gesture-begins-fence-without-source-close', 'physical-before-source-retains-exact-receipt', 'source-before-physical-awaits-genuine-dismiss',
  'queued-close-before-show-does-not-manufacture-ready', 'foreign-presentation-cannot-close', 'foreign-gesture-cannot-join', 'independent-source-close-crosses-native-gesture', 'independent-source-close-crosses-physical-dismissal', 'foreign-completion-cannot-remove-original', 'duplicate-accepted-close-and-native-completion-once',
  'real-cancel-restores-same-original-without-ready-event', 'native-identity-never-reused', 'accepted-close-cannot-share-native-identity', 'accepted-cancelled-transition-fails-without-ack', 'retirement-before-or-after-physical-never-joins',
  'physical-without-will-retains-native-transaction', 'strict-opaque-ticket-validation', 'failed-receipts-cannot-revive']) {
  for (const language of ['Foundation', 'JVM']) test(`production ${language} owned-sheet transaction: ${name}`, () => {
    const output = language === 'Foundation' ? execFileSync(path.join(temporary, 'owned-sheet'), [name], { encoding: 'utf8' }) : execFileSync('java', ['-cp', temporary, 'expo.modules.accordadminpresentation.AdminSheetTransactionHostTest', name], { encoding: 'utf8' });
    assert.equal(output.trim(), name + ' passed');
  });
}
