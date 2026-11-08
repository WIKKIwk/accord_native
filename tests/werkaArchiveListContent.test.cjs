// Read-only list body only. No Paddon route, PDF, account source or device is exercised.
const assert=require('node:assert/strict'),fs=require('node:fs'),Module=require('node:module'),path=require('node:path');
const test=require('node:test'),ts=require('typescript'),catalog=require('../src/shared/localization/catalog.json');
function compile(file,mocks={}){const filename=path.resolve(__dirname,'../src',file),m=new Module(filename);m.filename=filename;m.paths=require.main.paths;
  m.require=name=>Object.hasOwn(mocks,name)?mocks[name]:require(name);
  m._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,filename);return m.exports;}
const localization=compile('shared/localization/index.ts',{'./catalog.json':catalog});
const delivery=compile('werka/werkaDeliveryPresentation.ts',{'../shared/localization':localization});
const model=compile('werka/werkaArchiveListPresentation.ts',{'../shared/localization':localization,'./werkaDeliveryPresentation':delivery});
const jsx={Fragment:'Fragment',jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})};
function nodes(node,type){if(!node||typeof node!=='object')return[];if(Array.isArray(node))return node.flatMap(x=>nodes(x,type));
  return [...(node.type===type?[node]:[]),...nodes(node.props?.children,type)];}
const item=(id,overrides={})=>({id,supplier_ref:'',supplier_name:'',item_code:'SKU',item_name:'Item',highlight:'',sent_qty:5,accepted_qty:2,uom:'kg',...overrides});
test('Paddon code and warehouse precedence match source',()=>{
  assert.equal(model.werkaArchivePaddonCode(item('paddon:ID:line',{supplier_ref:' paddon:REF ',supplier_name:'Paddon NAME • WH'})),'REF');
  assert.equal(model.werkaArchivePaddonCode(item('paddon:ID:line')),'ID');
  assert.equal(model.werkaArchivePaddonCode(item('R',{supplier_name:'Paddon NAME • WH'})),'NAME');
  assert.equal(model.werkaArchivePaddonWarehouse(item('R',{highlight:' Chosen ',supplier_name:'Paddon NAME • Other'})),'Chosen');
  assert.equal(model.werkaArchivePaddonWarehouse(item('R',{supplier_name:'Paddon NAME • WH'})),'WH');
});
test('grouping preserves first-seen order, duplicate single IDs and source quantity rules',()=>{
  const items=[item('p1',{supplier_ref:'paddon:P',supplier_name:'Paddon P • WH'}),item('single',{supplier_name:'Supplier'}),
    item('p2',{supplier_ref:'paddon:P'}),item('single',{item_name:'later'})];
  const groups=model.werkaArchiveGroups(items,'received');assert.deepEqual(groups.map(x=>x.key),['paddon:P','single:single']);
  assert.deepEqual(groups[0],{key:'paddon:P',code:'P',title:'Paddon P',subtitle:'WH',trailing:'2 ta rulon'});
  assert.deepEqual(groups[1],{key:'single:single',code:'',title:'Supplier',subtitle:'SKU • Item',trailing:'2 kg'});
  assert.equal(model.werkaArchiveGroups([item('a')],'sent')[0].trailing,'5 kg');
  assert.equal(model.werkaArchiveGroups([item('a',{accepted_qty:7})],'returned')[0].trailing,'0 kg');
  assert.equal(model.werkaArchiveGroups([item('a',{accepted_qty:0})],'received')[0].trailing,'5 kg');
});
test('summary reuses localized count and source numeric formatter',()=>{
  const data={summary:{recordCount:2,totalsByUOM:[{qty:1.5,uom:'kg'},{qty:-0,uom:'m'}]},items:[]};
  assert.deepEqual(model.werkaArchiveSummary(data,'uz'),{count:'2 ta yozuv',totals:['1.50 kg','-0 m']});
});
for(const platform of ['ios','android'])test(`${platform} archive list distinguishes loading/error/empty and has no held Paddon action`,async()=>{
  const mocks={'react/jsx-runtime':jsx,'./werkaArchiveListPresentation':model,'../shared/localization':localization,
    [`./WerkaArchiveListDateFilter.${platform}`]:{WerkaArchiveListDateFilter:'ArchiveFilter'},
    '@expo/ui/swift-ui':Object.fromEntries(['Button','HStack','ProgressView','Section','Spacer','Text','VStack'].map(x=>[x,x])),
    '@expo/ui/jetpack-compose':{useMaterialColors:()=>({onSurfaceVariant:'muted'})},
    'react-native':{ActivityIndicator:'ActivityIndicator',Text:'RNText',View:'View'},'react-native-reanimated':{useSharedValue:v=>({value:v})},
    '../preparation/PreparationUI.ios':{PreparationList:'PreparationList'},'../preparation/PreparationUI.android':{PreparationRow:'PreparationRow',PreparationText:'PreparationText'},
    '../shared/orders/OrdersList':{OrdersList:'OrdersList'}};
  const {WerkaArchiveListContent}=compile(`werka/WerkaArchiveListContent.${platform}.tsx`,mocks);let refresh=0;
  const props={kind:'received',data:null,loading:true,error:null,locale:'uz',onRefresh:async()=>{refresh++;}};
  assert.equal(nodes(WerkaArchiveListContent(props),platform==='ios'?'ProgressView':'ActivityIndicator').length,1);
  const failure=WerkaArchiveListContent({...props,loading:false,error:Error('offline')});
  const retry=nodes(failure,platform==='ios'?'Button':'PreparationRow')[0];retry.props.onPress();await Promise.resolve();assert.equal(refresh,1);
  const empty=WerkaArchiveListContent({...props,loading:false,data:{summary:{recordCount:0,totalsByUOM:[]},items:[]}});
  assert.equal(nodes(empty,platform==='ios'?'Button':'PreparationRow').some(x=>typeof x.props.onPress==='function'),false);
  const full=WerkaArchiveListContent({...props,loading:false,data:{summary:{recordCount:1,totalsByUOM:[]},items:[item('p',{supplier_ref:'paddon:P'})]}});
  assert.equal(nodes(full,'Button').length,0);assert.equal(nodes(full,'PreparationRow').some(x=>typeof x.props.onPress==='function'),false);
  const list=nodes(full,platform==='ios'?'PreparationList':'OrdersList')[0];await list.props[platform==='ios'?'refresh':'onRefresh']();assert.equal(refresh,2);
});
