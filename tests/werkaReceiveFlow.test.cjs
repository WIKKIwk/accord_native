// Unwired receive flow: fake confirmations/requests only, no live backend or account.
const assert=require('node:assert/strict'),fs=require('node:fs'),Module=require('node:module'),path=require('node:path');
const test=require('node:test'),ts=require('typescript');
const {testWerkaGuardEvaluator}=require('./support/werkaGuardEvaluator.cjs');
function load(file,cache=new Map()) {const resolved=path.resolve(file.endsWith('.ts')?file:`${file}.ts`);if(cache.has(resolved))return cache.get(resolved);
  const m=new Module(resolved);m.filename=resolved;m.paths=require.main.paths;cache.set(resolved,m.exports);
  m.require=name=>name.endsWith('/authorizedFetch')||name==='./authorizedFetch'?{authorizedFetch:()=>{throw Error('No network');}}
    :name.startsWith('.')?load(path.resolve(path.dirname(resolved),name),cache):require(name);
  m._compile(ts.transpileModule(fs.readFileSync(resolved,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,resolved);
  cache.set(resolved,m.exports);return m.exports;}
const base=path.resolve(__dirname,'../src'),cache=new Map();
const {WerkaReceiveFlow,werkaReceiveErrorMessage}=load(`${base}/werka/werkaReceiveFlow.ts`,cache);
const {MobileApiException}=load(`${base}/shared/mobileApiException.ts`,cache);
const defer=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};};
const paddon=()=>({kind:'paddon',value:{receipt:null,warehouses:['W1'],canReceive:true,snapshotToken:'snap',snapshot:{paddon:{code:'P1'},items:[{batch_id:'b'}]}}});
const wip=()=>({kind:'wip',value:{receipt:null,warehouses:['W1'],canReceive:true,snapshotToken:'snap',batch:{batch_id:'b',qr_payload:'QR',label_item_name:'Item'}}});
function harness(preview=paddon(),overrides={}) {let active=true;const calls=[],states=[];
  const deps={isCurrent:()=>active,evaluateGuard:testWerkaGuardEvaluator,loadPreview:async current=>{calls.push(['load']);return current;},
    receive:async(_preview,warehouse)=>{calls.push(['receive',warehouse]);return {warehouse};},
    confirm:async details=>{calls.push(['confirm',details]);return true;},label:value=>value,onState:state=>states.push({...state}),...overrides};
  const flow=new WerkaReceiveFlow(preview,deps);return{flow,calls,states,invalidate:()=>{active=false;},deps};}
