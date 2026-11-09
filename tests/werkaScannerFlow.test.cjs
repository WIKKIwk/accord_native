// No native camera, route, live request or real account is used here.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const {testWerkaGuardEvaluator} = require('./support/werkaGuardEvaluator.cjs');
function load(file, cache = new Map()) {
  const resolved = path.resolve(file.endsWith('.ts') ? file : `${file}.ts`);
  if (cache.has(resolved)) return cache.get(resolved);
  const module = new Module(resolved); module.filename = resolved; module.paths = require.main.paths; cache.set(resolved, module.exports);
  module.require = name => name.endsWith('/authorizedFetch') || name === './authorizedFetch' ? { authorizedFetch: () => { throw Error('No network'); } }
    : name.startsWith('.') ? load(path.resolve(path.dirname(resolved), name), cache) : require(name);
  module._compile(ts.transpileModule(fs.readFileSync(resolved, 'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,resolved);
  cache.set(resolved,module.exports); return module.exports;
}
const cache = new Map(), base = path.resolve(__dirname,'../src');
const {WerkaScannerFlow} = load(`${base}/werka/werkaScannerFlow.ts`,cache);
const {WorkerControlException} = load(`${base}/workerControlsApi.ts`,cache);
const deferred = () => { let resolve, reject; const promise = new Promise((yes,no) => {resolve=yes;reject=no;}); return {promise,resolve,reject}; };
function harness(overrides = {}) {
  const calls = [], snapshots = []; let active = true;
  const deps = { isCurrent:()=>active, evaluateGuard:testWerkaGuardEvaluator, stopCamera:async()=>{calls.push(['stop']);}, startCamera:async()=>{calls.push(['start']);return 'running';},
    preview:async code=>{calls.push(['preview',code]);return {code,paddon:{},wip:null};},
    onState:state=>snapshots.push({...state}), onNotice:message=>calls.push(['notice',message]), onResult:result=>calls.push(['result',result]), ...overrides };
  const flow = new WerkaScannerFlow(deps);
  return {flow,calls,snapshots,invalidate:()=>{active=false;}};
}
const archive = `https://scan.wspace.sbs/A/${Buffer.from('ARCHIVE\nsess\nitem\n3\ntime').toString('base64url')}`;
test('archive raw code wins, stops first, and concurrent frames do not cause another operation', async () => {
  const stop=deferred(), h=harness({stopCamera:()=>{h.calls.push(['stop']);return stop.promise;}});
  const pending=h.flow.onDetection([{rawValue:` ${archive} `,displayValue:'not archive'}]);
  await h.flow.onDetection([{rawValue:'00002'}]); assert.deepEqual(h.calls,[['stop']]);
  stop.resolve(); await pending;
  assert.equal(h.calls[1][0],'result'); assert.equal(h.calls[1][1].kind,'archive');
  assert.equal(h.flow.getSnapshot().processing,true); assert.equal(h.snapshots[0].status,'Batch QR o‘qildi...');
});
test('invalid code never sends preview and restarts, while preview result uses full raw input', async () => {
  const h=harness(); await h.flow.handleCode('https://scan.wspace.sbs/A/not-valid-base64');
  assert.deepEqual(h.calls,[['notice','QR kodi noto‘g‘ri.'],['start']]);
  assert.equal(h.flow.getSnapshot().status,'QR kodni ramkaga keltiring');
  await h.flow.onDetection([{rawValue:'  00002 ',displayValue:'ignored'}]);
  assert.deepEqual(h.calls.slice(2,4),[['stop'],['preview','00002']]);
  assert.equal(h.calls[4][1].kind,'preview');
});
test('only qr_not_found routes to stock; other errors show V2 notice and restart', async () => {
  const miss=harness({preview:async()=>{throw new WorkerControlException('qr_not_found','missing',404);}});
  await miss.flow.handleCode('00002'); assert.equal(miss.calls[1][1].kind,'stock');
  const denied=harness({preview:async()=>{throw new WorkerControlException('forbidden','no',403);}});
  await denied.flow.handleCode('00002');
  assert.equal(denied.calls[1][0],'notice'); assert.match(denied.calls[1][1],/ruxsat yo‘q/);
  assert.deepEqual(denied.calls[2],['start']); assert.equal(denied.flow.getSnapshot().processing,false);
});
test('manual entry waits for stop, holds the lock, and cancel resumes scanning', async () => {
  const stop=deferred(), h=harness({stopCamera:()=>{h.calls.push(['stop']);return stop.promise;}}); let prompts=0;
  const pending=h.flow.enterManual(async()=>{prompts++;return null;});
  assert.equal(h.flow.getSnapshot().manualEntry,true); await h.flow.handleCode('00002'); assert.equal(prompts,0);
  stop.resolve(); await pending; assert.equal(prompts,1); assert.deepEqual(h.calls,[['stop'],['start']]);
  assert.equal(h.flow.getSnapshot().processing,false); assert.equal(h.flow.getSnapshot().manualEntry,false);
});
test('manual submitted code is trimmed and runs the same routing path', async () => {
  const h=harness(); await h.flow.enterManual(async()=>`  00002  `);
  assert.deepEqual(h.calls.slice(0,3),[['stop'],['stop'],['preview','00002']]); assert.equal(h.calls[3][1].kind,'preview');
});
test('inactive session or disposed screen cannot emit stale prompt, result or notice after awaits', async () => {
  const stop=deferred(), h=harness({stopCamera:()=>stop.promise}); let prompts=0;
  const pending=h.flow.enterManual(async()=>{prompts++;return 'X';}); h.invalidate(); stop.resolve(); await pending;
  assert.equal(prompts,0); assert.equal(h.calls.length,0);
  const response=deferred(), h2=harness({preview:()=>response.promise});
  const request=h2.flow.handleCode('00002'); await Promise.resolve(); h2.flow.dispose(); response.resolve({code:'00002',paddon:{},wip:null}); await request;
  assert.deepEqual(h2.calls,[['stop']]);
});
test('late camera retry cannot overwrite a newer processing status', async () => {
  const start=deferred(), stop=deferred(), h=harness({startCamera:()=>start.promise,stopCamera:()=>stop.promise});
  const retry=h.flow.retryCamera(); const scan=h.flow.handleCode('00002'); start.resolve('running'); await retry;
  assert.equal(h.flow.getSnapshot().status,'Barcode tekshirilmoqda...'); h.invalidate(); stop.resolve(); await scan;
});
test('scope change during state callback blocks camera stop and notice', async () => {
  let valid=true, stops=0, notices=0;
  const h=harness({isCurrent:()=>valid,onState:()=>{valid=false;},stopCamera:async()=>{stops++;},onNotice:()=>{notices++;}});
  await h.flow.handleCode('00002'); assert.equal(stops,0); assert.equal(notices,0);
});
test('required evaluator rejects false, undefined, asynchronous and throwing scope guards', async () => {
  const unhandled=[];const listener=error=>unhandled.push(error);process.on('unhandledRejection',listener);
  try {for(const guard of [()=>false,()=>undefined,()=>Promise.resolve(true),()=>Promise.reject(new Error('no')),()=>{throw Error('no');}]) {
    const h=harness({isCurrent:guard});await h.flow.handleCode('00002');assert.deepEqual(h.calls,[]);
  } await new Promise(resolve=>setImmediate(resolve));assert.deepEqual(unhandled,[]);
  } finally {process.off('unhandledRejection',listener);}
});
test('scope-bound evaluator rejects a guard that changes account, scope or generation before returning true', async () => {
  for(const field of ['account','scope','generation']) {
    const live={account:'A',scope:'W1',generation:1},captured={...live};
    const evaluate=guard=>{if(JSON.stringify(live)!==JSON.stringify(captured))return false;
      const result=testWerkaGuardEvaluator(guard);return result===true&&JSON.stringify(live)===JSON.stringify(captured);};
    const h=harness({evaluateGuard:evaluate,isCurrent:()=>{live[field]=field==='generation'?2:'changed';return true;}});
    await h.flow.handleCode('00002');assert.deepEqual(h.calls,[],field);
  }
});
test('guard replacement during evaluation cannot dispatch a scanner action', async () => {
  let flow, stops=0;const deps={isCurrent:()=>true,evaluateGuard:guard=>{const result=guard();deps.isCurrent=()=>true;return result;},
    stopCamera:async()=>{stops++;},startCamera:async()=> 'running',preview:async()=>({}),onState:()=>{},onNotice:()=>{},onResult:()=>{}};
  flow=new WerkaScannerFlow(deps);await flow.handleCode('00002');assert.equal(stops,0);
});
