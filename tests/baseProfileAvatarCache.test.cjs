const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const test = require('node:test');
const ts = require('typescript');
const filename = path.resolve(__dirname, '../src/shared/profileAvatarCache.ts');
const mod = new Module(filename, module); mod.filename = filename; mod.paths = module.paths;
const guardFile = path.resolve(__dirname, '../src/shared/profileSessionGuard.ts'), guard = new Module(guardFile, module);
guard.filename = guardFile; guard.paths = module.paths;
guard._compile(ts.transpileModule(fs.readFileSync(guardFile, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, guardFile);
mod.require = id => id === './profileSessionGuard' ? guard.exports : require(id);
mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
const { ProfileAvatarCache } = mod.exports;
const account = (url = '/avatar?v=1', ref = 'one') => ({ baseUrl: 'https://example.test', profile: { role: 'werka', ref, avatar_url: url } });

test('avatar bytes survive a failed refresh only for the same account and URL', async () => {
  const cache = new ProfileAvatarCache(), current = account();
  const saved = cache.remember(current, Uint8Array.from([0, 1, 2, 253]), 'image/png');
  assert.equal(saved, 'data:image/png;base64,AAEC/Q==');
  assert.equal(await cache.refresh(current, async () => { throw Error('offline'); }), saved);
  assert.equal(cache.get(account('/avatar?v=2')), null);
  assert.equal(cache.get(account('/avatar?v=1', 'other')), null);
  assert.equal(await cache.refresh(account('/avatar?v=2'), async () => null), null);
});

test('concurrent initial avatar reads share a download and reset prevents stale writes', async () => {
  const cache = new ProfileAvatarCache(), current = account(); let count = 0, release;
  const download = () => { count++; return new Promise(resolve => { release = resolve; }); };
  const first = cache.ensure(current, download), second = cache.ensure(current, download);
  assert.equal(count, 1);
  cache.clear();
  release({ bytes: Uint8Array.of(1) });
  assert.equal(await first, null);
  assert.equal(await second, null);
  assert.equal(cache.get(current), null);
});