test('single warehouse is preselected; confirmation precedes the only write',async()=>{
  const h=harness();assert.equal(h.flow.getSnapshot().warehouse,'W1');assert.equal(h.flow.canReceive(),true);await h.flow.accept();
  assert.equal(h.calls[0][0],'confirm');assert.equal(h.calls[0][1].title,'Paddonni kirim qilish');
  assert.equal(h.calls[0][1].message,'P1 paddonidagi 1 ta rulon «W1» omboriga qabul qilinadi.');
  assert.deepEqual(h.calls[1],['receive','W1']);assert.deepEqual(h.flow.getSnapshot().receipt,{warehouse:'W1'});assert.equal(h.flow.canReceive(),false);
});
test('cancel and concurrent taps cannot issue a write',async()=>{
  const confirm=defer(),h=harness(paddon(),{confirm:()=>{h.calls.push(['confirm']);return confirm.promise;}});
  const first=h.flow.accept();await h.flow.accept();assert.deepEqual(h.calls,[['confirm']]);assert.equal(h.flow.getSnapshot().confirming,true);
  confirm.resolve(false);await first;assert.equal(h.flow.getSnapshot().busy,false);assert.deepEqual(h.calls,[['confirm']]);
});
test('an attempted timed-out write remains locked even after a fresh read',async()=>{
  let writes=0,loads=0;const h=harness(paddon(),{receive:async()=>{writes++;throw Error('timeout');},loadPreview:async()=>{loads++;return paddon();}});
  await h.flow.accept();assert.equal(writes,1);assert.equal(h.flow.getSnapshot().uncertainWrite,true);assert.equal(h.flow.getSnapshot().mustReload,true);
  assert.match(h.flow.getSnapshot().error,/bajarilgan bo‘lishi mumkin/);await h.flow.reload();assert.equal(loads,1);
  assert.equal(h.flow.getSnapshot().mustReload,true);assert.equal(h.flow.canReceive(),false);await h.flow.accept();assert.equal(writes,1);
});
test('successful WIP reload rejects changed batch identity and retains the old preview',async()=>{
  const h=harness(wip(),{loadPreview:async()=>{const fresh=wip();fresh.value.batch.batch_id='other';return fresh;}});
  await h.flow.reload();assert.equal(h.flow.getSnapshot().preview.value.batch.batch_id,'b');assert.equal(h.flow.getSnapshot().mustReload,true);
  assert.equal(h.flow.getSnapshot().error,'WIP ma’lumotini olib bo‘lmadi. Qayta tekshiring.');
});
test('account invalidation during confirmation prevents a write',async()=>{
  const confirmation=defer(),h=harness(wip(),{confirm:()=>confirmation.promise});const pending=h.flow.accept();h.invalidate();confirmation.resolve(true);await pending;
  assert.deepEqual(h.calls,[]);assert.equal(h.flow.canReceive(),false);
});
test('account invalidation after a sent write suppresses the late receipt without claiming cancellation',async()=>{
  const write=defer();let sends=0;const h=harness(paddon(),{receive:()=>{sends++;return write.promise;}});
  const pending=h.flow.accept();await Promise.resolve();assert.equal(sends,1);h.invalidate();write.resolve({warehouse:'W1'});await pending;
  assert.equal(h.flow.getSnapshot(),null);assert.equal(sends,1);
});
test('preview mutation during confirmation requires reload rather than sending changed details',async()=>{
  const confirmation=defer(),preview=paddon(),h=harness(preview,{confirm:()=>confirmation.promise});const pending=h.flow.accept();
  preview.value.snapshot.items.push({batch_id:'new'});confirmation.resolve(true);await pending;
  assert.equal(h.flow.getSnapshot().mustReload,true);assert.equal(h.flow.getSnapshot().uncertainWrite,false);assert.deepEqual(h.calls,[]);
});
test('a failed confirmation before a send is not treated as an uncertain write',async()=>{
  let writes=0;const h=harness(wip(),{confirm:async()=>{throw Error('dialog');},receive:async()=>{writes++;return {};}});
  await h.flow.accept();assert.equal(writes,0);assert.equal(h.flow.getSnapshot().uncertainWrite,false);assert.equal(h.flow.getSnapshot().mustReload,true);
  await h.flow.reload();assert.equal(h.flow.getSnapshot().mustReload,false);assert.equal(h.flow.canReceive(),true);
});
test('blocked, asynchronous and throwing guards cannot request confirmation or write',async()=>{
  const unhandled=[],listener=e=>unhandled.push(e);process.on('unhandledRejection',listener);
  try{for(const guard of [()=>false,()=>undefined,()=>Promise.resolve(true),()=>Promise.reject(Error('no')),()=>{throw Error('no');}]){
    const h=harness(paddon(),{isCurrent:guard});await h.flow.accept();await h.flow.reload();assert.deepEqual(h.calls,[]);}
    await new Promise(resolve=>setImmediate(resolve));assert.deepEqual(unhandled,[]);
  }finally{process.off('unhandledRejection',listener);}
});
test('scope-bound evaluation detects account, scope and generation changes inside guard',async()=>{
  for(const key of ['account','scope','generation']){const live={account:'A',scope:'W1',generation:1},captured={...live};
    const evaluate=guard=>{if(JSON.stringify(live)!==JSON.stringify(captured))return false;const ok=testWerkaGuardEvaluator(guard);
      return ok===true&&JSON.stringify(live)===JSON.stringify(captured);};
    const h=harness(paddon(),{evaluateGuard:evaluate,isCurrent:()=>{live[key]=key==='generation'?2:'changed';return true;}});
    await h.flow.accept();assert.deepEqual(h.calls,[],key);}
});
test('source receipt error copy distinguishes codes and uncertain transport',()=>{
  assert.equal(werkaReceiveErrorMessage('wip',new MobileApiException({code:'wip_receipt_conflict',message:'x'}),true),
    'WIP ma’lumoti o‘zgargan. Qayta tekshiring.');
  assert.equal(werkaReceiveErrorMessage('paddon',new MobileApiException({code:'paddon_not_found',message:'x'})),
    'Paddon topilmadi. QR kodni tekshiring.');
  assert.match(werkaReceiveErrorMessage('wip',Error('timeout'),true),/bajarilgan bo‘lishi mumkin/);
});
test('reentrant guard replacement or state callback invalidation stops confirmation',async()=>{
  const h=harness();h.deps.evaluateGuard=guard=>{const ok=guard();h.deps.isCurrent=()=>true;return ok;};
  await h.flow.accept();assert.deepEqual(h.calls,[]);
  let active=true,confirms=0;const h2=harness(paddon(),{isCurrent:()=>active,onState:()=>{active=false;},confirm:async()=>{confirms++;return true;}});
  await h2.flow.accept();assert.equal(confirms,0);
});
