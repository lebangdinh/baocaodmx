// This bridge never receives credentials. Firebase stays in the SKST page.
const pending = new Map();
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (sender.id !== chrome.runtime.id || message?.channel !== 'skst933') return;
  const requestId = crypto.randomUUID();
  const timer = setTimeout(() => { pending.delete(requestId); respond({ok:false,error:'SKST chưa phản hồi. Tải lại trang rồi thử lại.'}); }, message.kind === 'commit' ? 120000 : 30000);
  pending.set(requestId, value => {clearTimeout(timer); respond(value);});
  window.postMessage({source:'skst933-extension', requestId, ...message}, location.origin);
  return true;
});
window.addEventListener('message', e => {
  if (e.source !== window || e.origin !== location.origin || e.data?.source !== 'skst933-page') return;
  const resolve = pending.get(e.data.requestId);
  if (resolve) {pending.delete(e.data.requestId); resolve(e.data.result);}
});
