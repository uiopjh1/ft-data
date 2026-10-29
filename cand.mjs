import fs from 'fs';
const UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';
const T=JSON.parse(fs.readFileSync('cand_urls.json','utf8'));
const out={};
const abs=(b,u)=>{try{return new URL(u,b).href}catch{return null}};
for (const [k,u] of Object.entries(T)) {
  try{
    const r=await fetch(u,{headers:{'user-agent':UA},signal:AbortSignal.timeout(20000)});
    const h=await r.text();
    const set=[];
    const og=(h.match(/property=["']og:image["'][^>]*content=["']([^"']+)/i)||h.match(/content=["']([^"']+)["'][^>]*property=["']og:image/i)||[])[1];
    if(og) set.push(abs(u,og));
    const sn=k.split('_').pop().toLowerCase();
    for(const m of h.matchAll(/<img[^>]+>/gi)){ const t=m[0]; const s=(t.match(/(?:data-src|src)=["']([^"']+)/i)||[])[1]; if(s&&!/logo|icon|sprite|svg|avatar|badge/i.test(s)&&(new RegExp(sn,'i').test(t)||/president|presidente|chairman/i.test(t))) set.push(abs(u,s)); }
    const uniq=[...new Set(set.filter(Boolean))].slice(0,4);
    out[k]={status:r.status,imgs:[]};
    let i=0;
    for(const s of uniq){ try{ const ir=await fetch(s,{headers:{'user-agent':UA},signal:AbortSignal.timeout(20000)}); const ct=ir.headers.get('content-type')||''; if(!ir.ok||!ct.startsWith('image/')||/svg/.test(ct)) continue; const buf=Buffer.from(await ir.arrayBuffer()); if(buf.length>3e6||buf.length<5000) continue; const ext=ct.includes('png')?'png':ct.includes('webp')?'webp':'jpg'; const f=`cand/${k}_${i++}.${ext}`; fs.writeFileSync(f,buf); out[k].imgs.push({f,src:s,bytes:buf.length}); }catch{} }
  }catch(e){ out[k]={err:String(e)}; }
}
fs.writeFileSync('cand_out.json',JSON.stringify(out,null,1));
