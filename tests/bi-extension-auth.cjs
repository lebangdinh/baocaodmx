const assert=require('node:assert/strict'),fs=require('node:fs'),Babel=require('@babel/standalone'),React=require('react'),renderer=require('react-test-renderer');
const files=JSON.parse(fs.readFileSync('index.html','utf8').match(/<script id="embedded-source" type="application\/json">([\s\S]*?)<\/script>/)[1]);
let listener,replies=[],uid='allowed-user',denied=false,writes=0,applies=0;
global.window={addEventListener(t,f){listener=f},removeEventListener(){},postMessage(m){replies.push(m)},firebase:{database:{ServerValue:{TIMESTAMP:{'.sv':'timestamp'}}}}};
global.location={origin:'https://lebangdinh.github.io',pathname:'/baocaodmx/'};
global.localStorage={getItem(){return '{}'},setItem(){}};
const dependencies={react:React,'../utils/stretchGoal':{getSharedFirebaseContext:async()=>({user:uid?{uid,email:'fixture@example.test'}:null,db:{ref(p){assert.equal(p,'dailyData/2026-10-16');return {once:async()=>{},update:async payload=>{writes++;assert(payload.dt_luyke.updatedByUid===uid);if(denied)throw Error('PERMISSION_DENIED')}}}}})},'../utils/dailyCloudHandoff':{getVietnamDayKey:()=> '2026-10-16'},'../utils/biExtensionImport':{BI_PROTOCOL:'bi-batch-v2',prepareBiImport:()=>({updates:{dt_luyke:[{'MÃ ĐƠN VỊ':'933'}]},errors:[]})}};
const mod={exports:{}};
new Function('require','module','exports',Babel.transform(files['src/components/BiExtensionStatus.tsx'],{filename:'component.tsx',presets:[['typescript',{allExtensions:true,isTSX:true}],'react'],plugins:['transform-modules-commonjs']}).code)(id=>dependencies[id],mod,mod.exports);
async function send(kind,id='run'){replies=[];await renderer.act(async()=>{await listener({source:window,origin:location.origin,data:{source:'skst933-extension',channel:'skst933',requestId:'request',kind,runId:id,profile:'all',protocol:'bi-batch-v2',results:[],errors:[]}})});return replies.at(-1)?.result;}
(async()=>{
 await renderer.act(async()=>{renderer.create(React.createElement(mod.exports.BiExtensionStatus,{onDataParsed(updates,meta){applies++;assert(meta.alreadySynced);return true;}}))});
 uid=null;assert.equal((await send('prepare')).ok,false);assert.equal(writes,0);
 uid='allowed-user';assert((await send('prepare')).ok);uid='another-user';assert.equal((await send('commit')).ok,false);assert.equal(writes,0);assert.equal(applies,0);
 uid='allowed-user';assert((await send('prepare')).ok);denied=true;assert.equal((await send('commit')).ok,false);assert.equal(applies,0,'Permission denial cannot apply data locally');
 denied=false;assert((await send('prepare','success')).ok);assert((await send('commit','success')).ok);assert.equal(applies,1);
 const count=writes;assert.equal((await send('commit','success')).ok,false);assert.equal(writes,count,'Replay cannot write twice');
 location.pathname='/baocaodmx/bi-test.html';
 assert((await send('prepare','preview')).ok);
 const writesBefore=writes,appliesBefore=applies;assert((await send('commit','preview')).ok);
 assert.equal(writes,writesBefore,'Trial must never write the captured results to Firebase');assert.equal(applies,appliesBefore,'Trial must not replace operational data');
 console.log('PASS BI authorization lifecycle: signed out, identity change, denied cloud write, success, replay. Existing Firebase rules remain authoritative.');
})().catch(e=>{console.error(e);process.exit(1)});
