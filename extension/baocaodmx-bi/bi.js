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

const bs = () => [...document.querySelectorAll('button')].filter((e) => !!e.offsetParent);
const btxt = (e) => (e.innerText || '').trim();

async function tab(name) {
  const b = bs().find((x) => btxt(x) === name && true);
  if (!b) return false;
  if (!/bg-blue-600/.test(b.className)) { b.click(); await sleep(800); }
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
    .filter(e=>vis(e)&&txt(e).replace(/[✓✔☑]/g,'').trim()==='Chi tiết doanh thu');
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
    !!pairButton(otherLabel) && !isSelectedButton(pairButton(otherLabel)),4000);
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
function storeFilterLabels(){
 return [...document.querySelectorAll('label')].filter(l=>vis(l)&&l.querySelector('input[type=checkbox]')&&/^\d+\s*[-–—]/.test(txt(l)));
}
function labelStoreCode(label){return txt(label).match(/^(\d+)\s*[-–—]/)?.[1];}
function desiredStoreCodes(){return requestedStore==='both'?['933','10341']:[requestedStore];}
async function area() {
  let button=bs().find(x=>/^Siêu thị/.test(btxt(x)));
  if(!button)return 'Không thấy bộ lọc Siêu thị';
  button.click();
  const labels=await waitFor(storeFilterLabels,5000),wanted=desiredStoreCodes();
  if(!labels)return 'Không đọc được danh sách Siêu thị';
  if(!wanted.every(code=>labels.some(l=>labelStoreCode(l)===code))){button.click();return 'Bộ lọc chưa có đủ shop '+wanted.join(' + ');}
  for(const code of labels.map(labelStoreCode)){
    const current=storeFilterLabels().find(l=>labelStoreCode(l)===code);
    if(!current)return 'Danh sách siêu thị thay đổi; chưa xác minh được bộ lọc.';
    if(current.querySelector('input').checked!==wanted.includes(code)){current.click();await sleep(180);}
  }
  const selected=storeFilterLabels().filter(l=>l.querySelector('input').checked).map(labelStoreCode);
  const ok=selected.length===wanted.length&&wanted.every(code=>selected.includes(code));
  button=bs().find(x=>/^Siêu thị/.test(btxt(x)));if(button)button.click();await sleep(400);
  return ok?'':'Chưa chọn đúng shop '+wanted.join(' + ');
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

// Thi đua: Lũy kế/Realtime + "Danh sách", lọc Khu vực, Tải lại, đợi "N chương trình".
async function runCompete(mode, progress) {
  if (/login|signin|dang-nhap/i.test(location.pathname)) return { ok: false, error: 'Chưa đăng nhập BI. Hãy đăng nhập BI rồi thử lại.' };
  const ready = await waitFor(() => bs().filter((x) => /Tải lại/i.test(btxt(x))), 25000);
  if (!ready) return { ok: false, error: 'Không thấy bộ lọc BI (có thể chưa đăng nhập hoặc giao diện đã đổi).' };
  progress('Đang chọn bộ lọc…');
  await setPeriod(mode);
  const dl = bs().find((x) => btxt(x) === 'Danh sách');
  if (dl && !/bg-blue-600/.test(dl.className)) { dl.click(); await sleep(500); }
  const ae = await area();
  if (ae) return { ok: false, error: 'Không chọn được Siêu thị: ' + ae };
  const rb = await waitFor(() => bs().filter((x) => /Tải lại/i.test(btxt(x))), 15000);
  if (!rb) return { ok: false, error: 'Không thấy nút Tải lại.' };
  rb[0].click();
  progress('Đang tải dữ liệu từ BI…');
  await sleep(2500);
  let last = '', stable = 0;
  const end = Date.now() + 90000;
  while (Date.now() < end) {
    const busy = document.querySelector('[aria-busy=true],.animate-spin,[class*=spinner]');
    const t = pageText();
    if (!busy && /\d+\s+chương trình/i.test(t) && /% DỰ BÁO/.test(t)) {
      stable = t === last ? stable + 1 : 0;
      if (stable >= 6) return { ok: true, text: t };
    } else stable = 0;
    last = t;
    await sleep(200);
  }
  return { ok: false, error: 'BI tải quá lâu (90 giây). Thử lại sau.' };
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
  const relevant=e=>/Chi tiết doanh thu|Lũy kế|Luỹ kế|Realtime|DT thực|DT quy đổi/.test(txt(e))&&txt(e).length<100;
  const controls=[...document.querySelectorAll('button,label,[role=checkbox],span')].filter(e=>vis(e)&&relevant(e));
  const stores=[...document.querySelectorAll('button,a,[role=button],td')].filter(e=>vis(e)&&['933','10341'].some(code=>matchesCompetitionStore(txt(e),code)));
  const describe=e=>({tag:e.tagName,text:txt(e),className:e.getAttribute('class'),role:e.getAttribute('role'),ariaChecked:e.getAttribute('aria-checked'),ariaPressed:e.getAttribute('aria-pressed'),background:getComputedStyle(e).backgroundColor,html:e.outerHTML.slice(0,1800)});
  return {ok:true,path:location.pathname,controls:controls.slice(0,35).map(describe),storeControls:stores.slice(0,8).map(describe)};
}

// Thi đua nhân viên của một siêu thị: lọc khu vực, Tải lại, bấm đúng tên siêu thị để vào danh sách nhân viên.
async function runEmpComp(mode, progress, store) {
  if (/login|signin|dang-nhap/i.test(location.pathname)) return { ok: false, error: 'Chưa đăng nhập BI.' };
  const ready = await waitFor(() => bs().filter((x) => /Tải lại/i.test(btxt(x))), 25000);
  if (!ready) return { ok: false, error: 'Không thấy bộ lọc BI.' };
  progress('Đang chọn bộ lọc…');
  await setPeriod(mode);
  const dl = bs().find((x) => btxt(x) === 'Danh sách');
  if (dl && !/bg-blue-600/.test(dl.className)) { dl.click(); await sleep(500); }
  const ae = await area();
  if (ae) return { ok: false, error: 'Không chọn được Siêu thị: ' + ae };
  const rb = await waitFor(() => bs().filter((x) => /Tải lại/i.test(btxt(x))), 15000);
  if (!rb) return { ok: false, error: 'Không thấy nút Tải lại.' };
  rb[0].click();
  await sleep(2500);
  const target=await waitFor(()=>findCompetitionStore(store),15000);
  if(!target)return {ok:false,error:'Không thấy tên shop '+store+' có thể bấm trong bảng thi đua. Mở Kiểm tra nút BI để gửi thông tin giao diện.'};
  progress('Đang bấm tên shop '+store+' để mở thi đua nhân viên…');
  target.click();
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
    if(m.type==='bi-inspect'){port.postMessage(inspectBiControls());return;}
    if (m.type !== 'bi-run') return;
    try {
      const res = await runChecked(m, p => port.postMessage({progress:p}));
      port.postMessage(res);
    } catch (e) {
      port.postMessage({ ok: false, error: String((e && e.message) || e) });
    }
  });
});

