const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
test('read-only Admin candidate has no reachable app route or home target', () => {
  const root = path.resolve(__dirname, '../src');
  assert.equal(fs.existsSync(path.join(root, 'app/ios-admin')), false);
  assert.equal(fs.existsSync(path.join(root, 'app/android-admin')), false);
  const routes = fs.readFileSync(path.join(root, 'shared/appRoutes.ts'), 'utf8');
  const targets = routes.slice(routes.indexOf('const homeTargets:'), routes.indexOf('export function homeTarget'));
  assert.doesNotMatch(targets, /ios-admin|android-admin/);
});
