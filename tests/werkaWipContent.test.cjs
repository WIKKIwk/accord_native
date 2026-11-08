// Partial native content test only; no device, confirmation, mutation, route or real account is exercised.
const assert=require('node:assert/strict'),fs=require('node:fs'),Module=require('node:module'),path=require('node:path');
const test=require('node:test'),ts=require('typescript');
const root=path.resolve(__dirname,'../src/werka');
function compile(file,mocks={}) {const filename=path.join(root,file),m=new Module(filename);m.filename=filename;m.paths=require.main.paths;
  m.require=name=>Object.hasOwn(mocks,name)?mocks[name]:require(name);
  m._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,filename);return m.exports;}
const receive=compile('werkaReceiveLogic.ts');
const model=compile('werkaWipPresentation.ts',{'./werkaReceiveLogic':receive});
const jsx={Fragment:'Fragment',jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})};
function nodes(node,type){if(!node||typeof node!=='object')return[];if(Array.isArray(node))return node.flatMap(x=>nodes(x,type));
  return [...(node.type===type?[node]:[]),...nodes(node.props?.children,type)];}
const preview={canReceive:true,snapshotToken:'s',receiveBlockedReason:'',paddonCode:'P1',warehouses:['W1','W2'],apparatusNames:{},
  batch:{batch_id:'b',qr_payload:'QR',label_item_name:'Item',label_item_code:'IT',order_id:'O1',produced_qty:1.25,uom:'kg',
    finished_goods_kg:null,finished_goods_meter:null,current_location:'Machine',worker_display_name:'Worker',description:'Note',wip_status:'waiting'}};
const state={busy:false,mustReload:false,receipt:null,warehouse:'W1'};
function setup(platform,patch={}){
  const calls=[],mocks={'react/jsx-runtime':jsx,'./werkaWipPresentation':model,'../shared/localization':{uiText:text=>text},
    '@expo/ui/swift-ui':Object.fromEntries(['Button','Menu','ProgressView','Section','Text','VStack'].map(x=>[x,x])),
    '@expo/ui/swift-ui/modifiers':{disabled:value=>({disabled:value})},
    '@expo/ui/jetpack-compose':{useMaterialColors:()=>({surface:'surface'})},
    'react-native':{ActivityIndicator:'ActivityIndicator',ScrollView:'ScrollView',View:'View'},
    '../components/WorkerSheetButton':{WorkerSheetButton:'WorkerSheetButton'},
    '../preparation/PreparationUI.ios':{PreparationList:'PreparationList'},
    '../preparation/PreparationUI.android':{PreparationRow:'PreparationRow',PreparationText:'PreparationText'},
    '../shared/filters/DropdownFilter.android':{DropdownFilter:'DropdownFilter'}};
  const {WerkaWipContent}=compile(`WerkaWipContent.${platform}.tsx`,mocks);
  const props={preview,state,confirming:false,error:'',locale:'uz',onWarehouse:value=>calls.push(['warehouse',value]),
    onRequestReceive:()=>calls.push(['confirm']),onReload:()=>calls.push(['reload']),onNextQr:()=>calls.push(['next']),...patch};
  return {tree:WerkaWipContent(props),calls};
}
for(const platform of ['ios','android']) {
  const button=platform==='ios'?'Button':'WorkerSheetButton';
  test(`${platform} WIP content reuses native list/picker/button and requests confirmation only`,()=>{
    const h=setup(platform), buttons=nodes(h.tree,button), receiveButton=buttons.find(x=>x.props.label==='Omborga kirim qilish');
    assert.ok(receiveButton);receiveButton.props.onPress();assert.deepEqual(h.calls,[['confirm']]);
    const picker=nodes(h.tree,platform==='ios'?'Menu':'DropdownFilter')[0];assert.ok(picker);
    if(platform==='ios') nodes(picker,'Button').find(x=>x.props.label==='W2').props.onPress(); else picker.props.onChange('W2');
    assert.deepEqual(h.calls,[['confirm'],['warehouse','W2']]);
    buttons.find(x=>x.props.label==='Qayta tekshirish').props.onPress();
    buttons.find(x=>x.props.label==='Keyingi QR kodni skanerlash').props.onPress();
    assert.deepEqual(h.calls,[['confirm'],['warehouse','W2'],['reload'],['next']]);
    assert.equal(nodes(h.tree,platform==='ios'?'PreparationList':'PreparationRow').length>0,true);
  });
  test(`${platform} WIP busy and uncertain states cannot invoke guarded actions`,()=>{
    const h=setup(platform,{state:{...state,busy:true,mustReload:true}}),buttons=nodes(h.tree,button);
    for(const b of buttons) b.props.onPress?.();
    const picker=nodes(h.tree,platform==='ios'?'Menu':'DropdownFilter')[0];if(platform==='android')picker.props.onChange('W2');
    assert.deepEqual(h.calls,[]);
    assert.equal(nodes(h.tree,platform==='ios'?'ProgressView':'ActivityIndicator').length,1);
  });
  test(`${platform} WIP receipt hides selector and receive action`,()=>{
    const h=setup(platform,{state:{...state,receipt:{warehouse:'W1',accepted_by_display_name:'Person'}}});
    assert.equal(nodes(h.tree,platform==='ios'?'Menu':'DropdownFilter').length,0);
    assert.equal(nodes(h.tree,button).some(x=>x.props.label==='Omborga kirim qilish'),false);
  });
}
