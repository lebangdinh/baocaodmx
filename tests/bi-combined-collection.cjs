const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
async function filters(){
 const {JSDOM}=require('jsdom');
 for(const placeholder of ['Tìm siêu thị…','Tìm công ty, vùng, cụm, khu vực, siêu thị...']){
  const dom=new JSDOM(`<button id="open">Siêu thị Chọn</button><div id="picker" hidden><input placeholder="${placeholder}"><button id="clear">Bỏ chọn tất cả</button><div id="rows"></div></div>`,{runScripts:'outside-only'});
  const c=dom.getInternalVMContext();
  c.chrome={runtime:{onConnect:{addListener(){}}}};
  vm.runInContext(`
   Element.prototype.getClientRects=function(){return this.closest('[hidden]')?[]:[{}]};
   Object.defineProperty(HTMLElement.prototype,'offsetWidth',{get(){return this.closest('[hidden]')?0:10}});
   Object.defineProperty(HTMLElement.prototype,'offsetParent',{get(){return this.closest('[hidden]')?null:document.body}});
   var selected={'933':false,'10341':false,'1099':true};
   function render(){
    document.querySelector('#rows').innerHTML=Object.keys(selected).map(code=>'<label><input type="checkbox" data-code="'+code+'" '+(selected[code]?'checked':'')+'>'+code+' - Shop</label>').join('');
    document.querySelectorAll('[data-code]').forEach(e=>e.onchange=()=>{selected[e.dataset.code]=e.checked;render()});
   }
   document.querySelector('#open').onclick=()=>document.querySelector('#picker').hidden=!document.querySelector('#picker').hidden;
   document.querySelector('#clear').onclick=()=>{Object.keys(selected).forEach(k=>selected[k]=false);render()};render();
  `,c);
  vm.runInContext(fs.readFileSync('extension/baocaodmx-bi/bi.js','utf8').replace('const sleep = (ms) => new Promise((r) => setTimeout(r, ms));','const sleep = async () => {};'),c);
  for(const store of ['both','both','933','10341']){
   vm.runInContext('requestedStore='+JSON.stringify(store),c);
   assert.equal(await vm.runInContext('area()',c),'');
   assert.deepEqual(JSON.parse(vm.runInContext('JSON.stringify(selected)',c)),{'933':store==='both'||store==='933','10341':store==='both'||store==='10341','1099':false});
   assert(c.document.querySelector('#picker').hidden,'Picker must close before capture');
  }
  dom.window.close();
 }
}
async function collection(fail=false){
 const calls=[],navigations=[];let commit,creates=0;
 const chrome={runtime:{getManifest:()=>({version:'1.2.0'}),onMessage:{addListener(){}},getPlatformInfo(){}},action:{setBadgeText:async()=>{},setBadgeBackgroundColor:async()=>{}},tabs:{
  query:async()=>[{id:1,url:'https://lebangdinh.github.io/baocaodmx/',active:true}],
  create:async options=>{creates++;navigations.push(options.url);return{id:2}},get:async()=>({status:'complete'}),remove:async()=>{},reload:async()=>{},
  update:async(id,options)=>{if(options.url)navigations.push(options.url)},
  sendMessage:async(id,m)=>{if(m.kind==='prepare')return{ok:true,protocol:'bi-batch-v2',month:'2026-10'};if(m.kind==='commit'){commit=m;return{ok:true,message:'Đã nhập và đồng bộ Firebase 9 loại báo cáo.'}}return{ok:true}},
  connect:()=>{const messages=[],disconnects=[];return{onMessage:{addListener:f=>messages.push(f)},onDisconnect:{addListener:f=>disconnects.push(f)},disconnect(){disconnects.forEach(f=>f())},postMessage(request){calls.push(request);queueMicrotask(()=>messages.forEach(f=>f(fail&&request.job==='installment'?{ok:false,error:'Thiếu dòng'}:{ok:true,text:'fixture',textThuc:'actual'})))}}}
 }};
 const context=vm.createContext({chrome,URL,AbortController,fetch:async()=>{throw Error('offline')},setInterval:()=>1,clearInterval(){},setTimeout(fn,ms){if(ms<2000)queueMicrotask(fn);return 1},clearTimeout(){},console});
 vm.runInContext(fs.readFileSync('extension/baocaodmx-bi/recognition.js','utf8'),context);
 vm.runInContext(fs.readFileSync('extension/baocaodmx-bi/background.js','utf8'),context);
 await vm.runInContext("start({id:'batch',biTab:null,cancelled:false},'all')",context);
 assert.equal(calls.length,9);assert.equal(creates,1);assert.equal(navigations.length,5,'Reuse page across month/realtime instead of reloading each store');
 assert.equal(calls.filter(x=>x.job==='empComp').length,2);
 assert(calls.filter(x=>x.job!=='empComp').every(x=>x.store==='both'));
 assert(calls.every(c=>c.recognition?.revision===1),'All jobs use one validated dictionary');
 if(fail){assert.equal(commit,undefined);assert.match(vm.runInContext('message',context),/Thiếu dòng/);return;}
 assert.equal(commit.results.length,9);assert.equal(commit.results.filter(x=>x.job==='installment').length,1);assert.equal(commit.results.find(x=>x.job==='installment').mode,'month');
 assert.match(vm.runInContext('message',context),/Đã nhập và đồng bộ Firebase/);
}
(async()=>{await filters();await collection();await collection(true);console.log('PASS: select both shops with fresh controls; only employee competition splits stores; collect 9 reports using 5 navigations; automatic commit after full collection.');})().catch(e=>{console.error(e);process.exit(1)});
