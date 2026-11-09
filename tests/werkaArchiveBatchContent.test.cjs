// Partial read-only panel only; no customer picker, submit, route, live account or device is used.
const assert=require('node:assert/strict'),fs=require('node:fs'),Module=require('node:module'),path=require('node:path');
const test=require('node:test'),ts=require('typescript'),catalog=require('../src/shared/localization/catalog.json');
function compile(file,mocks={}){const filename=path.resolve(__dirname,'../src/werka',file),m=new Module(filename);m.filename=filename;m.paths=require.main.paths;
  m.require=name=>Object.hasOwn(mocks,name)?mocks[name]:require(name);
  m._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,filename);return m.exports;}
const localization=compile('../shared/localization/index.ts',{'./catalog.json':catalog});
const delivery=compile('werkaDeliveryPresentation.ts',{'../shared/localization':localization});
const trim=compile('werkaBatchTrim.ts');
const model=compile('werkaArchiveBatchPresentation.ts',{'./werkaDeliveryPresentation':delivery,'./werkaBatchTrim':trim,'../shared/localization':localization});
const jsx={Fragment:'Fragment',jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})};
function nodes(node,type){if(!node||typeof node!=='object')return[];if(Array.isArray(node))return node.flatMap(x=>nodes(x,type));
  return [...(node.type===type?[node]:[]),...nodes(node.props?.children,type)];}
