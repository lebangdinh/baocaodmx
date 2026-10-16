const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
async function scenario(existing,persistent){
 let reloads=0,creates=[],prepares=0;
 const chrome={runtime:{onMessage:{addListener(){}},getPlatformInfo(){}},action:{setBadgeText:async()=>{},setBadgeBackgroundColor:async()=>{}},tabs:{
  query:async()=>existing?[{id:7,url:'https://lebangdinh.github.io/baocaodmx/',active:true}]:[],
  create:async options=>{creates.push(options.url);return{id:7}},
  get:async()=>({status:'complete'}),reload:async()=>{reloads++},update:async()=>{},remove:async()=>{},
  sendMessage:async(id,m)=>{if(m.kind==='prepare'){prepares++;if(persistent||prepares===1)throw Error('Could not establish connection. Receiving end does not exist.');return{ok:false,error:'Đăng nhập Google trên SKST.'};}return{ok:true}}
 }};
 const ctx=vm.createContext({chrome,crypto:{randomUUID:()=> 'run'},setTimeout:fn=>fn(),setInterval:()=>1,clearInterval(){},URL,console});
 vm.runInContext(fs.readFileSync('extension/baocaodmx-bi/background.js','utf8'),ctx);
 await vm.runInContext("start({id:'run',cancelled:false,biTab:null},'realtime')",ctx);
 assert.equal(reloads,1,'Missing bridge gets one automatic reload');assert.equal(prepares,2,'Retry only once');
 assert.equal(creates.length,existing?0:1);if(creates.length)assert.equal(creates[0],'https://lebangdinh.github.io/baocaodmx/','Auto-open production receiver');
 assert.match(vm.runInContext('message',ctx),persistent?/Receiving end/:/Đăng nhập Google/);
}
(async()=>{await scenario(true,false);await scenario(false,false);await scenario(true,true);console.log('PASS: reload existing pre-install tab once; auto-open missing trial tab; persistent connection errors surfaced without looping.');})().catch(e=>{console.error(e);process.exit(1)});
