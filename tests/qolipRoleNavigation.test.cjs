const assert=require('node:assert/strict'),test=require('node:test');
const {load,l10n,routes}=require('./adminUsersSupport.cjs');
const navigation=load('qolip/qolipNavigation',{'../shared/localization':l10n});
const session=(role='qolipchi',capabilities=['qolip.manage'])=>({token:'token',profile:{role,ref:'person'},capabilities});
test('Qolipchi home reaches each native role tree and denied/other roles retain their own routing',()=>{
 assert.equal(routes.homeTarget(session(),'android'),'/android-qolip');assert.equal(routes.homeTarget(session(),'ios'),'/ios-qolip');
 assert.equal(routes.homeTarget(session('qolipchi',[]),'android'),null);
 assert.equal(routes.homeTarget(session('supplier',['qolip.manage']),'ios'),null);
});
test('Qolip drawer preserves source destination order and real localized titles in all four locales',()=>{
 assert.deepEqual(navigation.qolipDestinations.map(row=>row[0]),['home','blocks','products','checkouts','transfer','sequence','tasks','profile','product-transfer','sets','reworks','paddons','archive']);
 for(const locale of ['uz','ru','en','ur'])for(const row of navigation.qolipDestinations){const title=navigation.qolipDestinationTitle(row[2],locale);assert.ok(title.length>0);assert.notEqual(title,row[2]);assert.ok(!title.startsWith('@'));}
 assert.equal(navigation.qolipDestinationTitle('nav.blocks','uz'),'Bloklarim');assert.equal(navigation.qolipDestinationTitle('nav.molds','uz'),'Qoliplar');
});