async function runInstallment(mode, progress) {
  if(mode!=='month')throw Error('Trả chậm Realtime đang lỗi trên BI; chỉ lấy Lũy kế.');
  if(location.pathname!=='/dashboard/tra-cham')throw Error('Chưa ở đúng trang Báo cáo trả chậm.');
  const installmentTab=await waitFor(()=>[...document.querySelectorAll('a,button,[role=tab]')].find(e=>vis(e)&&txt(e)==='Tỷ trọng trả góp'),15000);
  if(!installmentTab)return {ok:false,error:'Không thấy tab Tỷ trọng trả góp.'};
  installmentTab.click();
  if(!await waitFor(()=>bs().find(x=>btxt(x)==='Xem'),25000))return {ok:false,error:'Không thấy nút Xem trên báo cáo trả chậm.'};
  await setPeriod(mode);
  const error=await area();if(error)return {ok:false,error};
  progress('Đang lấy trả chậm Lũy kế — Tỷ trọng trả góp…');
  bs().find(x=>btxt(x)==='Xem').click();
  await sleep(2500);let last='',stable=0;
  const end=Date.now()+90000;
  while(Date.now()<end){
    const t=pageText();
    const busy=document.querySelector('[aria-busy=true],.animate-spin,[class*=spinner]');
    if(!busy&&/DT SIÊU THỊ/i.test(t)&&/TỶ TRỌNG TRẢ CHẬM/i.test(t)&&/NHÂN VIÊN/i.test(t)){
      stable=t===last?stable+1:0;if(stable>=6)return {ok:true,text:t};
    }else stable=0;
    last=t;await sleep(250);
  }
  return {ok:false,error:'Không đọc được bảng trả chậm. Dữ liệu cũ được giữ nguyên.'};
}
function reportMonth(text){
  const match=String(text).match(/(?:^|\n)\s*(0?[1-9]|1[0-2])\s*\/\s*(20\d{2})\s*(?:\n|$)/);
  return match?match[2]+'-'+match[1].padStart(2,'0'):null;
}
async function runChecked(m,progress){
  if(!(m.job==='empComp'?['933','10341'].includes(m.store):m.store==='both')||!['month','realtime'].includes(m.mode))throw Error('Yêu cầu không hợp lệ.');
  if(/login|signin|dang-nhap/i.test(location.pathname))throw Error('Đăng nhập BI bằng SSO trước khi chạy.');
  requestedStore=m.store;requestedPeriod=m.mode;
  await waitFor(()=>bs().find(x=>m.job==='installment'?btxt(x)==='Xem':/Tải lại/i.test(btxt(x))),25000);
  for(const button of bs().filter(x=>/^(Ngành hàng|Nhóm hàng)/.test(btxt(x)) && btxt(x)!=='Ngành hàng BI')){
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
