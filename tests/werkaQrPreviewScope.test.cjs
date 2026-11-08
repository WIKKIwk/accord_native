// Real authorizedFetch control flow with fake accounts and a local fetch double. No network is contacted.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const {testWerkaGuardEvaluator} = require('./support/werkaGuardEvaluator.cjs');
const base = path.resolve(__dirname, '../src');
const fakeSession = ref => ({baseUrl:'https://example.invalid',token:`fake-${ref}`,profile:{role:'werka',ref},
  capabilities:['werka.access'],assigned_apparatus:[],assigned_item_groups:[],assigned_warehouses:[]});
function setup(onRefresh) {
  let active=fakeSession('A'), refreshes=0;
  const auth={currentSession:()=>active,activeSessionToken:session=>session===active?session.token:null,
    refreshSession:async session=>{refreshes++;onRefresh?.(session);return true;}};
  const cache=new Map();
  function load(file) {
    const filename=path.resolve(file.endsWith('.ts')?file:`${file}.ts`); if(cache.has(filename)) return cache.get(filename);
    const loaded=new Module(filename); loaded.filename=filename; loaded.paths=require.main.paths; cache.set(filename,loaded.exports);
    loaded.require=name=>name==='../auth'||name==='./auth'?auth:name.startsWith('.')?load(path.resolve(path.dirname(filename),name)):require(name);
    loaded._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,filename);
    cache.set(filename,loaded.exports);return loaded.exports;
  }
  return {get session(){return active;},switchTo:value=>{active=value;},get refreshes(){return refreshes;},api:load(`${base}/werka/werkaPaddonApi.ts`),
    scanner:load(`${base}/werka/werkaScannerFlow.ts`), scope:load(`${base}/sessionReadScope.ts`)};
}
const valid = JSON.stringify({kind:'paddon',paddon:{id:'p',code:'00002'},items:[],warehouses:[],snapshot_token:'',can_receive:false});
test('missing Werka permission prevents the first QR preview send', async () => {
  const saved=globalThis.fetch, h=setup(); let sends=0; h.session.capabilities=[];
  try {globalThis.fetch=async()=>{sends++;return new Response(valid);};
    await assert.rejects(h.api.werkaQrPreview(h.session,'00002'),error=>error.code==='session_scope_changed'); assert.equal(sends,0);
  } finally {globalThis.fetch=saved;}
});
test('401 refresh that changes permission or role cannot retry the QR preview', async () => {
  const saved=globalThis.fetch;
  try {for(const change of [s=>{s.capabilities=[];},s=>{s.profile.role='customer';}]) {
    const h=setup(change); let sends=0; globalThis.fetch=async()=>{sends++;return new Response('{}',{status:401});};
    await assert.rejects(h.api.werkaQrPreview(h.session,'00002'),error=>error.code==='session_scope_changed');
    assert.equal(sends,1);assert.equal(h.refreshes,1);
  }} finally {globalThis.fetch=saved;}
});
test('401 refresh retaining the same read scope may retry and decode', async () => {
  const saved=globalThis.fetch, h=setup(s=>{s.token='fake-refreshed';}), headers=[];
  try {globalThis.fetch=async(_url,init)=>{headers.push(new Headers(init.headers).get('authorization'));
      return headers.length===1?new Response('{}',{status:401}):new Response(valid,{status:200});};
    const result=await h.api.werkaQrPreview(h.session,'00002'); assert.equal(result.paddon.snapshot.paddon.code,'00002');
    assert.deepEqual(headers,['Bearer fake-A','Bearer fake-refreshed']);
  } finally {globalThis.fetch=saved;}
});
test('account change during successful or error body decoding suppresses the old result', async () => {
  const saved=globalThis.fetch;
  try {for(const status of [200,404]) for(const change of [h=>h.switchTo(fakeSession('B')),h=>{h.session.capabilities=[];}]) {
    const h=setup();let resolve,bodyStarted;const started=new Promise(yes=>{bodyStarted=yes;}),body=new Promise(yes=>{resolve=yes;});
    globalThis.fetch=async()=>({status,json:()=>{bodyStarted();return body;}});
    const pending=h.api.werkaQrPreview(h.session,'00002');await started;change(h);
    resolve(status===200?JSON.parse(valid):{error:'qr_not_found'});
    await assert.rejects(pending,error=>error.code==='session_scope_changed');
  }} finally {globalThis.fetch=saved;}
});

test('scanner flow suppresses stale 401 refresh outcomes without stock fallback', async () => {
  const saved=globalThis.fetch, h=setup(s=>{s.capabilities=[];}), session=h.session;
  const captured=h.scope.sessionReadScope(session), events=[]; let sends=0;
  try {globalThis.fetch=async()=>{sends++;return new Response('{}',{status:401});};
    const flow=new h.scanner.WerkaScannerFlow({evaluateGuard:testWerkaGuardEvaluator,isCurrent:()=>h.session===session&&h.scope.sessionReadScope(session)===captured&&session.capabilities.includes('werka.access'),
      stopCamera:async()=>{},startCamera:async()=>{events.push('restart');return 'running';},preview:code=>h.api.werkaQrPreview(session,code),
      onState:()=>{},onNotice:message=>events.push(message),onResult:result=>events.push(result.kind)});
    await flow.handleCode('00002'); assert.equal(sends,1); assert.deepEqual(events,[]);
  } finally {globalThis.fetch=saved;}
});
