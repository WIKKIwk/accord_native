// Partial read-only body. Discussion, navigation, auth lifecycle and device are intentionally not wired.
const assert=require('node:assert/strict'),fs=require('node:fs'),Module=require('node:module'),path=require('node:path');
const test=require('node:test'),ts=require('typescript'),catalog=require('../src/shared/localization/catalog.json');
function compile(file,mocks={}) {const filename=path.resolve(__dirname,'../src',file),m=new Module(filename);m.filename=filename;m.paths=require.main.paths;
  m.require=name=>Object.hasOwn(mocks,name)?mocks[name]:require(name);
  m._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,filename);return m.exports;}
const localization=compile('shared/localization/index.ts',{'./catalog.json':catalog});
const model=compile('werka/werkaDeliveryPresentation.ts',{'../shared/localization':localization});
const jsx={Fragment:'Fragment',jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})};
function nodes(node,type){if(!node||typeof node!=='object')return[];if(Array.isArray(node))return node.flatMap(x=>nodes(x,type));
  return [...(node.type===type?[node]:[]),...nodes(node.props?.children,type)];}
const record={id:'R',status:'pending',supplier_name:'Customer',item_name:'Item',sent_qty:1.5,accepted_qty:0,uom:'kg',created_label:'2026-01-01',note:''};
test('delivery status and note cover all six source states',()=>{
  const labels={pending:'Haridor javobi kutilmoqda',accepted:'Haridor tasdiqlagan',rejected:'Haridor rad etgan',partial:'Qisman yakunlangan',cancelled:'Bekor qilingan',draft:'Draft'};
  for(const [status,label] of Object.entries(labels)){const view=model.werkaDeliveryPresentation({record:{...record,status},locale:'uz'});
    assert.equal(view.status,label);assert.equal(view.discussionHeld,status==='accepted'||status==='rejected');}
  const pending=model.werkaDeliveryPresentation({record,locale:'uz'});assert.match(pending.note,/haridorga yuborilgan/);
  const accepted=model.werkaDeliveryPresentation({record:{...record,status:'accepted',note:'  hello  ',accepted_qty:1},locale:'uz'});
  assert.equal(accepted.note,'hello');assert.equal(accepted.rows.length,5);assert.equal(accepted.rows[2].value,'1 kg');
  assert.equal(model.werkaDeliveryPresentation({record:{...record,status:'accepted'},locale:'en'}).note,'No additional note.');
});
test('delivery quantity uses source integer, fixed-two and negative-zero formatting',()=>{
  assert.deepEqual([-0,0,1,-1,1.5,1.234,1.999].map(model.werkaDeliveryQuantity),['-0','0','1','-1','1.50','1.23','2.00']);
});
for(const platform of ['ios','android'])test(`${platform} delivery reuses native lists/rows and exposes no held discussion action`,()=>{
  const mocks={'react/jsx-runtime':jsx,'./werkaDeliveryPresentation':model,
    '@expo/ui/swift-ui':Object.fromEntries(['HStack','Section','Spacer','Text','VStack'].map(x=>[x,x])),
    '@expo/ui/jetpack-compose':{useMaterialColors:()=>({onSurfaceVariant:'muted',onSurface:'text'})},
    'react-native':{ScrollView:'ScrollView',Text:'RNText'},
    '../preparation/PreparationUI.ios':{PreparationList:'PreparationList'},
    '../preparation/PreparationUI.android':{PreparationRow:'PreparationRow'}};
  const {WerkaDeliveryContent}=compile(`werka/WerkaDeliveryContent.${platform}.tsx`,mocks);
  for(const status of ['pending','accepted','rejected']){const tree=WerkaDeliveryContent({record:{...record,status},locale:'uz'});
    assert.ok(nodes(tree,platform==='ios'?'PreparationList':'PreparationRow').length);assert.equal(nodes(tree,'Button').length,0);
    assert.equal(nodes(tree,'PreparationRow').some(x=>typeof x.props.onPress==='function'),false);}
});
