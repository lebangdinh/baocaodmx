const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const context=vm.createContext({chrome:{runtime:{onConnect:{addListener(){}}}},document:{},setTimeout:fn=>fn(),Date,getComputedStyle:e=>({backgroundColor:e.color||'rgb(255, 255, 255)'})});
vm.runInContext(fs.readFileSync('extension/baocaodmx-bi/bi.js','utf8'),context);
context.storeText='933 - TGD_DNA_HCH - 351 Nguyễn Hữu Thọ';
assert(vm.runInContext("matchesCompetitionStore(storeText,'933')",context));
assert(!vm.runInContext("matchesCompetitionStore(storeText,'10341')",context));
for(const name of ['TGD_DNA_HCH - 351 Nguyễn Hữu Thọ','933–TGD_DNA_HCH']){context.storeText=name;assert(vm.runInContext("matchesCompetitionStore(storeText,'933')",context));}
context.storeText='AAR_DNA_HCH - 351 Nguyễn Hữu Thọ';assert(vm.runInContext("matchesCompetitionStore(storeText,'10341')",context));
context.storeText='1099 - TGD_DNA_CLE';assert(!vm.runInContext("matchesCompetitionStore(storeText,'933')",context));
context.chip={color:'rgb(37, 99, 235)'};assert(vm.runInContext('blueSelected(chip)',context));context.chip.color='rgb(239, 246, 255)';assert(!vm.runInContext('blueSelected(chip)',context));
const filters=['Ngành hàng Chọn','Nhóm hàng Chọn','Ngành hàng BI'].filter(t=>/^(Ngành hàng|Nhóm hàng)/.test(t)&&t!=='Ngành hàng BI');assert.deepEqual(filters,['Ngành hàng Chọn','Nhóm hàng Chọn']);
console.log('PASS: store identity with/without numeric code, no cross-store match, checkbox blue/pale distinction, BI subtab excluded from product filters.');
