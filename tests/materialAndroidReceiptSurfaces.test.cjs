const assert = require('node:assert/strict'), fs = require('node:fs'), Module = require('node:module'), path = require('node:path'), test = require('node:test'), ts = require('typescript');
const jsx = { jsx: (type,props) => ({type,props}), jsxs: (type,props) => ({type,props}) };
function compile(file,mocks) { const filename=path.resolve(__dirname,'../src',file), mod=new Module(filename,module); mod.filename=filename;mod.paths=module.paths;
  mod.require=id=>Object.hasOwn(mocks,id)?mocks[id]:require(id);mod._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,filename);return mod.exports; }
function expand(node) { if (!node || typeof node !== 'object') return node; if(Array.isArray(node)) return node.map(expand);
  if(typeof node.type === 'function') return expand(node.type(node.props));return {...node,props:{...node.props,children:expand(node.props.children)}}; }
function find(node,predicate) { if (!node || typeof node!=='object')return [];if(Array.isArray(node))return node.flatMap(n=>find(n,predicate));
  return [...(predicate(node)?[node]:[]),...find(node.props?.children,predicate)]; }
function harness(connection) {
  const calls=[], effects=[], refs=[], server={endpoint:{baseUrl:'http://scale:39117',host:'scale',port:39117},handshake:{serverName:'Tarozi'}};
  const picker={ device:{connection,scanning:false,checkingAddress:false,addressError:'',scanResult:{servers:[]}},address:'http://scale:39117',setAddress:value=>calls.push(['address',value]),
    printers:[],scanning:false,error:'',friendlyError:'',choose:value=>calls.push(['choose',value]),scan:()=>calls.push('scan'),rescanBluetooth:()=>calls.push('bluetooth-scan'),
    selectUsb:async()=>calls.push('usb'),selectServer:async value=>calls.push(['select',value]),selectBluetooth:async value=>calls.push(['bluetooth',value]),probeAddress:async()=>{calls.push('probe');return server;} };
  const sheet={content:null,options:null,open(content,options){this.content=content;this.options=options;calls.push('open');},close(){calls.push('form-close');},isOpen(){return !!this.content;},update(content){this.content=content;}};
  const react={useEffect:fn=>effects.push(fn),useRef:value=>{const ref={current:value};refs.push(ref);return ref;},useState:value=>[value,()=>{}]};
  const compose=new Proxy({useMaterialColors:()=>({}),useNativeState:value=>({get:()=>value,set:()=>{}})},{get:(target,key)=>target[key]??String(key)});
  compose.OutlinedTextField=Object.assign(()=>null,{Label:'FieldLabel',Placeholder:'FieldPlaceholder'});
  const {MaterialDevicePicker}=compile('shared/printing/MaterialDevicePicker.android.tsx',{
    'react/jsx-runtime':jsx,react,'@expo/ui/jetpack-compose':compose,'@expo/ui/jetpack-compose/modifiers':new Proxy({},{get:(_,key)=>value=>({[key]:value})}),
    'expo-symbols':{SymbolView:'Symbol'},'react-native':{View:'View',Text:'NativeText',ScrollView:'ScrollView',RefreshControl:'RefreshControl',ActivityIndicator:'ActivityIndicator',StyleSheet:{create:value=>value},useWindowDimensions:()=>({height:1000})},
    '../../components/WorkerQueueCard.android':{WorkerQueueCard:'QueueCard'},'../../nativeSheet':{useNativeSheet:()=>sheet},'./useDevicePicker':{useDevicePicker:()=>picker},
    '../../customer/CustomerSnackbar.android':{CustomerSnackbar:'Snackbar'},'./useMaterialDeviceNotice':{useMaterialDeviceNotice:()=>''},
  });
  let current=true;const render=()=>expand(MaterialDevicePicker({operator:{},close:()=>calls.push('outer-close'),useText:()=>value=>value,materialReceipt:{apiBaseUrl:'http://api',isCurrent:()=>current}}));
  return {calls,picker,sheet,server,render,expire:()=>{current=false;}};
}
const byId=(tree,id)=>find(tree,node=>node.props.modifiers?.some(mod=>mod.testID===id))[0];
const words=tree=>find(tree,node=>node.type==='NativeText'||node.type==='Text').map(node=>node.props.children);
test('Android Material picker preserves three source transports, source USB action, WiFi scan/empty and list selection',async()=>{
  const h=harness(null);const tree=h.render();for(const mode of ['usb','bluetooth','wifi']) {byId(tree,`material-device-${mode}`).props.onClick();assert.deepEqual(h.calls.at(-1),['choose',mode]);}
  h.picker.device.connection='usb';const usb=h.render();assert.ok(words(usb).includes('Printer Android qurilmaga USB orqali ulanadi. RPS service va printer WiFi tarmog‘i talab qilinmaydi.'));
  byId(usb,'material-device-usb').props.onClick();await Promise.resolve();assert.equal(h.calls.at(-1),'usb');
  h.picker.device.connection='wifi';const empty=h.render();assert.ok(words(empty).includes('Qurilma tarmoqda topilmadi'));
  byId(empty,'material-device-refresh').props.onClick();assert.equal(h.calls.at(-1),'scan');
  h.picker.device.scanResult.servers=[h.server];const populated=h.render();find(populated,node=>node.type==='QueueCard')[0].props.onPress();await Promise.resolve();assert.deepEqual(h.calls.at(-1),['select',h.server]);
});
test('Android Material manual server form closes before selecting into the outer picker and ignores expired account results',async()=>{
  const h=harness('wifi');byId(h.render(),'material-device-add_link').props.onClick();assert.equal(h.calls.at(-1),'open');assert.equal(h.sheet.options.dismissible,true);
  const form=expand(h.sheet.content);assert.ok(words(form).includes('Server qo‘shish'));
  byId(form,'material-device-link').props.onClick();await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(h.calls.slice(-2),['probe','form-close']);assert.equal(h.calls.some(call=>Array.isArray(call)&&call[0]==='select'),false);
  h.sheet.options.onDismiss();await Promise.resolve();assert.deepEqual(h.calls.at(-1),['select',h.server]);
  const stale=harness('wifi');byId(stale.render(),'material-device-add_link').props.onClick();const pending=expand(stale.sheet.content);stale.expire();
  byId(pending,'material-device-link').props.onClick();await new Promise(resolve=>setImmediate(resolve));stale.sheet.options.onDismiss();
  assert.equal(stale.calls.includes('form-close'),false);assert.equal(stale.calls.some(call=>Array.isArray(call)&&call[0]==='select'),false);
});
test('Android Material Bluetooth empty state uses source friendly error and technical disclosure, with retry separate from selection',()=>{
  const h=harness('bluetooth');h.picker.error='MissingPluginException: native';h.picker.friendlyError='Bluetooth printer tizim moduli ushbu muhitda faol emas. Qurilma Bluetooth sozlamalarini tekshiring.';
  const tree=h.render();assert.ok(words(tree).includes(h.picker.friendlyError));assert.ok(words(tree).includes('Bluetooth printer topilmadi'));
  assert.ok(words(tree).includes('Texnik ma’lumot'));byId(tree,'material-device-refresh').props.onClick();assert.equal(h.calls.at(-1),'bluetooth-scan');
});
