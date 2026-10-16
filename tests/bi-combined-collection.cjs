const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
async function filters(){
 let selected={'933':false,'10341':false,'1099':true},clicks=0;
 const label=code=>({offsetWidth:10,textContent:code+' - Shop',querySelector:()=>({checked:selected[code]}),click(){selected[code]=!selected[code];clicks++}});
 const button={offsetParent:{},innerText:'Siêu thị',click(){}};
 const document={querySelectorAll:selector=>selector==='button'?[button]:selector==='label'?Object.keys(selected).map(label):[]};
 const c=vm.createContext({document,chrome:{runtime:{onConnect:{addListener(){}}}},setTimeout:fn=>fn(),Date});
 vm.runInContext(fs.readFileSync('extension/baocaodmx-bi/bi.js','utf8'),c);
 vm.runInContext("requestedStore='both'",c);assert.equal(await vm.runInContext('area()',c),'');
 assert.deepEqual(selected,{'933':true,'10341':true,'1099':false});assert.equal(clicks,3);
 assert.equal(await vm.runInContext('area()',c),'');assert.equal(clicks,3,'Already correct selection must not be toggled');
 vm.runInContext("requestedStore='933'",c);assert.equal(await vm.runInContext('area()',c),'');assert.deepEqual(selected,{'933':true,'10341':false,'1099':false});
}
async function collection(){
 const calls=[],navigations=[];let commit,creates=0;
 const chrome={runtime:{onMessage:{addListener(){}},getPlatformInfo(){}},action:{setBadgeText:async()=>{},setBadgeBackgroundColor:async()=>{}},tabs:{
  query:async()=>[{id:1,url:'https://lebangdinh.github.io/baocaodmx/',active:true}],
  create:async options=>{creates++;navigations.push(options.url);return{id:2}},get:async()=>({status:'complete'}),remove:async()=>{},reload:async()=>{},
  update:async(id,options)=>{if(options.url)navigations.push(options.url)},
  sendMessage:async(id,m)=>{if(m.kind==='prepare')return{ok:true,protocol:'bi-batch-v2',month:'2026-10'};if(m.kind==='commit'){commit=m;return{ok:true,message:'Đã nhập và đồng bộ Firebase 9 loại báo cáo.'}}return{ok:true}},
  connect:()=>{const messages=[],disconnects=[];return{onMessage:{addListener:f=>messages.push(f)},onDisconnect:{addListener:f=>disconnects.push(f)},disconnect(){disconnects.forEach(f=>f())},postMessage(request){calls.push(request);queueMicrotask(()=>messages.forEach(f=>f({ok:true,text:'fixture',textThuc:'actual'})))}}}
 }};
 const context=vm.createContext({chrome,URL,setInterval:()=>1,clearInterval(){},setTimeout(fn,ms){if(ms<2000)queueMicrotask(fn);return 1},clearTimeout(){},console});
 vm.runInContext(fs.readFileSync('extension/baocaodmx-bi/background.js','utf8'),context);
 await vm.runInContext("start({id:'batch',biTab:null,cancelled:false},'all')",context);
 assert.equal(calls.length,9);assert.equal(creates,1);assert.equal(navigations.length,6,'Reuse page across month/realtime instead of reloading each store');
 assert.equal(calls.filter(x=>x.job==='empComp').length,2);
 assert(calls.filter(x=>x.job!=='empComp').every(x=>x.store==='both'));
 assert.equal(commit.results.length,9);assert.equal(commit.results.filter(x=>x.job==='installment').length,1);assert.equal(commit.results.find(x=>x.job==='installment').mode,'month');
 assert.match(vm.runInContext('message',context),/Đã nhập và đồng bộ Firebase/);
}
(async()=>{await filters();await collection();console.log('PASS: select both shops with fresh controls; only employee competition splits stores; collect 9 reports using 6 navigations; automatic commit after full collection.');})().catch(e=>{console.error(e);process.exit(1)});
