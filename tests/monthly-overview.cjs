const assert=require('node:assert/strict');
const fs=require('node:fs');
const posix=require('node:path').posix;
const Babel=require('@babel/standalone');
const React=require('react'),server=require('react-dom/server');
global.localStorage={getItem(){return null},setItem(){},removeItem(){}};
global.window={addEventListener(){},removeEventListener(){},dispatchEvent(){},matchMedia(){return {matches:false,addEventListener(){},removeEventListener(){}}}};
global.navigator={onLine:true};
const html=fs.readFileSync('index.html','utf8');
const files=JSON.parse(html.match(/<script id="embedded-source" type="application\/json">([\s\S]*?)<\/script>/)[1]);
const icons=new Proxy({}, {get(_obj,key){return (_props)=>React.createElement('i',{'data-icon':String(key)})}});
const external={react:React,'lucide-react':icons};
const cache={};
function load(id){
 if(external[id])return external[id];
 const source=files[id];
 if(!source)throw Error('Module not found: '+id);
 if(cache[id])return cache[id].exports;
 const item=cache[id]={exports:{}};
 const compiled=Babel.transform(source,{filename:id,presets:[['typescript',{allExtensions:true,isTSX:id.endsWith('.tsx')}],'react'],plugins:['transform-modules-commonjs']}).code;
 new Function('require','module','exports',compiled)(req=>{
  if(external[req])return external[req];
  const full=posix.normalize(posix.join(posix.dirname(id),req));
  for(const suffix of ['', '.ts', '.tsx', '.js'])if(files[full+suffix])return load(full+suffix);
  throw Error('Cannot resolve '+req+' from '+id);
 },item,item.exports);
 return item.exports;
}
const {buildMonthlyOverview:build}=load('src/utils/monthlyOverview.ts');
const now=new Date('2026-10-21T08:00:00+07:00');
const rev=(code,a,c,i)=>({'MÃ ĐƠN VỊ':code,'DOANH THU (TR)':a,'DOANH THU QĐ (TR)':c,'DT TRẢ GÓP (TR)':i,'TARGET (TR)':1000,'TARGET QĐ (TR)':2000,'SỐ NGÀY CỬA SỔ':20,'TB 3 THÁNG (TR)':100,'LƯỢT BILL (TẤT CẢ ST)':20});
const contest=(code,type,a)=>({'MÃ ĐƠN VỊ':code,'MÃ CHƯƠNG TRÌNH':'P1','CHƯƠNG TRÌNH':'Môn mẫu','LOẠI TĐ':type,'DT QUY ĐỔI (TR)':a,'SỐ LƯỢNG':a,'TARGET (TR/SL theo LOẠI TĐ)':100});
const data={dt_luyke:[rev('933',100,150,10),rev('10341',900,900,450)],dt_realtime:[rev('933',9999,9999,9999)],td_luyke:[contest('933',3,80),contest('10341',3,20),contest('10341',2,5)],td_realtime:[contest('933',3,9999)],dt_nv_luyke:[{'MÃ NHÂN VIÊN':'1','TÊN NHÂN VIÊN':'Cùng tên','SIÊU THỊ':'TGD_DNA_HCH','DOANH THU (TR)':10,'DOANH THU QĐ (TR)':20},{'MÃ NHÂN VIÊN':'2','TÊN NHÂN VIÊN':'Cùng tên','SIÊU THỊ':'AAR_DNA_HCH','DOANH THU (TR)':50,'DOANH THU QĐ (TR)':60},{'TÊN NHÂN VIÊN':'Không rõ shop','DOANH THU QĐ (TR)':999}]};
const original=JSON.stringify(data),all=build(data,'ALL',now);
assert.equal(all.actual,1000);assert.equal(all.converted,1050);assert.equal(all.installmentPct,46);assert.equal(all.convertedPct,105);
assert.equal(all.forecast,1627.5);assert.equal(all.forecastPct,40.6875);assert.equal(all.contests.length,2);assert.equal(all.contests.find(p=>p.type===3).target,200);assert.equal(all.contests.find(p=>p.type===3).achieved,100);
assert.equal(all.employees.length,2);assert.equal(all.employees[0].store,'TopZone');assert.equal(build(data,'933',now).actual,100);assert.equal(build(data,'10341',now).actual,900);assert.equal(build(data,'933',now).employees.length,1);assert.equal(JSON.stringify(data),original);
const partial=build({...data,dt_luyke:[data.dt_luyke[0]]},'ALL',now);assert.equal(partial.actual,null);assert.deepEqual(partial.missing,['TopZone']);
const missing=structuredClone(data);delete missing.dt_luyke[1]['DT TRẢ GÓP (TR)'];assert.equal(build(missing,'ALL',now).installmentPct,null);
assert.equal(build({},'ALL',now).actual,null);assert.equal(build({},'ALL',now).forecast,null);assert.equal(build({dt_luyke:[rev('933',0,0,0)]},'933',now).convertedPct,null);
const Monthly=load('src/views/MonthlyOverview.tsx').MonthlyOverview;
for(const scope of ['ALL','933','10341']){const markup=server.renderToStaticMarkup(React.createElement(Monthly,{appData:data,scope,onChangeScope(){}}));assert(markup.includes('Phạm vi tổng quan tháng'));assert(markup.includes('Toàn cụm — 2 siêu thị'));assert(markup.includes('TGDĐ — 351 Nguyễn Hữu Thọ'));assert(markup.includes('TopZone — 351 Nguyễn Hữu Thọ'));assert(!markup.includes('NaN')&&!markup.includes('Infinity'));}
const empty=server.renderToStaticMarkup(React.createElement(Monthly,{appData:{},scope:'ALL',onChangeScope(){}}));assert(empty.includes('Chưa có lũy kế: TGDĐ, TopZone'));assert(empty.includes('Chỉ số chưa đủ dữ liệu hiển thị “—”.'));assert(!empty.includes('NaN')&&!empty.includes('Infinity'));
for(const [id,source] of Object.entries(files))if(/\.[jt]sx?$/.test(id))Babel.transform(source,{filename:id,presets:[['typescript',{allExtensions:true,isTSX:id.endsWith('.tsx')}],'react'],plugins:['transform-modules-commonjs']});
console.log('PASS weighted ratios, store scope, forecast, contest units, staff identity, missing/zero data, no realtime double counting, nonmutation, SSR and source compilation.');
const TestRenderer=require('react-test-renderer');
let tree;
function Harness(){const [scope,setScope]=React.useState('ALL');return React.createElement(Monthly,{appData:data,scope,onChangeScope:setScope});}
TestRenderer.act(()=>{tree=TestRenderer.create(React.createElement(Harness));});
const select=()=>tree.root.findByProps({'aria-label':'Phạm vi tổng quan tháng'});
assert.equal(select().props.value,'ALL');
for(const scope of ['933','10341','ALL']){TestRenderer.act(()=>select().props.onChange({target:{value:scope}}));assert.equal(select().props.value,scope);assert(tree.root.findAllByType('h2')[0].children.join('').includes(scope==='ALL'?'Toàn cụm':scope==='933'?'TGDĐ':'TopZone'));}
// KPI cards also use <article>; count only competition cards.
const programs=()=>tree.root.findAll(node=>node.type==='article'&&node.props['data-achieved']!==undefined);
assert.equal(programs().length,2);
const done=tree.root.findByProps({'data-filter':'DONE'});
TestRenderer.act(()=>done.props.onClick());
assert.equal(tree.root.findByProps({'data-filter':'DONE'}).props['aria-pressed'],true);
assert.equal(programs().length,0);
TestRenderer.act(()=>tree.root.findByProps({'data-filter':'ALL'}).props.onClick());
assert.equal(programs().length,2);
TestRenderer.act(()=>tree.unmount());
console.log('PASS interactive scope selection and contest filter.');
