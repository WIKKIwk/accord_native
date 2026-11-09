// Pure source-derived date projections; calendar UI, backend reads and device remain unconnected.
const assert=require('node:assert/strict'),fs=require('node:fs'),Module=require('node:module'),path=require('node:path');
const {spawnSync}=require('node:child_process');const test=require('node:test'),ts=require('typescript');
function load(file,cache=new Map()){const filename=path.resolve(file.endsWith('.ts')?file:`${file}.ts`);if(cache.has(filename))return cache.get(filename);
  const m=new Module(filename);m.filename=filename;m.paths=require.main.paths;cache.set(filename,m.exports);
  m.require=name=>name.startsWith('.')?load(path.resolve(path.dirname(filename),name),cache):require(name);
  m._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,filename);
  cache.set(filename,m.exports);return m.exports;}
const api=load(path.resolve(__dirname,'../src/werka/werkaArchiveCalendar.ts'));
const ymd=d=>[d.getFullYear(),d.getMonth()+1,d.getDate()];
test('active days, months and years keep first-seen insertion order and ignore invalid labels',()=>{
  const labels=['2026-03-02','2026-02-28','invalid','2026-03-02','2024-02-29','2026-03-08','2038-01-01'];
  assert.deepEqual([...api.werkaArchiveActiveDays(labels,2026,3)],[2,8]);
  assert.deepEqual([...api.werkaArchiveActiveMonths(labels,2026)],[3,2]);
  assert.deepEqual([...api.werkaArchiveActiveYears(labels,2024)],[2026,2024]);
});
test('month, year and 12-year page ranges match source date boundaries',()=>{
  const leap=api.werkaArchiveMonthRange(2024,2);assert.deepEqual(ymd(leap.from),[2024,2,1]);assert.deepEqual(ymd(leap.to),[2024,2,29]);
  assert.deepEqual(ymd(api.werkaArchiveMonthRange(2025,2).to),[2025,2,28]);
  assert.deepEqual(ymd(api.werkaArchiveYearRange(50).from),[50,1,1]);
  const page=api.werkaArchiveYearPageRange(2021);assert.deepEqual(ymd(page.from),[2021,1,1]);assert.deepEqual(ymd(page.to),[2032,12,31]);
});
test('explicit offset or Z retains Dart UTC calendar fields under a non-UTC local timezone',()=>{
  const source=`const fs=require('node:fs'),ts=require('typescript'),Module=require('node:module'),path=require('node:path');\n`+
    `function load(f,c=new Map()){f=path.resolve(f.endsWith('.ts')?f:f+'.ts');if(c.has(f))return c.get(f);const m=new Module(f);m.filename=f;m.paths=module.paths;c.set(f,m.exports);m.require=n=>n.startsWith('.')?load(path.resolve(path.dirname(f),n),c):require(n);m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,f);c.set(f,m.exports);return m.exports;}\n`+
    `const a=load('./src/werka/werkaArchiveCalendar.ts');console.log(JSON.stringify(['2026-01-01T22:00:00Z','2026-01-01T00:30:00+05:00','2026-01-01T22:00:00','2026-02-30','2025-12-31 23:59:59','bad'].map(a.werkaArchiveCalendarFields)));`;
  const result=spawnSync(process.execPath,['-e',source],{cwd:path.resolve(__dirname,'..'),env:{...process.env,TZ:'Asia/Tashkent'},encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);assert.deepEqual(JSON.parse(result.stdout),[
    {year:2026,month:1,day:1},{year:2025,month:12,day:31},{year:2026,month:1,day:1},
    {year:2026,month:3,day:2},{year:2025,month:12,day:31},null]);
});
test('archive marker fields replay standalone Dart source samples across four time zones',()=>{
  const fixture=require('./contracts/f11910bb/werka_archive_timestamp_oracle.json');assert.equal(fixture.labels.length,479);
  const source=`const fs=require('node:fs'),ts=require('typescript'),Module=require('node:module'),path=require('node:path');\n`+
    `function load(f,c=new Map()){f=path.resolve(f.endsWith('.ts')?f:f+'.ts');if(c.has(f))return c.get(f);const m=new Module(f);m.filename=f;m.paths=module.paths;c.set(f,m.exports);m.require=n=>n.startsWith('.')?load(path.resolve(path.dirname(f),n),c):require(n);m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,f);c.set(f,m.exports);return m.exports;}\n`+
    `const a=load('./src/werka/werkaArchiveCalendar.ts'),f=require('./tests/contracts/f11910bb/werka_archive_timestamp_oracle.json');console.log(JSON.stringify(f.labels.map(a.werkaArchiveCalendarFields)));`;
  for(const [zone,expected] of Object.entries(fixture.zones)){
    const result=spawnSync(process.execPath,['-e',source],{cwd:path.resolve(__dirname,'..'),env:{...process.env,TZ:zone},encoding:'utf8'});
    assert.equal(result.status,0,result.stderr);const actual=JSON.parse(result.stdout);assert.equal(actual.length,expected.length);
    for(let index=0;index<actual.length;index++)assert.deepEqual(actual[index],expected[index],`${zone}: ${JSON.stringify(fixture.labels[index])}`);
  }
});
test('Dart-trimmed labels participate in day, month and year marker sets',()=>{
  const labels=['\u00852026-03-02\u0085','\u0085 2026-01-01T00:30:00+05:00 \u0085','\u0085not date\u0085'];
  assert.deepEqual([...api.werkaArchiveActiveDays(labels,2026,3)],[2]);
  assert.deepEqual([...api.werkaArchiveActiveMonths(labels,2025)],[12]);
  assert.deepEqual([...api.werkaArchiveActiveYears(labels,2024)],[2026,2025]);
});
