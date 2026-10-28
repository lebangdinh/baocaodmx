if(typeof importScripts==='function')importScripts('recognition.js');
const SITE='https://lebangdinh.github.io/baocaodmx/';
const PROTOCOL='bi-batch-v2';
const BI='https://baocao.dienmayxanh.com';
const URLS={revenue:BI+'/dashboard/revenue-consolidated',empRev:BI+'/dashboard/revenue-consolidated',compete:BI+'/dashboard/thi-dua',empComp:BI+'/dashboard/thi-dua',installment:BI+'/dashboard/tra-cham'};
const LABELS={revenue:'Doanh thu siêu thị',compete:'Thi đua siêu thị',empRev:'Doanh thu nhân viên',empComp:'Thi đua nhân viên',installment:'Trả chậm'};
let active=null, message='Sẵn sàng. Bấm Lấy dữ liệu & tự nhập.';
function badge(text,color){chrome.action.setBadgeText({text}).catch(()=>{});chrome.action.setBadgeBackgroundColor({color}).catch(()=>{});}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function onSite(url){try{const u=new URL(url);return u.origin==='https://lebangdinh.github.io'&&/^\/baocaodmx\//.test(u.pathname);}catch{return false;}}
async function page(tabId,kind,data={}) {return chrome.tabs.sendMessage(tabId,{channel:'skst933',kind,...data});}
chrome.runtime.onMessage.addListener((m,sender,reply)=>{
  // Only our packaged popup can start/cancel a collection.
  if(sender.id!==chrome.runtime.id||sender.url!==chrome.runtime.getURL('popup.html'))return;
  if(m.type==='status'){reply({running:!!active,message,recognition:recognitionStatus});return;}
  if(m.type==='cancel'){if(active?.committing){reply({message:'Đang ghi Firebase; chờ kết quả lưu.'});return;}if(active){active.cancelled=true;message='Đã yêu cầu dừng; chưa nhập dữ liệu của lượt này.';if(active.biTab)chrome.tabs.remove(active.biTab).catch(()=>{});}reply({message});return;}
  if(m.type==='start'){
    if(active){reply({message:'Đang có lượt đồng bộ chạy.'});return;}
    if(!['all','month','realtime'].includes(m.profile)){reply({message:'Lựa chọn không hợp lệ.'});return;}
    message='Đang mở baocaodmx và kiểm tra đăng nhập…';badge('…','#2563eb');
    active={id:crypto.randomUUID(),cancelled:false,biTab:null};
    start(active,m.profile).catch(e=>{message=e.message;}).finally(()=>{active=null;});
    reply({message});
  }
});
async function waitComplete(id){for(let n=0;n<120;n++){const t=await chrome.tabs.get(id);if(t.status==='complete')return;await sleep(500);}throw Error('Trang BI tải quá lâu.');}
async function callBi(id,request,progress){
  for(let attempt=0;attempt<15;attempt++){
    try{return await new Promise((resolve,reject)=>{
      const port=chrome.tabs.connect(id,{name:'bi-run'});let settled=false,connected=false;
      const finish=(err,value)=>{if(settled)return;settled=true;clearTimeout(timer);port.disconnect();err?reject(err):resolve(value);};
      const timer=setTimeout(()=>finish(Error('BI quá thời gian chờ lấy dữ liệu.')),request.job==='installment'?420000:180000);
      port.onMessage.addListener(m=>{connected=true;if(m.progress)progress(m.progress);else finish(null,m);});
      port.onDisconnect.addListener(()=>{const error=Error(connected?'Mất kết nối BI trong lúc lấy dữ liệu.':'not-ready');finish(error);});
      port.postMessage(request);
    });}catch(e){if(e.message!=='not-ready'||attempt===14)throw e;await sleep(500);}
  }
}
async function start(run,profile){
  let appTab;
  const beat=setInterval(()=>chrome.runtime.getPlatformInfo(),20000);
  const progress=async text=>{message=text;if(appTab)await page(appTab.id,'progress',{runId:run.id,message:text}).catch(()=>{});};
  try{
    const tabs=await chrome.tabs.query({});
    const candidates=tabs.filter(t=>{const url=t.url?.split(/[?#]/)[0];return url===SITE||url===SITE+'index.html';});
    appTab=candidates.find(t=>t.active)|| (candidates.length===1?candidates[0]:null);
    if(!appTab&&candidates.length)throw Error('Có nhiều tab SKST: chọn đúng tab rồi chạy lại.');
    if(!appTab){
      message='Đang mở baocaodmx SKST…';
      appTab=await chrome.tabs.create({url:SITE,active:true});
      await waitComplete(appTab.id);
    }
    let ready;
    try{ready=await page(appTab.id,'prepare',{runId:run.id,profile,protocol:PROTOCOL});}
    catch(e){
      // Installing/reloading an extension does not inject it into an already open
      // tab. Reload this preview page once to activate the installed bridge.
      if(!/receiving end|could not establish connection/i.test(e.message||''))throw e;
      message='Đang tải lại baocaodmx để kết nối tiện ích…';
      await chrome.tabs.reload(appTab.id);await sleep(500);await waitComplete(appTab.id);
      ready=await page(appTab.id,'prepare',{runId:run.id,profile,protocol:PROTOCOL});
    }
    if(!ready?.ok)throw Error(ready?.error||'Tải lại baocaodmx để nhận bản hỗ trợ tiện ích.');
    if(ready.protocol!==PROTOCOL)throw Error('Trang SKST còn bản cũ. Nhấn Ctrl+Shift+R trên baocaodmx rồi chạy lại.');
    const recognition=await loadRecognition();
    const jobs=buildJobs(profile);
    const results=[],errors=[];let onUrl='';
    for(let i=0;i<jobs.length;i++){
      if(run.cancelled)throw Error('Đã dừng. Chưa nhập dữ liệu của lượt này.');
      const task=jobs[i],label=`${i+1}/${jobs.length} · ${LABELS[task.job]} · ${task.store==='both'?'933 + 10341':task.store} · ${task.mode==='month'?'Lũy kế':'Realtime'}`;
      await progress(label);
      try{
        const navigate=!run.biTab||onUrl!==URLS[task.job];
        if(!run.biTab){const t=await chrome.tabs.create({url:URLS[task.job],active:true});run.biTab=t.id;}
        else if(navigate)await chrome.tabs.update(run.biTab,{url:URLS[task.job],active:true});
        if(navigate){await sleep(500);await waitComplete(run.biTab);}
        onUrl=URLS[task.job];
        const res=await callBi(run.biTab,{type:'bi-run',...task,month:ready.month,recognition},s=>{void progress(label+' — '+s);});
        if(!res?.ok)throw Error(res?.error||'Không lấy được dữ liệu.');
        results.push({...task,text:res.text,textThuc:res.textThuc});
      }catch(e){run.failed=true;throw Error(label+': '+e.message+' — Đã dừng và giữ tab BI để kiểm tra.');}
    }
    if(run.cancelled)throw Error('Đã dừng. Chưa nhập dữ liệu của lượt này.');
    run.committing=true;
    await progress('Đã lấy dữ liệu; đang chạy parser, nhập SKST và đồng bộ Firebase…');
    const result=await page(appTab.id,'commit',{runId:run.id,results,errors});
    if(!result?.ok)throw Error(result?.error||'Chưa hoàn tất nhập dữ liệu.');
    message=result.message;badge('OK','#15803d');
  }catch(e){badge('!','#dc2626');await progress(e.message);if(appTab)await page(appTab.id,'abort',{runId:run.id,message:e.message}).catch(()=>{});}
  finally{clearInterval(beat);if(run.biTab&&!run.failed)await chrome.tabs.remove(run.biTab).catch(()=>{});if(appTab&&!run.failed)await chrome.tabs.update(appTab.id,{active:true}).catch(()=>{});}
}

function buildJobs(profile){
 const modes=profile==='all'?['month','realtime']:[profile],jobs=[];
 for(const job of ['revenue','compete','empRev','empComp','installment']){
  if(['empComp','installment'].includes(job)&&profile==='realtime')continue;
  for(const mode of ['empComp','installment'].includes(job)?['month']:modes)
   for(const store of job==='empComp'?['933','10341']:['both'])jobs.push({job,mode,store});
 }
 return jobs;
}

// One immutable dictionary per run. Never fetch or execute remote JavaScript.
let recognitionStatus='Chưa kiểm tra cấu hình nhận diện.';
async function loadRecognition(){
 const installed=chrome.runtime.getManifest().version;
 let cached=null,newer='';
 try{cached=(await chrome.storage.local.get('recognitionCache')).recognitionCache;}catch{}
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),4000);
 try{
  const response=await fetch(SITE+'downloads/bi-recognition.json',{cache:'no-store',credentials:'omit',redirect:'error',signal:controller.signal});
  if(!response.ok)throw Error('Không tải được cấu hình');
  if(Number(response.headers.get('content-length'))>32768)throw Error('Cấu hình quá lớn');
  const reader=response.body.getReader();let raw='',size=0;const decoder=new TextDecoder();
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>32768){await reader.cancel();throw Error('Cấu hình quá lớn');}raw+=decoder.decode(value,{stream:true});}
  raw+=decoder.decode();
  const incoming=JSON.parse(raw);
  if(/^\d{1,4}\.\d{1,4}\.\d{1,4}$/.test(incoming?.latestVersion)&&SkstRecognition.compare(incoming.latestVersion,installed)>0)newer=' Có tiện ích '+incoming.latestVersion+' mới trên web.';
  const config=SkstRecognition.validate(incoming,installed);
  if(cached?.config?.revision>config.revision)throw Error('Cấu hình lùi phiên bản');
  try{await chrome.storage.local.set({recognitionCache:{config,at:Date.now()}});}catch{}
  recognitionStatus='Nhận diện #'+config.revision+' · đã cập nhật'+(SkstRecognition.compare(config.latestVersion,installed)>0?' · Có tiện ích '+config.latestVersion+' mới trên web.':'.');
  return config;
 }catch{
  if(cached&&Date.now()-cached.at>=0&&Date.now()-cached.at<7*86400000){
   try{const config=SkstRecognition.validate(cached.config,installed);recognitionStatus='Nhận diện #'+config.revision+' · dùng bản lưu; chưa áp dụng được cấu hình mới.'+newer;return config;}catch{}
  }
  recognitionStatus='Dùng nhận diện kèm tiện ích; chưa tải được cấu hình phù hợp. Kiểm tra nút tải trên web nếu BI báo lỗi.'+newer;
  return SkstRecognition.defaults;
 }finally{clearTimeout(timer);}
}
