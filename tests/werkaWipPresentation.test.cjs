// Source-based WIP presentation tests. No receive action, device or navigation is used.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const filename=path.resolve(__dirname,'../src/werka/werkaWipPresentation.ts'), moduleUnderTest=new Module(filename);
moduleUnderTest.filename=filename; moduleUnderTest.paths=require.main.paths;
const receiveFile=path.resolve(__dirname,'../src/werka/werkaReceiveLogic.ts'), receiveModule=new Module(receiveFile);
receiveModule.filename=receiveFile; receiveModule.paths=require.main.paths;
receiveModule._compile(ts.transpileModule(fs.readFileSync(receiveFile,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,receiveFile);
moduleUnderTest.require=name=>name==='./werkaReceiveLogic'?receiveModule.exports:require(name);
moduleUnderTest._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,filename);
const api=moduleUnderTest.exports;
const state={busy:false,mustReload:false,receipt:null,warehouse:'W1'};
const preview={canReceive:true,snapshotToken:'s',receiveBlockedReason:'',paddonCode:'P1',apparatusNames:{'apparatus:x:1':'Laminator'},
  batch:{batch_id:'b',qr_payload:'QR',label_item_name:'Item apparatus:x:1',label_item_code:'IT',order_id:'O1',produced_qty:1.25,uom:'kg',
    finished_goods_kg:null,finished_goods_meter:null,current_location:'apparatus:x:missing',worker_display_name:'Worker',description:'Note',wip_status:'waiting'}};
test('WIP body fields, name fallback and quantities follow source',()=>{
  assert.deepEqual(api.werkaWipPresentation(preview,state),{product:'Item Laminator',order:'Buyurtma: O1',qr:'QR: QR',quantity:'1.25 kg',
    location:'Joylashuv: Apparat nomi mavjud emas',worker:'Ishchi: Worker',description:'Note',status:'Kirimga tayyor'});
  const next={...preview,batch:{...preview.batch,label_item_name:'',finished_goods_kg:12.5,finished_goods_meter:0,worker_display_name:''}};
  assert.equal(api.werkaWipPresentation(next,state).product,'IT');assert.equal(api.werkaWipPresentation(next,state).quantity,'12.5 kg • 0 m');
  assert.equal(api.werkaWipPresentation(next,state).worker,'');
  assert.equal(api.werkaWipPresentation(next,{...state,receipt:{warehouse:'W2'}}).location,'Joylashuv: W2');
});
test('receipt and blocked reasons take priority over WIP status and canReceive',()=>{
  assert.equal(api.werkaWipStatus(preview,{}),'Omborga kirim qilingan');
  const expected={paddon_item_already_assigned:'WIP P1 paddoniga biriktirilgan. Paddon QR orqali kirim qiling.',
    order_not_active:'Buyurtma faol emas. Kirim mumkin emas.',apparatus_inactive:'Apparat faol emas. Kirim mumkin emas.',
    wip_location_mismatch:'WIP joylashuvi o‘zgargan. Kirim mumkin emas.',already_received:'WIP avval kirim qilingan.'};
  for(const [reason,text] of Object.entries(expected)) assert.equal(api.werkaWipStatus({...preview,receiveBlockedReason:reason},null),text);
  assert.equal(api.werkaWipStatus({...preview,batch:{...preview.batch,wip_status:'in_use'}},null),'WIP hozir ishlatilmoqda. Kirim mumkin emas.');
  assert.equal(api.werkaWipStatus({...preview,batch:{...preview.batch,wip_status:'processed'}},null),'WIP avval ishlatilgan. Kirim mumkin emas.');
  assert.equal(api.werkaWipStatus({...preview,canReceive:false},null),'Bu WIP hozir omborga kirim qilish uchun tayyor emas.');
});
test('apparatus substitution is case-insensitive but lookup key remains exact',()=>{
  assert.equal(api.werkaWipLabel('APPARATUS:x:1 / apparatus:x:1',{ 'apparatus:x:1':'A' }),'Apparat nomi mavjud emas / A');
  assert.equal(api.werkaWipLabel('(apparatus:x:1),',{ 'apparatus:x:1':'A' }), '(A),');
});
test('WIP formatting preserves V2 integer, six decimal and negative-zero cases',()=>{
  const inputs=[-0,0,1,-1,1.25,1.2345675,1.2345674,-0.0000001,999.9999999,1e21];
  assert.deepEqual(inputs.map(api.werkaWipQuantity),['-0','0','1','-1','1.25','1.234568','1.234567','-0','1000','1e+21']);
});
