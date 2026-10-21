// Adapt BI's per-shop drilldowns to the existing combined clipboard parser.
// No Firebase access here. Both shops must be complete before anything is sent.
const SkstInstallment = (() => {
  const normalize = s => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().replace(/\s+/g, ' ').trim();
  const sources = ['Payoo', 'HomeCredit(HC)', 'Kim Ngân Pay', 'Trả góp KREDIVO', 'FECredit(FE)', 'Thẻ tín dụng - SMARTPOS', 'Samsung Finance +'];
  const aliases = ['payoo', 'homecredit', 'kim ngan pay', 'kredivo', 'fecredit', 'smartpos', 'samsung finance'];
  const storeNames = {'933':'TGD_DNA_HCH', '10341':'AAR_DNA_HCH'};
  function number(s) {
    s = String(s).trim();
    if (!/^-?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/.test(s)) throw Error('Số liệu trả chậm không hợp lệ: ' + s);
    const n = Number(s.replace(/,/g, ''));
    if (!Number.isFinite(n)) throw Error('Số liệu trả chậm không hợp lệ.');
    return n;
  }
  const core=['DT trả góp (triệu)','DT siêu thị (triệu)','Tỷ trọng trả chậm %'];
  const canonical=s=>typeof SkstRecognition!=='undefined'?SkstRecognition.canonical(s):String(s).trim();
  function column(s){
    s=canonical(s);const n=normalize(s);
    const c=core.findIndex(k=>normalize(k)===n);if(c>=0)return {kind:'core',index:c};
    const matches=sources.map((a,i)=>normalize(a)===n||aliases[i]===n?i:-1).filter(i=>i>=0);
    return matches.length===1?{kind:'partner',index:matches[0]}:null;
  }
  function linesOf(text){
    return String(text).split(/\r?\n/).map(x=>x.trim()).filter(Boolean).flatMap(line=>{
      const cells=line.split('\t');
      if(cells.length>=4&&/[A-Za-zÀ-ỹĐđ]/.test(cells[0])&&cells.slice(1).every(c=>/^-?[\d,.]+$/.test(c)))return [cells[0],cells.slice(1).join('\t')];
      if(cells.length>1&&['Vùng','Khu vực','Siêu thị','Nhân viên'].includes(canonical(cells[0]))&&column(cells[1]))return [cells[0],cells.slice(1).join('\t')];
      return [line];
    });
  }
  function heading(text){
    const lines=linesOf(text);
    const index=lines.findIndex((x,i)=>['Vùng','Khu vực','Siêu thị','Nhân viên'].includes(canonical(x))&&column((lines[i+1]||'').split('\t')[0]));
    return {level:index<0?'':canonical(lines[index]),index,lines};
  }
  function parse(text, store) {
    if (!storeNames[store]) throw Error('Shop trả chậm không hợp lệ.');
    const {lines,index:hi,level}=heading(text);
    if(hi<0||level!=='Nhân viên')throw Error('Chưa có bảng nhân viên trả chậm.');
    const context=lines.slice(0,hi).join('\n');
    const matches=Object.values(storeNames).filter(s=>context.includes(s));
    if(matches.length!==1||matches[0]!==storeNames[store])throw Error('Bảng trả chậm không đúng shop '+store+'.');
    const months=[...new Set(lines.filter(x=>/^(0?[1-9]|1[0-2])\/20\d{2}$/.test(x)).map(x=>x.padStart(7,'0')))];
    if(months.length!==1)throw Error('Thiếu tháng trả chậm hoặc có nhiều tháng khác nhau.');
    const month=months[0];
    const footer=lines.findIndex((x,i)=>i>hi&&/\d+\s*[-–]\s*\d+\s*\/\s*Tổng\s+\d+\s+dòng/i.test(x));
    if(footer<0)throw Error('Không xác minh được tổng số dòng trả chậm.');
    const count=lines[footer].match(/(\d+)\s*[-–]\s*(\d+)\s*\/\s*Tổng\s+(\d+)\s+dòng/i).slice(1).map(Number);
    if(count[0]!==1||count[1]!==count[2]||!count[2])throw Error('Bảng trả chậm chưa đủ một trang; chưa nhập.');
    const firstData=lines.findIndex((x,i)=>i>hi&&i<footer&&/^[-\d,.]+(?:\t[-\d,.]+){2,}$/.test(x));
    if(firstData<0)throw Error('Bảng trả chậm chưa có số liệu.');
    const parts=lines.slice(hi+1,firstData-1).join('\t').split(/\t+/).map(x=>x.trim()).filter(Boolean);
    const columns=[],seenColumns=new Set(),sub=[];
    for(const part of parts){
      if(['dt','%'].includes(normalize(part))){sub.push(normalize(part));continue;}
      if(sub.length)throw Error('Cấu trúc tiêu đề trả chậm đã đổi.');
      const c=column(part);
      if(!c)throw Error('Cột đối tác trả chậm đã đổi: '+part);
      const key=c.kind+c.index;if(seenColumns.has(key))throw Error('Trùng cột trả chậm: '+part);seenColumns.add(key);
      columns.push(c);
    }
    if(!core.every((_,i)=>seenColumns.has('core'+i)))throw Error('Thiếu cột doanh thu hoặc tỷ trọng trả chậm.');
    const partners=columns.filter(c=>c.kind==='partner');
    if(!partners.length)throw Error('Không thấy cột đối tác trả chậm.');
    if(sub.length!==partners.length*2)throw Error('Thiếu cột con DT / % của đối tác trả chậm.');
    let offset=0,pair=0;
    for(const c of columns){c.offset=offset;if(c.kind==='partner'){
      const labels=sub.slice(pair*2,pair*2+2);if(!labels.includes('dt')||!labels.includes('%'))throw Error('Lệch cột con DT / % trả chậm.');
      c.amountOffset=offset+labels.indexOf('dt');offset+=2;pair++;
    }else offset++;}
    const rows=[],seen=new Set();
    for(let i=firstData-1;i<footer;i+=2){
      const name=lines[i],cells=(lines[i+1]||'').split('\t');
      if(!/[A-Za-zÀ-ỹĐđ]/.test(name)||cells.length!==offset)throw Error('Thiếu hoặc lệch cột trả chậm: '+name);
      const key=normalize(name);if(seen.has(key))throw Error('Trùng nhân viên trong một shop: '+name);seen.add(key);
      const values=cells.map(number),partner=Array(sources.length).fill(0),base=[];
      for(const c of columns)if(c.kind==='core')base[c.index]=values[c.offset];else partner[c.index]=values[c.amountOffset];
      if(Math.abs(partner.reduce((a,b)=>a+b,0)-base[0])>0.02*(partners.length+1))throw Error('Tổng doanh thu đối tác không khớp DT trả góp: '+name);
      rows.push({name,credit:base[0],revenue:base[1],partner});
    }
    if(rows.length!==count[2])throw Error('Thiếu dòng trả chậm shop '+store+'.');
    return {store,month,rows};
  }
  function combine(captures) {
    if (captures.length!==2 || new Set(captures.map(c=>c.store)).size!==2 || !['933','10341'].every(s=>captures.some(c=>c.store===s))) throw Error('Chưa đủ trả chậm hai shop.');
    if (captures[0].month!==captures[1].month) throw Error('Hai shop khác tháng trả chậm.');
    const map=new Map();
    for (const capture of captures) for (const row of capture.rows) {
      const key=normalize(row.name);
      if (!map.has(key)) map.set(key,{name:row.name,credit:0,revenue:0,partner:Array(sources.length).fill(0)});
      const total=map.get(key);total.credit+=row.credit;total.revenue+=row.revenue;
      row.partner.forEach((v,i)=>total.partner[i]+=v);
    }
    const fmt=n=>n.toFixed(8);
    const percentage=(n,d)=>d?n/d*100:0;
    const lines=[captures[0].month,'Báo cáo trả chậm','Tỷ trọng trả góp','Lũy kế','Nhân viên','DT trả góp (triệu)','DT siêu thị (triệu)\tTỷ trọng trả chậm %\t'+sources.join('\t'),sources.map(()=>'DT\t%').join('\t')];
    for (const row of map.values()) {
      const cells=[row.credit,row.revenue,percentage(row.credit,row.revenue)];
      row.partner.forEach(v=>cells.push(v,percentage(v,row.credit)));
      // One line per employee for the site's existing clipboard parser.
      lines.push(row.name+'\t'+cells.map(fmt).join('\t'));
    }
    lines.push('1-'+map.size+' / Tổng '+map.size+' dòng');
    return lines.join('\n');
  }
  return {parse,combine,normalize,storeNames,heading};
})();
if (typeof module!=='undefined') module.exports=SkstInstallment;
