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
const Kpi=load('src/views/KpiCustomView.tsx').KpiCustomView;
const config={TGDD:{
 'Bùi Thị Thương Hoài':{jobTitle:'Nhân viên',isOfficial:true,isVisible:true,targetPct:100},
 'Trần Đình Tri':{jobTitle:'Tiếp đón khách hàng',isOfficial:false,isVisible:false,targetPct:0},
 'Nguyễn Hữu Tấn':{jobTitle:'Quản lý',isOfficial:false,isVisible:false,targetPct:0},
},TOPZONE:{'Nhân viên mẫu':{jobTitle:'Nhân viên',isOfficial:true,isVisible:true,targetPct:100}}};
const markup=server.renderToStaticMarkup(React.createElement(Kpi,{appData:{},personnelConfig:config,onUpdateConfig(){},onResetDefault(){}}));
assert(markup.includes('Trần Đình Tri'),'Reception staff must be visible in settings');
assert(markup.includes('Tiếp đón khách hàng'),'Reception must have its own group');
assert(markup.includes('Nguyễn Hữu Tấn'),'Manager must be visible in separate group');
assert(markup.includes('Không KPI'),'Non-sales staff must be marked KPI excluded');
assert(markup.includes('TGD NHT (Shop 933)')&&markup.includes('AAR NHT (Shop 10341)'),'Preserve original two-store names');
assert(markup.includes('Chuẩn hóa danh sách nội bộ'),'Bulk HRM import entry must appear');
console.log('PASS React SSR for original two-shop KPI manager, protected role groups and HRM input.');
