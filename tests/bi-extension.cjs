const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const Babel=require('@babel/standalone');
const files=JSON.parse(fs.readFileSync('index.html','utf8').match(/<script id="embedded-source" type="application\/json">([\s\S]*?)<\/script>/)[1]);
const cache={};
function load(id){if(cache[id])return cache[id].exports;const m=cache[id]={exports:{}};const code=Babel.transform(files[id],{filename:id,presets:[['typescript',{allExtensions:true,isTSX:id.endsWith('.tsx')}],'react'],plugins:['transform-modules-commonjs']}).code;new Function('require','module','exports',code)(req=>{const p=path.posix.normalize(path.posix.join(path.posix.dirname(id),req));return load(files[p+'.ts']?p+'.ts':p);},m,m.exports);return m.exports;}
const {prepareBiImport,mergeRevenue,reportMonth,slotFor,expectedBiJobs}=load('src/utils/biExtensionImport.ts');
assert.equal(reportMonth('Cập nhật 16/10/2026\n10/2026\n'), '2026-10');
assert.equal(reportMonth('Cập nhật 16/10/2026'),null);
const {parsePastedData}=load('src/utils/smartDataParser.ts');
const fixture=(qd,employee=false,rt=false,codes=['933','10341'])=>[
 'TGDD','Doanh thu hợp nhất','10/2026',rt?'% HT target (LK)':'Lũy kế tới hết ngày 15',employee?'Nhân viên':'Siêu thị',
 'SỐ LƯỢNG',qd?'DOANH THU QĐ':'DOANH THU','TỈ TRỌNG','TARGET','% HT TARGET',
 ...codes.flatMap((code,i)=>[`${employee?(i===0?'204201 - Lê Văn Nhân':'98486 - Nguyễn Quỳnh Anh'):code+' - '+(code==='933'?'TGD_DNA_HCH':'AAR_DNA_HCH')}`,`2\t${qd?150+i:100+i}\t50\t${qd?600:500}\t25`])
].join('\n');
const report=(job='revenue',mode='month')=>({job,mode,store:'both',text:fixture(true,job==='empRev',mode==='realtime'),textThuc:fixture(false,job==='empRev',mode==='realtime')});
let r=prepareBiImport([report()],'2026-10','month');
assert.equal(r.updates.dt_luyke?.length,2,JSON.stringify(r));
assert.equal(r.updates.dt_luyke[0]['DOANH THU (TR)'],100);assert.equal(r.updates.dt_luyke[0]['DOANH THU QĐ (TR)'],150);
assert.equal(r.updates.dt_luyke[0]['TARGET (TR)'],500);assert.equal(r.updates.dt_luyke[0]['TARGET QĐ (TR)'],600);
assert.equal(prepareBiImport([{...report(),text:fixture(true,false,false,['933'])}],'2026-10','month').updates.dt_luyke,undefined,'Incomplete combined table must preserve old slot');
assert.equal(prepareBiImport([report(),report()],'2026-10','month').updates.dt_luyke,undefined,'Duplicate result rejected');
assert.equal(prepareBiImport([report()],'2026-11','month').updates.dt_luyke,undefined,'Wrong month rejected');
assert.equal(prepareBiImport([{...report(),text:fixture(true,false,false,['1099','10341'])}],'2026-10','month').updates.dt_luyke,undefined,'Foreign store rejected');
for(const mode of ['month','realtime']){
 const item=report('empRev',mode),slot=mode==='month'?'dt_nv_luyke':'dt_nv_realtime';r=prepareBiImport([item],'2026-10',mode);
 assert.equal(r.updates[slot]?.length,2,JSON.stringify(r));
 const manual=parsePastedData(item.text,slot);assert(!('error' in manual));
 assert.deepEqual(r.updates[slot].map(x=>x['SIÊU THỊ']),manual.data.map(x=>x['SIÊU THỊ']),'Keep the same employee mapping as manual paste');
 assert.deepEqual(r.updates[slot].map(x=>x['SIÊU THỊ']),['TGDĐ','TopZone']);
 assert(r.updates[slot].every(x=>x['MÃ ĐƠN VỊ']===undefined),'Never stamp combined staff rows with one store');
 assert.equal(r.updates[slot][0]['DOANH THU (TR)'],100);
}
const compete=(store,employee=false,rt=false)=>['10/2026',`Môn thử DOANH THU ${rt?'(RT) ':''}${employee?'HẠNG TRONG ST TOP/BOTTOM ST':`TARGET % HT ${rt?'NGÀY':'THÁNG'} % DỰ BÁO HẠNG VÙNG TOP/BOTTOM VÙNG`}`,
 ...(employee?[`${store==='933'?'204201 - Lê Văn Nhân':'98486 - Nguyễn Quỳnh Anh'}\t10\t1\tTOP`]:['933 - TGD_DNA_HCH\t10\t100\t10%\t20%\t1\tTOP','10341 - AAR_DNA_HCH\t20\t100\t20%\t40%\t2\tTOP'])].join('\n');
