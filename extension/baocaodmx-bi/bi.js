// Chạy trên trang BI: chọn bộ lọc → Tải lại → đợi → lấy toàn bộ chữ trên trang (như Cmd+A, Cmd+C).
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const txt = (el) => (el.textContent || '').replace(/\s+/g, ' ').trim();
const vis = (el) => !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);

async function waitFor(fn, ms = 15000, step = 200) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const v = fn();
    if (v && (!Array.isArray(v) || v.length > 0)) return v;
    await sleep(step);
  }
  return null;
}
const byText = (sel, re) => [...document.querySelectorAll(sel)].filter((e) => vis(e) && re.test(txt(e)));
const click = (el) => el.click();

const bs = () => [...new Set([...document.querySelectorAll('button'),...document.querySelectorAll('[role=button],[role=tab]')])].filter((e) => !!e.offsetParent);
const canonicalLabel=s=>typeof SkstRecognition!=='undefined'?SkstRecognition.canonical(s):String(s).trim();
const btxt = (e) => canonicalLabel((e.innerText || e.textContent || '').trim());

async function tab(name) {
  const b = bs().find((x) => btxt(x) === name && true);
  if (!b) return false;
  if (!isSelectedButton(b)) { b.click(); await sleep(800); }
  return true;
}

async function ticks() {
  // Enable only the columns used by the existing parser; do not toggle every
  // display option or mistake the selected view tabs for checkboxes.
  for(const name of ['Tỉ trọng','Tỷ trọng','Target','Tăng trưởng']){
    const control=[...document.querySelectorAll('button,label,[role=checkbox]')].find(e=>vis(e)&&txt(e).replace(/[✓✔☑]/g,'').trim()===name);
    if(control&&revenueDetailState(control)===false){control.click();await sleep(150);}
  }
}

