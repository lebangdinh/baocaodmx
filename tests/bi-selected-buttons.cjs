const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
let buttons=[],clicks=0;
const ctx=vm.createContext({document:{querySelectorAll:()=>buttons},chrome:{runtime:{onConnect:{addListener(){}}}},setTimeout:fn=>fn(),getComputedStyle:e=>({backgroundColor:e.className.includes('bg-blue-600')?'rgb(37, 99, 235)':'rgb(255, 255, 255)'}),Date});
vm.runInContext(fs.readFileSync('extension/baocaodmx-bi/bi.js','utf8'),ctx);
function setPair(a,b,selected){buttons=[a,b].map(name=>({innerText:name,offsetParent:{},className:name===selected?'bg-blue-600 text-white':'bg-white',getAttribute(){return null},click(){clicks++;setPair(a,b,name)}}));}
(async()=>{
 setPair('Lũy kế','Realtime','Realtime');await vm.runInContext("setPeriod('month')",ctx);assert.equal(clicks,1);
 await vm.runInContext("setPeriod('month')",ctx);assert.equal(clicks,1,'Already selected stays selected');
 await vm.runInContext("setPeriod('realtime')",ctx);assert.equal(clicks,2);
 setPair('DT thực','DT quy đổi','DT thực');await vm.runInContext("clickMeasure('qd')",ctx);assert.equal(clicks,3);
 await vm.runInContext("clickMeasure('qd')",ctx);assert.equal(clicks,3);
 await vm.runInContext("clickMeasure('thuc')",ctx);assert.equal(clicks,4);
 console.log('PASS BI selected buttons: period and measure pairs, no duplicate click, fresh state after React replacement.');
})().catch(e=>{console.error(e);process.exit(1)});
