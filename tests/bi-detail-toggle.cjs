const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
let control,clicks=0;
const context=vm.createContext({document:{querySelectorAll(){return control?[control]:[]}},chrome:{runtime:{onConnect:{addListener(){}}}},setTimeout(fn){fn()},Date,console,getComputedStyle:()=>({backgroundColor:'rgb(255, 255, 255)'})});
vm.runInContext(fs.readFileSync('extension/baocaodmx-bi/bi.js','utf8'),context);
const make=checked=>({offsetWidth:100,textContent:'Chi tiết doanh thu',closest(){return this},querySelectorAll(){return this.firstElementChild?[this.firstElementChild]:[]},querySelector(){return null},getAttribute(name){return name==='aria-pressed'?String(checked):null},click(){clicks++;checked=true},firstElementChild:null});
(async()=>{
 control=make(false);await vm.runInContext('ensureRevenueDetails()',context);assert.equal(clicks,1);
 await vm.runInContext('ensureRevenueDetails()',context);assert.equal(clicks,1,'Already checked must not be toggled off');
 control=null;await assert.rejects(vm.runInContext('ensureRevenueDetails()',context),/Không thấy ô/);
 control={...make(false),getAttribute(){return null},firstElementChild:{textContent:'✓',querySelector(){return null}}};
 assert.equal(vm.runInContext('revenueDetailState(revenueDetailControl())',context),true);
 control.firstElementChild.textContent='';assert.equal(vm.runInContext('revenueDetailState(revenueDetailControl())',context),false);
 console.log('PASS required revenue details: enable unchecked, preserve checked, detect visible checkmark and reject missing control.');
})().catch(e=>{console.error(e);process.exit(1)});