// Required on the consolidated revenue page, including the employee tab.
// Re-read the control after a click because BI can replace it during a render.
function revenueDetailControl() {
  const labels=[...document.querySelectorAll('button,label,[role=checkbox],span,div')]
    .filter(e=>vis(e)&&canonicalLabel(txt(e).replace(/[✓✔☑]/g,'').trim())==='Chi tiết doanh thu');
  // Prefer an actual interactive ancestor over a text-only span.
  for(const label of labels){const target=label.closest('button,label,[role=checkbox]');if(target)return target;}
  return labels.sort((a,b)=>a.querySelectorAll('*').length-b.querySelectorAll('*').length)[0]||null;
}
function blueSelected(element) {
  if(!element)return false;
  const rgb=getComputedStyle(element).backgroundColor.match(/rgba?\((\d+)[, ]+\s*(\d+)[, ]+\s*(\d+)/);
  return !!rgb && Number(rgb[1])<100 && Number(rgb[2])>=40 && Number(rgb[2])<180 && Number(rgb[3])>=170;
}
function revenueDetailState(control) {
  const input=control.matches?.('input[type=checkbox]')?control:control.querySelector('input[type=checkbox]');
  if(input)return input.checked;
  const state=control.getAttribute('aria-checked')||control.getAttribute('aria-pressed')||control.getAttribute('data-state');
  if(['true','checked','on'].includes(state))return true;
  if(['false','unchecked','off'].includes(state))return false;
  const children=[...control.querySelectorAll('span,div,svg')];
  if(children.some(e=>/^[✓✔☑]$/.test(txt(e))||e.matches?.('svg.lucide-check,svg[data-lucide="check"]')))return true;
  if(children.some(e=>blueSelected(e)&&txt(e).length<=1))return true;
  const indicator=control.firstElementChild;
  if(indicator&&txt(indicator)===''&&!indicator.querySelector('svg'))return false;
  return null;
}

async function ensureRevenueDetails() {
  let control=revenueDetailControl();
  if(!control)throw Error('Không thấy ô Chi tiết doanh thu trên BI.');
  const state=revenueDetailState(control);
  if(state===null)throw Error('Chưa xác minh được trạng thái ô Chi tiết doanh thu.');
  if(!state){control.click();await sleep(300);}
  const checked=await waitFor(()=>{control=revenueDetailControl();return control&&revenueDetailState(control)===true;},3000);
  if(!checked)throw Error('Chưa bật được Chi tiết doanh thu; chưa lấy bảng để tránh thiếu cột.');
}

async function dtqd() {
  const b = bs().find((x) => btxt(x) === 'DT quy đổi');
  if (b && !/bg-blue-600/.test(b.className)) { b.click(); await sleep(150); }
}

function isSelectedButton(button) {
  return !!button && (blueSelected(button) || /(?:^|\s)bg-blue-600(?:\s|$)/.test(button.className) ||
    button.getAttribute('aria-selected')==='true' || button.getAttribute('aria-pressed')==='true' ||
    button.getAttribute('data-state')==='active');
}
function pairButton(label) {
  return bs().find(b => btxt(b)===label || (label==='Lũy kế' && /^Luỹ kế$/i.test(btxt(b))));
}
async function selectPair(label, otherLabel) {
  const current=pairButton(label);
  if(!current)throw Error('Không thấy nút '+label+' trên BI.');
  if(!isSelectedButton(current))current.click();
  // React can replace buttons after click. Always inspect the current document.
  const selected=await waitFor(()=>isSelectedButton(pairButton(label)) &&
    (!pairButton(otherLabel) || !isSelectedButton(pairButton(otherLabel))),4000);
  if(!selected)throw Error('Chưa xác minh được '+label+' đang chọn trên BI.');
  await sleep(400);
}
async function setPeriod(mode) {
  if(!['month','realtime'].includes(mode))throw Error('Sai chế độ báo cáo.');
  await selectPair(mode==='month'?'Lũy kế':'Realtime',mode==='month'?'Realtime':'Lũy kế');
}

// Combined filters mirror the user's copy-paste workflow. Only employee
// competition requests one store; all other jobs request both stores together.
let requestedStore = '', requestedPeriod = '';
// Scope all tree actions to the open store picker, never the report table.
function storePicker(){
 const search=[...document.querySelectorAll('input')].find(e=>vis(e)&&/^Tìm (?:siêu thị|công ty, vùng, cụm, khu vực, siêu thị)(?:\.{3}|…)?$/i.test((e.placeholder||'').replace(/\s+/g,' ').trim()));
 if(!search)return null;
 for(let root=search.parentElement;root&&root!==document.body;root=root.parentElement){
  if([...root.querySelectorAll('button')].some(e=>txt(e)==='Bỏ chọn tất cả'))return root;
 }
 return null;
}
function storeFilterLabels(){
 const root=storePicker();if(!root)return [];
 return [...root.querySelectorAll('input[type=checkbox]')].map(input=>{
  for(let row=input.parentElement;row&&row!==root;row=row.parentElement){
   if(row.querySelectorAll('input[type=checkbox]').length!==1)break;
   if(/^\d+\s*[-–—]/.test(txt(row)))return row;
  }
  return null;
 }).filter(e=>e&&vis(e));
}
function labelStoreCode(label){return txt(label).match(/^(\d+)\s*[-–—]/)?.[1];}
function desiredStoreCodes(){return requestedStore==='both'?['933','10341']:[requestedStore];}
function collapsedStoreToggle(root){
 const icons=[...root.querySelectorAll('svg.lucide-chevron-right,svg[data-lucide="chevron-right"],svg')].filter(vis);
 for(const icon of icons){
  const right=icon.matches('.lucide-chevron-right,[data-lucide="chevron-right"]')||[...icon.querySelectorAll('path,polyline')].some(e=>/^(m9 18 6-6-6-6|9 18 15 12 9 6)$/i.test((e.getAttribute('d')||e.getAttribute('points')||'').trim()));
  if(!right)continue;
  const control=icon.closest('button,[role=button]')||icon.parentElement;
  // Only an icon-only expander; never click a checkbox label or a whole branch.
  if(control&&root.contains(control)&&!txt(control)&&!control.querySelector('input')&&control.getAttribute('aria-expanded')!=='true')return control;
 }
 return [...root.querySelectorAll('[aria-expanded="false"]')].find(e=>vis(e)&&!e.querySelector('input')&&!txt(e))||null;
}
async function expandStoreTree(){
 for(let step=0;step<100;step++){
  const root=storePicker();if(!root)throw Error('Menu Siêu thị đã đóng khi đang mở cây.');
  const toggle=collapsedStoreToggle(root);
  if(!toggle)return;
  const before=root.innerHTML;
  toggle.click();
  if(!await waitFor(()=>storePicker()&&storePicker().innerHTML!==before,2000))throw Error('Không mở được nhánh Siêu thị; dùng Kiểm tra nút BI để gửi chẩn đoán.');
  await sleep(150);
 }
 throw Error('Cây Siêu thị vượt giới hạn kiểm tra; chưa lấy dữ liệu.');
}
async function area() {
 const wanted=desiredStoreCodes();
 let button=bs().find(x=>/^Siêu thị/.test(btxt(x)));
 if(!button)return 'Không thấy bộ lọc Siêu thị';
 try{
  if(!storePicker())button.click();
  if(!await waitFor(storePicker,5000))return 'Không nhận diện được menu Siêu thị';
  // Clear stale search so hidden selected shops cannot escape validation.
  const search=storePicker().querySelector('input[placeholder]');
  if(search?.value){
   Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(search,'');
   search.dispatchEvent(new Event('input',{bubbles:true}));
   search.dispatchEvent(new Event('change',{bubbles:true}));
   await sleep(400);
  }
  // Show inactive stores too, if this picker exposes a status filter.
  const all=[...storePicker().querySelectorAll('button')].find(e=>/^Tất cả(?:\s*\(\d+\))?$/.test(txt(e)));
  if(all){all.click();await sleep(200);}
  await expandStoreTree();
  let labels=storeFilterLabels();
  if(!wanted.every(code=>labels.filter(l=>labelStoreCode(l)===code).length===1))return 'Bộ lọc chưa có đúng shop '+wanted.join(' + ');
  const clear=[...storePicker().querySelectorAll('button')].find(e=>txt(e)==='Bỏ chọn tất cả');
  if(!clear)return 'Không thấy nút Bỏ chọn tất cả';
  clear.click();await sleep(200);
  await expandStoreTree();
  for(const code of wanted){
   const current=storeFilterLabels().find(l=>labelStoreCode(l)===code);
   const input=current?.querySelector('input[type=checkbox]');
   if(!input)return 'Danh sách Siêu thị thay đổi khi chọn '+code;
   if(!input.checked){input.click();await sleep(180);}
  }
  const selected=storeFilterLabels().filter(l=>l.querySelector('input[type=checkbox]').checked).map(labelStoreCode);
  const ok=selected.length===wanted.length&&wanted.every(code=>selected.includes(code));
  return ok?'':'Chưa chọn đúng shop '+wanted.join(' + ');
 }catch(e){return e.message;}
 finally{
  button=bs().find(x=>/^Siêu thị/.test(btxt(x)));
  if(storePicker()&&button){button.click();await sleep(400);}
 }
}

function pageText() {
  const sel = getSelection();
  sel.removeAllRanges();
  const r = document.createRange();
  r.selectNodeContents(document.body);
  sel.addRange(r);
  const t = sel.toString();
  sel.removeAllRanges();
  // Body selection can omit a month-picker input. Include its actual displayed
  // value, never the requested month, so the receiver can reject a stale period.
  const monthInput=[...document.querySelectorAll('input')].find(e=>vis(e)&&/^(0?[1-9]|1[0-2])\/20\d{2}$/.test(e.value||''));
  return monthInput ? monthInput.value+'\n'+t : t;
}

async function clickMeasure(measure) {
  const label=measure==='qd'?'DT quy đổi':'DT thực';
  await selectPair(label,measure==='qd'?'DT thực':'DT quy đổi');
  return true;
}

// Bấm Tải lại rồi đợi bảng đúng loại (QĐ hoặc thực) có dòng siêu thị và ổn định, trả về toàn bộ chữ trên trang.
async function reloadAndCapture(measure) {
  await ensureRevenueDetails();
  const wanted=measure==='qd'?'DT quy đổi':'DT thực';
  if(!isSelectedButton(pairButton(wanted)))throw Error('Chế độ doanh thu thay đổi trước khi lấy bảng.');
  if(requestedPeriod&&!isSelectedButton(pairButton(requestedPeriod==='month'?'Lũy kế':'Realtime')))throw Error('Chế độ Lũy kế/Realtime thay đổi trước khi lấy bảng.');
  const rb = await waitFor(() => bs().filter((x) => /Tải lại/i.test(btxt(x))), 15000);
  if (!rb) return { ok: false, error: 'Không thấy nút Tải lại.' };
  rb[0].click();
  await sleep(2500);
  let last = '', stable = 0;
  const end = Date.now() + 90000;
  while (Date.now() < end) {
    const busy = document.querySelector('[aria-busy=true],.animate-spin,[class*=spinner]');
    const t = pageText();
    const head = [...document.querySelectorAll('thead th')].filter(vis).map(txt).find(h=>/^DOANH THU/i.test(h)) || (t.match(/SỐ LƯỢNG[^\n]*\n\s*(DOANH THU[^\n]*)/)||[])[1] || '';
    const rightMeasure = measure === 'qd' ? /QĐ|QUY ĐỔI/i.test(head) : (head && !/QĐ|QUY ĐỔI/i.test(head));
    const hasRow = [...document.querySelectorAll('tbody tr')].some(row=>/^(?:\d{3,7}|online)\s*[-–—]/i.test(txt(row))) || /\n\d+\s*-\s*[^\n]+\n[\d,.]+\t/.test(t);
    if (!busy && rightMeasure && hasRow && /DT TRẢ GÓP/i.test(t)) {
      stable = t === last ? stable + 1 : 0;
      if (stable >= 6) return { ok: true, text: t };
    } else stable = 0;
    last = t;
    await sleep(200);
  }
  return { ok: false, error: 'BI tải quá lâu (90 giây). Thử lại sau.' };
}

async function run(mode, progress) {
  if (/login|signin|dang-nhap/i.test(location.pathname)) return { ok: false, error: 'Chưa đăng nhập BI. Hãy đăng nhập BI rồi thử lại.' };
  const ready = await waitFor(() => bs().filter((x) => /Tải lại/i.test(btxt(x))), 25000);
  if (!ready) return { ok: false, error: 'Không thấy bộ lọc BI (có thể chưa đăng nhập hoặc giao diện đã đổi).' };
  progress('Đang chọn bộ lọc…');
  if (!(await tab('Doanh thu'))) return { ok: false, error: 'Không thấy tab Doanh thu trên BI.' };
  progress('Đang chọn '+(mode==='realtime'?'Realtime':'Lũy kế')+' trên Doanh thu hợp nhất…');
  await setPeriod(mode);
  await ticks();
  const ae = await area();
  if (ae) return { ok: false, error: 'Không chọn được Siêu thị: ' + ae };
  // SKST cần cả DT thực và DT quy đổi (BI chỉ hiện một loại mỗi lần) → lấy lần lượt hai bảng.
  const got = {};
  for (const measure of ['thuc', 'qd']) {
    progress(measure === 'thuc' ? 'Đang tải DT thực…' : 'Đang tải DT quy đổi…');
    if (!(await clickMeasure(measure))) return { ok: false, error: 'Không thấy nút ' + (measure === 'qd' ? 'DT quy đổi' : 'DT thực') + '.' };
    await ticks();
    progress('Đang bật Chi tiết doanh thu và kiểm tra cột…');
    const r = await reloadAndCapture(measure);
    if (!r.ok) return r;
    got[measure] = r.text;
  }
  return { ok: true, text: got.qd, textThuc: got.thuc };
}


// Capture every lazily rendered competition block. BI can show 24 programs
// while keeping only 11 in the DOM. Selection(body) alone is NOT a full export.
function competitionHeading(line){
 return /^T\d{2}\s*[-–]\s*(?:T\d{2}\s*[-–]\s*)?\S/i.test(String(line||'').trim());
}
function competitionCounts(raw){
 // BI displays two different counters: selected filter (41), shown results (24).
 const values=[...String(raw).matchAll(/(?:^|\n)\s*(\d+)\s+chương trình\s*(?=\n|$)/gi)]
  .map(m=>Number(m[1]));
 return {selected:values.length>=2?values[0]:null,shown:values.length>=2?values[values.length-1]:null};
}
function competitionParts(raw){
 const lines=String(raw).split(/\r?\n/).map(s=>s.trim());
 const headers=[];
 for(let i=0;i<lines.length;i++)if(competitionHeading(lines[i]))headers.push(i);
 const parts=[];
 for(let i=0;i<headers.length;i++){
  const first=headers[i],last=i+1<headers.length?headers[i+1]:lines.length;
  const content=lines.slice(first,last).filter(Boolean);
  parts.push({name:lines[first].replace(/\s+/g,' ').trim(),content});
 }
 return {prefix:lines.slice(0,headers[0]??lines.length).filter(Boolean).join('\n'),parts};
}
function competitionShopLineCount(text){
 return String(text).split(/\r?\n/).filter(x=>/^(?:TGD_DNA_HCH|AAR_DNA_HCH)\s*[-–—]/i.test(x.trim())).length;
}
// Diagnostics per program. A title alone does not mean the shop rows were copied.
function competitionRows(part){
 const content=part.content;
 const stores=[];
 let total=null;
 for(let i=0;i<content.length;i++){
  const line=content[i];
  const isStore=/^(?:TGD_DNA_HCH|AAR_DNA_HCH)\s*[-–—]/i.test(line);
  if(!isStore&&line!=='TỔNG')continue;
  const valueLine=content[i+1]||'';
  const amountCell=valueLine.split('\t')[0].trim();
  const amount=/^-?\d[\d,.]*(?:\s|$)/.test(amountCell)?Number(amountCell.replace(/,/g,'')):null;
  if(isStore)stores.push({name:line,unit:/^TGD_/i.test(line)?'TGD':'AAR',amount:Number.isFinite(amount)?amount:null,hasValue:Number.isFinite(amount)});
  else total=Number.isFinite(amount)?amount:null;
 }
 return {stores,total};
}
function competitionProgramDiagnostics(part){
 const rows=competitionRows(part);
 const unique=[...new Set(rows.stores.map(r=>r.unit))];
 const valid=rows.stores.filter(r=>r.hasValue);
 const sum=valid.length===rows.stores.length&&valid.length?valid.reduce((s,r)=>s+r.amount,0):null;
 return {program:part.name,storeRows:rows.stores.length,units:unique,
  rowsWithValues:valid.length,total:rows.total,
  storeSum:sum,totalDifference:sum!==null&&rows.total!==null?Number((rows.total-sum).toFixed(2)):null};
}
// A virtualized BI list may show the TGD and AAR lines of the SAME
// program in different scroll frames. Assemble complete rows only from BI
// text actually observed; never calculate/fill in missing values ourselves.
function competitionMergeProgram(part,fragments){
 const merged=part.content.slice();
 const has=new Set();
 for(let i=0;i<merged.length;i++){
  if(/^(?:TGD_DNA_HCH|AAR_DNA_HCH)\s*[-–—]/i.test(merged[i]))
   has.add(merged[i].split('_')[0].toUpperCase());
 }
 for(const candidate of fragments){
  const rows=candidate.content;
  for(let i=0;i<rows.length-1;i++){
   const row=rows[i];
   if(!/^(?:TGD_DNA_HCH|AAR_DNA_HCH)\s*[-–—]/i.test(row))continue;
   const unit=row.split('_')[0].toUpperCase();
   if(has.has(unit))continue;
   const cells=rows[i+1].split('\t').map(x=>x.trim());
   if(cells.length<5||!cells.slice(0,2).every(v=>/^-?\d[\d,.]*$/.test(v)))continue;
   merged.push(row,rows[i+1]);
   has.add(unit);
  }
 }
 return {name:part.name,content:merged};
}
// Validate the complete numeric row expected by the SKST paste parser,
// not merely its first amount cell. Values of zero are valid.
function competitionValidateDataCells(part){
 for(let i=0;i<part.content.length;i++){
  if(!/^(?:TGD_DNA_HCH|AAR_DNA_HCH)\s*[-–—]/i.test(part.content[i]))continue;
  const values=(part.content[i+1]||'').split('\t').map(x=>x.trim());
  if(values.length<5||!values.slice(0,2).every(v=>/^-?\d[\d,.]*$/.test(v)))
   throw Error('Chương trình '+part.name+' có dòng shop '+part.content[i]+' thiếu Doanh thu/Số lượng hoặc TARGET. Đã chặn nhập.');
  if(!/^(?:\d+(?:[.,]\d+)?%|-)$/.test(values[2]))
   throw Error('Chương trình '+part.name+' có dòng shop '+part.content[i]+' thiếu % hoàn thành. Đã chặn nhập.');
 }
}
function competitionScrollCandidates(){
 const leaf=[...document.querySelectorAll('body *')].find(e=>
  vis(e)&&e.childElementCount===0&&competitionHeading(txt(e)));
 if(!leaf)return [];
 const found=[];
 for(let cur=leaf.parentElement;cur;cur=cur.parentElement){
  if(cur.scrollHeight>cur.clientHeight+60&&cur.clientHeight>90){
   const style=getComputedStyle(cur);
   if(/auto|scroll|overlay|hidden/.test(style.overflowY)||cur===document.scrollingElement||cur===document.body)
    found.push(cur);
  }
 }
 const doc=document.scrollingElement;
 if(doc&&doc.scrollHeight>doc.clientHeight+60&&!found.includes(doc))found.push(doc);
 return found;
}
function competitionScrollPosition(el){return el===document.scrollingElement ? window.scrollY : el.scrollTop;}
function competitionScrollTo(el,y){
 if(el===document.scrollingElement)window.scrollTo({top:y,left:window.scrollX,behavior:'instant'});
 else el.scrollTop=y;
}
async function competitionCaptureFull(level,mode,progress=()=>{}){
 if(!['Siêu thị','Nhân viên'].includes(level))throw Error('Cấp lấy Thi đua không hợp lệ.');
 const original=await competitionStable(level,'',mode);
 const counts=competitionCounts(original);
 if(!Number.isInteger(counts.shown)||counts.shown<1||counts.shown>200)
  throw Error('Không tách được số chương trình đang hiển thị từ BI (khác số chương trình đã chọn). Chưa nhập.');
 const rootParts=competitionParts(original);
 const candidates=competitionScrollCandidates();
 const seen=new Map(),observedUnits=new Map(),fragments=new Map();
 let prefix=rootParts.prefix;
 const ingest=raw=>{
  const parts=competitionParts(raw);
  // Keep header/navigation text from the first view. Do not join copies of the header.
  for(const part of parts.parts){
   const versions=fragments.get(part.name)||[];
   if(!versions.some(p=>p.content.join('\n')===part.content.join('\n'))){
    versions.push(part);
    if(versions.length>18)versions.shift();
    fragments.set(part.name,versions);
   }
   const units=observedUnits.get(part.name)||new Set();
   for(const record of competitionRows(part).stores)units.add(record.unit);
   observedUnits.set(part.name,units);
   const prev=seen.get(part.name);
   // A partially virtualized block may be present in multiple scroll views.
   // Keep the version containing most rows/characters, never sum duplicate rows.
   const quality=p=>competitionShopLineCount(p.content.join('\n'))*10000+p.content.join('\n').length;
   if(!prev||quality(part)>quality(prev))seen.set(part.name,part);
  }
 };
 ingest(original);
 const diagnostic=[];
 // In most BI versions an inner scroll pane virtualizes the list. Try its
 // ancestors too, never assume the whole document is the scrollable element.
 for(const [index,container] of candidates.entries()){
  // Even if all titles are visible, the *rows* of a tall program may be virtualized.
  const originalY=competitionScrollPosition(container);
  let steps=0;
  try{
   competitionScrollTo(container,0);
   await sleep(450);
   ingest(pageText());
   let stagnation=0;
   for(let n=0;n<180;n++){
    const height=container.clientHeight||window.innerHeight;
    const end=Math.max(0,container.scrollHeight-height);
    const old=competitionScrollPosition(container);
    const next=Math.min(end,old+Math.max(180,Math.floor(height*.72)));
    if(next<=old+1)break;
    competitionScrollTo(container,next);
    await sleep(250);
    // Give React/lazy render a chance to replace the virtual rows.
    let raw=pageText();
    for(let attempt=0;attempt<4&&raw===original&&next>0;attempt++){await sleep(200);raw=pageText();}
    const before=seen.size;ingest(raw);steps++;
    progress('Đang đọc đủ Thi đua '+level+': '+seen.size+'/'+counts.shown+' chương trình…');
    if(seen.size===before)stagnation++;else stagnation=0;
    if(stagnation>=12&&competitionScrollPosition(container)>=end-2)break;
   }
   diagnostic.push({index,tag:container.tagName,steps,found:seen.size});
  }finally{competitionScrollTo(container,originalY);await sleep(200);}
 }
 if(seen.size!==counts.shown){
  throw Error('BI hiển thị '+counts.shown+' chương trình nhưng chỉ lấy được '+seen.size+
   ' tiêu đề (đã thử cuộn '+diagnostic.map(d=>d.steps).join('/')+' bước). Đã CHẶN nhập để tránh thiếu dòng. Chụp lỗi này để kiểm tra.');
 }
 // Merge fragments of the same program if its two stores were rendered
 // separately. Re-run all checks on the exact text sent to SKST.
 if(level==='Siêu thị'){
  for(const [name,part] of seen){
   seen.set(name,competitionMergeProgram(part,fragments.get(name)||[part]));
  }
 }
 const programChecks=[];
 for(const [name,part] of seen){
  const body=part.content.join('\n');
  if(!/(?:DOANH THU|SỐ LƯỢNG)/i.test(body))
   throw Error('Chương trình '+name+' thiếu tiêu đề cột. Chưa nhập.');
  if(mode==='realtime'&&!/(?:DOANH THU|SỐ LƯỢNG)\s*\(RT\)/i.test(body))
   throw Error('Chương trình '+name+' không có nhãn số liệu (RT). Chưa nhập Realtime.');
  if(mode==='realtime'&&!/% HT NGÀY/i.test(body))
   throw Error('Chương trình '+name+' thiếu cột % HT NGÀY. Chưa nhập Realtime.');
  if(level==='Siêu thị'){
   competitionValidateDataCells(part);
   const check=competitionProgramDiagnostics(part);
   programChecks.push(check);
   if(check.storeRows===0||check.rowsWithValues!==check.storeRows||check.total===null)
    throw Error('Chương trình '+name+' thiếu dòng siêu thị, số liệu hoặc dòng TỔNG. Chưa nhập.');
   if(new Set(check.units).size!==check.storeRows)
    throw Error('Chương trình '+name+' bị trùng dòng siêu thị. Chưa nhập.');
   if(check.totalDifference!==null&&Math.abs(check.totalDifference)>0.06)
    throw Error('Chương trình '+name+' không khớp tổng BI: TỔNG '+check.total+' nhưng cộng dòng shop '+check.storeSum+' (chênh '+check.totalDifference+'). Có thể bị thiếu shop. Đã CHẶN nhập.');
   // Scroll virtualization may show two different shop rows in different frames.
   const units=observedUnits.get(name)||new Set();
   if([...units].some(unit=>!check.units.includes(unit)))
    throw Error('Chương trình '+name+' có dòng '+[...units].filter(u=>!check.units.includes(u)).join(', ')+
     ' ở phần cuộn khác nhưng chưa ghép được. Đã chặn nhập để tránh thiếu dòng.');
  }
 }
 // Preserve original program order by first encounter; all values are captured
 // from BI, not invented. The SKST parser still handles the resulting text.
 const merged=prefix+'\n'+[...seen.values()].map(p=>p.content.join('\n')).join('\n')+'\n';
 return {text:merged,selectedCount:counts.selected,shownCount:counts.shown,
  collectedCount:seen.size,storeLines:competitionShopLineCount(merged),
  programChecks,steps:diagnostic};
}

// Monthly competition now navigates report rows and the breadcrumb.
function competitionLevel(){
 return ['Nhân viên','Siêu thị','Cụm','Khu vực','Vùng'].find(name=>
  bs().some(b=>btxt(b)===name&&isSelectedButton(b)))||'';
}
function competitionLink(label){
 const matches=[...document.querySelectorAll('a,button,span,td,[role=button]')]
  .filter(e=>vis(e)&&txt(e)===label);
 return matches.find(e=>!matches.some(child=>child!==e&&e.contains(child)))||null;
}
function programPicker(){
 const search=[...document.querySelectorAll('input')].find(e=>vis(e)&&/^Tìm chương trình/.test(e.placeholder||''));
 for(let root=search?.parentElement;root&&root!==document.body;root=root.parentElement){
  if([...root.querySelectorAll('button')].some(b=>txt(b)==='Chọn tất cả'))return root;
 }
 return null;
}
async function allCompetitionPrograms(){
 const opener=()=>bs().find(b=>/^Ngành hàng \(chương trình\)/.test(btxt(b)));
 if(!opener())throw Error('Không thấy bộ lọc Ngành hàng (chương trình).');
 if(!programPicker())opener().click();
 if(!await waitFor(programPicker,5000))throw Error('Không mở được danh sách chương trình.');
 try{
  const search=programPicker().querySelector('input');
  if(search.value){
   Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(search,'');
   search.dispatchEvent(new Event('input',{bubbles:true}));
   search.dispatchEvent(new Event('change',{bubbles:true}));await sleep(400);
  }
  [...programPicker().querySelectorAll('button')].find(b=>txt(b)==='Chọn tất cả').click();
  if(!await waitFor(()=>{
   const boxes=[...(programPicker()?.querySelectorAll('input[type=checkbox]')||[])];
   return boxes.length&&boxes.every(b=>b.checked);
  },5000))throw Error('Chưa xác minh được chọn tất cả chương trình.');
 }finally{if(programPicker()&&opener()){opener().click();await sleep(400);}}
}
// Match both the breadcrumb and populated store cells, so a new breadcrumb
// cannot validate rows left over from the previous shop during an async render.
function competitionEmployeeStoreMatches(store){
 const breadcrumb=[...document.querySelectorAll('a,button,span')]
  .some(e=>vis(e)&&matchesCompetitionStore(txt(e),store));
 const cells=[...document.querySelectorAll('tbody td')].filter(e=>vis(e)&&
  /^(?:\d+\s*[-–—]\s*)?(?:TGD|AAR)_DNA_HCH\s*[-–—]/i.test(txt(e)));
 return breadcrumb&&cells.length>0&&cells.every(e=>matchesCompetitionStore(txt(e),store));
}
async function competitionStable(level,store='',mode='month'){
 let last='',stable=0,result='';
 const done=await waitFor(()=>{
  const t=pageText();
  const right=competitionLevel()===level && !installmentBusy() && /\d+\s+chương trình/i.test(t)
   && (level==='Nhân viên'
    ? mode==='month'&&employeeCompetitionView()&&/(?:DOANH THU|SỐ LƯỢNG)/i.test(t)&&/SIÊU THỊ/i.test(t)
    : /% DỰ BÁO/i.test(t)&&(mode==='realtime'
      ? /% HT NGÀY/i.test(t)&&/(?:DOANH THU|SỐ LƯỢNG)\s*\(RT\)/i.test(t)
      : /% HT THÁNG/i.test(t)));
  const shopMatches=!store||competitionEmployeeStoreMatches(store);
  if(!right||!shopMatches){stable=0;last='';return false;}
  if(!isSelectedButton(pairButton(mode==='month'?'Lũy kế':'Realtime')))throw Error('Thi đua không còn đúng chế độ yêu cầu.');
  stable=t===last?stable+1:0;last=t;result=t;
  return stable>=6;
 },60000,250);
 if(!done)throw Error('Chưa xác minh được Thi đua cấp '+level+(store?' shop '+store:'')+'. Giữ tab BI để kiểm tra.');
 return result;
}
async function competitionShops(mode,progress,details=false){
 await setPeriod(mode);
 if(!await tab('Danh sách'))throw Error('Không thấy chế độ Danh sách.');
 await allCompetitionPrograms();
 // An employee view must return via Đà Nẵng before opening either shop.
 if(competitionLevel()==='Nhân viên'){
  const back=competitionLink('Đà Nẵng');
  if(!back)throw Error('Không thấy đường dẫn Đà Nẵng để quay lại.');
  progress('Đang bấm Đà Nẵng để quay lại danh sách shop…');
  back.click();await sleep(500);await competitionStable('Siêu thị','',mode);
 }
 if(competitionLevel()!=='Siêu thị'){
  // Normalize an intermediate region/cluster view through the company breadcrumb.
  const home=competitionLink('Toàn công ty');
  if(home){home.click();await sleep(500);}
  await competitionStable('Vùng','',mode);
  for(const [label,level] of [['Vùng Trung Bộ','Khu vực'],['Đà Nẵng','Siêu thị']]){
   progress('Thi đua '+(mode==='month'?'Lũy kế':'Realtime')+': đang mở '+label+'…');
   const target=await waitFor(()=>competitionLink(label),10000);
   if(!target)throw Error('Không thấy dòng '+label+' trong Thi đua.');
   target.click();await sleep(500);await competitionStable(level,'',mode);
  }
 }
 await competitionStable('Siêu thị','',mode);
 if(!competitionLink('Đà Nẵng')||!['933','10341'].every(code=>findCompetitionStore(code)))
  throw Error('Chưa thấy đủ hai shop tại Đà Nẵng; chưa lấy bảng Thi đua.');
 const full=await competitionCaptureFull('Siêu thị',mode,progress);
 return details?full:full.text;
}
async function runCompetitionDrilldown(mode,progress,store=''){
 const text=await competitionShops(mode,progress);
 if(!store)return {ok:true,text};
 const target=findCompetitionStore(store);
 if(!target)throw Error('Không thấy tên shop '+store+'.');
 progress('Đang mở Thi đua nhân viên Lũy kế shop '+store+'…');
 target.click();await sleep(500);
 await competitionStable('Nhân viên',store,mode);
 const full=await competitionCaptureFull('Nhân viên',mode,progress);
 return {ok:true,text:full.text,store};
}

// Thi đua: Lũy kế/Realtime + "Danh sách", lọc Khu vực, Tải lại, đợi "N chương trình".
async function runCompete(mode, progress) {
 return runCompetitionDrilldown(mode,progress);
}

// ---- Nhân viên ----
const norm = (s) => String(s || '').replace(/^\s*\d+\s*[-–—]\s*/, '').replace(/\s+/g, ' ').trim().toLowerCase();

// Doanh thu nhân viên (luỹ kế): tab Nhân viên, tick hết, lấy bảng DT thực rồi DT quy đổi.
async function runEmpRev(mode, progress) {
  if (/login|signin|dang-nhap/i.test(location.pathname)) return { ok: false, error: 'Chưa đăng nhập BI.' };
  const ready = await waitFor(() => bs().filter((x) => /Tải lại/i.test(btxt(x))), 25000);
  if (!ready) return { ok: false, error: 'Không thấy bộ lọc BI.' };
  progress('Đang chọn bộ lọc…');
  if (!(await tab('Nhân viên'))) return { ok: false, error: 'Không thấy tab Nhân viên trên BI.' };
  progress('Đang chọn '+(mode==='realtime'?'Realtime':'Lũy kế')+' trên Doanh thu hợp nhất…');
  await setPeriod(mode);
  await ticks();
  const ae=await area();if(ae)return {ok:false,error:'Không chọn được Siêu thị: '+ae};
  const got = {};
  for (const measure of ['thuc', 'qd']) {
    progress(measure === 'thuc' ? 'Đang tải DT thực…' : 'Đang tải DT quy đổi…');
    if (!(await clickMeasure(measure))) return { ok: false, error: 'Không thấy nút DT thực/DT quy đổi.' };
    await ticks();
    const r = await reloadAndCapture(measure);
    if (!r.ok) return r;
    got[measure] = r.text;
  }
  return { ok: true, text: got.qd, textThuc: got.thuc };
}

function matchesCompetitionStore(text,store){
  const code=String(text).match(/^\s*(\d+)\s*[-–—]/)?.[1];
  if(code)return code===store;
  const name=String(text).replace(/\s+/g,' ').trim();
  return store==='933'?/^TGD_DNA_HCH(?:\s*[-–—]|$)/i.test(name):/^AAR_DNA_HCH(?:\s*[-–—]|$)/i.test(name);
}
function findCompetitionStore(store){
  const candidates=[...document.querySelectorAll('button,a,[role=button],td')].filter(e=>vis(e)&&matchesCompetitionStore(txt(e),store));
  const controls=candidates.filter(e=>e.matches('button,a,[role=button]'));
  return (controls.length?controls:candidates)[0]||null;
}
function inspectBiControls(){
  const relevant=e=>/Chi tiết doanh thu|Lũy kế|Luỹ kế|Realtime|DT thực|DT quy đổi|Tỷ trọng trả góp|^Xem$|^Tất cả vùng$|^Vùng Trung Bộ$|^Đà Nẵng$/.test(txt(e))&&txt(e).length<100;
  const controls=[...document.querySelectorAll('button,label,[role=checkbox],span')].filter(e=>vis(e)&&relevant(e));
  const stores=[...document.querySelectorAll('button,a,[role=button],td')].filter(e=>vis(e)&&['933','10341'].some(code=>matchesCompetitionStore(txt(e),code)));
  const describe=e=>({tag:e.tagName,text:txt(e),className:e.getAttribute('class'),role:e.getAttribute('role'),ariaChecked:e.getAttribute('aria-checked'),ariaPressed:e.getAttribute('aria-pressed'),background:getComputedStyle(e).backgroundColor,checked:e.matches('input[type=checkbox]')?e.checked:null,html:e.outerHTML.slice(0,1800)});
  const navigationControls=['/dashboard/tra-cham','/dashboard/thi-dua'].includes(location.pathname)?[...document.querySelectorAll('a,button,span,div,[role=button]')].filter(e=>vis(e)&&/^(Tất cả vùng|Vùng Trung Bộ|Đà Nẵng|Tỷ trọng trả góp|Xem)$/.test(txt(e))).slice(0,20).map(describe):[];
  return {ok:true,extensionVersion:chrome.runtime.getManifest?.().version,recognitionRevision:typeof SkstRecognition!=='undefined'?SkstRecognition.current.revision:null,sourceHints:biSourceHints(),pickerSearchInputs:[...document.querySelectorAll('input[placeholder]')].filter(vis).map(e=>({placeholder:e.placeholder,html:e.outerHTML.slice(0,1500)})),storePickerHtml:storePicker()?.outerHTML.slice(0,24000)||null,storeFilterControls:storePicker()?[...storePicker().querySelectorAll('input,button,label,svg')].slice(0,80).map(describe):[],path:location.pathname,controls:controls.slice(0,35).map(describe),storeControls:stores.slice(0,8).map(describe),navigationControls,installmentLevel:location.pathname==='/dashboard/tra-cham'?installmentHeading():null};
}

// Thi đua nhân viên của một siêu thị: lọc khu vực, Tải lại, bấm đúng tên siêu thị để vào danh sách nhân viên.
function employeeCompetitionView(){
 const text=pageText();return /HẠNG TRONG ST/i.test(text)&&!/HẠNG VÙNG/i.test(text);
}
async function runEmpComp(mode, progress, store) {
  if(mode==='month')return runCompetitionDrilldown(mode,progress,store);
  if (/login|signin|dang-nhap/i.test(location.pathname)) return { ok: false, error: 'Chưa đăng nhập BI.' };
  const ready = await waitFor(() => bs().filter((x) => /Tải lại/i.test(btxt(x))), 25000);
  if (!ready) return { ok: false, error: 'Không thấy bộ lọc BI.' };
  progress('Đang chọn bộ lọc…');
  await setPeriod(mode);
  const dl = bs().find((x) => btxt(x) === 'Danh sách');
  if (dl && !isSelectedButton(dl)) { dl.click(); await sleep(500); }
  const ae = await area();
  if (ae) return { ok: false, error: 'Không chọn được Siêu thị: ' + ae };
  const rb = await waitFor(() => bs().filter((x) => /Tải lại/i.test(btxt(x))), 15000);
  if (!rb) return { ok: false, error: 'Không thấy nút Tải lại.' };
  rb[0].click();
  await sleep(2500);
  // Once inside an employee report, changing the store filter and reloading
  // switches that same drilldown to the next shop; no second store-name click.
  if(!employeeCompetitionView()){
    const target=await waitFor(()=>findCompetitionStore(store),15000);
    if(!target)return {ok:false,error:'Không thấy tên shop '+store+' có thể bấm trong bảng thi đua. Mở Kiểm tra nút BI để gửi thông tin giao diện.'};
    progress('Đang bấm tên shop '+store+' để mở thi đua nhân viên…');
    target.click();
  }else progress('Đã chuyển bộ lọc sang shop '+store+'; đang lấy thi đua nhân viên Lũy kế…');
  let last = '', stable = 0;
  const end = Date.now() + 60000;
  while (Date.now() < end) {
    const t = pageText();
    if (/HẠNG TRONG ST/.test(t) && !/HẠNG VÙNG/.test(t)) {
      stable = t === last ? stable + 1 : 0;
      if (stable >= 6) return { ok: true, text: t, store };
    } else stable = 0;
    last = t;
    await sleep(250);
  }
  return { ok: false, error: 'Không mở được danh sách nhân viên của ' + store + '.' };
}

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'bi-run') return;
  port.onMessage.addListener(async (m) => {
    if (m.type !== 'bi-run') return;
    try {
      const res = await runChecked(m, p => port.postMessage({progress:p}));
      port.postMessage(res);
    } catch (e) {
      port.postMessage({ ok: false, error: String((e && e.message) || e) });
    }
  });
});

