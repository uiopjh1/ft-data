import fs from 'fs';
const UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';
const T=JSON.parse(fs.readFileSync('cand_urls.json','utf8'));
fs.mkdirSync('cand',{recursive:true});
const out={};
for (const [k,u] of Object.entries(T)) {
  try{
    const ir=await fetch(u,{headers:{'user-agent':UA},signal:AbortSignal.timeout(25000)});
    const ct=ir.headers.get('content-type')||'';
    const buf=Buffer.from(await ir.arrayBuffer());
    const ext=ct.includes('png')?'png':ct.includes('webp')?'webp':'jpg';
    const f=`cand/${k}.${ext}`; fs.writeFileSync(f,buf);
    out[k]={status:ir.status,ct,bytes:buf.length,f};
  }catch(e){ out[k]={err:String(e)}; }
}
fs.writeFileSync('cand_out.json',JSON.stringify(out,null,1));
