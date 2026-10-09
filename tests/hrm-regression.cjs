const assert=require('node:assert/strict');
const fs=require('node:fs');
const Babel=require('@babel/standalone');
const html=fs.readFileSync('index.html','utf8');
const match=html.match(/<script id="embedded-source" type="application\/json">([\s\S]*?)<\/script>/);
assert(match,'Embedded-source tag is required');
const files=JSON.parse(match[1]);
let compiled=0;
for(const [id,source] of Object.entries(files)){
 assert(typeof source==='string',id+' is not source text');
 Babel.transform(source,{filename:id,presets:[['typescript',{allExtensions:true,isTSX:id.endsWith('.tsx')}],'react'],plugins:['transform-modules-commonjs']});
 compiled++;
}
function load(id,dependency){
 const result={exports:{}};
 const code=Babel.transform(files[id],{filename:id,presets:[['typescript',{allExtensions:true,isTSX:id.endsWith('.tsx')}],'react'],plugins:['transform-modules-commonjs']}).code;
 new Function('module','exports','require',code)(result,result.exports,req=>{
  if(dependency&&/internalRoster$/.test(req))return dependency;
  throw Error('Unexpected dependency '+req+' from '+id);
 });
 return result.exports;
}
const parser=load('src/utils/internalRoster.ts');
const scope=load('src/utils/personnelReportScope.ts',parser);
const hrm=(store,storeLabel='TGD_DNA_CLE')=>[
 'logo','Mail','20084 - Bùi Thị Thương Hoài','Nhân Viên',store+' - '+storeLabel+' - Cửa hàng kiểm tra','BP All In One - ĐMX',
 '50977 - Trần Đình Tri','Nhân Viên',store+' - '+storeLabel+' - Cửa hàng kiểm tra','BP Tiếp Đón Khách Hàng - ĐMX',
 '30391 - Đinh Ngọc Hồng','Nhân Viên',store+' - '+storeLabel+' - Cửa hàng kiểm tra','BP Tiếp Đón Khách Hàng - ĐMX',
 '52116 - Nguyễn Hữu Tấn','Quản lý',store+' - '+storeLabel+' - Cửa hàng kiểm tra','BP Quản Lý Siêu Thị - ĐMX',
 '30779 - Lê Ngọc Mỹ Duyên','Trưởng Ca',store+' - '+storeLabel+' - Cửa hàng kiểm tra','BP Trưởng Ca - ĐMX',
].join('\n');
const parsed=parser.parseInternalRoster(hrm('933'));
assert.equal(parsed.errors.length,0,parsed.errors.join(', '));
assert.deepEqual(parsed.people.map(p=>p.role),['Nhân viên','Tiếp đón khách hàng','Tiếp đón khách hàng','Quản lý','Trưởng ca']);
const before={'Bùi Thị Thương Hoài':{isOfficial:false,isVisible:true,targetPct:42},'Người hỗ trợ':{isOfficial:true,isVisible:true,targetPct:45}};
const preview=parser.previewInternalRoster(hrm('933'),before,'933',{},'TGDD',['Nhân viên','Tiếp đón khách hàng','Quản lý']);
assert.equal(preview.errors.length,0);
assert.equal(preview.eligibleCount,1);
assert.equal(preview.next['Bùi Thị Thương Hoài'].isOfficial,true);
for(const name of ['Trần Đình Tri','Đinh Ngọc Hồng','Nguyễn Hữu Tấn','Lê Ngọc Mỹ Duyên']){
 const c=preview.next[name];
 assert.equal(c.isOfficial,false,name+' must not receive KPI');
 assert.equal(c.isVisible,false);
 assert.equal(c.targetPct,0);
}
assert.equal(preview.next['Người hỗ trợ'].isOfficial,false);
assert.equal(preview.next['Người hỗ trợ'].isVisible,false);
assert.equal(before['Người hỗ trợ'].isOfficial,true,'Preview must not mutate configuration');
assert(parser.previewInternalRoster(hrm('933'),{},'10341',{},'TOPZONE').errors.length,'Reject HRM of the other shop');
assert(!parser.previewInternalRoster(hrm('10341','AAR_DNA_CLE'),{},'10341',{},'TOPZONE').errors.length,'TopZone HRM must match its own shop');
const table=parser.parseInternalRoster('Mã NV\tHọ tên\tChức danh\tBộ phận\n50977\tTrần Đình Tri\tNhân Viên\tBP Tiếp Đón Khách Hàng - ĐMX');
assert.equal(table.people[0].role,'Tiếp đón khách hàng');
const raw={
 dt_luyke:[{'MÃ ĐƠN VỊ':'933','DOANH THU (TR)':1000},{'MÃ ĐƠN VỊ':'10341','DOANH THU (TR)':2000}],
 dt_nv_luyke:[
 {'MÃ ĐƠN VỊ':'933','MÃ NV':'20084','TÊN NHÂN VIÊN':'Bùi Thị Thương Hoài','DOANH THU (TR)':150},
 {'MÃ ĐƠN VỊ':'933','MÃ NV':'50977','TÊN NHÂN VIÊN':'Trần Đình Tri','DOANH THU (TR)':30},
 {'MÃ ĐƠN VỊ':'933','TÊN NHÂN VIÊN':'Người hỗ trợ','DOANH THU (TR)':25},
 {'MÃ ĐƠN VỊ':'10341','TÊN NHÂN VIÊN':'Trần Đình Tri','DOANH THU (TR)':70}
 ],
 nv_tgdd:[{'NHÂN VIÊN':'Trần Đình Tri','MÃ NV':'50977'}],
 nv_tz:[{'NHÂN VIÊN':'Trần Đình Tri'}],
};
const config={TGDD:preview.next,TOPZONE:{'Trần Đình Tri':{isOfficial:true,isVisible:true,targetPct:100}}};
const report=scope.filterReportPersonnelData(raw,config);
assert.equal(report.dt_nv_luyke.length,2,'Only selling staff in their own shop');
assert.deepEqual(report.dt_nv_luyke.map(x=>x['DOANH THU (TR)']),[150,70]);
assert.equal(report.nv_tgdd.length,0);
assert.equal(report.nv_tz.length,1);
assert.deepEqual(raw.dt_nv_luyke.map(x=>x['DOANH THU (TR)']),[150,30,25,70],'Raw BI rows must not be mutated');
assert.deepEqual(report.dt_luyke,raw.dt_luyke,'Store-level revenue must remain intact');
const softDeleted={TGDD:{...preview.next,'Bùi Thị Thương Hoài':{...preview.next['Bùi Thị Thương Hoài'],isDeleted:true}}};
assert.equal(scope.filterReportPersonnelData(raw,softDeleted).dt_nv_luyke.some(r=>r['MÃ NV']==='20084'),false,'Soft deletion hides staff in reports');
assert(files['src/views/KpiCustomView.tsx'].includes('isDeleted:true,isOfficial:false,isVisible:false,targetPct:0'),'Soft delete must not physically purge rows');
assert(!files['src/views/KpiCustomView.tsx'].includes('delete next[activeStore][name]'),'No destructive personnel deletion');
assert(files['src/App.tsx'].includes('visibleOperationalAppData'),'Use non-destructive visible projection in App');
assert(files['src/views/KpiCustomView.tsx'].includes('TGD NHT (Shop 933)')&&files['src/views/KpiCustomView.tsx'].includes('AAR NHT (Shop 10341)'),'Keep two existing shop tabs');
console.log('PASS '+compiled+' TS/TSX modules parsed; 2-store HRM, department overrides, protected roles, KPI exclusion, soft delete and raw revenue preservation.');
