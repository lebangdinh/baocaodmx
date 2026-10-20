// Synthetic data only: validate the new drilldown adapter with the site's parser.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const helper=require('../extension/baocaodmx-bi/installment.js');
const fixtures={
 '933':{providers:['HomeCredit(HC)','FECredit(FE)','Payoo','Trả góp KREDIVO','Thẻ tín dụng - SMARTPOS','Samsung Finance +'],rows:[
  ['Nhân Viên A','100 200 50 40 40 10 10 20 20 15 15 10 10 5 5'],
  ['Nhân Viên B','0 20 0 0 0 0 0 0 0 0 0 0 0 0 0']
 ]},
 '10341':{providers:['Payoo','Thẻ tín dụng - SMARTPOS','Trả góp KREDIVO','HomeCredit(HC)','FECredit(FE)','Kim Ngân Pay'],rows:[
  ['Nhân Viên A','200 500 40 30 15 40 20 50 25 60 30 10 5 10 5'],
  ['Nhân Viên C','50 100 50 10 20 10 20 10 20 10 20 5 10 5 10']
 ]}
};
function sample(store){const f=fixtures[store];return ['TGDD','Báo cáo trả chậm','10/2026','Lũy kế','Realtime','Tất cả vùng','Vùng Trung Bộ','Đà Nẵng',helper.storeNames[store]+' - 351 Nguyễn Hữu Thọ','Nhân viên','DT trả góp (triệu)','DT siêu thị (triệu)\tTỷ trọng trả chậm %\t'+f.providers.join('\t'),f.providers.map(()=>'DT\t%').join('\t'),...f.rows.flatMap(([name,values])=>[name,values.replace(/ /g,'\t')]),'1-2 / Tổng 2 dòng','50 / trang'].join('\n');}
const captures=['933','10341'].map(s=>helper.parse(sample(s),s));
assert.equal(helper.parse(sample('933').replace(/([^\n]+)\n(?=[\d,.]+\t)/g,'$1\t'),'933').rows.length,2);
assert.throws(()=>helper.parse(sample('933'),'10341'),/đúng shop/);
assert.throws(()=>helper.parse(sample('933').replace('Tổng 2 dòng','Tổng 3 dòng'),'933'),/đủ một trang/);
assert.throws(()=>helper.parse(sample('933').replace('FECredit(FE)','New Partner'),'933'),/đối tác/);
assert.throws(()=>helper.combine([captures[0],captures[0]]),/hai shop/);
assert.throws(()=>helper.combine([captures[0],{...captures[1],month:'11/2026'}]),/khác tháng/);
assert.throws(()=>helper.parse(sample('933').replace('40\t40','40'),'933'),/lệch cột/);
const Babel=require('@babel/standalone');
const files=JSON.parse(fs.readFileSync('index.html','utf8').match(/<script id="embedded-source" type="application\/json">([\s\S]*?)<\/script>/)[1]),cache={};
function load(id){
 if(cache[id])return cache[id].exports;
 const m=cache[id]={exports:{}};
 const code=Babel.transform(files[id],{filename:id,presets:[['typescript',{allExtensions:true,isTSX:id.endsWith('.tsx')}],'react'],plugins:['transform-modules-commonjs']}).code;
 new Function('require','module','exports',code)(req=>{const p=path.posix.normalize(path.posix.join(path.posix.dirname(id),req));return load(files[p+'.ts']?p+'.ts':p);},m,m.exports);
 return m.exports;
}
const text=helper.combine(captures);
const parsed=load('src/utils/smartDataParser.ts').parsePastedData(text,'tra_cham_luyke');
assert(!parsed.error,parsed.error);assert.equal(parsed.data.length,3);
const a=parsed.data.find(r=>r['NHÂN VIÊN']==='Nhân Viên A');
const near=(x,y)=>assert(Math.abs(x-y)<0.00001,`${x} != ${y}`);
near(a['DT TRẢ GÓP (TRIỆU)'],300);near(a['DT SIÊU THỊ (TRIỆU)'],700);
near(a['TỶ TRỌNG TRẢ CHẬM (%)'],300/700*100);
for(const [key,value] of Object.entries({'PAYOO DT (TRIỆU)':50,'HOME CREDIT (HC) DT (TRIỆU)':100,'FE CREDIT (FE) DT (TRIỆU)':20,'KREDIVO DT (TRIỆU)':65,'SMARTPOS DT (TRIỆU)':50,'SAMSUNG FINANCE+ DT (TRIỆU)':5,'KIM NGÂN PAY DT (TRIỆU)':10}))near(a[key],value);
near(parsed.data.reduce((n,r)=>n+r['DT TRẢ GÓP (TRIỆU)'],0),350);
const result=load('src/utils/biExtensionImport.ts').prepareBiImport([{job:'installment',store:'both',mode:'month',text}],'2026-10','month');
assert.deepEqual(result.updates.tra_cham_luyke,parsed.data);
console.log('PASS installment: provider order, shared employee totals, percentages, zero rows, rejected incomplete/foreign-month payloads, current parser and receiver.');
module.exports={sample};