const payload={sessionID:'s',itemName:' Item ',qtyText:'1.25',qty:1.25,bruttoText:'2.50',bruttoQty:2.5,nettoText:'1.25',nettoQty:1.25,batchTime:' May 01 ',rawValue:'raw'};
const option={customerRef:'C',customerName:'Customer',customerPhone:'',itemCode:'IT',itemName:'Item',uom:'kg',warehouse:'WH'};
const customer={ref:'C',name:'Customer',phone:''};
test('archive batch loading, missing and resolved text and rows follow source',()=>{
  const loading=model.werkaArchiveBatchPresentation({payload,state:'loading',locale:'en'});
  assert.equal(loading.title,' Item ');assert.equal(loading.subtitle,'Mahsulot customer ro‘yxatidan qidirilmoqda...');
  assert.equal(loading.shellTitle,'Batch QR');assert.equal(loading.shellSubtitle,'Item');
  assert.deepEqual(loading.metrics,[{label:'Netto',value:'1.25 Kg'},{label:'Brutto',value:'2.5 Kg'}]);
  assert.deepEqual(loading.infoRows,[{label:'Sana',value:'May 01'}]);
  const missing=model.werkaArchiveBatchPresentation({payload,state:'missing',locale:'en'});assert.equal(missing.title,'Mahsulot topilmadi');
  assert.equal(missing.subtitle,'Batch QR ichidagi mahsulot customer jo‘natish ro‘yxatidan topilmadi.');
  const resolved=model.werkaArchiveBatchPresentation({payload,state:'resolved',option,customer,locale:'en'});
  assert.equal(resolved.title,'Item');assert.equal(resolved.subtitle,'Customer');
  assert.deepEqual(resolved.infoRows.slice(-3),[{label:'Kod',value:'IT'},{label:'Haridor',value:'Customer'},{label:'Ombor',value:'WH'}]);
  assert.equal(model.werkaArchiveBatchPresentation({payload:{...payload,batchTime:' '},state:'resolved',option:{...option,warehouse:' '},customer,locale:'en'}).infoRows.length,2);
});
test('batch quantity reuses two-decimal formatter and trims only fractional zeros',()=>{
  assert.deepEqual([-0,0,100,1.5,1.234,1.999,1e21].map(model.werkaArchiveBatchQuantity),['-0','0','100','1.5','1.23','2','1e+21']);
});
test('batch presentation follows Dart edge whitespace for optional source fields',()=>{
  const view=model.werkaArchiveBatchPresentation({payload:{...payload,itemName:'\u0085',batchTime:'\u0085'},
    state:'resolved',option:{...option,warehouse:'\u0085'},customer,locale:'en'});
  assert.equal(view.shellSubtitle,'Batch tafsiloti');
  assert.deepEqual(view.infoRows.map(row=>row.label),['Kod','Haridor']);
});
test('info rows use source AppInfoRow trimming and blank-value dash, not raw strings',()=>{
  const view=model.werkaArchiveBatchPresentation({payload:{...payload,batchTime:'\u0085 May 01 \u0085'},state:'resolved',
    option:{...option,itemCode:'\u0085',warehouse:'\u0085 WH \u0085'},customer:{...customer,name:' \u0085 '},locale:'en'});
  assert.deepEqual(view.infoRows,[{label:'Sana',value:'May 01'},{label:'Kod',value:'—'},
    {label:'Haridor',value:'—'},{label:'Ombor',value:'WH'}]);
  assert.equal(view.subtitle,' \u0085 ');
});
test('info-row display replays 303 standalone Dart trim samples',()=>{
  const fixture=require('./contracts/f11910bb/werka_unannounced_input_oracle.json');assert.equal(fixture.cases.length,303);
  for(const sample of fixture.cases){
    const view=model.werkaArchiveBatchPresentation({payload,state:'resolved',option:{...option,itemCode:sample.input},customer,locale:'en'});
    assert.equal(view.infoRows.find(row=>row.label==='Kod').value,sample.trimmed||'—',JSON.stringify(sample.input));
  }
});
test('source scan/back copy uses Urdu-aware text and appears only after loading',()=>{
  for(const locale of ['uz','en','ru','ur-PK']){
    const loading=model.werkaArchiveBatchPresentation({payload,state:'loading',locale});
    const missing=model.werkaArchiveBatchPresentation({payload,state:'missing',locale});
    const resolved=model.werkaArchiveBatchPresentation({payload,state:'resolved',option,customer,locale});
    assert.equal(loading.showScanActions,false);assert.equal(missing.showScanActions,true);assert.equal(resolved.showScanActions,true);
    assert.deepEqual([missing.scanLabel,missing.backLabel],locale==='ur-PK'?['دوبارہ اسکین کریں','واپس']:['Qayta scan','Ortga']);
  }
});
for(const platform of ['ios','android'])test(`${platform} archive batch body groups metric tiles and exposes no held action`,()=>{
  const mocks={'react/jsx-runtime':jsx,'./werkaArchiveBatchPresentation':model,
    '@expo/ui/swift-ui':Object.fromEntries(['Button','HStack','Image','ProgressView','Section','Spacer','Text','VStack'].map(x=>[x,x])),
    '@expo/ui/swift-ui/modifiers':Object.fromEntries(['accessibilityIdentifier','buttonStyle','disabled','font','frame','lineLimit'].map(name=>[name,(...args)=>({name,args})])),
    '@expo/ui/jetpack-compose':{...Object.fromEntries(['Button','FilledTonalButton','Host','RNHostView','Row'].map(x=>[x,x])),Text:'ComposeText',
      useMaterialColors:()=>({onSurface:'text',onSurfaceVariant:'muted',primary:'primary',error:'error',
        surfaceContainerLow:'surface',surfaceContainerHighest:'tile',outlineVariant:'outline'})},
    '@expo/ui/jetpack-compose/modifiers':Object.fromEntries(['fillMaxWidth','weight'].map(name=>[name,(...args)=>({name,args})])),
    'expo-symbols':{SymbolView:'SymbolView'},
    'react-native':{ActivityIndicator:'ActivityIndicator',ScrollView:'ScrollView',Text:'RNText',View:'View'},
    '../preparation/PreparationUI.ios':{PreparationList:'PreparationList'},'../components/WorkerQueueCard.android':{WorkerQueueCard:'WorkerQueueCard'}};
  const {WerkaArchiveBatchContent}=compile(`WerkaArchiveBatchContent.${platform}.tsx`,mocks);
  for(const state of ['loading','missing','resolved']){const tree=WerkaArchiveBatchContent(state==='resolved'?{payload,state,option,customer,locale:'en'}:{payload,state,locale:'en'});
    assert.ok(nodes(tree,platform==='ios'?'PreparationList':'WorkerQueueCard').length);
    const actions=platform==='ios'?nodes(tree,'Button'):[...nodes(tree,'FilledTonalButton'),...nodes(tree,'Button')];
    assert.equal(actions.length,state==='loading'?0:2);
    if(state!=='loading')assert.deepEqual(actions.map(action=>platform==='ios'?action.props.label:nodes(action,'ComposeText')[0].props.children),['Qayta scan','Ortga']);
    for(const action of actions){assert.equal(action.props[platform==='ios'?'onPress':'onClick'],undefined);
      if(platform==='ios')assert.ok(action.props.modifiers.some(value=>value.name==='disabled'&&value.args[0]===true));else assert.equal(action.props.enabled,false);}
    assert.equal(nodes(tree,'WorkerQueueCard').some(row=>typeof row.props.onPress==='function'),false);
    const group=platform==='ios'?nodes(tree,'HStack').find(row=>row.props.modifiers?.some(value=>value.name==='accessibilityIdentifier'&&value.args[0]==='archive_batch_metrics'))
      :nodes(tree,'View').find(row=>row.props.testID==='archive_batch_metrics');
    assert.ok(group);const labels=nodes(group,platform==='ios'?'Text':'RNText').map(value=>value.props.children);
    assert.deepEqual(labels,['Netto','1.25 Kg','Brutto','2.5 Kg']);
    if(platform==='ios')for(const value of nodes(group,'Text').filter(text=>typeof text.props.children==='string'&&text.props.children.endsWith(' Kg')))
      assert.ok(value.props.modifiers.some(modifier=>modifier.name==='lineLimit'&&modifier.args[0]===1));}
});
