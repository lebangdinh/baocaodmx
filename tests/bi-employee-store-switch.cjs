const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {JSDOM}=require('jsdom');
const dom=new JSDOM('<main></main>',{runScripts:'outside-only',url:'https://baocao.dienmayxanh.com/dashboard/thi-dua'});
const ctx=dom.getInternalVMContext();ctx.chrome={runtime:{onConnect:{addListener(){}}}};
vm.runInContext(`
 Element.prototype.getClientRects=function(){return this.closest('[hidden]')?[]:[{}]};
 Object.defineProperty(HTMLElement.prototype,'offsetWidth',{get(){return this.closest('[hidden]')?0:10}});
 Object.defineProperty(HTMLElement.prototype,'offsetParent',{get(){return this.closest('[hidden]')?null:document.body}});
 var level='Vùng',shop='',events=[],all=false;
 var names={'933':'TGD_DNA_HCH - 351 Nguyễn Hữu Thọ','10341':'AAR_DNA_HCH - 351 Nguyễn Hữu Thọ'};
 function render(){
  const nav=level==='Vùng'?'<button data-go="Khu vực">Vùng Trung Bộ</button>':level==='Khu vực'?'<button data-go="Siêu thị">Đà Nẵng</button>':
   '<button data-go="Siêu thị">Đà Nẵng</button>'+(shop?'<button>'+names[shop]+'</button>':'');
  const rows=level==='Siêu thị'?Object.keys(names).map(code=>'<tr><td><button data-shop="'+code+'">'+names[code]+'</button></td><td>10</td></tr>').join(''):
   level==='Nhân viên'?'<tr><td>204201 - Nhân viên</td><td>10</td><td>'+shop+' - '+names[shop]+'</td></tr>':'';
  document.querySelector('main').innerHTML='<button class="bg-blue-600">Lũy kế</button><button class="bg-blue-600">Danh sách</button><button class="bg-blue-600">'+level+'</button>'+
   '<button id="program">Ngành hàng (chương trình) '+(all?'41 chương trình':'Chọn')+'</button><div id="picker" hidden><input placeholder="Tìm chương trình..."><button id="all">Chọn tất cả</button><input type="checkbox" '+(all?'checked':'')+'></div>'+nav+
   '<div>22 chương trình</div><table><thead><tr><th>'+(level==='Nhân viên'?'DOANH THU HẠNG TRONG ST TOP/BOTTOM ST BỘ PHẬN SIÊU THỊ':'DOANH THU TARGET % HT THÁNG % DỰ BÁO HẠNG VÙNG')+'</th></tr></thead><tbody>'+rows+'</tbody></table>';
  document.querySelector('#program').onclick=()=>document.querySelector('#picker').hidden=!document.querySelector('#picker').hidden;
  document.querySelector('#all').onclick=()=>{all=true;document.querySelector('#picker input[type=checkbox]').checked=true;events.push('all')};
  document.querySelectorAll('[data-go]').forEach(e=>e.onclick=()=>{events.push(e.textContent);level=e.dataset.go;shop='';render()});
  document.querySelectorAll('[data-shop]').forEach(e=>e.onclick=()=>{shop=e.dataset.shop;events.push(shop);level='Nhân viên';render()});
 }render();
`,ctx);
vm.runInContext(fs.readFileSync('extension/baocaodmx-bi/bi.js','utf8').replace('const sleep = (ms) => new Promise((r) => setTimeout(r, ms));','const sleep = async () => {};'),ctx);
vm.runInContext(`waitFor=async fn=>{for(let i=0;i<30;i++){const v=fn();if(v&&(!Array.isArray(v)||v.length))return v;}return null;};`,ctx);
(async()=>{
 const a=await vm.runInContext("runEmpComp('month',()=>{},'933')",ctx);
 assert(a.ok);assert.match(a.text,/933 - TGD_DNA_HCH/);assert(!a.text.includes('% HT THÁNG'),'Employee fixture has no monthly percentage column');
 const b=await vm.runInContext("runEmpComp('month',()=>{},'10341')",ctx);
 assert(b.ok);assert.match(b.text,/10341 - AAR_DNA_HCH/);assert(!b.text.includes('933 - TGD_DNA_HCH'));
 assert.deepEqual(Array.from(ctx.events),['all','Vùng Trung Bộ','Đà Nẵng','933','all','Đà Nẵng','10341']);
 // New breadcrumb must not validate old shop rows while the report is loading.
 ctx.document.querySelector('tbody td:last-child').textContent='933 - TGD_DNA_HCH - 351 Nguyễn Hữu Thọ';
 await assert.rejects(()=>vm.runInContext("competitionStable('Nhân viên','10341','month')",ctx),/Chưa xác minh/);
 dom.window.close();console.log('PASS: actual monthly drilldown, program selection, city breadcrumb return, separate shop captures, stale-row rejection.');
})().catch(e=>{console.error(e);process.exit(1)});
