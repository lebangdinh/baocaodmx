const status = document.getElementById('status');
const run = document.getElementById('run');
async function state(){const r=await chrome.runtime.sendMessage({type:'status'});status.textContent=r.message;run.disabled=r.running;}
run.onclick=async()=>{run.disabled=true;try{const r=await chrome.runtime.sendMessage({type:'start',profile:document.getElementById('profile').value});status.textContent=r.message;}catch(e){status.textContent=e.message;}finally{await state();}};
document.getElementById('stop').onclick=async()=>{await chrome.runtime.sendMessage({type:'cancel'});await state();};
state();
