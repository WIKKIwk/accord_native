// Partial Paddon footer only; no device, confirmation, mutation, route or real account is exercised.
const assert=require('node:assert/strict'),fs=require('node:fs'),Module=require('node:module'),path=require('node:path');
const test=require('node:test'),ts=require('typescript');
const root=path.resolve(__dirname,'../src/werka');
function compile(file,mocks={}){const filename=path.join(root,file),m=new Module(filename);m.filename=filename;m.paths=require.main.paths;
  m.require=name=>Object.hasOwn(mocks,name)?mocks[name]:require(name);
  m._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,filename);return m.exports;}
const receive=compile('werkaReceiveLogic.ts'),model=compile('werkaPaddonPresentation.ts',{'./werkaReceiveLogic':receive});
const footerModel=compile('werkaReceiveFooterModel.ts');
const jsx={Fragment:'Fragment',jsx:(type,props)=>typeof type==='function'?type(props):({type,props}),jsxs:(type,props)=>typeof type==='function'?type(props):({type,props})};
function nodes(node,type){if(!node||typeof node!=='object')return[];if(Array.isArray(node))return node.flatMap(x=>nodes(x,type));
  return [...(node.type===type?[node]:[]),...nodes(node.props?.children,type)];}
const preview={canReceive:true,snapshotToken:'token',warehouses:['W1','W2']};
const state={busy:false,mustReload:false,receipt:null,warehouse:'W1'};
const input={preview,state,confirming:false,error:'',locale:'uz',apparatusNames:{},onWarehouse:()=>{},onRequestReceive:()=>{},onReload:()=>{},onNextQr:()=>{}};
test('Paddon apparatus label fallback follows the locale and exact map key',()=>{
  const value='apparatus:x:1';assert.equal(model.werkaPaddonLabel(value,{},'uz'),'Apparat nomi mavjud emas');
  assert.equal(model.werkaPaddonLabel(value,{},'en'),'Machine name unavailable');
  assert.equal(model.werkaPaddonLabel(value,{},'ru'),'Название аппарата недоступно');
  assert.equal(model.werkaPaddonLabel(value,{},'ur-PK'),'مشین کا نام دستیاب نہیں');
  assert.equal(model.werkaPaddonLabel('APPARATUS:x:1 / apparatus:x:1',{'apparatus:x:1':'A'},'en'),'Machine name unavailable / A');
});
test('Paddon footer uses exact can-receive rules, warning and receipt interpolation',()=>{
  assert.equal(model.werkaPaddonFooterProps(input).canReceive,true);
  const blocked=model.werkaPaddonFooterProps({...input,preview:{...preview,canReceive:false}});
  assert.equal(blocked.canReceive,false);assert.match(blocked.warning,/paddon bo‘sh/);
  assert.equal(model.werkaPaddonFooterProps({...input,state:{...state,mustReload:true}}).canReceive,false);
  const received=model.werkaPaddonFooterProps({...input,state:{...state,receipt:{}}});
  assert.equal(received.receiptWarehouse,'null');assert.equal(received.receiptAcceptedBy,'null');assert.equal(received.canReceive,false);
});
for(const platform of ['ios','android']) test(`${platform} Paddon reuses the same receive footer without sending a mutation`,()=>{
  const calls=[],mocks={'react/jsx-runtime':jsx,'./werkaPaddonPresentation':model,'./werkaReceiveFooterModel':footerModel,
    '../shared/localization':{uiText:text=>text},
    '@expo/ui/swift-ui':Object.fromEntries(['Button','Menu','ProgressView','Section','Text'].map(x=>[x,x])),
    '@expo/ui/swift-ui/modifiers':{disabled:value=>({disabled:value})},
    '@expo/ui/jetpack-compose':{useMaterialColors:()=>({surface:'surface'})},
    'react-native':{ActivityIndicator:'ActivityIndicator',View:'View'},
    '../components/WorkerSheetButton':{WorkerSheetButton:'WorkerSheetButton'},
    '../preparation/PreparationUI.android':{PreparationRow:'PreparationRow',PreparationText:'PreparationText'},
    '../shared/filters/DropdownFilter.android':{DropdownFilter:'DropdownFilter'}};
  mocks[`./WerkaReceiveFooter.${platform}`]=compile(`WerkaReceiveFooter.${platform}.tsx`,mocks);
  const {WerkaPaddonFooter}=compile(`WerkaPaddonFooter.${platform}.tsx`,mocks);
  const tree=WerkaPaddonFooter({...input,onRequestReceive:()=>calls.push('confirm')});
  const button=nodes(tree,platform==='ios'?'Button':'WorkerSheetButton').find(x=>x.props.label==='Omborga kirim qilish');
  assert.ok(button);button.props.onPress();assert.deepEqual(calls,['confirm']);
  assert.equal(nodes(tree,platform==='ios'?'Menu':'DropdownFilter').length,1);
});
