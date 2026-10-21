// Data-only recognition dictionary. All navigation and validation logic ships locally.
const SkstRecognition = (() => {
 const defaults = {"schema": 1, "revision": 1, "minVersion": "1.2.0", "latestVersion": "1.2.0", "aliases": {"Lũy kế": ["Lũy kế", "Luỹ kế"], "Realtime": ["Realtime"], "DT quy đổi": ["DT quy đổi"], "DT thực": ["DT thực"], "Tỷ trọng trả góp": ["Tỷ trọng trả góp"], "Xem": ["Xem"], "Tải lại": ["Tải lại"], "Doanh thu": ["Doanh thu"], "Danh sách": ["Danh sách"], "Chi tiết doanh thu": ["Chi tiết doanh thu"], "Tất cả vùng": ["Tất cả vùng"], "Vùng Trung Bộ": ["Vùng Trung Bộ"], "Đà Nẵng": ["Đà Nẵng"], "Vùng": ["Vùng"], "Khu vực": ["Khu vực"], "Siêu thị": ["Siêu thị"], "Nhân viên": ["Nhân viên"], "DT trả góp (triệu)": ["DT trả góp (triệu)"], "DT siêu thị (triệu)": ["DT siêu thị (triệu)"], "Tỷ trọng trả chậm %": ["Tỷ trọng trả chậm %"], "Payoo": ["Payoo"], "HomeCredit(HC)": ["HomeCredit(HC)", "Home Credit (HC)"], "Kim Ngân Pay": ["Kim Ngân Pay"], "Trả góp KREDIVO": ["Trả góp KREDIVO", "KREDIVO"], "FECredit(FE)": ["FECredit(FE)", "FE Credit (FE)"], "Thẻ tín dụng - SMARTPOS": ["Thẻ tín dụng - SMARTPOS", "SMARTPOS"], "Samsung Finance +": ["Samsung Finance +", "Samsung Finance+"]}};
 const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').replace(/Đ/g,'D').toLowerCase().replace(/\s+/g,' ').trim();
 const version=v=>/^\d{1,4}\.\d{1,4}\.\d{1,4}$/.test(v);
 const compare=(a,b)=>{const x=a.split('.').map(Number),y=b.split('.').map(Number);for(let i=0;i<3;i++)if(x[i]!==y[i])return x[i]-y[i];return 0;};
 let current=defaults;
 function validate(value,installed='1.2.0') {
  if(!value||Object.keys(value).some(k=>!['schema','revision','minVersion','latestVersion','aliases'].includes(k))||value.schema!==1||!Number.isSafeInteger(value.revision)||value.revision<1||!version(value.minVersion)||!version(value.latestVersion)||compare(value.minVersion,installed)>0||compare(value.latestVersion,value.minVersion)<0)throw Error('Cấu hình không tương thích; cần kiểm tra bản tiện ích mới.');
  if(!value.aliases||typeof value.aliases!=='object'||Array.isArray(value.aliases))throw Error('Cấu hình thiếu tên nhận diện.');
  const result=JSON.parse(JSON.stringify(defaults)), owners=new Map();
  for(const [key,list] of Object.entries(value.aliases)) {
   if(!Object.hasOwn(defaults.aliases,key)||!Array.isArray(list)||!list.length||list.length>8||list.some(s=>typeof s!=='string'||!s.trim()||s.length>100||/[<>\r\n\t]/.test(s)))throw Error('Cấu hình tên nhận diện không hợp lệ.');
   result.aliases[key]=[...new Set([...defaults.aliases[key],...list])];
  }
  for(const [key,list] of Object.entries(result.aliases))for(const label of list){const n=norm(label);if(owners.has(n)&&owners.get(n)!==key)throw Error('Cấu hình trùng tên cho hai chức năng.');owners.set(n,key);}
  return {...result,revision:value.revision,minVersion:value.minVersion,latestVersion:value.latestVersion};
 }
 function use(value){current=value?validate(value):defaults;}
 function canonical(label){const n=norm(label);return Object.keys(current.aliases).find(k=>current.aliases[k].some(v=>norm(v)===n))||String(label).trim();}
 return {validate,use,canonical,compare,defaults,get current(){return current;},matches:(label,key)=>canonical(label)===key};
})();
if(typeof module!=='undefined')module.exports=SkstRecognition;
