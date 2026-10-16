const SITE='https://lebangdinh.github.io/baocaodmx/bi-test.html';
const BI='https://baocao.dienmayxanh.com';
const URLS={revenue:BI+'/dashboard/revenue-consolidated',empRev:BI+'/dashboard/revenue-consolidated',compete:BI+'/dashboard/thi-dua',empComp:BI+'/dashboard/thi-dua',installment:BI+'/dashboard/tra-cham'};
const LABELS={revenue:'Doanh thu siêu thị',compete:'Thi đua siêu thị',empRev:'Doanh thu nhân viên',empComp:'Thi đua nhân viên',installment:'Trả chậm'};
let active=null, message='Sẵn sàng. Bấm Lấy dữ liệu thử để bắt đầu.';
function badge(text,color){chrome.action.setBadgeText({text}).catch(()=>{});chrome.action.setBadgeBackgroundColor({color}).catch(()=>{});}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function onSite(url){try{const u=new URL(url);return u.origin==='https://lebangdinh.github.io'&&/^\/baocaodmx\//.test(u.pathname);}catch{return false;}}
async function page(tabId,kind,data={}) {return chrome.tabs.sendMessage(tabId,{channel:'skst933',kind,...data});}
chrome.runtime.onMessage.addListener((m,sender,reply)=>{
  // Only our packaged popup can start/cancel a collection.
  if(sender.id!==chrome.runtime.id||sender.url!==chrome.runtime.getURL('popup.html'))return;
  if(m.type==='inspect'){inspectCurrentBi().then(reply).catch(e=>reply({ok:false,error:e.message}));return true;}
  if(m.type==='status'){reply({running:!!active,message});return;}
  if(m.type==='cancel'){if(active?.committing){reply({message:'Đang ghi Firebase; chờ kết quả lưu.'});return;}if(active){active.cancelled=true;message='Đã yêu cầu dừng; chưa nhập dữ liệu của lượt này.';if(active.biTab)chrome.tabs.remove(active.biTab).catch(()=>{});}reply({message});return;}
  if(m.type==='start'){
    if(active){reply({message:'Đang có lượt đồng bộ chạy.'});return;}
    if(!['all','month','realtime'].includes(m.profile)){reply({message:'Lựa chọn không hợp lệ.'});return;}
    message='Đang mở trang thử và kiểm tra đăng nhập…';badge('…','#2563eb');
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
      const timer=setTimeout(()=>finish(Error('BI quá thời gian chờ (180 giây).')),180000);
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
    const candidates=tabs.filter(t=>t.url?.split(/[?#]/)[0]===SITE);
    appTab=candidates.find(t=>t.active)|| (candidates.length===1?candidates[0]:null);
    if(!appTab&&candidates.length)throw Error('Có nhiều tab thử SKST: chọn đúng tab rồi chạy lại.');
    if(!appTab){
      message='Đang mở trang thử SKST…';
      appTab=await chrome.tabs.create({url:SITE,active:true});
      await waitComplete(appTab.id);
    }
    let ready;
    try{ready=await page(appTab.id,'prepare',{runId:run.id,profile});}
    catch(e){
      // Installing/reloading an extension does not inject it into an already open
      // tab. Reload this preview page once to activate the installed bridge.
      if(!/receiving end|could not establish connection/i.test(e.message||''))throw e;
      message='Đang tải lại trang thử để kết nối tiện ích…';
      await chrome.tabs.reload(appTab.id);await sleep(500);await waitComplete(appTab.id);
      ready=await page(appTab.id,'prepare',{runId:run.id,profile});
    }
    if(!ready?.ok)throw Error(ready?.error||'Tải lại baocaodmx để nhận bản hỗ trợ tiện ích.');
    const modes=profile==='all'?['month','realtime']:[profile];
    const jobs=[];
    for(const job of ['revenue','compete','empRev','empComp','installment']){
      if(['empComp','installment'].includes(job)&&profile==='realtime')continue;
      for(const mode of ['empComp','installment'].includes(job)?['month']:modes)
        for(const store of ['933','10341'])jobs.push({job,mode,store});
    }
    const results=[],errors=[];
    for(let i=0;i<jobs.length;i++){
      if(run.cancelled)throw Error('Đã dừng. Chưa nhập dữ liệu của lượt này.');
      const task=jobs[i],label=`${i+1}/${jobs.length} · ${LABELS[task.job]} · ${task.store} · ${task.mode==='month'?'Lũy kế':'Realtime'}`;
      await progress(label);
      try{
        if(!run.biTab){const t=await chrome.tabs.create({url:URLS[task.job],active:true});run.biTab=t.id;}
        else await chrome.tabs.update(run.biTab,{url:URLS[task.job],active:true});
        // Wait for a content script on the requested document, not an old document.
        await sleep(500);await waitComplete(run.biTab);
        const res=await callBi(run.biTab,{type:'bi-run',...task,month:ready.month},s=>{void progress(label+' — '+s);});
        if(!res?.ok)throw Error(res?.error||'Không lấy được dữ liệu.');
        results.push({...task,text:res.text,textThuc:res.textThuc});
      }catch(e){run.failed=true;throw Error(label+': '+e.message+' — Đã dừng và giữ tab BI để kiểm tra.');}
    }
    if(run.cancelled)throw Error('Đã dừng. Chưa nhập dữ liệu của lượt này.');
    run.committing=true;
    await progress('Đang kiểm tra và tổng hợp kết quả thử…');
    const result=await page(appTab.id,'commit',{runId:run.id,results,errors});
    if(!result?.ok)throw Error(result?.error||'Chưa hoàn tất nhập dữ liệu.');
    message=result.message;badge('OK','#15803d');
  }catch(e){badge('!','#dc2626');await progress(e.message);if(appTab)await page(appTab.id,'abort',{runId:run.id,message:e.message}).catch(()=>{});}
  finally{clearInterval(beat);if(run.biTab&&!run.failed)await chrome.tabs.remove(run.biTab).catch(()=>{});if(appTab&&!run.failed)await chrome.tabs.update(appTab.id,{active:true}).catch(()=>{});}
}

async function inspectCurrentBi(){
 const tabs=await chrome.tabs.query({});
 const candidates=tabs.filter(t=>t.url?.startsWith(BI+'/'));
 const selected=candidates.find(t=>t.active)||(candidates.length===1?candidates[0]:null);
 if(!selected)throw Error('Chọn tab BI đang bị vướng rồi mở tiện ích và bấm Kiểm tra nút BI.');
 return callBi(selected.id,{type:'bi-inspect'},()=>{});
}
