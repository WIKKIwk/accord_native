import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const cameraRoot = dirname(require.resolve('expo-camera/package.json'));
const patch = fileURLToPath(new URL('../patches/expo-camera-android-texture-preview.patch', import.meta.url));
const gitApply = (...options) => spawnSync('git', ['apply', '--no-index', ...options, patch], {
  cwd: cameraRoot,
  encoding: 'utf8',
  // Treat the installed package as its own tree. It sits below an ignored node_modules.
  env: { ...process.env, GIT_CEILING_DIRECTORIES: dirname(cameraRoot) },
});

const alreadyApplied = gitApply('--reverse', '--check');
if (alreadyApplied.error) throw alreadyApplied.error;
if (alreadyApplied.status !== 0) {
  const result = gitApply();
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Could not patch the Android Expo Camera preview:\n${result.stderr}`);
}
