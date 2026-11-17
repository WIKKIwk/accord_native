const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const root = path.resolve(__dirname, '../src'), cache = new Map();
function load(name) {
  name = name.replaceAll('\\', '/');
  if (cache.has(name)) return cache.get(name).exports;
  const filename = path.join(root, name), loaded = new Module(filename, module); cache.set(name, loaded);
  loaded.require = target => target.startsWith('.') ? load(`${path.relative(root, path.resolve(path.dirname(filename), target))}.ts`) : require(target);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ESNext,
  } }).outputText, filename);
  return loaded.exports;
}

const { QolipCheckoutReturns } = load('qolip/qolipCheckoutReturns.ts');
const { QolipLocationTransferState } = load('qolip/qolipLocationTransferState.ts');
const row = (id, patch = {}) => ({ id, block:'A',warehouse:'W',item_name:id,item_code:'I',qolip_code:id,size:1,quantity:3,row_letter:'A',column_number:1,location_label:'A1',...patch });
test('bulk checkout cancellation resolves every target first and sends no partial batch', async () => {
 const rows=[row('one'),row('two',{row_letter:'',column_number:null,location_label:''})], sent=[];
 const owner=new QolipCheckoutReturns({current:()=>true,pick:async()=>null,send:async e=>sent.push(e.id),selected:()=>rows,reload:async()=>{},replaceSelected:()=>{},message:()=>{},failure:()=>{}});
 await owner.bulk();assert.deepEqual(sent,[]);assert.equal(owner.getSnapshot().bulkReturning,false);
});
test('bulk returns preserve source order, keep failed IDs, reload before source partial notice', async () => {
 const rows=[row('two'),row('one'),row('three')], events=[];let selected;
 const owner=new QolipCheckoutReturns({current:()=>true,pick:async()=>null,send:async e=>{events.push(e.id);if(e.id==='one')throw Error();},selected:()=>rows,
  reload:async()=>events.push('reload'),replaceSelected:ids=>{selected=[...ids]},message:(key,value)=>events.push([key,value]),failure:()=>{}});
 await owner.bulk();assert.deepEqual(events.slice(0,4),['two','one','three','reload']);assert.deepEqual(selected,['one']);
 assert.deepEqual(events[4],['checkouts.selection_returned_partial',{count:2,success:2,failed:1}]);assert.equal(owner.getSnapshot().returningIds.size,0);
});
test('an account transition while choosing a checkout target cannot dispatch a return', async () => {
 let current=true,calls=0;const owner=new QolipCheckoutReturns({current:()=>current,pick:async()=>{current=false;return 'C3'},send:async()=>calls++,selected:()=>[],reload:async()=>{},replaceSelected:()=>{},message:()=>{},failure:()=>{}});
 await owner.single(row('one',{row_letter:'',column_number:null,location_label:''}));assert.equal(calls,0);
});
test('location transfer mirrors source defaults, quantity validation and target readback confirmation', async () => {
 const messages=[],calls=[],a={name:'A',warehouse:'W'},b={name:'B',warehouse:'W'};let confirmed=false;
 const state=new QolipLocationTransferState({current:()=>true,blocks:async()=>({blocks:[a,b],warehouses:['W'],supports_cross_block_move:true}),locations:async()=>[row('source')],
  move:async input=>{calls.push(input);return row('result',{block:confirmed?'B':'A',row_letter:'C',column_number:2,location_label:'C2',qolip_code:'source'})},
  message:(key,values)=>messages.push([key,values]),failure:error=>{throw error}});
 await state.reload();assert.equal(state.getSnapshot().sourceBlock,'A');assert.equal(state.getSnapshot().targetBlock,'A');
 state.selectSource('source');assert.equal(state.getSnapshot().quantity,'3');state.selectTargetBlock('B');state.setCell('c02');state.setQuantity('1.5');await state.transfer();assert.equal(calls.length,0);
 assert.equal(messages.at(-1)[0],'transfer.quantity_range');state.setQuantity('2');await state.transfer();assert.equal(messages.at(-1)[0],'transfer.target_unconfirmed');assert.equal(state.getSnapshot().source.id,'source');
 confirmed=true;await state.transfer();assert.equal(messages.at(-1)[0],'transfer.moved');assert.equal(state.getSnapshot().source,null);
 assert.deepEqual(calls[1],{locationId:'source',targetBlock:b,quantity:2,rowLetter:'C',columnNumber:2});
});
test('legacy servers only offer source block as the transfer target', async () => {
 const state=new QolipLocationTransferState({current:()=>true,blocks:async()=>({blocks:[{name:'A',warehouse:'W'},{name:'B',warehouse:'W'}],warehouses:['W'],supports_cross_block_move:false}),locations:async()=>[row('one')],move:async()=>{},message:()=>{},failure:()=>{}});
 await state.reload();state.selectSource('one');assert.deepEqual(state.targetBlocks,[{name:'A',warehouse:'W'}]);
});
