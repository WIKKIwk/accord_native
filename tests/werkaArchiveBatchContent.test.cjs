// Partial read-only panel only; no customer picker, submit, route, live account or device is used.
const assert=require('node:assert/strict'),fs=require('node:fs'),Module=require('node:module'),path=require('node:path');
const test=require('node:test'),ts=require('typescript');
function compile(file,mocks={}){const filename=path.resolve(__dirname,'../src/werka',file),m=new Module(filename);m.filename=filename;m.paths=require.main.paths;
  m.require=name=>Object.hasOwn(mocks,name)?mocks[name]:require(name);
  m._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,filename);return m.exports;}
const delivery=compile('werkaDeliveryPresentation.ts',{'../shared/localization':{}});
const model=compile('werkaArchiveBatchPresentation.ts',{'./werkaDeliveryPresentation':delivery});
const jsx={Fragment:'Fragment',jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})};
function nodes(node,type){if(!node||typeof node!=='object')return[];if(Array.isArray(node))return node.flatMap(x=>nodes(x,type));
  return [...(node.type===type?[node]:[]),...nodes(node.props?.children,type)];}
const payload={sessionID:'s',itemName:' Item ',qtyText:'1.25',qty:1.25,bruttoText:'2.50',bruttoQty:2.5,nettoText:'1.25',nettoQty:1.25,batchTime:' May 01 ',rawValue:'raw'};
const option={customerRef:'C',customerName:'Customer',customerPhone:'',itemCode:'IT',itemName:'Item',uom:'kg',warehouse:'WH'};
const customer={ref:'C',name:'Customer',phone:''};
test('archive batch loading, missing and resolved text and rows follow source',()=>{
  const loading=model.werkaArchiveBatchPresentation({payload,state:'loading'});
  assert.equal(loading.title,' Item ');assert.equal(loading.subtitle,'Mahsulot customer ro‘yxatidan qidirilmoqda...');
  assert.equal(loading.shellTitle,'Batch QR');assert.equal(loading.shellSubtitle,'Item');
  assert.deepEqual(loading.rows,[{label:'Netto',value:'1.25 Kg'},{label:'Brutto',value:'2.5 Kg'},{label:'Sana',value:' May 01 '}]);
  const missing=model.werkaArchiveBatchPresentation({payload,state:'missing'});assert.equal(missing.title,'Mahsulot topilmadi');
  assert.equal(missing.subtitle,'Batch QR ichidagi mahsulot customer jo‘natish ro‘yxatidan topilmadi.');
  const resolved=model.werkaArchiveBatchPresentation({payload,state:'resolved',option,customer});
  assert.equal(resolved.title,'Item');assert.equal(resolved.subtitle,'Customer');
  assert.deepEqual(resolved.rows.slice(-3),[{label:'Kod',value:'IT'},{label:'Haridor',value:'Customer'},{label:'Ombor',value:'WH'}]);
  assert.equal(model.werkaArchiveBatchPresentation({payload:{...payload,batchTime:' '},state:'resolved',option:{...option,warehouse:' '},customer}).rows.length,4);
});
test('batch quantity reuses two-decimal formatter and trims only fractional zeros',()=>{
  assert.deepEqual([-0,0,100,1.5,1.234,1.999,1e21].map(model.werkaArchiveBatchQuantity),['-0','0','100','1.5','1.23','2','1e+21']);
});
for(const platform of ['ios','android'])test(`${platform} archive batch body reuses native rows and exposes no held action`,()=>{
  const mocks={'react/jsx-runtime':jsx,'./werkaArchiveBatchPresentation':model,
    '@expo/ui/swift-ui':Object.fromEntries(['HStack','Image','ProgressView','Section','Spacer','Text','VStack'].map(x=>[x,x])),
    '@expo/ui/jetpack-compose':{useMaterialColors:()=>({onSurface:'text'})},'expo-symbols':{SymbolView:'SymbolView'},
    'react-native':{ActivityIndicator:'ActivityIndicator',ScrollView:'ScrollView',Text:'RNText'},
    '../preparation/PreparationUI.ios':{PreparationList:'PreparationList'},'../preparation/PreparationUI.android':{PreparationRow:'PreparationRow'}};
  const {WerkaArchiveBatchContent}=compile(`WerkaArchiveBatchContent.${platform}.tsx`,mocks);
  for(const state of ['loading','missing','resolved']){const tree=WerkaArchiveBatchContent(state==='resolved'?{payload,state,option,customer}:{payload,state});
    assert.ok(nodes(tree,platform==='ios'?'PreparationList':'PreparationRow').length);assert.equal(nodes(tree,'Button').length,0);
    assert.equal(nodes(tree,'PreparationRow').some(row=>typeof row.props.onPress==='function'),false);}
});
