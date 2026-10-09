const assert=require('node:assert/strict');
const fs=require('node:fs');
const posix=require('node:path').posix;
const Babel=require('@babel/standalone');
const RealReact=require('react');
const React={...RealReact,useEffect(){}};
const renderer=require('react-test-renderer');
global.localStorage={getItem(){return null},setItem(){},removeItem(){}};
global.window={setTimeout(){return 1},clearTimeout(){},addEventListener(){},removeEventListener(){},dispatchEvent(){},matchMedia(){return {matches:false,addEventListener(){},removeEventListener(){}}}};
global.navigator={onLine:true};
const html=fs.readFileSync(process.env.HTML_PATH||'index.html','utf8');
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

const View=load('src/views/RealtimeRevenueSummary.tsx').RealtimeRevenueSummary;
const names=['Lê Văn Nhân','Lê Thị Thanh Trâm','Nguyễn Thị Thy','Trần Thị Huyền Trang'];
const config={TGDD:{},TOPZONE:{}};
names.forEach((name,i)=>{
 config.TGDD[name]={employeeId:String(10001+i),isOfficial:true,isVisible:true,targetPct:32.5};
 config.TOPZONE[name]={employeeId:String(10001+i),isOfficial:false,isVisible:false,targetPct:0};
});
config.TOPZONE['Đỗ Nhật Trinh']={employeeId:'20001',isOfficial:true,isVisible:true,targetPct:130};
config.TGDD['Hỗ trợ']={employeeId:'30001',isOfficial:false,isVisible:true,targetPct:0};
const snapshot=JSON.stringify(config);
const data={dt_nv_realtime:names.map((name,i)=>({'TÊN NHÂN VIÊN':name,'MÃ NV':String(10001+i),'MÃ ĐƠN VỊ':'933','DOANH THU QĐ (TR)':10})),dt_realtime:[{'MÃ ĐƠN VỊ':'933','TARGET QĐ (TR)':1000},{'MÃ ĐƠN VỊ':'10341','TARGET QĐ (TR)':1000}]};
const raw=JSON.stringify(data);
const tree=renderer.create(React.createElement(View,{appData:data,personnelConfig:config}));
const text=n=>typeof n==='string'?n:(n?.children||[]).map(text).join('');
const buttons=()=>tree.root.findAllByType('button');

const click=button=>renderer.act(()=>button.props.onClick());
click(buttons().find(b=>text(b).startsWith('Bộ lọc NV')));
click(buttons().find(b=>text(b).includes('Ẩn/hiện nhân sự')));
const groupButton=()=>buttons().find(b=>text(b).startsWith('NV TGDĐ/TZ'));
const staffBox=name=>tree.root.findAllByType('input').find(n=>n.props.type==='checkbox'&&n.parent.type==='label'&&text(n.parent).startsWith(name));
for(const name of [...names,'Đỗ Nhật Trinh']){
 assert.equal(staffBox(name).props.checked,true,name+' must be selected across both shops');
 assert(text(staffBox(name).parent).includes('Nội bộ KPI'),name+' must use active roster, not hidden legacy entry');
}
assert.equal(groupButton().props['aria-pressed'],true);
click(groupButton());
for(const name of [...names,'Đỗ Nhật Trinh'])assert.equal(staffBox(name).props.checked,false,'Group deselect: '+name);
assert.equal(groupButton().props['aria-pressed'],false);
click(groupButton());
for(const name of [...names,'Đỗ Nhật Trinh'])assert.equal(staffBox(name).props.checked,true,'Group select: '+name);
// Partial selection must select the whole KPI group on the next click.
renderer.act(()=>staffBox(names[0]).props.onChange({target:{checked:false}}));
assert.equal(groupButton().props['aria-pressed'],false);
click(groupButton());
assert.equal(staffBox(names[0]).props.checked,true);
// Separately selected support staff remain selected when toggling KPI group.
renderer.act(()=>staffBox('Hỗ trợ').props.onChange({target:{checked:true}}));
click(groupButton());
assert.equal(staffBox('Hỗ trợ').props.checked,true);
for(const name of names)assert.equal(staffBox(name).props.checked,false);
click(groupButton());
// Re-normalization updates MANAGED membership immediately, even with no RT rows.
click(buttons().find(b=>text(b)==='BỎ CHỌN'));
click(groupButton());
const updated=JSON.parse(snapshot);
updated.TGDD['Nhân viên mới']={employeeId:'40001',isOfficial:true,isVisible:true,targetPct:0};
renderer.act(()=>tree.update(React.createElement(View,{appData:{...data,dt_nv_realtime:[]},personnelConfig:updated})));
assert.equal(staffBox('Nhân viên mới').props.checked,true);
for(const name of names)assert.equal(staffBox(name).props.checked,true,'No realtime revenue: '+name);
assert.equal(JSON.stringify(config),snapshot,'Selection must not change KPI configuration');
assert.equal(JSON.stringify(data),raw,'Selection must not change source revenue');
tree.unmount();
console.log('PASS: cross-shop legacy roster, both-shop KPI toggle, partial selection, support selection, live normalized roster without RT, and source preservation.');
