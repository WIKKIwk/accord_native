const assert=require('node:assert/strict'),test=require('node:test');
const {load}=require('./adminUsersSupport.cjs');
const baseline={apparatus_id:'apparatus:one',limit:10,search:'older order',epoch:'e',revision:8,scope:'s'};
const session={baseUrl:'https://example.test',token:'token'};
function setup(open){
 let listener,removed=0;const stopped=[],messages=[],errors=[],closures=[];
 const native={addListener(_name,callback){listener=callback;return{remove(){removed++;}};},openSupplyTasks(origin,url){return open({origin,url,send:event=>listener(event)});},stop:id=>stopped.push(id)};
 const {subscribeQolipTasksLive}=load('qolip/qolipTasksLive',{
  '../shared/supplyTasks/supplyTaskJson':load('shared/supplyTasks/supplyTaskJson'),
  '../../modules/accord-production-live/src/AccordProductionLiveModule':{productionLiveNativeModule:()=>native},
  '../auth':{activeSessionToken:value=>value.token},
  '../shared/supplyTasks/supplyTaskModels':{supplyTaskMessageFromJson:value=>value},
  '../shared/mobileApiException':load('shared/mobileApiException'),
 });
 return{subscribe:current=>subscribeQolipTasksLive(session,baseline,current,event=>messages.push(event),error=>errors.push(error),()=>closures.push(true)),
 send:event=>listener(event),stopped,messages,errors,closures,removed:()=>removed};
}
test('Qolip live preserves source query/cursor and accepts synchronous bridge events only for the admitted socket',()=>{
 let target;
 const h=setup(({origin,url,send})=>{assert.equal(origin,session.baseUrl);target=new URL(url);send({session:'other',type:'message',value:'{"ok":true,"rev":1}'});send({session:'owned',type:'message',value:'{"ok":true,"rev":9}'});return'owned';});
 const stop=h.subscribe(()=>true);
 assert.equal(target.pathname,'/v1/mobile/production-tasks/live');assert.equal(target.protocol,'wss:');
 assert.deepEqual(Object.fromEntries(target.searchParams),{kind:'qolip',apparatus:baseline.apparatus_id,limit:'10',search:baseline.search,token:'token',epoch:'e',rev:'8',scope:'s'});
 assert.deepEqual(h.messages,[{ok:true,rev:9}]);
 h.send({session:'owned',type:'message',value:'{"ok":true,"rev":9.0}'});assert.equal(h.errors.length,1);
 h.send({session:'owned',type:'error',statusCode:403,value:'denied'});assert.equal(h.errors[1].code,'forbidden');
 stop();stop();assert.deepEqual(h.stopped,['owned']);assert.equal(h.removed(),1);
 h.send({session:'owned',type:'close',value:''});assert.equal(h.closures.length,0);
});
test('account expiry during native open closes the real socket before queued data can publish',()=>{
 let current=true;const h=setup(({send})=>{send({session:'owned',type:'message',value:'{"ok":true,"rev":9}'});current=false;return'owned';});
 h.subscribe(()=>current);assert.deepEqual(h.stopped,['owned']);assert.equal(h.messages.length,0);assert.equal(h.removed(),1);
});
test('stale native events and opening failures cannot publish into another account',()=>{
 let current=true;const h=setup(()=> 'owned');const stop=h.subscribe(()=>current);current=false;
 for(const type of ['message','error','close'])h.send({session:'owned',type,value:'{"ok":true,"rev":9}'});
 assert.equal(h.messages.length+h.errors.length+h.closures.length,0);stop();
 const failed=setup(()=>{throw Error('open failed');});failed.subscribe(()=>true);assert.equal(failed.errors[0].message,'open failed');assert.equal(failed.removed(),1);
});
