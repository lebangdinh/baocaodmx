const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
let drilled=false,loaded='',filters=[],reloads=0,shopClicks=0;
const period={innerText:'Lũy kế',offsetParent:{},className:'bg-blue-600',getAttribute(){return null},click(){throw Error('Already selected');}};
const reload={innerText:'Tải lại',offsetParent:{},getAttribute(){return null},click(){reloads++;loaded=vm.runInContext('requestedStore',ctx)}};
const ctx=vm.createContext({location:{pathname:'/dashboard/thi-dua'},document:{querySelectorAll:()=>[period,reload]},chrome:{runtime:{onConnect:{addListener(){}}}},Date,setTimeout:fn=>fn(),getComputedStyle:e=>({backgroundColor:e===period?'rgb(37,99,235)':'rgb(255,255,255)'})});
vm.runInContext(fs.readFileSync('extension/baocaodmx-bi/bi.js','utf8'),ctx);
ctx.testArea=async()=>{filters.push(vm.runInContext('requestedStore',ctx));return ''};
ctx.testText=()=>drilled?'10/2026\nHẠNG TRONG ST\nSHOP '+loaded:'10/2026\nHẠNG VÙNG';
ctx.testShop=store=>({click(){shopClicks++;assert.equal(store,loaded);drilled=true}});
vm.runInContext('area=testArea;pageText=testText;findCompetitionStore=testShop;',ctx);
(async()=>{
 vm.runInContext("requestedStore='933'",ctx);let a=await vm.runInContext("runEmpComp('month',()=>{},'933')",ctx);assert(a.ok);assert(a.text.includes('SHOP 933'));
 vm.runInContext("requestedStore='10341'",ctx);let b=await vm.runInContext("runEmpComp('month',()=>{},'10341')",ctx);assert(b.ok);assert(b.text.includes('SHOP 10341'));
 assert.deepEqual(filters,['933','10341']);assert.equal(reloads,2);assert.equal(shopClicks,1,'Second shop uses the filter in the current employee report, not another shop-name click');
 console.log('PASS: monthly employee-only view, drill into first shop once, filter/reload next shop, capture separate shop payloads.');
})().catch(e=>{console.error(e);process.exit(1)});
