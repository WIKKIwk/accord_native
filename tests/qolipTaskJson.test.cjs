const assert=require('node:assert/strict'),test=require('node:test');
const {load}=require('./adminUsersSupport.cjs');
const {parseSupplyTaskJson}=load('shared/supplyTasks/supplyTaskJson');
test('Dart int projection preserves JSON token kinds instead of accepting rounded doubles',()=>{
 for(const token of ['1.0','1e0','9007199254740991.1','-0.0']) assert.throws(()=>parseSupplyTaskJson('{"ok":true,"rev":'+token+'}'),/integer JSON token/);
 assert.equal(parseSupplyTaskJson('{"ok":true,"rev":1}').rev,1);assert.equal(parseSupplyTaskJson('{"ok":true,"rev":-0}').rev,-0);
 assert.throws(()=>parseSupplyTaskJson('{"ok":true,"window":{"\\u0072ev":1.0}}'),/integer JSON token/);
});
test('numeric-looking text, quantity doubles and server error bodies retain their source meaning',()=>{
 const value=parseSupplyTaskJson('{"ok":true,"search":"\\\"rev\\\":1.0","products":[{"qty":1.5}],"rev":2}');assert.equal(value.products[0].qty,1.5);
 assert.equal(parseSupplyTaskJson('{"ok":false,"rev":1.0,"error":"forbidden"}').error,'forbidden');
});