// Drilldown introduced by BI in October 2026. Never capture a region total
// as employee data. Inspect the table level and each shop before proceeding.
function installmentHeading(text=pageText()) {
 return SkstInstallment.heading(text).level;
}
function installmentBusy() {
 return [...document.querySelectorAll('[aria-busy=true],.animate-spin,[class*=spinner]')].some(vis);
}
async function installmentStable(level,store='') {
 let last='',stable=0,result='',reason='';
 const done=await waitFor(()=>{
  const t=pageText();
  const current=installmentHeading(t);
  if(installmentBusy()||!(Array.isArray(level)?level:[level]).includes(current)){reason='Đang thấy cấp '+(current||'chưa nhận diện')+'; cần '+level;stable=0;return false;}
  if(!/\d+\s*[-–]\s*\d+\s*\/\s*Tổng\s+\d+\s+dòng/i.test(t)){reason='Chưa thấy số dòng của bảng';stable=0;return false;}
  if(!isSelectedButton(pairButton('Lũy kế')))throw Error('Trả chậm không còn ở Lũy kế.');
  if(store){
   try{SkstInstallment.parse(t,store);}catch(e){reason=e.message;stable=0;return false;}
  }
  stable=t===last?stable+1:0;last=t;result=t;
  return stable>=6;
 },45000,250);
 if(!done)throw Error('Chưa xác minh được bảng trả chậm '+(store||level)+': '+reason+'. Giữ tab BI để kiểm tra.');
 return result;
}
function installmentCell(label) {
 const matches=[...document.querySelectorAll('a,button,span,div,td,[role=button],[role=cell]')]
  .filter(e=>vis(e)&&canonicalLabel(txt(e))===canonicalLabel(label));
 // Nested text and its clickable parent are one control; separate matches are ambiguous.
 const leaves=matches.filter(e=>!matches.some(child=>child!==e&&e.contains?.(child)));
 if(leaves.length>1)throw Error('Có nhiều nút '+label+'; chưa xác định được nút đúng.');
 return leaves[0]||null;
}
function installmentShopLabels() {
 const {level,index,lines}=SkstInstallment.heading(pageText());
 if(level!=='Siêu thị')return [];
 const body=lines.slice(index+1).join('\n').split(/\d+\s*[-–]\s*\d+\s*\/\s*Tổng\s+\d+\s+dòng/i)[0];
 return body.split(/[\n\t]/).map(s=>s.trim()).filter(s=>/^(?:\d+\s*[-–—]\s*)?[A-Z]+_[A-Z]+_[A-Z]+\s*[-–—]\s*\S/.test(s));
}
async function installmentOpen(label,level,store='') {
 const control=await waitFor(()=>installmentCell(label),10000);
 if(!control)throw Error('Không thấy dòng '+label+' trong báo cáo trả chậm.');
 control.click();
 await sleep(500);
 return installmentStable(level,store);
}
async function installmentReachShops(progress){
 const levels=['Vùng','Khu vực','Siêu thị','Nhân viên'];
 let level=await waitFor(()=>installmentHeading(),15000);
 if(level==='Nhân viên'){
  const back=installmentCell('Đà Nẵng')||installmentCell('Tất cả vùng');
  if(!back)throw Error('Không thấy đường dẫn quay lại danh sách shop.');
  back.click();await sleep(500);
  await installmentStable(['Vùng','Khu vực','Siêu thị']);level=installmentHeading();
 }
 for(let step=0;step<3;step++){
  await installmentStable(level);
  if(level==='Siêu thị')return;
  const label=level==='Vùng'?'Vùng Trung Bộ':level==='Khu vực'?'Đà Nẵng':null;
  if(!label)throw Error('Cấp báo cáo mới chưa được hỗ trợ; chưa nhập dữ liệu.');
  progress('Trả chậm Lũy kế: đang mở '+label+'…');
  await installmentOpen(label,level==='Vùng'?['Khu vực','Siêu thị']:['Siêu thị']);
  const next=installmentHeading();if(levels.indexOf(next)<=levels.indexOf(level))throw Error('BI chưa chuyển đúng cấp báo cáo.');level=next;
 }
 throw Error('Chưa mở được danh sách shop trả chậm.');
}
async function runInstallment(mode, progress) {
 if(mode!=='month')throw Error('Chỉ lấy trả chậm Lũy kế.');
 if(location.pathname!=='/dashboard/tra-cham')throw Error('Chưa ở đúng trang Báo cáo trả chậm.');
 const installmentTab=await waitFor(()=>[...document.querySelectorAll('a,button,[role=tab]')].find(e=>vis(e)&&canonicalLabel(txt(e))==='Tỷ trọng trả góp'),15000);
 if(!installmentTab)throw Error('Không thấy tab Tỷ trọng trả góp.');
 installmentTab.click();
 const view=await waitFor(()=>bs().find(x=>btxt(x)==='Xem'),25000);
 if(!view)throw Error('Không thấy nút Xem trên báo cáo trả chậm.');
 await setPeriod(mode);
 // Keep the existing shop filter unchanged. The drilldown must visibly contain
 // exactly the two managed shops; otherwise stop instead of importing a subset.
 view.click();await sleep(1000);
 await installmentReachShops(progress);
 const labels=installmentShopLabels();
 for(const store of ['933','10341'])if(labels.filter(l=>matchesCompetitionStore(l,store)).length!==1)throw Error('Chưa thấy đúng hai shop 933 và 10341 trên trả chậm.');
 if(labels.length!==2)throw Error('Trả chậm đang có ngoài hai shop; kiểm tra lại bộ lọc.');
 const captures=[];
 for(const store of ['933','10341']){
  progress('Đang lấy trả chậm Lũy kế shop '+store+'…');
  const currentLabels=installmentShopLabels();
  if(currentLabels.length!==2||!['933','10341'].every(code=>currentLabels.filter(l=>matchesCompetitionStore(l,code)).length===1))throw Error('Danh sách shop đã thay đổi; chưa nhập.');
  const label=currentLabels.find(l=>matchesCompetitionStore(l,store));
  const text=await installmentOpen(label,'Nhân viên',store);
  captures.push(SkstInstallment.parse(text,store));
  if(store==='933'){
   await installmentReachShops(progress);
  }
 }
 progress('Đã lấy đủ hai shop; đang ghép trả chậm theo tên đối tác…');
 return {ok:true,text:SkstInstallment.combine(captures)};
}
function reportMonth(text){
  const match=String(text).match(/(?:^|\n)\s*(0?[1-9]|1[0-2])\s*\/\s*(20\d{2})\s*(?:\n|$)/);
  return match?match[2]+'-'+match[1].padStart(2,'0'):null;
}
async function runChecked(m,progress){
  if(!(m.job==='empComp'?['933','10341'].includes(m.store):m.store==='both')||!['month','realtime'].includes(m.mode))throw Error('Yêu cầu không hợp lệ.');
  if(/login|signin|dang-nhap/i.test(location.pathname))throw Error('Đăng nhập BI bằng SSO trước khi chạy.');
  if(typeof SkstRecognition!=='undefined')SkstRecognition.use(m.recognition);
  requestedStore=m.store;requestedPeriod=m.mode;
  await waitFor(()=>bs().find(x=>m.job==='installment'?btxt(x)==='Xem':/Tải lại/i.test(btxt(x))),25000);
  for(const button of bs().filter(x=>/^(Ngành hàng|Nhóm hàng)/.test(btxt(x)) && btxt(x)!=='Ngành hàng BI')){
    if(['compete','empComp'].includes(m.job)&&/^Ngành hàng \(chương trình\)/.test(btxt(button)))continue;
    if(!/Chọn\s*$/.test(btxt(button)))throw Error('BI còn bộ lọc ngành/nhóm hàng. Bỏ bộ lọc đó trước để lấy đủ báo cáo.');
  }
  const fn={revenue:run,compete:runCompete,empRev:runEmpRev,empComp:runEmpComp,installment:runInstallment}[m.job];
  if(!fn)throw Error('Loại báo cáo không hỗ trợ.');
  const result=await fn(m.mode,progress,m.store);
  if(!result.ok)return result;
  for(const t of [result.text,result.textThuc].filter(Boolean)){
    if(reportMonth(t)!==m.month)throw Error('Tháng trên BI chưa khớp tháng hiện tại '+m.month+'. Chọn đúng tháng trên BI rồi chạy lại.');
  }
  // Do not silently import the first page of a paginated report.
  const next=document.querySelector('.ant-pagination-next');
  if(next&&!next.classList.contains('ant-pagination-disabled')&&next.getAttribute('aria-disabled')!=='true')throw Error('Bảng còn trang tiếp theo; chưa nhập để tránh thiếu dữ liệu.');
  return result;
}

function biSourceHints(){
 if(typeof performance==='undefined')return [];
 return [...new Set(performance.getEntriesByType('resource').filter(e=>['fetch','xmlhttprequest'].includes(e.initiatorType)).map(e=>{
  try{const u=new URL(e.name);if(u.origin!==location.origin||!/\/api(?:\/|$)/i.test(u.pathname)||/auth|login|token|session|user|employee/i.test(u.pathname))return null;
   return u.pathname.split('/').map(s=>/^[a-z-]{1,60}$/i.test(s)?s:':value').join('/');
  }catch{return null;}
 }).filter(Boolean))].slice(0,30);
}
