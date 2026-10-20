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
  function parse(text, store) {
    if (!storeNames[store]) throw Error('Shop trả chậm không hợp lệ.');
    const lines = String(text).split(/\r?\n/).map(x=>x.trim()).filter(Boolean).flatMap(line=>{
      const cells=line.split('\t');
      return cells.length>=4 && /[A-Za-zÀ-ỹĐđ]/.test(cells[0]) && cells.slice(1).every(c=>/^-?[\d,.]+$/.test(c))
        ? [cells[0],cells.slice(1).join('\t')] : [line];
    });
    const hi = lines.findIndex(x=>normalize(x)==='nhan vien');
    if (hi<0) throw Error('Chưa có bảng nhân viên trả chậm.');
    const context = lines.slice(0,hi).join('\n');
    const matches = Object.values(storeNames).filter(s=>context.includes(s));
    if (matches.length!==1 || matches[0]!==storeNames[store]) throw Error('Bảng trả chậm không đúng shop '+store+'.');
    const month = lines.find(x=>/^(0?[1-9]|1[0-2])\/20\d{2}$/.test(x));
    if (!month) throw Error('Thiếu tháng trả chậm.');
    const footer = lines.findIndex((x,i)=>i>hi&&/\d+\s*[-–]\s*\d+\s*\/\s*Tổng\s+\d+\s+dòng/i.test(x));
    if (footer<0) throw Error('Không xác minh được tổng số dòng trả chậm.');
    const count = lines[footer].match(/(\d+)\s*[-–]\s*(\d+)\s*\/\s*Tổng\s+(\d+)\s+dòng/i).slice(1).map(Number);
    if (count[0]!==1 || count[1]!==count[2] || !count[2]) throw Error('Bảng trả chậm chưa đủ một trang; chưa nhập.');
    const firstData = lines.findIndex((x,i)=>i>hi&&i<footer&&/^[-\d,.]+(?:\t[-\d,.]+){2,}$/.test(x));
    if (firstData<0) throw Error('Bảng trả chậm chưa có số liệu.');
    const header = lines.slice(hi+1,firstData-1).join('\t');
    const parts = header.split(/\t+/).map(x=>x.trim()).filter(Boolean);
    const order = [];
    for (const part of parts) {
      const n=normalize(part);
      if (/^(dt tra gop|dt sieu thi|ty trong tra cham)/.test(n) || n==='dt' || n==='%') continue;
      const index=aliases.findIndex(a=>n.includes(a));
      if (index<0 || order.includes(index)) throw Error('Cột đối tác trả chậm đã đổi: '+part);
      order.push(index);
    }
    if (!order.length) throw Error('Không thấy cột đối tác trả chậm.');
    const rows=[], seen=new Set();
    for (let i=firstData-1;i<footer;i+=2) {
      const name=lines[i], cells=(lines[i+1]||'').split('\t');
      if (!/[A-Za-zÀ-ỹĐđ]/.test(name) || cells.length!==3+2*order.length) throw Error('Thiếu hoặc lệch cột trả chậm: '+name);
      const key=normalize(name);
      if (seen.has(key)) throw Error('Trùng nhân viên trong một shop: '+name);
      seen.add(key);
      const values=cells.map(number), partner=Array(sources.length).fill(0);
      order.forEach((source,j)=>partner[source]=values[3+2*j]);
      rows.push({name,credit:values[0],revenue:values[1],partner});
    }
    if (rows.length!==count[2]) throw Error('Thiếu dòng trả chậm shop '+store+'.');
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
  return {parse,combine,normalize,storeNames};
})();
if (typeof module!=='undefined') module.exports=SkstInstallment;