for(const store of ['933','10341']){
 const item={job:'empComp',mode:'month',store,text:compete(store,true)};
 r=prepareBiImport([item],'2026-10','month');const slot=store==='933'?'nv_tgdd':'nv_tz';
 assert.equal(r.updates[slot]?.length,1,JSON.stringify(r));assert.equal(String(r.updates[slot][0]['MÃ ĐƠN VỊ']),store);
}
for(const mode of ['month','realtime']){
 const item={job:'compete',mode,store:'both',text:compete('',false,mode==='realtime')};
 r=prepareBiImport([item],'2026-10',mode);assert.equal(r.updates[mode==='month'?'td_luyke':'td_realtime']?.length,2,JSON.stringify(r));
}
const installment=['10/2026','Nhân viên\tDT trả góp (triệu)\tDT siêu thị (triệu)\tTỷ trọng trả chậm %\tPayoo\tSMARTPOS\tKREDIVO\tHome Credit (HC)','Nguyễn Quỳnh Anh\t100\t200\t50\t20\t20\t30\t30\t10\t10\t40\t40','Lê Văn Nhân\t10\t100\t10\t1\t10\t3\t30\t2\t20\t4\t40'].join('\n');
r=prepareBiImport([{job:'installment',mode:'month',store:'both',text:installment}],'2026-10','month');
const pasted=parsePastedData(installment,'tra_cham_luyke');assert(!('error' in pasted),JSON.stringify(pasted));assert.deepEqual(r.updates.tra_cham_luyke,pasted.data,'Installment combined payload is exactly existing paste parser output');
assert.throws(()=>mergeRevenue([{'MÃ ĐƠN VỊ':'933'}],[{'MÃ ĐƠN VỊ':'10341'}],false));
assert.throws(()=>slotFor({job:'revenue',mode:'month',store:'933'}),/lấy chung/);
for(const [name,source] of Object.entries(files))Babel.transform(source,{filename:name,presets:[['typescript',{allExtensions:true,isTSX:name.endsWith('.tsx')}],'react'],plugins:['transform-modules-commonjs']});
// Load packaged scripts as syntax only; never execute a BI request in tests.
for(const name of ['background.js','bridge.js','bi.js','popup.js'])new vm.Script(fs.readFileSync('extension/baocaodmx-bi/'+name,'utf8'));
const manifest=JSON.parse(fs.readFileSync('extension/baocaodmx-bi/manifest.json'));
assert(!manifest.permissions.includes('cookies'));assert(!manifest.permissions.includes('debugger'));
assert(!JSON.stringify(manifest).includes('skst-new.vercel.app'));
console.log('PASS BI import: actual/converted merge, target preservation, month/store validation, missing/duplicate reports, employee scope, all TSX modules compile, packaged scripts parse.');

assert.throws(()=>slotFor({job:'installment',mode:'realtime',store:'both'}),/tạm ngưng/);
assert(!prepareBiImport([], '2026-10','realtime').errors.some(e=>e.includes('tra_cham')), 'Realtime profile does not request paused installment reports');
assert(!prepareBiImport([], '2026-10','all').errors.some(e=>e.includes('tra_cham_realtime')), 'Full import never requests paused realtime installment');

const context=vm.createContext({chrome:{runtime:{onMessage:{addListener(){}}}},URL});
vm.runInContext(fs.readFileSync('extension/baocaodmx-bi/background.js','utf8'),context);
for(const [profile,count] of [['all',9],['month',6],['realtime',3]]){
 const jobs=expectedBiJobs(profile);assert.equal(jobs.length,count);
 assert.deepEqual(JSON.parse(JSON.stringify(vm.runInContext(`buildJobs('${profile}')`,context))),jobs,'Collector and receiver agree on every expected report');
 assert(jobs.every(j=>j.job==='empComp'?['933','10341'].includes(j.store):j.store==='both'));
}
console.log('PASS combined workflow: 9 full/6 monthly/3 realtime reports; only employee competition is per-store; reuse original parser output.');
