/* global __dirname */
const assert = require('node:assert/strict'), fs = require('node:fs'), os = require('node:os'), path = require('node:path'), { execFileSync } = require('node:child_process'), test = require('node:test');
const root = path.resolve(__dirname, '../modules/accord-admin-presentation/android/src'), temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'accord-sheet-window-evidence-'));
test.before(() => execFileSync('javac', ['-d', temporary, path.join(root, 'main/java/expo/modules/accordadminpresentation/AdminSheetWindowEvidence.java'), path.join(root, 'test/java/expo/modules/accordadminpresentation/AdminSheetWindowEvidenceHostTest.java')], { encoding: 'utf8' }));
test.after(() => fs.rmSync(temporary, { recursive: true, force: true }));
// Real production predicate with controlled facts. This does not compile/run Android views or prove external-display support.
for (const name of ['normal-dialogs-have-distinct-view-application-tokens', 'foreign-activity-cohort-rejected', 'unknown-actual-layout-token-rejected', 'subwindow-is-not-normal-application-cohort',
  'system-and-invalid-window-types-rejected', 'owned-dialog-cannot-be-base-activity-window', 'actual-display-mismatch-rejected', 'unknown-display-never-defaults-to-zero', 'same-actual-secondary-display-metadata-is-not-faked-primary']) {
  test(`production JVM owned sheet actual-window association: ${name}`, () => assert.equal(execFileSync('java', ['-cp', temporary, 'expo.modules.accordadminpresentation.AdminSheetWindowEvidenceHostTest', name], { encoding: 'utf8' }).trim(), name + ' passed'));
}
