// Content-only tests do not verify a device, session lifecycle, shell or navigation.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const catalog = require('../src/shared/localization/catalog.json');
const jsx = { Fragment: 'Fragment', jsx: (type, props) => ({type, props}), jsxs: (type, props) => ({type, props}) };
function compile(file, mocks) {
  const filename = path.resolve(__dirname, '../src', file), loaded = new Module(filename);
  loaded.filename = filename; loaded.paths = require.main.paths;
  loaded.require = name => Object.hasOwn(mocks, name) ? mocks[name] : require(name);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {compilerOptions: {
    module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  }}).outputText, filename);
  return loaded.exports;
}
const localization = compile('shared/localization/index.ts', {'./catalog.json': catalog});
const routes = {appRoutes: {werkaCreateHub: '/werka-create-hub', werkaHome: '/werka-home'}};
const model = compile('werka/werkaSuccessPresentation.ts', {'../shared/localization': localization, '../shared/appRoutes': routes});
const record = {id: 'R-7', event_type: '', sent_qty: 5.25, accepted_qty: 3.5, uom: 'kg'};
function nodes(node, type) {
  if (!node || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap(child => nodes(child, type));
  return [...(node.type === type ? [node] : []), ...nodes(node.props?.children, type)];
}
test('success copy, quantity and fallback route follow V2 for the three events', () => {
  const props = {record, locale: 'uz'};
  assert.deepEqual(model.werkaSuccessPresentation(props), {id:'R-7',title:'Qabul qilindi',subtitle:'3.50 kg qabul qilindi',actionLabel:'Pending listga qaytish',target:'/werka-home'});
  assert.deepEqual(model.werkaSuccessPresentation({...props, record:{...record,event_type:'customer_issue_pending'}}),
    {id:'R-7',title:'Jo‘natildi',subtitle:'5.25 kg haridorga jo‘natildi',actionLabel:'Qaydga qaytish',target:'/werka-create-hub'});
  assert.deepEqual(model.werkaSuccessPresentation({...props, record:{...record,event_type:'werka_unannounced_pending'}}),
    {id:'R-7',title:'Qayd qilindi',subtitle:'5.25 kg qayd qilindi',actionLabel:'Qaydga qaytish',target:'/werka-create-hub'});
});
test('success keeps explicit override, empty override, locale and Dart negative zero', () => {
  const props = {record:{...record,accepted_qty:-0},locale:'en',returnRouteName:'/scan',returnLabel:'Scan again'};
  const view = model.werkaSuccessPresentation(props);
  assert.equal(view.subtitle,'-0.00 kg received'); assert.equal(view.actionLabel,'Scan again'); assert.equal(view.target,'/scan');
  const empty = model.werkaSuccessPresentation({...props,returnRouteName:'',returnLabel:''});
  assert.equal(empty.actionLabel,''); assert.equal(empty.target,'');
  assert.equal(model.werkaSuccessPresentation({...props,locale:'ru'}).title,'Принято');
  assert.equal(model.werkaSuccessPresentation({...props,locale:'ur'}).title,'وصول کیا گیا');
});
for (const platform of ['ios','android']) test(`${platform} success content reuses native components and forwards the target only`, () => {
  const calls = [], mocks = {'react/jsx-runtime':jsx,'./werkaSuccessPresentation':model,
    '@expo/ui/swift-ui':Object.fromEntries(['Button','Image','Section','Text','VStack'].map(name=>[name,name])),
    '@expo/ui/jetpack-compose':{useMaterialColors:()=>({surfaceContainerLow:'bg',onSecondaryContainer:'accent',onSurface:'text',onSurfaceVariant:'muted'})},
    'expo-symbols':{SymbolView:'SymbolView'}, 'react-native':{View:'View',Text:'Text'},
    '../preparation/PreparationUI.ios':{PreparationList:'PreparationList'},
    '../components/WorkerQueueCard.android':{WorkerQueueCard:'WorkerQueueCard'},
    '../components/WorkerSheetButton':{WorkerSheetButton:'WorkerSheetButton'}};
  const {WerkaSuccessContent} = compile(`werka/WerkaSuccessContent.${platform}.tsx`,mocks);
  const tree = WerkaSuccessContent({record, locale:'uz', returnRouteName:'/scan', returnLabel:'Scan again', onReturn:target=>calls.push(target)});
  assert.equal(nodes(tree,platform==='ios'?'PreparationList':'WorkerQueueCard').length,1);
  const buttons = nodes(tree,platform==='ios'?'Button':'WorkerSheetButton'); assert.equal(buttons.length,1);
  assert.equal(buttons[0].props.label,'Scan again'); buttons[0].props.onPress(); assert.deepEqual(calls,['/scan']);
});
