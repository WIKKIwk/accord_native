// Unwired read-only rows; no notification store, subscription, count, action, route or device is used.
const assert=require('node:assert/strict'),fs=require('node:fs'),Module=require('node:module'),path=require('node:path');
const test=require('node:test'),ts=require('typescript'),catalog=require('../src/shared/localization/catalog.json');
function compile(file,mocks={}){const filename=path.resolve(__dirname,'../src',file),m=new Module(filename);m.filename=filename;m.paths=require.main.paths;
  m.require=name=>Object.hasOwn(mocks,name)?mocks[name]:require(name);
  m._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,filename);return m.exports;}
const model=compile('werka/werkaNotificationPresentation.ts',{'../shared/localization':{localizedGetter:(key,locale)=>catalog.getters[key][locale]}});
const jsx={Fragment:'Fragment',jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})};
function nodes(node,type){if(!node||typeof node!=='object')return[];if(Array.isArray(node))return node.flatMap(x=>nodes(x,type));
  return [...(node.type===type?[node]:[]),...nodes(node.props?.children,type)];}
const rec=(id,status='pending')=>({id,status,event_type:'',supplier_name:'Supplier',item_code:'SKU',item_name:'Item',highlight:'',
  sent_qty:3.5,accepted_qty:0,uom:'kg',created_label:'2026-01-01'});
test('notification title, secondary text and metric follow source event/status',()=>{
  assert.deepEqual(model.werkaNotificationPresentation(rec('1'),'uz'),{title:'Supplier',secondary:'Item',metric:'4 kg qabul kutmoqda',date:'2026-01-01',icon:'pending'});
  const accepted={...rec('2','accepted'),accepted_qty:1.5,highlight:' reason '};
  assert.equal(model.werkaNotificationPresentation(accepted,'uz').title,'SKU');
  assert.equal(model.werkaNotificationPresentation(accepted,'uz').secondary,' reason ');
  assert.equal(model.werkaNotificationPresentation(accepted,'uz').metric,'2 kg qabul qilindi • 4 kg kutilgan');
  assert.equal(model.werkaNotificationPresentation({...accepted,event_type:'supplier_ack'},'uz').title,"Ta'minotchi tasdiqladi");
  assert.equal(model.werkaNotificationPresentation({...rec('3'),sent_qty:-0},'uz').metric,'-0 kg qabul kutmoqda');
});
test('highlighted IDs partition rows stably without inventing or modifying unread state',()=>{
  const a=rec('a'),b=rec('b'),c=rec('c'),items=[a,b,c], highlighted=new Set(['c','a']);
  assert.deepEqual(model.orderedWerkaNotifications(items,highlighted).map(x=>x.id),['a','c','b']);
  assert.deepEqual(items.map(x=>x.id),['a','b','c']);assert.deepEqual([...highlighted],['c','a']);
});
for(const platform of ['ios','android'])test(`${platform} notification rows reuse native list/card and expose no held actions`,async()=>{
  const mocks={'react/jsx-runtime':jsx,'./werkaNotificationPresentation':model,
    '@expo/ui/swift-ui':Object.fromEntries(['HStack','Image','Section','Spacer','Text','VStack'].map(x=>[x,x])),
    '@expo/ui/swift-ui/modifiers':{lineLimit:n=>({lineLimit:n}),listRowBackground:color=>({color})},
    '@expo/ui/jetpack-compose':{useMaterialColors:()=>({surface:'surface',secondaryContainer:'highlight',onSurface:'text',onSurfaceVariant:'muted'})},
    'react-native':{PlatformColor:name=>name,Text:'RNText',View:'View'},'expo-symbols':{SymbolView:'SymbolView'},
    'react-native-reanimated':{useSharedValue:value=>({value})},'../shared/orders/OrdersList':{OrdersList:'OrdersList'},
    '../preparation/PreparationUI.ios':{PreparationList:'PreparationList'},'../components/WorkerQueueCard.android':{WorkerQueueCard:'WorkerQueueCard'}};
  const {WerkaNotificationRows}=compile(`werka/WerkaNotificationRows.${platform}.tsx`,mocks),highlighted=new Set(['b']);
  let refreshes=0;const tree=WerkaNotificationRows({items:[rec('a'),rec('b','accepted')],highlightedIds:highlighted,locale:'uz',onRefresh:async()=>{refreshes++;}});
  assert.equal(nodes(tree,'Button').length,0);assert.equal(nodes(tree,'WorkerQueueCard').some(x=>x.props.onPress),false);
  if(platform==='android'){const cards=nodes(tree,'WorkerQueueCard');assert.equal(cards.length,2);assert.equal(cards[0].props.backgroundColor,'highlight');assert.equal(cards[1].props.backgroundColor,'surface');}
  else assert.equal(nodes(tree,'PreparationList').length,1);
  const list=nodes(tree,platform==='ios'?'PreparationList':'OrdersList')[0];assert.equal(typeof list.props[platform==='ios'?'refresh':'onRefresh'],'function');await list.props[platform==='ios'?'refresh':'onRefresh']();assert.equal(refreshes,1);
});
