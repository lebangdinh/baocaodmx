const status = document.getElementById('status');
const run = document.getElementById('run');
let refreshing=false;
async function state(){
  if(refreshing)return;
  refreshing=true;
  try{
    const r=await chrome.runtime.sendMessage({type:'status'});
    if(!r)throw Error('Không nhận được phản hồi từ tiện ích. Mở chrome://extensions rồi tải lại tiện ích.');
    status.textContent=r.message;run.disabled=!!r.running;
  }catch(e){status.textContent='Lỗi kết nối tiện ích: '+e.message;run.disabled=false;}
  finally{refreshing=false;}
}
run.onclick=async()=>{
  run.disabled=true;status.textContent='Đang mở trang thử và kiểm tra đăng nhập…';
  try{const r=await chrome.runtime.sendMessage({type:'start',profile:document.getElementById('profile').value});if(!r)throw Error('Tiện ích chưa phản hồi. Tải lại tiện ích rồi thử lại.');status.textContent=r.message;}
  catch(e){status.textContent=e.message;run.disabled=false;}
};
document.getElementById('stop').onclick=async()=>{try{const r=await chrome.runtime.sendMessage({type:'cancel'});status.textContent=r?.message||'Đã yêu cầu dừng.';}catch(e){status.textContent=e.message;}};
state();
// A run continues after the popup closes. Reopening it shows the current result.
const poll=setInterval(state,700);
window.addEventListener('pagehide',()=>clearInterval(poll));

document.getElementById('inspect').onclick=async()=>{
 try{
  const result=await chrome.runtime.sendMessage({type:'inspect'});
  if(!result?.ok)throw Error(result?.error||'Chưa đọc được nút trên BI.');
  const url=URL.createObjectURL(new Blob([JSON.stringify(result,null,2)],{type:'application/json'}));
  const a=document.createElement('a');a.href=url;a.download='skst-bi-controls.json';a.click();
  setTimeout(()=>URL.revokeObjectURL(url),10000);
 }catch(e){status.textContent=e.message;}
};
