// V2 has no direct HTTP recordings for these methods; assertions follow the f119 source.
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
function load(file, fetch, cache = new Map()) {
  const resolved = path.resolve(file.endsWith('.ts') ? file : `${file}.ts`);
  if (cache.has(resolved)) return cache.get(resolved);
  const module = new Module(resolved); module.filename = resolved; module.paths = require.main.paths; cache.set(resolved, module.exports);
  module.require = name => name.endsWith('/authorizedFetch') ? { authorizedFetch: fetch }
    : name === './werkaReadScope' ? { werkaReadScope: () => () => {} }
    : name.startsWith('.') ? load(path.resolve(path.dirname(resolved), name), fetch, cache) : require(name);
  module._compile(ts.transpileModule(fs.readFileSync(resolved, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, resolved);
  cache.set(resolved, module.exports); return module.exports;
}
const filename = path.resolve(__dirname, '../src/werka/werkaArchiveApi.ts');
function setup(response) {
  const calls = [], api = load(filename, async (_session, url) => { calls.push(url); return response(); });
  return { api, calls };
}
test('archive uses both date bounds only together and preserves local calendar dates', async () => {
  const { api, calls } = setup(() => new Response(JSON.stringify({ kind: ' RECEIVED ', period: ' DAILY ', from: '2026-05-01',
    summary: { record_count: 2, totals_by_uom: [{ uom: 'Kg', qty: 3.5 }] }, items: [{ id: 'r' }] }), { status: 200 }));
  const from = new Date(2026, 4, 1, 23), to = new Date(2026, 4, 31, 2);
  const data = await api.werkaArchive({}, { kind: 'received', period: 'daily', from, to });
  assert.equal(calls[0], '/v1/mobile/werka/archive?kind=received&period=daily&from=2026-05-01&to=2026-05-31');
  assert.equal(data.kind, 'received'); assert.equal(data.period, 'daily'); assert.equal(data.from.getDate(), 1);
  assert.equal(data.summary.totalsByUOM[0].qty, 3.5); assert.equal(data.items[0].id, 'r');
  await api.werkaArchive({}, { kind: 'sent', period: 'custom', from });
  assert.equal(calls[1], '/v1/mobile/werka/archive?kind=sent&period=custom');
});
test('archive fallback values and malformed types follow source', () => {
  const { api } = setup(() => new Response('{}'));
  const data = api.werkaArchiveResponseFromJson({ from: 'invalid' });
  assert.equal(data.kind, 'sent'); assert.equal(data.period, 'yearly'); assert.equal(data.from, null);
  assert.deepEqual(data.summary, { recordCount: 0, totalsByUOM: [] });
  assert.throws(() => api.werkaArchiveResponseFromJson({ items: 'bad' }), /Invalid archive list/);
});
test('archive enums use Dart trim while raw response dates do not', () => {
  const { api } = setup(() => new Response('{}'));
  assert.equal(api.parseWerkaArchiveKind('\u0085RECEIVED\u0085'), 'received');
  assert.equal(api.parseWerkaArchiveKind('\u0085RETURNED\u0085'), 'returned');
  assert.equal(api.parseWerkaArchivePeriod('\u0085MONTHLY\u0085'), 'monthly');
  assert.equal(api.parseWerkaArchivePeriod('\u0085CUSTOM\u0085'), 'custom');
  for (const value of [' 2026-05-01', '2026-05-01 ', '\u00852026-05-01\u0085', '\ufeff2026-05-01\ufeff']) {
    assert.equal(api.werkaArchiveResponseFromJson({ from: value, to: value }).from, null, JSON.stringify(value));
    assert.equal(api.werkaArchiveResponseFromJson({ from: value, to: value }).to, null, JSON.stringify(value));
  }
  assert.notEqual(api.werkaArchiveResponseFromJson({ from: '2026-01-01T01:00:00 Z' }).from, null);
});
test('archive response date parsing replays standalone Dart samples across four time zones', () => {
  const fixture = require('./contracts/f11910bb/werka_archive_timestamp_oracle.json');
  assert.equal(fixture.rawLabels.length, 21);
  const source = `const fs=require('node:fs'),ts=require('typescript'),Module=require('node:module'),path=require('node:path');\n` +
    `function load(f,c=new Map()){f=path.resolve(f.endsWith('.ts')?f:f+'.ts');if(c.has(f))return c.get(f);const m=new Module(f);m.filename=f;m.paths=module.paths;c.set(f,m.exports);m.require=n=>n.endsWith('/authorizedFetch')?{authorizedFetch:()=>{}}:n==='./werkaReadScope'?{werkaReadScope:()=>()=>{}}:n.startsWith('.')?load(path.resolve(path.dirname(f),n),c):require(n);m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,f);c.set(f,m.exports);return m.exports;}\n` +
    `const a=load('./src/werka/werkaArchiveApi.ts'),f=require('./tests/contracts/f11910bb/werka_archive_timestamp_oracle.json');console.log(JSON.stringify(f.rawLabels.map(s=>a.werkaArchiveResponseFromJson({from:s}).from?.getTime()??null)));`;
  for (const [zone, expected] of Object.entries(fixture.rawZones)) {
    const result = spawnSync(process.execPath, ['-e', source], { cwd: path.resolve(__dirname, '..'), env: { ...process.env, TZ: zone }, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    const actual = JSON.parse(result.stdout);
    assert.equal(actual.length, expected.length);
    for (let index = 0; index < actual.length; index++) assert.equal(actual[index], expected[index], `${zone}: ${JSON.stringify(fixture.rawLabels[index])}`);
  }
});
test('PDF returns original bytes and server disposition with fallbacks', async () => {
  const first = setup(() => new Response(new Uint8Array([37, 80, 68, 70]), { status: 200,
    headers: { 'content-disposition': 'attachment; filename="  report.pdf "', 'content-type': 'application/pdf' } }));
  const data = await first.api.downloadWerkaArchivePdf({}, { kind: 'sent', period: 'yearly' });
  assert.equal(first.calls[0], '/v1/mobile/werka/archive/pdf?kind=sent&period=yearly');
  assert.equal(data.filename, 'report.pdf'); assert.equal(data.contentType, 'application/pdf'); assert.deepEqual([...data.bytes], [37, 80, 68, 70]);
  const fallback = setup(() => new Response(new Uint8Array([1]), { status: 200 }));
  assert.equal((await fallback.api.downloadWerkaArchivePdf({}, { kind: 'returned', period: 'monthly' })).filename, 'werka-archive.pdf');
});
test('non-200 archive responses fail', async () => {
  const { api } = setup(() => new Response('', { status: 500 }));
  await assert.rejects(api.werkaArchive({}, { kind: 'sent', period: 'yearly' }), /Werka archive failed/);
  await assert.rejects(api.downloadWerkaArchivePdf({}, { kind: 'sent', period: 'yearly' }), /Werka archive pdf failed/);
});
