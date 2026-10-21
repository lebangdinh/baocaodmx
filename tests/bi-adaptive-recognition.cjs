const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const recognition=require('../extension/baocaodmx-bi/recognition.js');
assert.deepEqual(recognition.defaults,JSON.parse(fs.readFileSync('downloads/bi-recognition.json','utf8')));
const copy=x=>JSON.parse(JSON.stringify(x));
const config=copy(recognition.defaults);config.revision=2;config.aliases['Vùng Trung Bộ']=['Miền Trung'];
recognition.use(config);assert(recognition.matches(' MIỀN  TRUNG ','Vùng Trung Bộ'));
for(const change of [c=>c.aliases.Xem=['Lũy kế'],c=>c.aliases.Unknown=['x'],c=>c.script='alert(1)',c=>c.aliases.Xem=['<script>'],c=>c.minVersion='9.0.0',c=>c.revision=-1]){
 const c=copy(config);change(c);assert.throws(()=>recognition.validate(c));
}
const {sample}=require('./bi-installment-data.cjs');
const ctx=vm.createContext({});
for(const file of ['recognition.js','installment.js'])vm.runInContext(fs.readFileSync('extension/baocaodmx-bi/'+file,'utf8'),ctx);
ctx.raw=sample('933');const original=JSON.parse(vm.runInContext("JSON.stringify(SkstInstallment.parse(raw,'933'))",ctx));
function reordered(order,swap=false){
 const lines=sample('933').split('\n'),i=lines.indexOf('Nhân viên');
 const names=[lines[i+1],...lines[i+2].split('\t')];
 const groups=names.map((name,j)=>({name,offset:j<3?j:3+2*(j-3),width:j<3?1:2}));
 const header=order.map(j=>names[j]).join('\t');
 const sub=order.filter(j=>j>=3).map(()=>swap?'%\tDT':'DT\t%').join('\t');
 const tail=lines.slice(i+4).map(line=>{
  if(!/^[-\d,.]+(?:\t[-\d,.]+){2,}$/.test(line))return line;
  const cells=line.split('\t');return order.flatMap(j=>{const g=groups[j],v=cells.slice(g.offset,g.offset+g.width);return swap&&g.width===2?v.reverse():v;}).join('\t');
 });
 return [...lines.slice(0,i+1),header,sub,...tail].join('\n');
}
for(const order of [[2,1,0,8,7,6,5,4,3],[3,0,4,1,5,2,6,7,8]])for(const swap of [false,true]){
 ctx.raw=reordered(order,swap);assert.deepEqual(JSON.parse(vm.runInContext("JSON.stringify(SkstInstallment.parse(raw,'933'))",ctx)),original);
}
ctx.raw=reordered([2,1,0,8,7,6,5,4,3]).replace('DT trả góp (triệu)','Doanh thu trả chậm (triệu)');
vm.runInContext("var config=JSON.parse(JSON.stringify(SkstRecognition.defaults));config.aliases['DT trả góp (triệu)']=['Doanh thu trả chậm (triệu)'];SkstRecognition.use(config);",ctx);
assert.deepEqual(JSON.parse(vm.runInContext("JSON.stringify(SkstInstallment.parse(raw,'933'))",ctx)),original);
ctx.raw=sample('933').replace('40\t40','30\t40');assert.throws(()=>vm.runInContext("SkstInstallment.parse(raw,'933')",ctx),/Tổng doanh thu/);
ctx.raw=sample('933').replace('10/2026','10/2026\n11/2026');assert.throws(()=>vm.runInContext("SkstInstallment.parse(raw,'933')",ctx),/nhiều tháng/);
console.log('PASS reordered core/provider columns, reversed DT/% subcolumns, alias headers, totals and conflicting months.');
async function cacheTests(){
 let cache,body=config,offline=false,large=false;
 const context=vm.createContext({URL,AbortController,TextDecoder,setTimeout,clearTimeout,Date,console,
  fetch:async()=>{if(offline)throw Error('offline');return new Response(large?'x'.repeat(32769):JSON.stringify(body));},
  chrome:{runtime:{getManifest:()=>({version:'1.2.0'}),onMessage:{addListener(){}}},storage:{local:{get:async()=>({recognitionCache:cache}),set:async value=>{cache=value.recognitionCache;}}}}
 });
 vm.runInContext(fs.readFileSync('extension/baocaodmx-bi/recognition.js','utf8'),context);
 vm.runInContext(fs.readFileSync('extension/baocaodmx-bi/background.js','utf8'),context);
 const load=()=>vm.runInContext('loadRecognition()',context);
 assert.equal((await load()).revision,2);assert.equal(cache.config.revision,2);
 offline=true;assert.equal((await load()).revision,2);assert.match(vm.runInContext('recognitionStatus',context),/bản lưu/);
 offline=false;body={...config,script:'not allowed'};assert.equal((await load()).revision,2);assert.equal(cache.config.script,undefined);
 body={...config,revision:1};assert.equal((await load()).revision,2,'Rollback must use cached dictionary');
 large=true;assert.equal((await load()).revision,2);large=false;
 cache.at=Date.now()-8*86400000;offline=true;assert.equal((await load()).revision,1,'Expired cache falls back to packaged dictionary');
 cache={at:Date.now(),config:{schema:99}};assert.equal((await load()).revision,1,'Invalid cache cannot execute or override recognition');
 offline=false;body={...config,latestVersion:'1.3.0'};assert.equal((await load()).revision,2);assert.match(vm.runInContext('recognitionStatus',context),/1.3.0/);
 body={...config,minVersion:'1.3.0',latestVersion:'1.3.0'};await load();assert.match(vm.runInContext('recognitionStatus',context),/1.3.0/);
 console.log('PASS remote dictionary: fetch/cache/offline/invalid/oversized/rollback/expired/update notice.');
}
cacheTests().catch(e=>{console.error(e);process.exitCode=1;});
