const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { getRoutes } = require('expo-router/build/getRoutes');

// Read the same physical route files Metro's require.context would expose, then
// use the installed SDK's route resolver rather than a hand-rolled route parser.
const appRoot = path.resolve(__dirname, '../src/app');
function walkFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walkFiles(full) : entry.isFile() ? [full] : [];
  });
}
const realKeys = walkFiles(appRoot).map(file => `./${path.relative(appRoot, file).split(path.sep).join('/')}`);
function manifest(platform, keys) {
  const context = () => ({ default: () => null });
  context.keys = () => [...keys];
  const root = getRoutes(context, { platform, skipGenerated: true, ignoreEntryPoints: true, internal_stripLoadRoute: true });
  assert.ok(root, 'Expo Router must resolve the actual root route');
  const result = [];
  const visit = route => { result.push(route.contextKey); (route.children ?? []).forEach(visit); };
  visit(root); return result;
}
for (const platform of ['ios', 'android']) test(`${platform} Expo Router exposes core Boyoqchi routes but holds Chat`, () => {
  const actual = manifest(platform, realKeys);
  for (const route of ['./index.tsx', './ios-boyoqchi/_layout.tsx', './ios-boyoqchi/(tabs)/(home)/index.tsx',
    './ios-boyoqchi/(tabs)/(astatka)/astatka.tsx', './ios-boyoqchi/(tabs)/profile/index.tsx',
    './android-boyoqchi/_layout.tsx', './android-boyoqchi/index.tsx', './android-boyoqchi/astatka.tsx',
    './android-boyoqchi/profile.tsx']) assert.ok(actual.includes(route), route);
  assert.ok(actual.some(key => key.startsWith('./ios-worker/')));
  assert.ok(actual.some(key => key.startsWith('./ios-preparation/')));
  assert.ok(actual.some(key => key.startsWith('./android-preparation/')));
  const isBoyoqchiChat = key => /^\.\/(?:ios-boyoqchi\/\(tabs\)|android-boyoqchi)\/chat(?:\/|\.)/.test(key);
  assert.ok(!actual.some(isBoyoqchiChat), actual.join('\n'));
  // Positive control: the installed resolver would detect Chat paths if restored.
  const withChat = manifest(platform, [...realKeys, './ios-boyoqchi/(tabs)/chat/_layout.tsx', './ios-boyoqchi/(tabs)/chat/index.tsx',
    './android-boyoqchi/chat/_layout.tsx', './android-boyoqchi/chat/index.tsx']);
  assert.ok(withChat.includes('./ios-boyoqchi/(tabs)/chat/index.tsx'));
  assert.ok(withChat.includes('./android-boyoqchi/chat/index.tsx'));
});
