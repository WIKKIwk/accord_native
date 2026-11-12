const assert = require('node:assert/strict'), fs = require('node:fs'), Module = require('node:module'), path = require('node:path'), test = require('node:test'), ts = require('typescript');
const file = path.resolve(__dirname, '../src/workerPaddonReadCache.ts'), mod = new Module(file, module); mod.filename = file;
mod.require = id => id === './workerPaddonModel' ? { WorkerPaddonRetired: class WorkerPaddonRetired extends Error {} } : require(id);
mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, file);
const { WorkerPaddonReadCache } = mod.exports;
const defer = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };

test('rapid reads reuse a fresh response; expiration and explicit refresh still read the server', async () => {
  let now = 0, reads = 0; const cache = new WorkerPaddonReadCache(() => now), read = async () => ({ version: ++reads });
  const first = await cache.read(read, () => true, false); now = 1000;
  assert.equal(cache.peek(), first); assert.equal(await cache.read(read, () => true, false), first); assert.equal(reads, 1);
  assert.equal((await cache.read(read, () => true)).version, 2);
  now += 15_000; assert.equal(cache.peek(), null); assert.equal((await cache.read(read, () => true, false)).version, 3);
});
test('concurrent automatic reads share a request while an explicit refresh supersedes it', async () => {
  const cache = new WorkerPaddonReadCache(), pending = defer(); let reads = 0;
  const read = () => { reads++; return pending.promise; };
  const first = cache.read(read, () => true, false), second = cache.read(read, () => true, false);
  const rejected = assert.rejects(first);
  await Promise.resolve(); assert.equal(reads, 1);
  const latest = await cache.read(async () => 'new', () => true);
  pending.resolve('old'); await rejected;
  assert.equal(await second, 'new'); assert.equal(latest, 'new'); assert.equal(cache.peek(), 'new'); assert.equal(reads, 1);
});
test('an invalidated request cannot repopulate the cache after a mutation', async () => {
  const cache = new WorkerPaddonReadCache(), pending = defer();
  const first = cache.read(() => pending.promise, () => true, false), rejected = assert.rejects(first);
  await Promise.resolve(); cache.invalidate();
  await cache.read(async () => 'changed', () => true, false); pending.resolve('old'); await rejected;
  assert.equal(cache.peek(), 'changed');
});
test('a retired route cannot supply a cached response or block a new route behind its pending read', async () => {
  const cache = new WorkerPaddonReadCache(), pending = defer(); let active = true;
  const first = cache.read(() => pending.promise, () => active, false), rejected = assert.rejects(first);
  await Promise.resolve(); active = false;
  assert.equal(await cache.read(async () => 'new route', () => true, false), 'new route');
  pending.resolve('retired'); await rejected;
  await assert.rejects(cache.read(async () => 'unused', () => active, false));
  assert.equal(cache.peek(), 'new route');
});
test('failed refreshes are not cached and permit the next visit to retry', async () => {
  const cache = new WorkerPaddonReadCache(); await cache.read(async () => 'before', () => true, false);
  await assert.rejects(cache.read(async () => { throw Error('offline'); }, () => true));
  assert.equal(cache.peek(), null); assert.equal(await cache.read(async () => 'recovered', () => true, false), 'recovered');
});
test('a live route sharing a read recovers if its original route closes before the response', async () => {
  const cache = new WorkerPaddonReadCache(), pending = defer(); let active = true, reads = 0;
  const first = cache.read(() => pending.promise, () => active, false), rejected = assert.rejects(first);
  const second = cache.read(async () => { reads++; return 'live route'; }, () => true, false);
  await Promise.resolve(); active = false; pending.resolve('closed route');
  await rejected; assert.equal(await second, 'live route'); assert.equal(reads, 1); assert.equal(cache.peek(), 'live route');
});
