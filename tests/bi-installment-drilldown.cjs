const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const {sample}=require('./bi-installment-data.cjs');
async function scenario(start='Vùng',extra=false){
 let state=start,store='933',actions=[],now=0;
 const labels=['TGD_DNA_HCH - 351 Nguyễn Hữu Thọ','AAR_DNA_HCH - 351 Nguyễn Hữu Thọ'];
 if(extra)labels.push('XYZ_DNA_HCH - Third shop');
 const element=(label,click=()=>{},button=false)=>({
  textContent:label,innerText:label,offsetParent:{},offsetWidth:20,
  className:button?'bg-blue-600':'text-blue-500',click,
  getAttribute:()=>null,querySelectorAll:()=>[]
 });
 const period=element('Lũy kế',()=>{},true),view=element('Xem',()=>actions.push('Xem'),true),tab=element('Tỷ trọng trả góp');
 const all=()=>{
  const controls=[period,view,tab];
  if(state!=='Vùng')controls.push(element('Tất cả vùng',()=>{state='Vùng';actions.push('root');}));
  if(state==='Vùng')controls.push(element('Vùng Trung Bộ',()=>{state='Khu vực';actions.push('Vùng Trung Bộ');}));
  if(state==='Khu vực')controls.push(element('Đà Nẵng',()=>{state='Siêu thị';actions.push('Đà Nẵng');}));
  if(state==='Siêu thị')labels.forEach((label,i)=>controls.push(element(label,()=>{store=i===0?'933':'10341';state='Nhân viên';actions.push(store);})));
  if(state==='Nhân viên')controls.push(element('Đà Nẵng',()=>{state='Siêu thị';actions.push('back');}));
  return controls;
 };
 const raw=()=>state==='Nhân viên'?sample(store):[
  '10/2026','Siêu thị','Chọn','Lũy kế','Realtime',state,
  'DT trả góp (triệu)','DT siêu thị (triệu)\tTỷ trọng trả chậm %',
  ...(state==='Siêu thị'?labels.flatMap(label=>[label,'100\t200\t50']):[state==='Vùng'?'Vùng Trung Bộ':'Đà Nẵng','100\t200\t50']),
  '1-'+(state==='Siêu thị'?labels.length:1)+' / Tổng '+(state==='Siêu thị'?labels.length:1)+' dòng'
 ].join('\n');
 // Deliberately no table, thead, th, tbody or td elements in this UI fixture.
 const document={querySelector:()=>null,querySelectorAll(sel){
  if(sel==='button')return [period,view];
  if(sel.includes('aria-busy'))return [];
  if(sel.includes('a,button'))return all();
  return [];
 }};
 const ctx={console,document,location:{pathname:'/dashboard/tra-cham'},Date:{now:()=>now},setTimeout:fn=>{now+=250;fn();},getComputedStyle:()=>({backgroundColor:'oklch(0.546 0.245 262.881)'}),chrome:{runtime:{onConnect:{addListener(){}}}}};
 vm.createContext(ctx);
 vm.runInContext(fs.readFileSync('extension/baocaodmx-bi/installment.js','utf8'),ctx);
 vm.runInContext(fs.readFileSync('extension/baocaodmx-bi/bi.js','utf8'),ctx);
 ctx.raw=raw;vm.runInContext('pageText=()=>raw();',ctx);
 const run=vm.runInContext("runChecked({job:'installment',mode:'month',store:'both',month:'2026-10'},()=>{})",ctx);
 if(extra){await assert.rejects(run,/ngoài hai shop/);assert(!actions.includes('933'));return;}
 const result=await run;assert(result.ok);
 const expected=['Xem','Vùng Trung Bộ','Đà Nẵng','933','back','10341'];
 if(start!=='Vùng')expected.splice(1,0,'root');
 assert.deepEqual(actions,expected);
 assert(result.text.includes('Nhân Viên A\t300.00000000'));
 assert.equal(vm.runInContext("installmentHeading('Siêu thị\\nChọn\\nVùng\\tDT trả góp (triệu)\\tDT siêu thị (triệu)')",ctx),'Vùng');
 console.log('PASS real collection functions with div controls, start='+start);
}
(async()=>{await scenario();await scenario('Nhân viên');await scenario('Khu vực');await scenario('Vùng',true);console.log('v1.1.3 collection checks passed');})().catch(e=>{console.error(e);process.exitCode=1;});
